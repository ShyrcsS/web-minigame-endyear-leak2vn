import { pickPlayableIconUrl } from './puzzle/characterIcon.js';
import { cropSquarePng, loadImage } from './puzzle/image.js';
import { createTileSwapPuzzle } from './puzzle/tileSwapPuzzle.js';

export function setupTapGame({ startButton, pauseButton, box, timerEl, onScore, onComplete }) {
  const fetchImage = async (usedIcons) => {
    const result = await pickPlayableIconUrl(usedIcons);
    const img = await loadImage(result.url);
    const dataUrl = cropSquarePng(img, 512);
    return { dataUrl, icon: result.icon };
  };

  const puzzle = createTileSwapPuzzle({ box, timerEl, onScore, fetchImage, onComplete });

  async function start() {
    try {
      puzzle.setStatus('Đang tải ảnh…');
      await puzzle.start();
    } catch (err) {
      console.error(err);
      puzzle.stop();
      puzzle.setStatus('Không tải được ảnh nhân vật.');
    }
  }

  startButton.addEventListener('click', start);
  puzzle.setStatus('Bấm “Bắt đầu” để ghép hình');
  onScore(0);  
  return {
    start,
    giveUp: () => puzzle.giveUp(),
    pause: () => puzzle.pause(),
    isPaused: () => puzzle.isPaused(),
    isRunning: () => puzzle.isRunning(),
  };}
