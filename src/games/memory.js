import { loadImage } from './puzzle/image.js';

const LIST_URL = './data/characterList.VI.json';
const SKILL_BASE = './assets/Skills/';

const TIME_LIMIT = 15;
const BASE_SCORE = 320;
const BONUS_PER_SEC = 30;

let cachedCharacters = null;
const iconCache = new Map();
let runStart = null;

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function normalizeText(str) {
  return String(str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function collectIconIds(char) {
  const ids = [];
  const skill = char?.skill || {};
  // loại bỏ normal vì không sài được
  ['elemental', 'burst'].forEach((key) => {
    if (skill[key]) ids.push(skill[key]);
  });
  if (Array.isArray(char?.talent)) ids.push(...char.talent);
  if (Array.isArray(char?.cons)) ids.push(...char.cons);
  return Array.from(new Set(ids.map((x) => String(x || '').trim()).filter(Boolean)));
}

async function loadCharacters() {
  if (cachedCharacters) return cachedCharacters;

  const res = await fetch(LIST_URL, { cache: 'no-store' });
  if (!res.ok) throw new Error('Không tải được danh sách nhân vật.');

  const data = await res.json();
  // Build per-icon list but apply filters here (do not change JSON)
  const allowedPrefix = /^(Skill_S_|Skill_E_|UI_Talent_S_)/;
  const raw = (Array.isArray(data) ? data : []);
  const items = [];

  for (const c of raw) {
    const name = c?.name || '';
    if (!name) continue;
    const ids = collectIconIds(c).filter((id) => {
      if (!id) return false;
      if (/_U_/.test(id)) return false; // exclude unwanted constellation UI_U_ entries
      return allowedPrefix.test(id);
    });
    for (const id of ids) {
      items.push({ name, iconId: id });
    }
  }

  // Deduplicate by iconId
  const map = new Map();
  for (const it of items) {
    if (!map.has(it.iconId)) map.set(it.iconId, it);
  }
  const list = Array.from(map.values());

  if (!list.length) throw new Error('Danh sách icon trống.');

  cachedCharacters = list;
  return cachedCharacters;
}

async function iconExists(url) {
  if (iconCache.has(url)) return iconCache.get(url);
  try {
    await loadImage(url);
    iconCache.set(url, true);
    return true;
  } catch {
    iconCache.set(url, false);
    return false;
  }
}

function buildTargets(name) {
  const full = normalizeText(name);
  const parts = full.split(/[^a-z0-9]+/).filter(Boolean);
  const set = new Set([full]);

  if (parts.length) set.add(parts[parts.length - 1]);
  if (parts.length >= 2) set.add(parts.slice(-2).join(''));

  return Array.from(set).filter(Boolean);
}

function matchesAnswer(typed, targets) {
  if (!typed || typed.length < 3) return false;
  return targets.some((t) => typed === t || typed.endsWith(t) || t.endsWith(typed));
}

async function pickRoundData(usedIconIds) {
  const list = await loadCharacters();
  const available = list.filter((c) => !usedIconIds.has(c.iconId));
  if (!available.length) throw new Error('Đã hỏi hết icon.');

  const shuffled = shuffle(available);

  for (const item of shuffled) {
    const url = `${SKILL_BASE}${item.iconId}.png`;
    if (await iconExists(url)) {
      return {
        name: item.name,
        iconId: item.iconId,
        icons: [url],
        targets: buildTargets(item.name),
      };
    }
  }

  throw new Error('Không tìm được icon hợp lệ.');
}

function renderFillBox(el, typedText) {
  if (!el) return;
  const clean = String(typedText || '').replace(/\s+/g, '').toUpperCase();
  const chars = clean ? Array.from(clean) : [];
  const underscores = chars.map(() => '_');

  const cell = (content) => `<span class="waifu-fill__cell">${content}</span>`;

  if (!chars.length) {
    el.innerHTML = '<div class="waifu-fill__row waifu-fill__typed"><span class="muted tiny">Gõ để bắt đầu...</span></div>';
    return;
  }

  el.innerHTML = `
    <div class="waifu-fill__row waifu-fill__typed">${chars.map(cell).join('')}</div>
    <div class="waifu-fill__row waifu-fill__underscores">${underscores.map(cell).join('')}</div>
  `;
}

export function setupMemoryGame({ startButton, gridEl, movesEl, timeEl, onScore, onComplete }) {
  let running = false;
  let round = 0;
  let totalRounds = 0;
  let score = 0;
  let timeLeft = TIME_LIMIT;
  let timerId = null;
  let roundActive = false;
  let current = null;
  let typed = '';
  let keyHandler = null;
  let inputEl = null;
  let fillEl = null;
  let focusHandler = null;
  let usedIconIds = new Set();

  function stopTimer() {
    if (timerId) {
      clearInterval(timerId);
      timerId = null;
    }
  }

  function updateHud() {
    const total = totalRounds || '∞';
    const currentRound = totalRounds ? Math.min(round, totalRounds) : round;
    movesEl.textContent = `${currentRound}/${total}`;
    timeEl.textContent = String(Math.max(0, timeLeft));
  }

  function finishGame({ reason = 'completed' } = {}) {
    running = false;
    roundActive = false;
    stopTimer();
    startButton.disabled = false;
    startButton.textContent = 'Chơi lại';
    const totalLabel = totalRounds || round;
    const msg = reason === 'giveup' 
      ? `Đã bỏ cuộc sau ${round} màn. Tổng điểm: <b>${score}</b>.`
      : `Đã hỏi hết ${totalLabel} nhân vật. Tổng điểm: <b>${score}</b>.`;
      gridEl.innerHTML = `<div class="waifu-finish">${msg}</div>`;
    timeLeft = 0;
    updateHud();
    onScore(score);
    const durationMs = runStart ? Math.max(0, Math.round(performance.now() - runStart)) : null;
    if (onComplete) onComplete({ score, durationMs });
  }

  function handleError(err) {
    running = false;
    roundActive = false;
    stopTimer();
    detachKeys();
    startButton.disabled = false;
    startButton.textContent = 'Bắt đầu';
    gridEl.innerHTML = `<div class="muted">${String(err?.message || err || 'Có lỗi xảy ra')}</div>`;
    onScore(0);
  }

  function detachKeys() {
    if (inputEl && keyHandler) {
      inputEl.removeEventListener('input', keyHandler);
    }
    if (fillEl && focusHandler) {
      fillEl.removeEventListener('click', focusHandler);
      fillEl.removeEventListener('keydown', focusHandler);
    }
    keyHandler = null;
    inputEl = null;
    fillEl = null;
    focusHandler = null;
  }

  function endRound({ correct }) {
    if (!roundActive) return;
    roundActive = false;
    stopTimer();
    detachKeys();

    const progressEl = gridEl.querySelector('#waifu-fill');
    const statusEl = gridEl.querySelector('#waifu-status');

    if (progressEl) {
      progressEl.innerHTML = `<div class="waifu-fill__row"><b>${current?.name || '??'}</b></div>`;
    }

    if (correct) {
      const gained = BASE_SCORE + Math.max(0, timeLeft) * BONUS_PER_SEC;
      score += gained;
      if (statusEl) statusEl.textContent = `Chuẩn! +${gained} điểm. Qua màn tiếp theo…`;
    } else if (statusEl) {
      statusEl.textContent = `Hết giờ. Đáp án: ${current?.name || '??'}`;
    }

    onScore(score);

    setTimeout(() => {
      if (correct) {
        if (totalRounds && round >= totalRounds) {
          finishGame();
        } else {
          playRound().catch(handleError);
        }
      } else {
        finishGame({ reason: 'timeout' });
      }
    }, 700);
  }

  async function playRound() {
    try {
      const list = await loadCharacters();
      totalRounds = list.length || totalRounds;
    } catch (err) {
      handleError(err);
      return;
    }

    round += 1;
    timeLeft = TIME_LIMIT;
    updateHud();

    try {
      current = await pickRoundData(usedIconIds);
    } catch (err) {
      const msg = String(err?.message || '');
      if (msg.includes('Đã hỏi hết nhân vật')) {
        finishGame();
        return;
      }
      throw err;
    }
    usedIconIds.add(current.iconId || current.name);

    gridEl.innerHTML = `
      <div class="waifu-icons">
        ${current.icons
          .map((src) => `<div class="waifu-icon"><img src="${src}" alt="Gợi ý icon" loading="lazy" /></div>`)
          .join('')}
      </div>
      <div class="waifu-type" id="waifu-type" aria-label="Nhấn để nhập tên">
        <div class="waifu-type__label">Bấm vào ô để gõ tên nhân vật</div>
        <div class="waifu-fill" id="waifu-fill" role="textbox" tabindex="0" aria-live="polite"></div>
        <input id="waifu-answer" autocomplete="off" spellcheck="false" class="waifu-type__hidden-input" aria-hidden="true" />
      </div>
      <div class="waifu-status tiny muted" id="waifu-status">Gõ đúng sẽ tự qua màn tiếp theo.</div>
    `;

    const progressEl = gridEl.querySelector('#waifu-fill');
    inputEl = gridEl.querySelector('#waifu-answer');
    fillEl = progressEl;

    renderFillBox(progressEl, '');

    roundActive = true;
    typed = '';

    focusHandler = () => {
      inputEl?.focus();
      // Keep cursor at end so mobile keyboards behave.
      setTimeout(() => {
        const len = inputEl?.value?.length || 0;
        inputEl?.setSelectionRange(len, len);
      }, 0);
    };

    fillEl?.addEventListener('click', focusHandler);
    fillEl?.addEventListener('keydown', focusHandler);
    focusHandler();

    keyHandler = (e) => {
      if (!roundActive) return;
      const raw = String(inputEl?.value || '').replace(/\s+/g, '');
      inputEl.value = raw; // keep display tight
      const normalized = normalizeText(raw);
      typed = normalized;
      renderFillBox(progressEl, raw);
      if (matchesAnswer(normalized, current.targets)) {
        endRound({ correct: true });
      }
    };

    inputEl?.addEventListener('input', keyHandler);

    stopTimer();
    timerId = setInterval(() => {
      timeLeft -= 1;
      updateHud();
      if (timeLeft <= 0) {
        endRound({ correct: false });
      }
    }, 1000);
  }

  async function start() {
    if (running) return;
    running = true;
    runStart = performance.now();
    round = 0;
    score = 0;
    timeLeft = TIME_LIMIT;
    usedCharNames.clear();
    onScore(0);
    updateHud();

    startButton.disabled = true;
    startButton.textContent = 'Đang chạy…';
    gridEl.innerHTML = '<div class="muted">Đang chuẩn bị câu hỏi…</div>';

    try {
      await playRound();
    } catch (err) {
      handleError(err);
    }
  }

  startButton.addEventListener('click', start);

  gridEl.innerHTML = '<div class="muted">Bấm Bắt đầu để xem câu hỏi</div>';
  timeLeft = 0;
  updateHud();
  onScore(0);
  
  return {
    isRunning: () => running,
    giveUp: () => {
      if (running) {
        finishGame({ reason: 'giveup' });
      }
    },
  };
}
