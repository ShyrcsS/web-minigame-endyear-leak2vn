import { loadProgress, saveProgress, clearProgress, loadState, saveState, computeBonusFromRank } from './storage.js';
import { uploadScreenshot, submitWheelParticipation } from './api.js';
import { setupReactionGame } from './games/reaction.js';
import { setupTapGame } from './games/tap.js';
import { setupMemoryGame } from './games/memory.js';
import { hide, normalizeFacebookUrl, show } from './dom.js';
import { createQuizFlow } from './flows/quizFlow.js';
import { createGaFlow } from './flows/gaFlow.js';
import { createIntakeFlow } from './flows/intakeFlow.js';

const API_BASE = 'https://api.gileak2vn.shyrcs.com';

const TURNSTILE_SITEKEY = '0x4AAAAAACJHkhQ69hr_Eg6b';

let sessionToken = '';

async function fetchLeaderboardData(uid) {
  if (!API_BASE) throw new Error('Missing API base URL');
  const url = new URL(`${API_BASE}/leaderboard`);
  if (uid) url.searchParams.set('uid', uid);
  const resp = await fetch(url.toString());
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(text || `${resp.status}`);
  }
  return await resp.json();
}

async function fetchSessionToken() {
  if (sessionToken) return sessionToken;
  const resp = await fetch(`${API_BASE}/session-token`, { method: 'POST' });
  if (!resp.ok) throw new Error(`Session token failed: ${resp.status}`);
  const data = await resp.json();
  sessionToken = data?.token || '';
  if (!sessionToken) throw new Error('Session token missing');
  return sessionToken;
}

function ensureTurnstileReady() {
  if (!TURNSTILE_SITEKEY || TURNSTILE_SITEKEY === 'your_turnstile_sitekey_here') {
    throw new Error('Missing TURNSTILE_SITEKEY');
  }
  if (!window.turnstile?.render || !window.turnstile?.execute || !window.turnstile?.remove) {
    throw new Error('Turnstile script not loaded');
  }
}

function createHiddenTurnstileContainer() {
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.width = '1px';
  container.style.height = '1px';
  container.style.opacity = '0';
  container.style.pointerEvents = 'none';
  container.style.left = '-9999px';
  container.style.bottom = '0';
  container.setAttribute('aria-hidden', 'true');
  document.body.appendChild(container);
  return container;
}

async function getTurnstileToken() {
  ensureTurnstileReady();

  const container = createHiddenTurnstileContainer();

  return await new Promise((resolve, reject) => {
    let settled = false;

    const cleanup = (widgetId) => {
      if (settled) return;
      settled = true;
      try {
        window.turnstile.remove(widgetId);
      } catch (err) {
        console.warn('[turnstile] remove failed:', err?.message || err);
      }
      container.remove();
    };

    const widgetId = window.turnstile.render(container, {
      sitekey: TURNSTILE_SITEKEY,
      size: 'invisible',
      retry: 'auto',
      callback: (token) => {
        cleanup(widgetId);
        resolve(token);
      },
      'error-callback': () => {
        cleanup(widgetId);
        reject(new Error('Turnstile error'));
      },
      'expired-callback': () => {
        cleanup(widgetId);
        reject(new Error('Turnstile expired'));
      },
      'timeout-callback': () => {
        cleanup(widgetId);
        reject(new Error('Turnstile timeout'));
      },
    });

    try {
      window.turnstile.execute(widgetId, { action: 'submit' });
    } catch (err) {
      cleanup(widgetId);
      reject(err);
      return;
    }

    setTimeout(() => {
      cleanup(widgetId);
      reject(new Error('Turnstile timeout'));
    }, 12000);
  });
}

const els = {
  stepIntake: document.getElementById('step-intake'),
  stepQuiz: document.getElementById('step-quiz'),
  stepGa: document.getElementById('step-ga'),

  intakeForm: document.getElementById('intake-form'),
  uid: document.getElementById('uid'),
  ingameName: document.getElementById('ingameName'),
  fbLink: document.getElementById('fbLink'),
  screenshot: document.getElementById('screenshot'),
  screenshotPreview: document.getElementById('screenshot-preview'),
  btnReset: document.getElementById('btn-reset'),

  qIdx: document.getElementById('q-idx'),
  qTimer: document.getElementById('q-timer'),
  qScore: document.getElementById('q-score'),
  qText: document.getElementById('q-text'),
  qChoices: document.getElementById('q-choices'),
  btnSkip: document.getElementById('btn-skip'),
  quizDone: document.getElementById('quiz-done'),
  quizBox: document.getElementById('quiz-box'),
  quizFinalScore: document.getElementById('quiz-final-score'),
  btnGoGa: document.getElementById('btn-go-ga'),

  gaLobby: document.getElementById('ga-lobby'),
  gaWheel: document.getElementById('ga-wheel'),
  gaWheelInfo: document.getElementById('ga-wheel-info'),
  btnWheelSpin: document.getElementById('btn-wheel-spin'),
  gaTopG1: document.getElementById('ga-top-g1'),
  gaTopG2: document.getElementById('ga-top-g2'),
  gaTopG3: document.getElementById('ga-top-g3'),
  gaSelfRow: document.getElementById('ga-self-row'),
  gaPlay: document.getElementById('ga-play'),
  btnGaG1: document.getElementById('btn-ga-g1'),
  btnGaG2: document.getElementById('btn-ga-g2'),
  btnGaG3: document.getElementById('btn-ga-g3'),
};

