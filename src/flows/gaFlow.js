import { loadState, saveState, clearScores, upsertScore, computeBonusFromRank, addPlay } from '../storage.js';
import { createEntry, submitPlay } from '../api.js';
import { hide, show } from '../dom.js';
import { renderLeaderboard } from '../leaderboard.js';

export function createGaFlow({
  els,
  session,
  apiBase,
  setupReactionGame,
  setupTapGame,
  setupMemoryGame,
  onPlayRecorded,
  getSessionToken,
  getTurnstileToken,
}) {
  function updateTotalAndSubmitState() {
  }

  function recordLocalPlay({ game, score, globalRank = null }) {
    if (!session.uid) return;
    // console.log('[recordLocalPlay] Saving play:', { game, score, globalRank, uid: session.uid });
    const state = loadState();
    const next = addPlay(state, {
      uid: session.uid,
      ingameName: session.ingameName,
      game,
      score,
      globalRank,
    });
    saveState(next);
    // console.log('[recordLocalPlay] Play saved, new state:', next);
    renderLeaderboard({ leaderboardBodyEl: els.leaderboardBody, uid: session.uid });
    
    // console.log('[recordLocalPlay] Calling onPlayRecorded callback...');
    if (onPlayRecorded) onPlayRecorded();

    if (apiBase && getSessionToken && getTurnstileToken) {
      Promise.all([getSessionToken(), getTurnstileToken()])
        .then(([sessionToken, turnstileToken]) =>
          submitPlay({
            apiBase,
            play: {
              uid: session.uid,
              ingameName: session.ingameName,
              game,
              score,
            },
            sessionToken,
            turnstileToken,
          })
        )
        .catch((err) => {
          console.warn('[recordLocalPlay] Failed to submit play to backend:', err?.message || err);
        });
    }
  }

  function setupGames() {
    const btnReaction = document.getElementById('btn-reaction-start');
    const btnReactionGiveup = document.getElementById('btn-reaction-giveup');
    const boxReaction = document.getElementById('reaction-box');
    if (btnReaction && boxReaction && btnReactionGiveup) {
      const game = setupReactionGame({
        startButton: btnReaction,
        box: boxReaction,
        onScore: (score) => {
          session.reactionScore = score;
          session.reactionPlayed = true;
          els.scoreReaction.textContent = String(score);
          updateTotalAndSubmitState();
        },
        onComplete: ({ score }) => {
          btnReactionGiveup.disabled = true;
          recordLocalPlay({ game: 'g1', score });
        },
      });

      btnReaction.addEventListener('click', () => {
        setTimeout(() => {
          if (game.isRunning()) {
            btnReactionGiveup.disabled = false;
          }
        }, 100);
      });
      
      btnReactionGiveup.addEventListener('click', () => {
        game.giveUp();
        btnReactionGiveup.disabled = true;
      });
    }

    const btnTap = document.getElementById('btn-tap-start');
    const btnTapGiveup = document.getElementById('btn-tap-giveup');
    const boxTap = document.getElementById('tap-box');
    const timerTap = document.getElementById('tap-timer');
    if (btnTap && boxTap && timerTap && btnTapGiveup) {
      const game = setupTapGame({
        startButton: btnTap,
        box: boxTap,
        timerEl: timerTap,
        onScore: (score) => {
          session.tapScore = score;
          session.tapPlayed = true;
          els.scoreTap.textContent = String(score);
          updateTotalAndSubmitState();
        },
        onComplete: ({ score }) => {
          btnTapGiveup.disabled = true;
          recordLocalPlay({ game: 'g2', score });
        },
      });
      
      btnTap.addEventListener('click', () => {
        setTimeout(() => {
          if (game.isRunning()) {
            btnTapGiveup.disabled = false;
          }
        }, 100);
      });
      
      btnTapGiveup.addEventListener('click', () => {
        game.giveUp();
        btnTapGiveup.disabled = true;
      });
    }

    const btnMem = document.getElementById('btn-memory-start');
    const btnMemGiveup = document.getElementById('btn-memory-giveup');
    const gridMem = document.getElementById('memory-grid');
    const movesMem = document.getElementById('mem-moves');
    const timeMem = document.getElementById('mem-time');
    if (btnMem && gridMem && movesMem && timeMem && btnMemGiveup) {
      const game = setupMemoryGame({
        startButton: btnMem,
        gridEl: gridMem,
        movesEl: movesMem,
        timeEl: timeMem,
        onScore: (score) => {
          session.memoryScore = score;
          session.memoryPlayed = true;
          els.scoreMemory.textContent = String(score);
          updateTotalAndSubmitState();
        },
        onComplete: ({ score }) => {
          btnMemGiveup.disabled = true;
          recordLocalPlay({ game: 'g3', score });
        },
      });
      
      btnMem.addEventListener('click', () => {
        setTimeout(() => {
          if (game.isRunning()) {
            btnMemGiveup.disabled = false;
          }
        }, 100);
      });
      
      btnMemGiveup.addEventListener('click', () => {
        game.giveUp();
        btnMemGiveup.disabled = true;
      });
    }

    if (els.leaderboardBody) {
      renderLeaderboard({ leaderboardBodyEl: els.leaderboardBody, uid: session.uid });
    }
  }

  async function submitGa() {
    const gaTotal = session.reactionScore + session.tapScore + session.memoryScore;
    const state = loadState();

    const updated = upsertScore(state, {
      uid: session.uid,
      ingameName: session.ingameName,
      fbLink: session.fbLink,
      loreScore: session.loreScore,
      gaTotal,
      updatedAt: new Date().toISOString(),
      winBonus: 0,
    });

    const sorted = [...updated.scores].sort(
      (a, b) => b.gaTotal - a.gaTotal || b.loreScore - a.loreScore || (a.updatedAt < b.updatedAt ? 1 : -1),
    );
    const rank = sorted.findIndex((r) => r.uid === session.uid) + 1;
    const players = sorted.length;
    const bonus = computeBonusFromRank({ rank, players });

    const finalState = upsertScore(updated, {
      uid: session.uid,
      ingameName: session.ingameName,
      fbLink: session.fbLink,
      loreScore: session.loreScore,
      gaTotal,
      updatedAt: new Date().toISOString(),
      winBonus: bonus,
    });

    saveState(finalState);
    renderLeaderboard({ leaderboardBodyEl: els.leaderboardBody, uid: session.uid });

    if (els.rankLocal) els.rankLocal.textContent = String(rank);
    if (els.playersLocal) els.playersLocal.textContent = String(players);
    if (els.winBonus) els.winBonus.textContent = String(bonus);
    if (els.gaResult) show(els.gaResult);

    if (!session.imageKey) {
      alert('Thiếu ảnh đã upload. Reset và upload lại giúp mình.');
      updateTotalAndSubmitState();
      return;
    }

    try {
      els.btnSubmitGa.disabled = true;
      const resp = await createEntry({
        apiBase,
        entry: {
          uid: session.uid,
          ingameName: session.ingameName,
          fbLink: session.fbLink,
          imageKey: session.imageKey,
          loreScore: session.loreScore,
          gaTotal,
          winBonus: bonus,
        },
      });

      if (resp?.ok) {
        alert('Đã gửi lên server.');
      } else {
        alert('Đã gửi request, nhưng server trả về dữ liệu lạ.');
      }
    } catch (err) {
      console.error(err);
      const msg = String(err?.message || '').toLowerCase();
      if (msg.includes('uid already exists')) {
        alert('UID này đã được đăng ký. Nếu bạn cần chỉnh sửa thông tin, liên hệ BTC để được hỗ trợ.');
      } else {
        alert(`Gửi lên server thất bại: ${err?.message || 'lỗi không rõ'}`);
      }
    } finally {
      updateTotalAndSubmitState();
    }
  }

  function clearLocalScores() {
    if (!confirm('Xóa toàn bộ bảng điểm')) return;
    clearScores();
    renderLeaderboard({ leaderboardBodyEl: els.leaderboardBody, uid: session.uid });
    hide(els.gaResult);
  }

  function resetGaUi() {
    if (els.scoreReaction) els.scoreReaction.textContent = '0';
    if (els.scoreTap) els.scoreTap.textContent = '0';
    if (els.scoreMemory) els.scoreMemory.textContent = '0';
    if (els.scoreTotal) els.scoreTotal.textContent = '0';
    if (els.btnSubmitGa) els.btnSubmitGa.disabled = true;
    if (els.gaResult) hide(els.gaResult);

    session.reactionScore = 0;
    session.tapScore = 0;
    session.memoryScore = 0;
    session.reactionPlayed = false;
    session.tapPlayed = false;
    session.memoryPlayed = false;

    renderLeaderboard({ leaderboardBodyEl: els.leaderboardBody, uid: session.uid });
  }

  return {
    setupGames,
    submitGa,
    clearLocalScores,
    resetGaUi,
    updateTotalAndSubmitState,
  };
}
