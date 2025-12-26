import { getTopPlaysByUid, loadState } from './storage.js';
import { escapeHtml } from './dom.js';

const GAME_NAME = {
  g1: 'Game 1: Weapon',
  g2: 'Game 2: Xếp hình',
  g3: 'Game 3: Đoán vợ',
};

export function renderLeaderboard({ leaderboardBodyEl, uid }) {
  const state = loadState();
  const rows = uid ? getTopPlaysByUid(state, uid) : [];

  leaderboardBodyEl.innerHTML = '';
  rows.forEach((r, idx) => {
    const tr = document.createElement('tr');
    const dt = new Date(r.timestamp);
    const rank = Number.isFinite(r.globalRank) ? r.globalRank : '-';
    tr.innerHTML = `
      <td>${escapeHtml(r.uid)}</td>
      <td>${escapeHtml(GAME_NAME[r.game] || r.game || 'N/A')}</td>
      <td>${r.score}</td>
      <td>${dt.toLocaleString('vi-VN')}</td>
      <td>${rank}</td>
    `;

    leaderboardBodyEl.appendChild(tr);
  });
}
