/**
 * quiz.module.js — Quiz System
 * Difficulty levels, timer per question, answer segregation,
 * animated feedback, score results with correct/wrong panels
 */

const QuizModule = (() => {
    // Quiz state
    let state = {
        phase: 'setup',   // 'setup' | 'active' | 'results'
        difficulty: 'medium',
        activeTopic: 'all',
        questions: [],
        currentIdx: 0,
        answered: false,
        selectedOption: null,
        timeLeft: 0,
        timerInterval: null,
        correctAnswers: [],  // { question, correctAnswer, topic }
        wrongAnswers: [],    // { question, userAnswer, correctAnswer, topic }
        startTime: null,
        totalTime: 0,
    };

    const TIME_LIMITS = { easy: 30, medium: 20, hard: 15 };

    function render() {
        const el = document.getElementById('page-quiz');
        if (!el) return;

        if (state.phase === 'setup') renderSetup(el);
        else if (state.phase === 'active') renderActive(el);
        else if (state.phase === 'results') renderResults(el);
    }

    // ===== SETUP PHASE =====
    function renderSetup(el) {
        const allQ = Store.get.allQuizQuestions();
        const topics = [...new Set(allQ.map(q => q.topic))];

        const countByDiff = (diff) => allQ.filter(q =>
            q.difficulty === diff && (state.activeTopic === 'all' || q.topic === state.activeTopic)
        ).length;

        el.innerHTML = `
      <div class="quiz-container anim-stagger">
        <div class="section-header">
          <div>
            <h1 class="section-title">Quiz Time 🎯</h1>
            <p class="section-subtitle">Test your knowledge with adaptive questions</p>
          </div>
        </div>

        ${allQ.length === 0 ? `
          <div class="empty-state">
            <span class="empty-state-icon">❓</span>
            <h2 class="empty-state-title">No Questions Yet</h2>
            <p class="empty-state-desc">Upload a document to generate AI-powered quiz questions, or load sample data.</p>
            <div style="display:flex;gap:var(--sp-3);flex-wrap:wrap;justify-content:center">
              <button class="btn btn-primary" onclick="App.navigate('upload')" id="btn-quiz-upload">Upload Document</button>
              <button class="btn btn-secondary" onclick="UploadModule.loadSampleData()" id="btn-quiz-sample">Load Sample</button>
            </div>
          </div>
        ` : `
          <!-- Topic Filter -->
          <div style="margin-bottom:var(--sp-6)">
            <label class="label">Select Topic</label>
            <div class="filter-tabs">
              <button class="filter-tab ${state.activeTopic === 'all' ? 'active' : ''}" onclick="QuizModule.setTopic('all')" id="qtab-all">All Topics (${allQ.length})</button>
              ${topics.map(t => `
                <button class="filter-tab ${state.activeTopic === t ? 'active' : ''}" onclick="QuizModule.setTopic('${t}')" id="qtab-${t.replace(/\s+/g, '_')}">
                  ${Helpers.truncate(t, 18)} (${allQ.filter(q => q.topic === t).length})
                </button>
              `).join('')}
            </div>
          </div>

          <!-- Difficulty Selector -->
          <label class="label">Choose Difficulty</label>
          <div class="difficulty-selector">
            ${renderDifficultyCard('easy', '🌱', 'Easy', 'Build your foundation', countByDiff('easy'))}
            ${renderDifficultyCard('medium', '⚡', 'Medium', 'Challenge yourself', countByDiff('medium'))}
            ${renderDifficultyCard('hard', '🔥', 'Hard', 'Master the material', countByDiff('hard'))}
          </div>

          <!-- Start Button -->
          <button class="btn btn-primary btn-lg" style="width:100%;margin-top:var(--sp-4)" onclick="QuizModule.startQuiz()" id="btn-start-quiz">
            🚀 Start Quiz
          </button>

          <!-- Quiz History -->
          ${renderQuizHistory()}
        `}
      </div>
    `;
    }

    function renderDifficultyCard(diff, icon, label, desc, count) {
        return `
      <div class="difficulty-card ${diff} ${state.difficulty === diff ? 'selected' : ''}"
           onclick="QuizModule.setDifficulty('${diff}')" id="diff-${diff}">
        <div class="difficulty-icon">${icon}</div>
        <div class="difficulty-card-title">${label}</div>
        <div class="difficulty-card-desc">${desc}</div>
        <div class="difficulty-card-count">${count} questions</div>
      </div>
    `;
    }

    function renderQuizHistory() {
        const history = Store.get.quizHistory().slice(0, 3);
        if (history.length === 0) return '';
        return `
      <div style="margin-top:var(--sp-8)">
        <h3 class="section-title" style="font-size:var(--text-lg);margin-bottom:var(--sp-4)">Recent Quizzes</h3>
        <div style="display:flex;flex-direction:column;gap:var(--sp-3)">
          ${history.map(h => `
            <div class="card card-sm" style="display:flex;align-items:center;gap:var(--sp-4)">
              <div style="font-size:2rem">${h.score / h.total >= 0.9 ? '🏆' : h.score / h.total >= 0.7 ? '✅' : '📖'}</div>
              <div style="flex:1">
                <div style="font-weight:700;font-size:var(--text-sm)">${h.topic || 'Mixed Topics'}</div>
                <div style="font-size:var(--text-xs);color:var(--text-secondary)">${Helpers.formatDate(h.date)} • ${h.difficulty} • ${h.total} questions</div>
              </div>
              <div>
                <div style="font-family:var(--font-display);font-size:var(--text-xl);font-weight:800;color:${h.score / h.total >= 0.7 ? 'var(--brand-emerald)' : 'var(--brand-amber)'}">${Math.round(h.score / h.total * 100)}%</div>
                <div style="font-size:var(--text-xs);color:var(--text-secondary);text-align:right">${h.score}/${h.total}</div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
    }

    // ===== ACTIVE PHASE =====
    function renderActive(el) {
        const q = state.questions[state.currentIdx];
        if (!q) { state.phase = 'results'; render(); return; }

        const progressPct = (state.currentIdx / state.questions.length) * 100;
        const timeRatio = state.timeLeft / TIME_LIMITS[state.difficulty];
        const timerClass = timeRatio <= 0.2 ? 'danger' : timeRatio <= 0.4 ? 'warning' : '';

        el.innerHTML = `
      <div class="quiz-container">
        <!-- Quiz Header -->
        <div class="quiz-header">
          <div class="quiz-progress-info">
            <span class="quiz-q-counter">Question ${state.currentIdx + 1} of ${state.questions.length}</span>
            <span class="${q.difficulty === 'easy' ? 'chip-easy' : q.difficulty === 'medium' ? 'chip-medium' : 'chip-hard'}">${q.difficulty}</span>
            <span class="badge badge-purple">${q.topic}</span>
          </div>
          <div class="quiz-timer ${timerClass}" id="quiz-timer">
            <span class="timer-icon">⏱</span>
            <span id="timer-display">${Helpers.formatTime(state.timeLeft)}</span>
          </div>
        </div>

        <!-- Progress bar -->
        <div class="progress-bar" style="margin-bottom:var(--sp-6);height:8px">
          <div class="progress-fill" style="width:${progressPct}%"></div>
        </div>

        <!-- Score mini -->
        <div style="display:flex;gap:var(--sp-4);margin-bottom:var(--sp-4);font-size:var(--text-sm)">
          <span style="color:var(--brand-emerald)">✅ ${state.correctAnswers.length} correct</span>
          <span style="color:var(--brand-red)">❌ ${state.wrongAnswers.length} wrong</span>
        </div>

        <!-- Question Card -->
        <div class="question-card">
          <div class="question-number">Question ${state.currentIdx + 1}</div>
          <div class="question-text">${q.question}</div>
          <div class="options-grid" id="options-grid">
            ${q.options.map((opt, i) => `
              <button class="option-btn" id="opt-${i}" onclick="QuizModule.selectAnswer(${i})" ${state.answered ? 'disabled' : ''}>
                <div class="option-label">${String.fromCharCode(65 + i)}</div>
                <span>${opt}</span>
              </button>
            `).join('')}
          </div>

          <!-- Feedback (shown after answer) -->
          <div id="feedback-area" style="display:none"></div>
        </div>

        <!-- Next Button -->
        <button class="btn btn-primary btn-lg next-question-btn ${state.answered ? 'show' : ''}" id="btn-next-q"
          onclick="QuizModule.nextQuestion()">
          ${state.currentIdx < state.questions.length - 1 ? 'Next Question →' : 'See Results 🎉'}
        </button>
      </div>
    `;

        // Re-apply answered state if coming back
        if (state.answered && state.selectedOption !== null) {
            applyAnswerFeedback(state.selectedOption);
        }

        // Start timer (only if not answered)
        if (!state.answered) startTimer();
    }

    // ===== RESULTS PHASE =====
    function renderResults(el) {
        const total = state.questions.length;
        const correct = state.correctAnswers.length;
        const pct = total > 0 ? Math.round(correct / total * 100) : 0;
        const elapsed = Math.round((Date.now() - state.startTime) / 1000);

        let emoji = pct >= 90 ? '🏆' : pct >= 70 ? '✅' : pct >= 50 ? '📖' : '💪';
        let title = pct >= 90 ? 'Outstanding!' : pct >= 70 ? 'Great Job!' : pct >= 50 ? 'Keep Going!' : 'Keep Practicing!';

        el.innerHTML = `
      <div class="quiz-container">
        <div class="quiz-results card-xl anim-scaleIn">
          <div class="results-score-circle">
            <div class="results-score-pct" id="result-pct">0%</div>
            <div class="results-score-label">Score</div>
          </div>
          <div class="results-title">${emoji} ${title}</div>
          <div class="results-subtitle">You answered ${correct} out of ${total} questions correctly</div>

          <div class="results-stats-row">
            <div class="results-stat">
              <div class="results-stat-value" style="color:var(--brand-emerald)">${correct}</div>
              <div class="results-stat-label">Correct</div>
            </div>
            <div class="results-stat">
              <div class="results-stat-value" style="color:var(--brand-red)">${state.wrongAnswers.length}</div>
              <div class="results-stat-label">Wrong</div>
            </div>
            <div class="results-stat">
              <div class="results-stat-value" style="color:var(--brand-amber)">${Helpers.formatTime(elapsed)}</div>
              <div class="results-stat-label">Time</div>
            </div>
            <div class="results-stat">
              <div class="results-stat-value" style="color:var(--brand-blue)">+${correct * 10} XP</div>
              <div class="results-stat-label">Earned</div>
            </div>
          </div>

          <div style="display:flex;gap:var(--sp-3);justify-content:center;flex-wrap:wrap">
            <button class="btn btn-primary" onclick="QuizModule.resetQuiz()" id="btn-retake">🔄 Try Again</button>
            <button class="btn btn-secondary" onclick="App.navigate('flashcards')" id="btn-review-fc">📚 Review Flashcards</button>
          </div>
        </div>

        <!-- Answer Segregation -->
        <div class="answers-section">
          <!-- Correct Answers -->
          <div class="answers-panel correct-panel">
            <div class="answers-panel-header">
              <span>✅</span>
              <span>Mastered Questions (${state.correctAnswers.length})</span>
            </div>
            ${state.correctAnswers.length > 0
                ? state.correctAnswers.map(a => `
                  <div class="answer-item">
                    <div class="answer-item-q">${Helpers.truncate(a.question, 80)}</div>
                    <div class="answer-item-a">✔ ${a.correctAnswer}</div>
                  </div>
                `).join('')
                : '<div class="answer-item" style="color:var(--text-muted);text-align:center">None yet</div>'
            }
          </div>

          <!-- Wrong Answers -->
          <div class="answers-panel wrong-panel">
            <div class="answers-panel-header">
              <span>❌</span>
              <span>Revise These (${state.wrongAnswers.length})</span>
            </div>
            ${state.wrongAnswers.length > 0
                ? state.wrongAnswers.map(a => `
                  <div class="answer-item">
                    <div class="answer-item-q">${Helpers.truncate(a.question, 80)}</div>
                    <div class="answer-item-a" style="color:var(--brand-red)">✘ ${a.userAnswer}</div>
                    <div class="answer-item-a" style="color:var(--brand-emerald);margin-top:2px">✔ ${a.correctAnswer}</div>
                  </div>
                `).join('')
                : '<div class="answer-item" style="color:var(--text-muted);text-align:center">No wrong answers! 🎉</div>'
            }
          </div>
        </div>
      </div>
    `;

        // Animate percentage number
        setTimeout(() => {
            const pctEl = document.getElementById('result-pct');
            if (pctEl) Helpers.animateNumber(pctEl, 0, pct, 1000);
            setTimeout(() => { if (pctEl) pctEl.textContent = pct + '%'; }, 1050);
        }, 100);

        if (pct >= 70) Helpers.confetti(pct >= 90 ? 30 : 15);
    }

    // ===== QUIZ CONTROLS =====
    function setDifficulty(diff) {
        state.difficulty = diff;
        Store.setQuizDifficulty(diff);
        render();
    }

    function setTopic(topic) {
        state.activeTopic = topic;
        render();
    }

    function startQuiz() {
        const all = Store.get.allQuizQuestions();
        let pool = all.filter(q =>
            q.difficulty === state.difficulty &&
            (state.activeTopic === 'all' || q.topic === state.activeTopic)
        );

        if (pool.length === 0) {
            Helpers.toast('No questions for this difficulty/topic. Try another combination.', 'warning');
            return;
        }

        // Shuffle and pick up to 10 questions
        pool = Helpers.shuffle(pool).slice(0, 10);

        state.questions = pool;
        state.currentIdx = 0;
        state.answered = false;
        state.selectedOption = null;
        state.correctAnswers = [];
        state.wrongAnswers = [];
        state.startTime = Date.now();
        state.phase = 'active';
        state.timeLeft = TIME_LIMITS[state.difficulty];

        render();
    }

    function selectAnswer(optionIdx) {
        if (state.answered) return;
        clearInterval(state.timerInterval);

        state.answered = true;
        state.selectedOption = optionIdx;

        const q = state.questions[state.currentIdx];
        const isCorrect = optionIdx === q.correctIndex;

        if (isCorrect) {
            state.correctAnswers.push({
                question: q.question,
                correctAnswer: q.options[q.correctIndex],
                topic: q.topic
            });
            Store.addPoints(10, 'Correct quiz answer');
        } else {
            state.wrongAnswers.push({
                question: q.question,
                userAnswer: q.options[optionIdx],
                correctAnswer: q.options[q.correctIndex],
                topic: q.topic
            });
        }

        Store.markActiveToday();
        applyAnswerFeedback(optionIdx);

        // Show next button
        const nextBtn = document.getElementById('btn-next-q');
        if (nextBtn) { nextBtn.classList.add('show'); nextBtn.textContent = state.currentIdx < state.questions.length - 1 ? 'Next Question →' : 'See Results 🎉'; }

        AchievementsModule.checkAll();
    }

    function applyAnswerFeedback(optionIdx) {
        const q = state.questions[state.currentIdx];
        const isCorrect = optionIdx === q.correctIndex;

        // Style option buttons
        document.querySelectorAll('.option-btn').forEach((btn, i) => {
            btn.disabled = true;
            if (i === q.correctIndex) btn.classList.add('correct');
            if (i === optionIdx && !isCorrect) btn.classList.add('wrong');
        });

        // Show feedback bar
        const feedbackEl = document.getElementById('feedback-area');
        if (feedbackEl) {
            feedbackEl.style.display = 'block';
            feedbackEl.innerHTML = `
        <div class="feedback-bar ${isCorrect ? 'correct' : 'wrong'}">
          <span class="feedback-icon">${isCorrect ? '🎉' : '😢'}</span>
          <div>
            <div class="feedback-title">${isCorrect ? 'Correct!' : 'Not quite!'}</div>
            <div class="feedback-explanation">${q.explanation || (isCorrect ? 'Great job!' : `Correct answer: ${q.options[q.correctIndex]}`)}</div>
          </div>
        </div>
      `;
        }
    }

    function nextQuestion() {
        clearInterval(state.timerInterval);

        if (state.currentIdx < state.questions.length - 1) {
            state.currentIdx++;
            state.answered = false;
            state.selectedOption = null;
            state.timeLeft = TIME_LIMITS[state.difficulty];
            render();
        } else {
            // End of quiz
            const total = state.questions.length;
            const correct = state.correctAnswers.length;
            const elapsed = Math.round((Date.now() - state.startTime) / 1000);

            Store.saveQuizResult({
                topic: state.activeTopic,
                difficulty: state.difficulty,
                score: correct,
                total,
                time: elapsed,
                correct: state.correctAnswers,
                wrong: state.wrongAnswers
            });

            state.phase = 'results';
            render();
        }
    }

    function startTimer() {
        clearInterval(state.timerInterval);
        state.timerInterval = setInterval(() => {
            state.timeLeft--;
            const timerEl = document.getElementById('timer-display');
            const timerWrapper = document.getElementById('quiz-timer');
            if (timerEl) timerEl.textContent = Helpers.formatTime(state.timeLeft);
            if (timerWrapper) {
                const ratio = state.timeLeft / TIME_LIMITS[state.difficulty];
                timerWrapper.className = `quiz-timer ${ratio <= 0.2 ? 'danger' : ratio <= 0.4 ? 'warning' : ''}`;
            }

            if (state.timeLeft <= 0) {
                clearInterval(state.timerInterval);
                // Time's up — auto-select wrong
                if (!state.answered) {
                    const q = state.questions[state.currentIdx];
                    state.wrongAnswers.push({
                        question: q.question,
                        userAnswer: '(Time expired)',
                        correctAnswer: q.options[q.correctIndex],
                        topic: q.topic
                    });
                    state.answered = true;
                    applyAnswerFeedback(-1);
                    const nextBtn = document.getElementById('btn-next-q');
                    if (nextBtn) { nextBtn.classList.add('show'); nextBtn.textContent = state.currentIdx < state.questions.length - 1 ? 'Next Question →' : 'See Results 🎉'; }
                }
            }
        }, 1000);
    }

    function resetQuiz() {
        clearInterval(state.timerInterval);
        state = { ...state, phase: 'setup', questions: [], currentIdx: 0, answered: false, selectedOption: null, correctAnswers: [], wrongAnswers: [], timeLeft: 0 };
        render();
    }

    function subscribe() {
        Store.on('documents:change', () => { if (state.phase === 'setup') render(); });
    }

    return { render, subscribe, setDifficulty, setTopic, startQuiz, selectAnswer, nextQuestion, resetQuiz };
})();