function makeSession() {
  return {
    uid: '',
    ingameName: '',
    fbLink: '',
    imageKey: '',
    loreScore: 0,
    quiz: null,
    quizIndex: 0,
    quizScore: 0,
    quizTimerId: null,
    timeLeft: 10,
    reactionScore: 0,
    tapScore: 0,
    memoryScore: 0,
    reactionPlayed: false,
    tapPlayed: false,
    memoryPlayed: false,
  };
}

let session = makeSession();

const quizFlow = createQuizFlow({
  els,
  session,
  saveProgress,
});

const intakeFlow = createIntakeFlow({
  els,
  session,
  apiBase: API_BASE,
  uploadScreenshot,
  normalizeFacebookUrl,
  saveProgress,
  startQuiz: () => quizFlow.startQuizFlow(),
});

let gaFlow = null;

async function renderGaLobby() {
  const selfUid = session.uid || loadProgress()?.uid || '';
  let remote = null;

  try {
    remote = await fetchLeaderboardData(selfUid);
  } catch (err) {
    console.warn('[renderGaLobby] Failed to fetch leaderboard:', err?.message || err);
  }

  const topLists = [
    { key: 'g1', el: els.gaTopG1 },
    { key: 'g2', el: els.gaTopG2 },
    { key: 'g3', el: els.gaTopG3 },
  ];

  topLists.forEach(({ key, el }) => {
    if (!el) return;
    el.innerHTML = '';
    const rows = remote?.games?.[key] || [];

    if (!rows.length) {
      const li = document.createElement('li');
      li.textContent = 'Chưa có ai chơi.';
      el.appendChild(li);
      return;
    }

    rows.slice(0, 3).forEach((r, idx) => {
      const li = document.createElement('li');
      li.textContent = `#${idx + 1} · ${r.ingame_name || r.uid} · ${r.best_score} điểm`;
      el.appendChild(li);
    });
  });

  if (selfUid) {
    const selfRows = Array.isArray(remote?.self) ? remote.self : [];
    const bestByGame = new Map();
    selfRows.forEach((r) => {
      bestByGame.set(r.game, r);
    });

    const txt = [
      bestByGame.has('g1') ? `G1: ${bestByGame.get('g1').best_score}` : null,
      bestByGame.has('g2') ? `G2: ${bestByGame.get('g2').best_score}` : null,
      bestByGame.has('g3') ? `G3: ${bestByGame.get('g3').best_score}` : null,
    ]
      .filter(Boolean)
      .join(' • ');

    els.gaSelfRow.textContent = txt || 'Bạn chưa chơi minigame nào.';

    // Calculate and display win rate from remote leaderboard
    let totalBonus = 0;
    ['g1', 'g2', 'g3'].forEach((key) => {
      const list = remote?.games?.[key] || [];
      if (!list.length) return;
      const rank = list.findIndex((p) => p.uid === selfUid) + 1;
      if (rank > 0) {
        const players = list.length;
        totalBonus += computeBonusFromRank({ rank, players });
      }
    });

    const baseRate = 5;
    const winRate = Math.min(100, baseRate + totalBonus);
    const winRateEl = document.getElementById('wheel-win-rate');
    if (winRateEl) {
      winRateEl.textContent = `${winRate.toFixed(1)}%`;
    }
  } else {
    els.gaSelfRow.textContent = 'Chưa có dữ liệu của bạn.';
    const winRateEl = document.getElementById('wheel-win-rate');
    if (winRateEl) {
      winRateEl.textContent = '5%';
    }
  }
}

