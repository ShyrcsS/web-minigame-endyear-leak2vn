function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function solved(cells) {
  for (let i = 0; i < cells.length; i += 1) {
    if (cells[i] !== i) return false;
  }
  return true;
}

function scoreLevel(n, moves, seconds) {
  const base = n * n * 10;
  return Math.max(1, Math.round(base - (moves * 2 + seconds)));
}

export function createTileSwapPuzzle({ box, timerEl, onScore, fetchImage, onComplete }) {
  const MAX_CHARS = 114;
  let running = false;
  let level = 3;
  let cells = [];
  let pick = -1;
  let moves = 0;
  let total = 0;
  let elapsed = 0;
  let tickId = null;
  let bg = '';
  let usedIcons = new Set();
  let charCount = 0;
  let hintTimer = 0;
  let hintInterval = null;
  let runStart = null;
  let tileElements = []; // cache tile elements

  function setStatus(text) {
    box.classList.remove('puzzle-grid');
    box.classList.add('puzzle-box');
    box.innerHTML = '';
    box.textContent = text;
  }

  function stopTick() {
    if (tickId) {
      clearInterval(tickId);
      tickId = null;
    }
  }

  function stopHint() {
    if (hintInterval) {
      clearInterval(hintInterval);
      hintInterval = null;
    }
    hintTimer = 0;
    document.querySelectorAll('.hint-overlay').forEach(el => el.remove());
  }

  function startTick() {
    stopTick();
    stopHint();
    elapsed = 0;
    hintTimer = 0;
    timerEl.textContent = '0';

    tickId = setInterval(() => {
      elapsed += 1;
      timerEl.textContent = String(elapsed);
    }, 1000);

    // Show hint every 15 seconds
    hintInterval = setInterval(() => {
      hintTimer += 15;
      if (hintTimer >= 15) {
        showHint();
      }
    }, 15000);
  }

  function showHint() {
    // Find a tile that is not in correct position
    const wrongTiles = [];
    for (let i = 0; i < cells.length; i++) {
      if (cells[i] !== i) {
        wrongTiles.push({ position: i, correctId: i, currentId: cells[i] });
      }
    }

    if (wrongTiles.length === 0) return; // All correct

    // Pick a random wrong tile
    const hintData = wrongTiles[Math.floor(Math.random() * wrongTiles.length)];

    // Show hint on the tile itself
    const tileEl = tileElements[hintData.position];
    if (!tileEl) return;

    // Create hint overlay
    let hintOverlay = tileEl.querySelector('.hint-overlay');
    if (!hintOverlay) {
      hintOverlay = document.createElement('div');
      hintOverlay.className = 'hint-overlay';
      hintOverlay.style.cssText = `
        position: absolute;
        top: 2px;
        right: 2px;
        background: rgba(0, 0, 0, 0.9);
        color: white;
        padding: 2px 4px;
        border-radius: 3px;
        font-size: 10px;
        font-weight: bold;
        z-index: 10;
        pointer-events: none;
      `;
      tileEl.style.position = 'relative';
      tileEl.appendChild(hintOverlay);
    }

    hintOverlay.textContent = String(cells[hintData.position] + 1);

    // Hide hint after 3 seconds
    setTimeout(() => {
      if (hintOverlay) {
        hintOverlay.remove();
      }
    }, 3000);
  }

  function makeScramble() {
    cells = Array.from({ length: level * level }, (_, i) => i);
    shuffle(cells);
    if (solved(cells)) shuffle(cells);
  }

  function updateSelection() {
    // only update selected class instead of full re-render
    tileElements.forEach((tile, i) => {
      if (i === pick) {
        tile.classList.add('selected');
      } else {
        tile.classList.remove('selected');
      }
    });
  }

  function render() {
    box.classList.add('puzzle-grid');
    box.classList.add('puzzle-box');
    box.innerHTML = '';
    box.style.gridTemplateColumns = `repeat(${level}, 1fr)`;
    tileElements.length = 0; // Clear array instead of reassigning

    // Remove any existing hint overlays
    document.querySelectorAll('.hint-overlay').forEach(el => el.remove());

    for (let i = 0; i < cells.length; i += 1) {
      const id = cells[i];
      const r = Math.floor(id / level);
      const c = id % level;

      const tile = document.createElement('button');
      tile.type = 'button';
      tile.className = 'puzzle-tile';
      if (i === pick) tile.classList.add('selected');

      tile.style.backgroundImage = `url("${bg}")`;
      tile.style.backgroundSize = `${level * 100}% ${level * 100}%`;
      tile.style.backgroundPosition = `${(c * 100) / (level - 1)}% ${(r * 100) / (level - 1)}%`;

      tile.addEventListener('click', () => click(i));
      box.appendChild(tile);
      tileElements.push(tile);
    }
  }

  function finishLevel() {
    stopTick();
    total += scoreLevel(level, moves, elapsed);
    onScore(total);
    nextLevel();
  }

  function click(i) {
    if (!running) return;

    if (pick === -1) {
      pick = i;
      updateSelection();
      return;
    }

    if (pick === i) {
      pick = -1;
      updateSelection();
      return;
    }

    // swap tiles
    [cells[pick], cells[i]] = [cells[i], cells[pick]];
    
    // swap background positions
    const pickEl = tileElements[pick];
    const iEl = tileElements[i];
    const tempBg = pickEl.style.backgroundPosition;
    pickEl.style.backgroundPosition = iEl.style.backgroundPosition;
    iEl.style.backgroundPosition = tempBg;
    
    moves += 1;
    pick = -1;
    updateSelection();

    if (solved(cells)) finishLevel();
  }

  function startLevel() {
    moves = 0;
    pick = -1;
    makeScramble();
    startTick();
    render();
  }

  async function loadBg() {
    if (typeof fetchImage !== 'function') throw new Error('Thiếu hàm fetchImage');
    const result = await fetchImage(usedIcons);
    if (!result || !result.dataUrl) throw new Error('Không lấy được ảnh mới.');
    bg = result.dataUrl;
    if (result.icon) usedIcons.add(result.icon);
  }

  async function start(backgroundDataUrl) {
    if (running) return;
    running = true;

    runStart = performance.now();

    total = 0;
    level = 3;
    charCount = 0;
    usedIcons.clear();
    bg = backgroundDataUrl || '';
    onScore(0);

    try {
      if (!bg) await loadBg();
      startLevel();
    } catch (err) {
      running = false;
      stopTick();
      setStatus(String(err?.message || err || 'Không thể bắt đầu'));
    }
  }

  function stop() {
    running = false;
    stopTick();
  }

  async function nextLevel() {
    charCount += 1;
    if (charCount >= MAX_CHARS) {
      running = false;
      setStatus(`HOÀN THÀNH ${MAX_CHARS} nhân vật! Tổng điểm: ${total}`);
      const durationMs = runStart ? Math.max(0, Math.round(performance.now() - runStart)) : null;
      if (onComplete) onComplete({ score: total, durationMs });
      return;
    }

    if (level >= 10) {
      level = 10; // Cap at max difficulty
    } else {
      level += 1;
    }

    try {
      await loadBg();
      startLevel();
    } catch (err) {
      running = false;
      setStatus(String(err?.message || 'Không tải được ảnh mới.'));
    }
  }

  function giveUp() {
    if (!running) return;
    if (!confirm('Bạn có chắc muốn bỏ cuộc? Điểm hiện tại sẽ được tính.')) return;
    running = false;
    stopTick();
    setStatus(`Đã bỏ cuộc. Tổng điểm: ${total}`);
    const durationMs = runStart ? Math.max(0, Math.round(performance.now() - runStart)) : null;
    if (onComplete) onComplete({ score: total, durationMs });
  }

  return { start, stop, giveUp, isRunning: () => running, setStatus, nextLevel, loadBg };
}
