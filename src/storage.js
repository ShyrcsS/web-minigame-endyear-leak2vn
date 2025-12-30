const KEY = 'leak2vn_event_state_v1';
const PROGRESS_KEY = 'leak2vn_event_progress_v1';

export function loadState() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { scores: [], plays: [] };
    const parsed = JSON.parse(raw);
    if (!parsed) return { scores: [], plays: [] };
    const result = {
      scores: Array.isArray(parsed.scores) ? parsed.scores : [],
      plays: Array.isArray(parsed.plays) ? parsed.plays : [],
    };
    // console.log('[loadState] Loaded from localStorage:', result);
    return result;
  } catch (err) {
    // console.error('[loadState] Error loading:', err);
    return { scores: [], plays: [] };
  }
}

export function saveState(state) {
  const next = {
    scores: Array.isArray(state?.scores) ? state.scores : [],
    plays: Array.isArray(state?.plays) ? state.plays : [],
  };
  // console.log('[saveState] Saving to localStorage:', next);
  localStorage.setItem(KEY, JSON.stringify(next));
  // console.log('[saveState] Saved. Verifying by loading back...');
  const verified = JSON.parse(localStorage.getItem(KEY));
  // console.log('[saveState] Verification result:', verified);
}

export function clearScores() {
  localStorage.removeItem(KEY);
}

export function upsertScore(state, entry) {
  const scores = Array.isArray(state?.scores) ? [...state.scores] : [];
  const idx = scores.findIndex((s) => s.uid === entry.uid);
  if (idx >= 0) {
    scores[idx] = { ...scores[idx], ...entry };
  } else {
    scores.push(entry);
  }
  return { scores, plays: Array.isArray(state?.plays) ? state.plays : [] };
}

// Save a play session (per minigame). Keeps top 5 per uid (highest score, latest wins ties).
export function addPlay(state, play) {
  const plays = Array.isArray(state?.plays) ? [...state.plays] : [];
  // console.log('[addPlay] Before adding:', plays);

  const entry = {
    uid: String(play?.uid || ''),
    ingameName: String(play?.ingameName || ''),
    game: String(play?.game || ''),
    score: Number(play?.score || 0),
    timestamp: play?.timestamp || new Date().toISOString(),
    globalRank: Number.isFinite(play?.globalRank) ? Number(play.globalRank) : null,
    completed: Number.isFinite(play?.completed) ? Number(play.completed) : null,
  };
  
  // console.log('[addPlay] Adding entry:', entry);

  plays.push(entry);
  // console.log('[addPlay] After push:', plays);

  // Keep only top 5 for each uid PER GAME (not total)
  const grouped = new Map();
  plays.forEach((p) => {
    const key = `${p.uid}|${p.game}`; // Group by BOTH uid AND game
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(p);
  });
  
  // console.log('[addPlay] Grouped by uid+game:', grouped);

  const trimmed = [];
  grouped.forEach((arr) => {
    arr
      .sort((a, b) => b.score - a.score || new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 5) // Top 5 per uid per game
      .forEach((p) => trimmed.push(p));
  });
  
  // console.log('[addPlay] After trimming to top 5 per uid per game:', trimmed);

  return { scores: Array.isArray(state?.scores) ? state.scores : [], plays: trimmed };
}

export function getTopPlaysByUid(state, uid) {
  if (!uid) return [];
  const plays = Array.isArray(state?.plays) ? state.plays : [];
  return plays
    .filter((p) => p.uid === uid)
    .sort((a, b) => b.score - a.score || new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, 5);
}

// Bonus rules:
// top 1: +1%
// top 2: +0.5%
// top 3: +0.25%
export function computeBonusFromRank({ rank, players }) {
  if (!players || players <= 0) return 0;

  if (rank === 1) return 1;
  if (rank === 2) return 0.5;
  if (rank === 3) return 0.25;

  return 0;
}

export function loadProgress() {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (!p || typeof p !== 'object') return null;
    return {
      uid: String(p.uid || ''),
      ingameName: String(p.ingameName || ''),
      fbLink: String(p.fbLink || ''),
      imageKey: String(p.imageKey || ''),
      loreScore: Number(p.loreScore || 0),
      quizDone: Boolean(p.quizDone),
      updatedAt: String(p.updatedAt || ''),
    };
  } catch {
    return null;
  }
}

export function saveProgress(progress) {
  const p = {
    uid: String(progress?.uid || ''),
    ingameName: String(progress?.ingameName || ''),
    fbLink: String(progress?.fbLink || ''),
    imageKey: String(progress?.imageKey || ''),
    loreScore: Number(progress?.loreScore || 0),
    quizDone: Boolean(progress?.quizDone),
    updatedAt: new Date().toISOString(),
  };
  localStorage.setItem(PROGRESS_KEY, JSON.stringify(p));
}

export function clearProgress() {
  localStorage.removeItem(PROGRESS_KEY);
}
