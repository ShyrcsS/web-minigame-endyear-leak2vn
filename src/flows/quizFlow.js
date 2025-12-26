import { loadQuestions, pickQuizSet } from '../quiz.js';
import { hide, show } from '../dom.js';

function stopQuizTimer(session) {
  if (session.quizTimerId) {
    clearInterval(session.quizTimerId);
    session.quizTimerId = null;
  }
}

function startQuizTimer({ session, qTimerEl, onTimeout }) {
  stopQuizTimer(session);
  session.timeLeft = 10;
  qTimerEl.textContent = String(session.timeLeft);
  session.quizTimerId = setInterval(() => {
    session.timeLeft -= 1;
    qTimerEl.textContent = String(session.timeLeft);
    if (session.timeLeft <= 0) {
      stopQuizTimer(session);
      onTimeout();
    }
  }, 1000);
}

export function createQuizFlow({
  els,
  session,
  saveProgress,
  onQuizCompleted,
}) {
  function renderQuestion() {
    const q = session.quiz[session.quizIndex];
    els.qIdx.textContent = String(session.quizIndex + 1);
    els.qScore.textContent = String(session.quizScore);
    els.qText.textContent = q.question;
    els.qChoices.innerHTML = '';

    q.choices.forEach((choice, i) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn choice';
      btn.textContent = choice;
      btn.addEventListener('click', () => answer(i));
      els.qChoices.appendChild(btn);
    });

    startQuizTimer({
      session,
      qTimerEl: els.qTimer,
      onTimeout: () => nextQuestion(false),
    });
  }

  function answer(choiceIndex) {
    const q = session.quiz[session.quizIndex];
    const ok = choiceIndex === q.correctIndex;
    nextQuestion(ok);
  }

  function nextQuestion(isCorrect) {
    stopQuizTimer(session);
    const q = session.quiz[session.quizIndex];
    if (isCorrect) {
      session.quizScore += q.points;
    }
    session.quizIndex += 1;

    if (session.quizIndex >= session.quiz.length) {
      session.loreScore = session.quizScore;
      saveProgress({
        uid: session.uid,
        ingameName: session.ingameName,
        fbLink: session.fbLink,
        imageKey: session.imageKey,
        loreScore: session.loreScore,
        quizDone: true,
      });

      els.quizFinalScore.textContent = String(session.loreScore);
      hide(els.quizBox);
      show(els.quizDone);

      onQuizCompleted?.();
      return;
    }

    renderQuestion();
  }

  async function startQuizFlow() {
    const questions = await loadQuestions();
    const quiz = pickQuizSet(questions, {
      pickPoolSize: 30,
      askCount: 10,
      preferTags: ['nod-krai'],
    });

    session.quiz = quiz;
    session.quizIndex = 0;
    session.quizScore = 0;

    els.qScore.textContent = '0';
    show(els.stepQuiz);
    hide(els.stepIntake);

    hide(els.quizDone);
    show(els.quizBox);
    renderQuestion();
  }

  function skip() {
    nextQuestion(false);
  }

  function resetQuizUi() {
    stopQuizTimer(session);
    hide(els.quizDone);
    show(els.quizBox);
    els.qText.textContent = 'Đang tải câu hỏi…';
    els.qChoices.innerHTML = '';
    els.qIdx.textContent = '0';
    els.qScore.textContent = '0';
    els.qTimer.textContent = '10';
  }

  return {
    startQuizFlow,
    skip,
    resetQuizUi,
  };
}
