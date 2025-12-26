export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Không tải được ảnh.'));
    img.src = src;
  });
}

export function cropSquarePng(img, size = 512) {
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  const s = Math.min(w, h);

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext('2d');
  const sx = Math.floor((w - s) / 2);
  const sy = Math.floor((h - s) / 2);
  ctx.drawImage(img, sx, sy, s, s, 0, 0, size, size);

  return canvas.toDataURL('image/png');
}
