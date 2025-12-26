import { loadImage } from './image.js';

const LIST_URL = './data/characterList.VI.json';
let cachedIcons = null;

async function loadIconIds() {
  if (cachedIcons) return cachedIcons;

  const res = await fetch(LIST_URL, { cache: 'no-store' });
  if (!res.ok) throw new Error('Không tải được danh sách nhân vật.');

  const list = await res.json();
  const icons = (Array.isArray(list) ? list : [])
    .map((x) => String(x?.icon || '').trim())
    .filter(Boolean);

  cachedIcons = Array.from(new Set(icons));
  return cachedIcons;
}

export async function pickPlayableIconUrl(usedIcons = new Set()) {
  const icons = await loadIconIds();
  const available = icons.filter((icon) => !usedIcons.has(icon));
  
  if (!available.length) throw new Error('Đã hết nhân vật.');

  for (let tries = 0; tries < 10; tries += 1) {
    const iconId = available[Math.floor(Math.random() * available.length)];
    const url = `./assets/Character/${iconId}.png`;

    try {
      await loadImage(url);
      return { url, icon: iconId };
    } catch {
      // try next
    }
  }

  const fallbackIcon = available[0];
  return { url: `./assets/Character/${fallbackIcon}.png`, icon: fallbackIcon };
}
