export function normalizeUid(input) {
  const s = String(input ?? '').replaceAll(/\s+/g, '');
  if (!/^\d{8,10}$/.test(s)) return '';
  return s;
}

export async function loadQuestions() {
  const res = await fetch('./data/questions.json', { cache: 'no-store' });
  if (!res.ok) throw new Error('Không tải được bộ câu hỏi.');
  const data = await res.json();
  if (!Array.isArray(data)) throw new Error('Dữ liệu câu hỏi không hợp lệ.');
  return data;
}

function weightedRandomPick(items, weightFn) {
  const weights = items.map((it) => Math.max(0, Number(weightFn(it)) || 0));
  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0) return items[Math.floor(Math.random() * items.length)];

  let r = Math.random() * total;
  for (let i = 0; i < items.length; i += 1) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function hasAnyTag(q, tags) {
  const qt = Array.isArray(q.tags) ? q.tags : [];
  return tags.some((t) => qt.includes(t));
}

export function pickQuizSet(allQuestions, { pickPoolSize = 30, askCount = 10, preferTags = [] } = {}) {
  const normalized = allQuestions
    .filter((q) => q && typeof q.question === 'string' && Array.isArray(q.choices) && Number.isInteger(q.correctIndex))
    .map((q) => ({
      id: String(q.id ?? ''),
      question: q.question,
      choices: q.choices,
      correctIndex: q.correctIndex,
      difficulty: Math.min(5, Math.max(1, Number(q.difficulty) || 1)),
      points: Math.max(1, Number(q.points) || 1),
      tags: Array.isArray(q.tags) ? q.tags : [],
    }));

  if (normalized.length < askCount) {
    throw new Error(`Chưa đủ câu hỏi. Hiện có ${normalized.length}, cần tối thiểu ${askCount}.`);
  }

  // Pick a question pool with tag preference and slight difficulty balancing.
  const pool = [];
  const remaining = [...normalized];
  for (let i = 0; i < Math.min(pickPoolSize, normalized.length); i += 1) {
    const pick = weightedRandomPick(remaining, (q) => {
      const tagBoost = preferTags.length && hasAnyTag(q, preferTags) ? 2.5 : 1;
      const diffBoost = 1 + (q.difficulty - 1) * 0.2;
      return tagBoost * diffBoost;
    });
    pool.push(pick);
    const idx = remaining.indexOf(pick);
    if (idx >= 0) remaining.splice(idx, 1);
    if (!remaining.length) break;
  }

  // From pool, build 10 questions ordered easy -> hard
  const sorted = [...pool].sort((a, b) => a.difficulty - b.difficulty);
  const picked = [];
  const used = new Set();

  for (const q of sorted) {
    if (picked.length >= askCount) break;
    const key = q.id || q.question;
    if (used.has(key)) continue;
    used.add(key);
    picked.push(q);
  }

  if (picked.length < askCount) {
    // Fallback: sample random from pool
    const extra = shuffle(pool).filter((q) => {
      const key = q.id || q.question;
      return !used.has(key);
    });
    for (const q of extra) {
      if (picked.length >= askCount) break;
      picked.push(q);
    }
  }

  return picked;
}