function buildGaPlayHtml(kind) {
  const blocks = {
    g1: `
      <div class="ga-game" id="game-reaction">
        <h3 class="ga-game__title">Game 1: Nhìn Trấn Đoán Chủ</h3>
        <p class="muted tiny">Nhìn Asset vũ khí và chọn đúng tên trong 10 giây.</p>
        <div class="reaction-box" id="reaction-box" aria-label="Weapon guess box">Bấm “Bắt đầu”</div>
        <div class="row">
          <div class="pill">Điểm game 1: <span id="score-reaction">0</span></div>
          <button id="btn-reaction-start" class="btn" type="button">Bắt đầu</button>
          <button id="btn-reaction-giveup" class="btn btn--small" type="button" disabled>Bỏ cuộc</button>
        </div>
      </div>
    `,
    g2: `
      <div class="ga-game" id="game-tap">
        <h3 class="ga-game__title">Game 2: Xếp Hình</h3>
        <p class="muted tiny">Ghép ảnh nhân vật bằng cách đổi chỗ 2 mảnh. Qua màn tăng độ khó!.</p>
        <div class="tap-box" id="tap-box" role="button" tabindex="0" aria-label="Tap box">BẤM Ở ĐÂY</div>
        <div class="row">
          <div class="pill">Thời gian: <span id="tap-timer">5</span>s</div>
          <div class="pill">Điểm game 2: <span id="score-tap">0</span></div>
          <button id="btn-tap-start" class="btn" type="button">Bắt đầu</button>
          <button id="btn-tap-giveup" class="btn btn--small" type="button" disabled>Bỏ cuộc</button>
        </div>
      </div>
    `,
    g3: `
      <div class="ga-game" id="game-memory">
        <h3 class="ga-game__title">Game 3: Nhìn Hình Đoán Vợ</h3>
        <p class="muted tiny">Nhìn Icon của nhân vật, gõ phím trực tiếp vào box dưới. Đúng sẽ tự qua màn.</p>
        <div class="memory-grid" id="memory-grid" aria-label="Guess waifu box"></div>
        <div class="row">
          <div class="pill">Màn: <span id="mem-moves">0</span>/5</div>
          <div class="pill">Còn: <span id="mem-time">0</span>s</div>
          <div class="pill">Điểm game 3: <span id="score-memory">0</span></div>
          <button id="btn-memory-start" class="btn" type="button">Bắt đầu</button>
          <button id="btn-memory-giveup" class="btn btn--small" type="button" disabled>Bỏ cuộc</button>
        </div>
      </div>
    `,
  };

  const block = blocks[kind] || '';
  return `
    <div class="ga-page">
      <div class="row">
        <button id="btn-ga-back" class="btn" type="button">Về lobby</button>
      </div>

      ${block}

      <div class="card__divider"></div>

      <div id="ga-result" class="hidden" style="display:none;">
        <p>
          Xếp hạng local: <b>#<span id="rank-local">0</span></b> / <span id="players-local">0</span>
          • Bonus win: <b><span id="win-bonus">0</span>%</b>
        </p>
        <p class="muted tiny">Bonus tính theo rule: Top 1/2/3, Top 1%, Top 10% (không cộng dồn, ưu tiên mức cao hơn).</p>
      </div>

      <div class="card__divider"></div>

      <h3 class="card__title">Bảng điểm – Top 5 lần chơi của bạn</h3>
      <div class="row">
        <button id="btn-clear-scores" class="btn" type="button">Xóa Bảng Điểm</button>
      </div>
      <div class="table-wrap">
        <table class="table" aria-label="Leaderboard">
          <thead>
            <tr>
              <th>UID</th>
              <th>Tên minigame</th>
              <th>Điểm</th>
              <th>Thời gian</th>
              <th>Hạng toàn cầu</th>
            </tr>
          </thead>
          <tbody id="leaderboard-body"></tbody>
        </table>
      </div>
    </div>
  `;
}

function collectGaEls(root) {
  return {
    scoreReaction: root.querySelector('#score-reaction'),
    scoreTap: root.querySelector('#score-tap'),
    scoreMemory: root.querySelector('#score-memory'),
    gaResult: root.querySelector('#ga-result'),
    rankLocal: root.querySelector('#rank-local'),
    playersLocal: root.querySelector('#players-local'),
    winBonus: root.querySelector('#win-bonus'),
    leaderboardBody: root.querySelector('#leaderboard-body'),
    btnClearScores: root.querySelector('#btn-clear-scores'),
    btnBack: root.querySelector('#btn-ga-back'),
  };
}

