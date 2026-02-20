/**
 * progress.module.js — Progress Tracking Dashboard
 * Topic mastery, accuracy %, time spent, weekly/monthly charts
 */

const ProgressModule = (() => {
    const WEEK_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    function render() {
        const el = document.getElementById('page-progress');
        if (!el) return;

        const allCards = Store.get.allFlashcards();
        const history = Store.get.quizHistory();
        const sessions = Store.get.pomodoroSessions();
        const gam = Store.get.gamification();

        const masteredCount = allCards.filter(c => c.status === 'mastered').length;
        const learningCount = allCards.filter(c => c.status === 'learning').length;
        const newCount = allCards.filter(c => c.status === 'new').length;

        const avgAcc = history.length > 0
            ? Math.round(history.reduce((a, h) => a + (h.score / h.total * 100), 0) / history.length)
            : 0;

        const totalFocus = sessions.reduce((a, s) => a + (s.focusMinutes || 0), 0);

        const weeklyData = buildWeeklyData(history, sessions);
        const monthlyData = buildMonthlyData(history);
        const topics = buildTopicStats(allCards, history);

        el.innerHTML = `
      <div class="anim-stagger">
        <div class="section-header">
          <div>
            <h1 class="section-title">Your Progress 📊</h1>
            <p class="section-subtitle">Track your learning journey over time</p>
          </div>
          <span class="badge badge-purple">Lv.${gam.level} — ${gam.xp} XP</span>
        </div>

        <!-- XP CARD -->
        <div class="xp-progress-section mb-6">
          <div class="xp-level-header">
            <div class="xp-level-badge">⚡ Level ${gam.level}</div>
            <div class="xp-to-next">${gam.xpForNextLevel - gam.xp} XP to Level ${gam.level + 1}</div>
          </div>
          <div class="xp-progress-bar-large">
            <div class="xp-fill-large" style="width:${Math.round(gam.xp / gam.xpForNextLevel * 100)}%"></div>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:var(--text-xs);color:var(--text-muted)">
            <span>${gam.xp} XP</span>
            <span>${gam.xpForNextLevel} XP</span>
          </div>
        </div>

        <!-- STAT CARDS -->
        <div class="grid-4 mb-6">
          <div class="stat-card">
            <div class="stat-value text-gradient" id="anim-cards">${allCards.length}</div>
            <div class="stat-label">Total Flashcards</div>
            <div class="stat-icon">📚</div>
          </div>
          <div class="stat-card green">
            <div class="stat-value" style="color:var(--brand-emerald)">${masteredCount}</div>
            <div class="stat-label">Cards Mastered</div>
            <div class="stat-change up">↑ ${allCards.length > 0 ? Math.round(masteredCount / allCards.length * 100) : 0}%</div>
            <div class="stat-icon">✅</div>
          </div>
          <div class="stat-card amber">
            <div class="stat-value" style="color:var(--brand-amber)">${avgAcc}%</div>
            <div class="stat-label">Quiz Accuracy</div>
            <div class="stat-change ${avgAcc >= 70 ? 'up' : 'down'}">${avgAcc >= 70 ? '📈' : '📉'} Average</div>
            <div class="stat-icon">🎯</div>
          </div>
          <div class="stat-card pink">
            <div class="stat-value" style="color:var(--brand-pink)">${totalFocus}m</div>
            <div class="stat-label">Focus Minutes</div>
            <div class="stat-change up">🍅 ${sessions.length} sessions</div>
            <div class="stat-icon">⏱️</div>
          </div>
        </div>

        <!-- CHARTS -->
        <div class="grid-2 mb-6">
          <!-- Weekly Activity -->
          <div class="chart-container">
            <div class="section-header" style="margin-bottom:var(--sp-5)">
              <h2 class="section-title" style="font-size:var(--text-lg)">Weekly Activity</h2>
              <span class="badge badge-blue">Cards & Quizzes</span>
            </div>
            <div class="bar-chart">
              ${weeklyData.map((val, i) => `
                <div class="bar-col">
                  <div class="bar-fill chart-bar" style="height:${val / (Math.max(...weeklyData) || 1) * 100}%;animation-delay:${i * 0.06}s" data-value="${val}"></div>
                  <span class="bar-label">${WEEK_DAYS[i]}</span>
                </div>
              `).join('')}
            </div>
          </div>

          <!-- Monthly Accuracy -->
          <div class="chart-container">
            <div class="section-header" style="margin-bottom:var(--sp-5)">
              <h2 class="section-title" style="font-size:var(--text-lg)">Monthly Accuracy</h2>
              <span class="badge badge-green">Quiz Scores %</span>
            </div>
            <div class="bar-chart">
              ${monthlyData.map((val, i) => `
                <div class="bar-col">
                  <div class="bar-fill chart-bar" style="height:${val}%;background:${val >= 70 ? 'var(--grad-success)' : val >= 50 ? 'linear-gradient(135deg,#F59E0B,#EF4444)' : 'var(--grad-secondary)'};animation-delay:${i * 0.06}s" data-value="${val}%"></div>
                  <span class="bar-label">${MONTHS[(new Date().getMonth() - (3 - i) + 12) % 12]}</span>
                </div>
              `).join('')}
            </div>
          </div>
        </div>

        <!-- TOPIC BREAKDOWN TABLE -->
        <div class="card mb-6">
          <div class="section-header" style="margin-bottom:var(--sp-5)">
            <h2 class="section-title" style="font-size:var(--text-lg)">Topic Breakdown</h2>
            <span class="badge badge-purple">${topics.length} topics</span>
          </div>
          ${topics.length > 0 ? `
            <div style="overflow-x:auto">
              <table style="width:100%;border-collapse:collapse;font-size:var(--text-sm)">
                <thead>
                  <tr style="border-bottom:1px solid var(--border-subtle)">
                    <th style="padding:var(--sp-3);text-align:left;font-weight:600;color:var(--text-secondary)">Topic</th>
                    <th style="padding:var(--sp-3);text-align:center;font-weight:600;color:var(--text-secondary)">Cards</th>
                    <th style="padding:var(--sp-3);text-align:center;font-weight:600;color:var(--text-secondary)">Mastered</th>
                    <th style="padding:var(--sp-3);text-align:left;font-weight:600;color:var(--text-secondary)">Mastery</th>
                    <th style="padding:var(--sp-3);text-align:center;font-weight:600;color:var(--text-secondary)">Quiz Acc.</th>
                    <th style="padding:var(--sp-3);text-align:center;font-weight:600;color:var(--text-secondary)">Status</th>
                  </tr>
                </thead>
                <tbody>
                  ${topics.map(t => `
                    <tr style="border-bottom:1px solid var(--border-subtle);transition:background var(--transition-fast)" onmouseover="this.style.background='var(--bg-elevated)'" onmouseout="this.style.background=''">
                      <td style="padding:var(--sp-3);font-weight:600">${t.name}</td>
                      <td style="padding:var(--sp-3);text-align:center">${t.total}</td>
                      <td style="padding:var(--sp-3);text-align:center;color:var(--brand-emerald)">${t.mastered}</td>
                      <td style="padding:var(--sp-3);min-width:120px">
                        <div style="display:flex;align-items:center;gap:var(--sp-2)">
                          <div class="progress-bar" style="flex:1;height:6px"><div class="progress-fill" style="width:${t.masteryPct}%"></div></div>
                          <span style="font-size:var(--text-xs);color:var(--text-secondary);min-width:32px">${t.masteryPct}%</span>
                        </div>
                      </td>
                      <td style="padding:var(--sp-3);text-align:center;font-weight:600;color:${t.quizAcc >= 70 ? 'var(--brand-emerald)' : t.quizAcc > 0 ? 'var(--brand-amber)' : 'var(--text-muted)'}">${t.quizAcc > 0 ? t.quizAcc + '%' : '—'}</td>
                      <td style="padding:var(--sp-3);text-align:center">
                        <span class="${t.masteryPct >= 80 ? 'badge badge-green' : t.masteryPct >= 50 ? 'badge badge-amber' : 'badge badge-blue'}">
                          ${t.masteryPct >= 80 ? '🏆 Mastered' : t.masteryPct >= 50 ? '📖 Learning' : '🆕 Started'}
                        </span>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          ` : '<p style="color:var(--text-muted);text-align:center">Upload a document to see topic breakdown</p>'}
        </div>

        <!-- FLASHCARD STATUS BREAKDOWN -->
        <div class="grid-2">
          <div class="card">
            <h3 style="font-weight:700;margin-bottom:var(--sp-5)">📚 Flashcard Status</h3>
            ${renderPieChart(masteredCount, learningCount, newCount, allCards.length)}
          </div>

          <!-- QUIZ HISTORY TABLE -->
          <div class="card">
            <h3 style="font-weight:700;margin-bottom:var(--sp-4)">🎯 Quiz History</h3>
            ${history.length > 0 ? `
              <div style="display:flex;flex-direction:column;gap:var(--sp-2);max-height:280px;overflow-y:auto">
                ${history.slice(0, 8).map(h => `
                  <div style="display:flex;align-items:center;gap:var(--sp-3);padding:var(--sp-2) 0;border-bottom:1px solid var(--border-subtle);font-size:var(--text-sm)">
                    <span>${h.score / h.total >= 0.9 ? '🏆' : h.score / h.total >= 0.7 ? '✅' : '📖'}</span>
                    <span style="flex:1;font-weight:600">${Helpers.truncate(h.topic || 'Mixed', 18)}</span>
                    <span class="${h.difficulty === 'easy' ? 'chip-easy' : h.difficulty === 'medium' ? 'chip-medium' : 'chip-hard'}">${h.difficulty}</span>
                    <span style="font-weight:700;color:${h.score / h.total >= 0.7 ? 'var(--brand-emerald)' : 'var(--brand-amber)'}">${Math.round(h.score / h.total * 100)}%</span>
                  </div>
                `).join('')}
              </div>
            ` : '<p style="color:var(--text-muted);text-align:center;font-size:var(--text-sm)">No quizzes taken yet</p>'}
          </div>
        </div>
      </div>
    `;
    }

    function buildWeeklyData(history, sessions) {
        const data = [0, 0, 0, 0, 0, 0, 0];
        const now = new Date();
        const monday = new Date(now);
        monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
        monday.setHours(0, 0, 0, 0);

        [...history, ...sessions].forEach(item => {
            const d = new Date(item.date);
            const dayIdx = Math.floor((d - monday) / 86400000);
            if (dayIdx >= 0 && dayIdx < 7) {
                data[dayIdx] += item.total || item.completedCycles || 1;
            }
        });

        return data;
    }

    function buildMonthlyData(history) {
        const months = [0, 0, 0, 0];
        const monthCounts = [0, 0, 0, 0];
        const now = new Date();

        history.forEach(h => {
            const d = new Date(h.date);
            const monthDiff = (now.getFullYear() - d.getFullYear()) * 12 + now.getMonth() - d.getMonth();
            if (monthDiff >= 0 && monthDiff < 4) {
                const idx = 3 - monthDiff;
                months[idx] += Math.round(h.score / h.total * 100);
                monthCounts[idx]++;
            }
        });

        return months.map((total, i) => monthCounts[i] > 0 ? Math.round(total / monthCounts[i]) : 0);
    }

    function buildTopicStats(allCards, history) {
        const topicMap = {};
        allCards.forEach(c => {
            if (!topicMap[c.topic]) topicMap[c.topic] = { total: 0, mastered: 0, quizScores: [] };
            topicMap[c.topic].total++;
            if (c.status === 'mastered') topicMap[c.topic].mastered++;
        });

        history.forEach(h => {
            if (h.topic && topicMap[h.topic]) {
                topicMap[h.topic].quizScores.push(Math.round(h.score / h.total * 100));
            }
        });

        return Object.entries(topicMap).map(([name, data]) => ({
            name,
            total: data.total,
            mastered: data.mastered,
            masteryPct: data.total > 0 ? Math.round(data.mastered / data.total * 100) : 0,
            quizAcc: data.quizScores.length > 0
                ? Math.round(data.quizScores.reduce((a, b) => a + b, 0) / data.quizScores.length)
                : 0
        })).sort((a, b) => b.total - a.total);
    }

    function renderPieChart(mastered, learning, newCards, total) {
        if (total === 0) return '<p style="color:var(--text-muted);text-align:center">No flashcards yet</p>';

        const pMastered = total > 0 ? (mastered / total * 100).toFixed(1) : 0;
        const pLearning = total > 0 ? (learning / total * 100).toFixed(1) : 0;
        const pNew = total > 0 ? (newCards / total * 100).toFixed(1) : 0;

        return `
      <div style="display:flex;flex-direction:column;gap:var(--sp-3)">
        ${[
                ['✅ Mastered', mastered, pMastered, 'var(--brand-emerald)'],
                ['📖 Learning', learning, pLearning, 'var(--brand-amber)'],
                ['🆕 New', newCards, pNew, 'var(--brand-blue)']
            ].map(([label, count, pct, color]) => `
          <div>
            <div style="display:flex;justify-content:space-between;margin-bottom:4px;font-size:var(--text-sm)">
              <span style="font-weight:600">${label}</span>
              <span style="color:var(--text-secondary)">${count} (${pct}%)</span>
            </div>
            <div class="progress-bar">
              <div class="progress-fill" style="width:${pct}%;background:${color}"></div>
            </div>
          </div>
        `).join('')}

        <div class="divider"></div>
        <div style="font-size:var(--text-sm);color:var(--text-muted);text-align:center">
          Total: ${total} cards across all topics
        </div>
      </div>
    `;
    }

    function subscribe() {
        Store.on('documents:change', () => render());
        Store.on('quiz:complete', () => render());
        Store.on('flashcard:update', () => render());
        Store.on('pomodoro:complete', () => render());
        Store.on('xp:change', () => render());
    }

    return { render, subscribe };
})();
