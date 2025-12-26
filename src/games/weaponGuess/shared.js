let cachedWeaponList = null;

export async function loadWeaponList() {
  if (cachedWeaponList) return cachedWeaponList;

  const url = new URL('../../../data/weaponList.VI.json', import.meta.url);
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error('Không tải được danh sách vũ khí.');

  const data = await res.json();
  if (!Array.isArray(data)) throw new Error('Dữ liệu vũ khí không hợp lệ.');

  cachedWeaponList = data
    .filter((w) => w && typeof w.name === 'string' && typeof w.icon === 'string')
    .map((w) => ({ name: w.name.trim(), icon: w.icon.trim() }))
    .filter((w) => w.name && w.icon);

  return cachedWeaponList;
}

export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Không tìm thấy ảnh.'));
    img.src = src;
  });
}

export function computeBlurPx(timeLeft, totalTime) {
  const t = Math.max(0, Math.min(totalTime, Number(timeLeft) || 0));
  const ratio = t / totalTime;
  return Math.round(2 + 14 * ratio);
}