function openGamePage(kind) {
  els.gaPlay.innerHTML = buildGaPlayHtml(kind);
  els.gaPlay.classList.remove('hidden');
  els.gaLobby.classList.add('hidden');

  const gaEls = collectGaEls(els.gaPlay);

  gaFlow = createGaFlow({
    els: gaEls,
    session,
    apiBase: API_BASE,
    setupReactionGame,
    setupTapGame,
    setupMemoryGame,
    onPlayRecorded: () => {
      // Update lobby data after recording a play
      // console.log('[onPlayRecorded] Callback triggered, calling renderGaLobby...');
      renderGaLobby();
    },
    getSessionToken: fetchSessionToken,
    getTurnstileToken,
  });

  gaFlow.setupGames();

  gaEls.btnClearScores?.addEventListener('click', gaFlow.clearLocalScores);
  gaEls.btnBack?.addEventListener('click', () => {
    els.gaPlay.classList.add('hidden');
    els.gaLobby.classList.remove('hidden');
    renderGaLobby();
  });
}

function resetSession() {
  clearProgress();
  session = makeSession();

  els.intakeForm.reset();
  els.screenshotPreview.innerHTML = '';

  hide(els.stepQuiz);
  hide(els.stepGa);
  show(els.stepIntake);

  quizFlow.resetQuizUi();
    if (gaFlow) gaFlow.resetGaUi();
}

function goToGa() {
  show(els.stepGa);
  hide(els.stepIntake);
  hide(els.stepQuiz);
  renderGaLobby();
  els.gaLobby.classList.remove('hidden');
  els.gaPlay.classList.add('hidden');
}

function setupGames() {
  // games are initialized when entering play screen
}

function spinWheel() {
  const state = loadState();
  const selfUid = session.uid || loadProgress()?.uid || '';

  if (!selfUid) {
    alert('Bạn cần hoàn thành Quiz trước.');
    return;
  }

  // Check if already participated
  if (state.wheelParticipated) {
    alert('Bạn đã tham gia vòng quay rồi!');
    return;
  }

  // Mark as participated locally
  const nextState = { ...state, wheelParticipated: true };
  saveState(nextState);

  els.btnWheelSpin.disabled = true;
  els.gaWheel.classList.add('spinning');

  // Fire participation to backend with session + turnstile
  Promise.all([fetchSessionToken(), getTurnstileToken()])
    .then(([sessionToken, turnstileToken]) =>
      submitWheelParticipation({
        apiBase: API_BASE,
        participation: { uid: selfUid, ingameName: session.ingameName || '' },
        sessionToken,
        turnstileToken,
      })
    )
    .catch((err) => {
      console.warn('[spinWheel] Failed to submit participation:', err?.message || err);
    })
    .finally(() => {
      setTimeout(() => {
        els.gaWheel.classList.remove('spinning');
        els.btnWheelSpin.disabled = false;
        els.gaWheelInfo.innerHTML = `
          <p class="muted tiny"><b>Đã ghi nhận tham gia!</b> Chúc bạn may mắn.</p>
        `;
      }, 2000);
    });
}

function wireActions() {
  els.btnReset.addEventListener('click', resetSession);

  intakeFlow.wireFormSubmit();

  els.btnSkip.addEventListener('click', quizFlow.skip);
  els.btnGoGa.addEventListener('click', goToGa);

  if (els.btnWheelSpin) {
    els.btnWheelSpin.addEventListener('click', spinWheel);
  }

  els.btnGaG1.addEventListener('click', () => openGamePage('g1'));
  els.btnGaG2.addEventListener('click', () => openGamePage('g2'));
  els.btnGaG3.addEventListener('click', () => openGamePage('g3'));
}

async function main() {
  intakeFlow.wireScreenshotPreview();
  setupGames();
  wireActions();

  // If the user already completed the quiz on this browser, jump straight to play section.
  const progress = loadProgress();
  if (progress?.quizDone && progress.uid && progress.ingameName && progress.fbLink) {
    session.uid = progress.uid;
    session.ingameName = progress.ingameName;
    session.fbLink = progress.fbLink;
    session.imageKey = progress.imageKey || '';
    session.loreScore = Number(progress.loreScore || 0);

    hide(els.stepIntake);
    hide(els.stepQuiz);
    show(els.stepGa);
    renderGaLobby();
  }
}

main().catch((err) => {
  console.error(err);
  alert('Có lỗi khi khởi chạy. Mở DevTools Console để xem chi tiết.');
});

// Update event date automatically
const eventDateEl = document.getElementById('event-date');
if (eventDateEl) {
  const now = new Date();
  const vnDate = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
  const day = String(vnDate.getDate()).padStart(2, '0');
  const month = String(vnDate.getMonth() + 1).padStart(2, '0');
  const year = vnDate.getFullYear();
  eventDateEl.textContent = `${day}/${month}/${year}`;
}
