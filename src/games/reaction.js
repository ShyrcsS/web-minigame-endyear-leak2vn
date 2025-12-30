import { computeBlurPx, loadImage, loadWeaponList, shuffle } from './weaponGuess/shared.js';

export function setupReactionGame({ startButton, box, onScore, onComplete }) {
  const TOTAL_TIME = 10;

  let running = false;
  let timerId = null;
  let timeLeft = TOTAL_TIME;
  let current = null;
  let totalScore = 0;
  let questionIdx = 0;
  let usedIconsForQuestion = new Set();
  let questionAnswered = false;
  let allWeapons = [];
  let loadedImages = new Map(); // Cache for loaded images
  let startTime = null;

  function clearTimer() {
    if (timerId) {
      clearInterval(timerId);
      timerId = null;
    }
  }

  function setBoxHtml(html) {
    box.innerHTML = html;
  }

  function setStartDisabled(disabled) {
    startButton.disabled = disabled;
  }

  function endRun({ ok, reason }) {
    if (!running) return;
    running = false;
    clearTimer();
    setStartDisabled(false);
    startButton.textContent = 'Chơi lại';

    const statusEl = box.querySelector('#wg-status');
    const imgEl = box.querySelector('#wg-img');

    if (imgEl) imgEl.style.filter = 'blur(0px)';
    if (statusEl) {
      statusEl.textContent = ok
        ? 'Hoàn thành lượt!'
        : reason === 'giveup'
          ? 'Đã bỏ cuộc.'
          : reason === 'timeout'
            ? 'Hết giờ lượt này.'
            : 'Sai đáp án.';
    }

    const durationMs = startTime ? Math.max(0, Math.round(performance.now() - startTime)) : null;
    if (onComplete) onComplete({ score: totalScore, durationMs, completed: questionIdx });
  }

  async function handleAnswer(ok, reason) {
    if (!running) return;
    if (questionAnswered) return;
    questionAnswered = true;

    if (!ok) {
      endRun({ ok: false, reason });
      return;
    }

    // Correct
    const delta = 500 + timeLeft * 50;
    totalScore += delta;
    onScore(totalScore);

    // Check if we've asked all weapons
    if (usedIconsForQuestion.size >= allWeapons.length) {
      endRun({ ok: true, reason: 'completed' });
      return;
    }

    clearTimer();
    const statusEl = box.querySelector('#wg-status');
    if (statusEl) statusEl.textContent = 'Đúng! Chuẩn bị câu tiếp theo…';

    setTimeout(async () => {
      if (!running) return;
      try {
        await startNextQuestion();
      } catch (err) {
        endRun({ ok: false, reason: err?.message || 'Lỗi' });
      }
    }, 400);
  }

  function renderRound() {
    const options = current.options;
    const correct = current.correct;
    const blurPx = computeBlurPx(timeLeft, TOTAL_TIME);

    // Mark this weapon icon as used
    usedIconsForQuestion.add(String(correct.icon || '').trim());

    setBoxHtml(`
      <div class="weapon-guess">
        <div class="weapon-guess__top">
          <div class="pill">Câu: <span id="wg-idx">${questionIdx}</span>/${allWeapons.length}</div>
          <div class="pill">Thời gian: <span id="wg-timer">${timeLeft}</span>s</div>
          <div class="weapon-guess__status muted tiny" id="wg-status">Chọn đáp án (4 lựa chọn)</div>
        </div>
        <img id="wg-img" class="weapon-guess__img" alt="Weapon icon" src="${current.imgSrc}" style="filter: blur(${blurPx}px);" />
        <div class="weapon-guess__options" id="wg-options"></div>
      </div>
    `);

    const optsEl = box.querySelector('#wg-options');
    const timerEl = box.querySelector('#wg-timer');
    const imgEl = box.querySelector('#wg-img');

    options.forEach((w) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn choice';
      btn.textContent = w.name;
      btn.addEventListener('click', () => {
        const ok = String(w.icon || '').trim() === String(correct.icon || '').trim();
        handleAnswer(ok, ok ? 'ok' : 'wrong');
      });
      optsEl.appendChild(btn);
    });

    clearTimer();
    timerId = setInterval(() => {
      timeLeft -= 1;
      if (timerEl) timerEl.textContent = String(timeLeft);
      if (imgEl) imgEl.style.filter = `blur(${computeBlurPx(timeLeft, TOTAL_TIME)}px)`;

      if (timeLeft <= 0) {
        handleAnswer(false, 'timeout');
      }
    }, 1000);
  }

  async function buildRound() {
    // Filter weapons that haven't been used as the correct answer yet
    const available = allWeapons.filter((w) => !usedIconsForQuestion.has(String(w.icon || '').trim()));
    if (!available.length) throw new Error('Đã hỏi hết vũ khí.');

    // Pick one unused weapon as correct answer
    const correctWeapon = available[Math.floor(Math.random() * available.length)];

    // Load image for correct weapon if not already loaded
    if (!loadedImages.has(correctWeapon.imgUrl)) {
      try {
        await loadImage(correctWeapon.imgUrl);
        loadedImages.set(correctWeapon.imgUrl, true);
      } catch (err) {
        throw new Error(`Không thể tải ảnh vũ khí: ${correctWeapon.name}`);
      }
    }

    // Pick 3 other weapons (can reuse names/icons for wrong answers)
    const wrongCandidates = shuffle(allWeapons.filter((w) => String(w.icon || '').trim() !== String(correctWeapon.icon || '').trim())).slice(0, 3);
    const options = shuffle([correctWeapon, ...wrongCandidates].map((w) => ({ name: w.name, icon: String(w.icon || '').trim() })));

    return {
      correct: { name: correctWeapon.name, icon: String(correctWeapon.icon || '').trim() },
      options,
      imgSrc: correctWeapon.imgUrl,
    };
  }

  async function startNextQuestion() {
    questionIdx += 1;
    questionAnswered = false;
    timeLeft = TOTAL_TIME;
    current = await buildRound();
    renderRound();
  }

  async function start() {
    if (running) return;
    startTime = performance.now();
    running = true;
    clearTimer();
    timeLeft = TOTAL_TIME;
    questionIdx = 0;
    totalScore = 0;
    usedIconsForQuestion.clear();
    loadedImages.clear();
    onScore(totalScore);
    setStartDisabled(true);
    startButton.textContent = 'Đang chạy…';

    setBoxHtml('<div class="muted">Đang tải danh sách vũ khí…</div>');

    try {
      // Load weapon list without preloading images
      if (!allWeapons.length) {
        const list = await loadWeaponList();
        const base = new URL('../../assets/Weapon/', import.meta.url);
        const loaded = [];
        const seenIcon = new Set();

        for (const w of list) {
          if (seenIcon.has(w.icon)) continue;
          const imgName = `${w.icon}_Awaken.png`;
          const imgUrl = new URL(imgName, base).toString();
          loaded.push({ name: w.name, icon: w.icon, imgUrl });
          seenIcon.add(w.icon);
        }

        if (loaded.length < 4) throw new Error('Lỗi, không đủ 4 asset vũ khí.');
        allWeapons = loaded;
      }

      await startNextQuestion();
    } catch (err) {
      running = false;
      clearTimer();
      setStartDisabled(false);
      startButton.textContent = 'Bắt đầu';
      setBoxHtml(`<div class="muted">${String(err?.message || err || 'Có lỗi')}</div>`);
      onScore(0);
    }
  }

  startButton.addEventListener('click', start);
  
  return {
    isRunning: () => running,
    giveUp: () => {
      if (running) {
        endRun({ ok: false, reason: 'giveup' });
      }
    },
  };
}
