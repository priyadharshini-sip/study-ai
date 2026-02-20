/**
 * dashboard.module.js — Dashboard Page
 * Shows hero stats, quick actions, recent activity, heatmap
 */

const DashboardModule = (() => {
    const SAMPLE_WEEKLY = [12, 28, 15, 30, 22, 38, 25];
    const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    function render() {
        const el = document.getElementById('page-dashboard');
        if (!el) return;

        const gam = Store.get.gamification();
        const docs = Store.get.documents();
        const allCards = Store.get.allFlashcards();
        const history = Store.get.quizHistory();
        const sessions = Store.get.pomodoroSessions();
        const masteredCount = allCards.filter(c => c.status === 'mastered').length;
        const totalQuizzes = history.length;
        const avgAccuracy = totalQuizzes > 0
            ? Math.round(history.reduce((a, h) => a + (h.score / h.total * 100), 0) / totalQuizzes)
            : 0;
        const totalFocusMin = sessions.reduce((a, s) => a + (s.focusMinutes || 0), 0);

        el.innerHTML = `
      <div class="anim-stagger">
        <!-- HERO -->
        <div class="dashboard-hero">
          <p class="hero-greeting">👋 Welcome back, ${Store.get.user().name}!</p>
          <h1 class="hero-title">Ready to learn<br/>something amazing?</h1>
          <div class="hero-stats-row">
            <div class="hero-stat">
              <span class="hero-stat-value">${gam.streak}</span>
              <span class="hero-stat-label">🔥 Day Streak</span>
            </div>
            <div class="hero-stat">
              <span class="hero-stat-value">${gam.points}</span>
              <span class="hero-stat-label">⭐ Points</span>
            </div>
            <div class="hero-stat">
              <span class="hero-stat-value">${allCards.length}</span>
              <span class="hero-stat-label">📚 Flashcards</span>
            </div>
            <div class="hero-stat">
              <span class="hero-stat-value">Lv.${gam.level}</span>
              <span class="hero-stat-label">🏅 Level</span>
            </div>
          </div>
          <div class="hero-actions">
            <button class="btn btn-primary btn-lg" onclick="App.navigate('upload')" id="btn-hero-upload">
              📄 Upload Document
            </button>
            <button class="btn btn-secondary btn-lg" onclick="App.navigate('flashcards')" id="btn-hero-study">
              ⚡ Quick Study
            </button>
          </div>
        </div>

        <!-- STAT CARDS -->
        <div class="grid-4 mb-6">
          <div class="stat-card">
            <div class="stat-value text-gradient">${allCards.length}</div>
            <div class="stat-label">Total Flashcards</div>
            <div class="stat-icon">📚</div>
          </div>
          <div class="stat-card green">
            <div class="stat-value" style="color:var(--brand-emerald)">${masteredCount}</div>
            <div class="stat-label">Mastered</div>
            <div class="stat-change up">↑ ${allCards.length > 0 ? Math.round(masteredCount / allCards.length * 100) : 0}%</div>
            <div class="stat-icon">✅</div>
          </div>
          <div class="stat-card amber">
            <div class="stat-value" style="color:var(--brand-amber)">${avgAccuracy}%</div>
            <div class="stat-label">Quiz Accuracy</div>
            <div class="stat-change ${avgAccuracy >= 70 ? 'up' : 'down'}">${avgAccuracy >= 70 ? '↑' : '↓'} Quiz avg</div>
            <div class="stat-icon">🎯</div>
          </div>
          <div class="stat-card pink">
            <div class="stat-value" style="color:var(--brand-pink)">${totalFocusMin}m</div>
            <div class="stat-label">Focus Time</div>
            <div class="stat-change up">🍅 Pomodoro</div>
            <div class="stat-icon">⏱️</div>
          </div>
        </div>

        <!-- QUICK ACTIONS -->
        <div class="section-header">
          <div>
            <h2 class="section-title">Quick Actions</h2>
            <p class="section-subtitle">Jump right into your studies</p>
          </div>
        </div>
        <div class="grid-4 mb-6">
          ${renderQuickAction('📄', 'Upload Doc', 'AI generates cards', 'rgba(124,58,237,0.12)', 'upload')}
          ${renderQuickAction('🃏', 'Flashcards', 'Flip & review', 'rgba(59,130,246,0.12)', 'flashcards')}
          ${renderQuickAction('❓', 'Take Quiz', 'Test your knowledge', 'rgba(16,185,129,0.12)', 'quiz')}
          ${renderQuickAction('🍅', 'Pomodoro', 'Focus session', 'rgba(239,68,68,0.12)', 'pomodoro')}
        </div>

        <!-- CHARTS ROW -->
        <div class="grid-2 mb-6">
          <!-- Weekly Activity Chart -->
          <div class="chart-container">
            <div class="section-header" style="margin-bottom:var(--sp-4)">
              <h3 class="section-title" style="font-size:var(--text-lg)">Weekly Activity</h3>
              <span class="badge badge-purple">This Week</span>
            </div>
            <div class="bar-chart" id="weekly-chart">
              ${SAMPLE_WEEKLY.map((val, i) => `
                <div class="bar-col" style="animation-delay:${i * 0.05}s">
                  <div class="bar-fill chart-bar" style="height:${val / 40 * 100}%;animation-delay:${i * 0.05}s" data-value="${val} cards"></div>
                  <span class="bar-label">${DAYS[i]}</span>
                </div>
              `).join('')}
            </div>
          </div>

          <!-- Topic Progress -->
          <div class="chart-container">
            <div class="section-header" style="margin-bottom:var(--sp-4)">
              <h3 class="section-title" style="font-size:var(--text-lg)">Topic Mastery</h3>
              <span class="badge badge-green">Topics</span>
            </div>
            <div style="display:flex;flex-direction:column;gap:var(--sp-4)" id="topic-mastery-list">
              ${renderTopicMastery(docs, allCards)}
            </div>
          </div>
        </div>

        <!-- RECENT DOCUMENTS -->
        <div class="section-header">
          <div>
            <h2 class="section-title">Recent Documents</h2>
            <p class="section-subtitle">${docs.length} document${docs.length !== 1 ? 's' : ''} uploaded</p>
          </div>
          <button class="btn btn-secondary btn-sm" onclick="App.navigate('upload')" id="btn-upload-more">+ Upload</button>
        </div>
        ${docs.length > 0 ? `
          <div style="display:flex;flex-direction:column;gap:var(--sp-3)" id="recent-docs-list">
            ${docs.slice(0, 4).map(renderDocItem).join('')}
          </div>
        ` : `
          <div class="empty-state">
            <span class="empty-state-icon">📄</span>
            <h3 class="empty-state-title">No documents yet</h3>
            <p class="empty-state-desc">Upload your first PDF or Word document to automatically generate flashcards and quizzes with AI.</p>
            <button class="btn btn-primary" onclick="App.navigate('upload')" id="btn-first-upload">Upload Your First Doc</button>
          </div>
        `}

        <!-- LEARNING HEATMAP -->
        <div class="chart-container mt-6">
          <div class="section-header" style="margin-bottom:var(--sp-4)">
            <h3 class="section-title" style="font-size:var(--text-lg)">Learning Heatmap</h3>
            <span class="badge badge-blue">Last 35 days</span>
          </div>
          <div class="heatmap" id="heatmap-grid">
            ${renderHeatmap()}
          </div>
          <div style="display:flex;align-items:center;gap:var(--sp-2);margin-top:var(--sp-3);font-size:var(--text-xs);color:var(--text-muted)">
            Less
            <div class="heat-cell" style="width:14px;height:14px;border-radius:3px"></div>
            <div class="heat-cell" data-level="1" style="width:14px;height:14px;border-radius:3px"></div>
            <div class="heat-cell" data-level="2" style="width:14px;height:14px;border-radius:3px"></div>
            <div class="heat-cell" data-level="3" style="width:14px;height:14px;border-radius:3px"></div>
            <div class="heat-cell" data-level="4" style="width:14px;height:14px;border-radius:3px"></div>
            More
          </div>
        </div>
      </div>
    `;

        // Animate numbers
        document.querySelectorAll('.hero-stat-value').forEach(el => {
            const text = el.textContent;
            const num = parseInt(text.replace(/\D/g, ''));
            if (!isNaN(num) && num > 0) {
                const prefix = text.match(/[A-Z a-z]+$/) ? text.replace(/[0-9]+/, '').trim() : '';
                Helpers.animateNumber(el, 0, num, 800);
                setTimeout(() => {
                    if (prefix) el.textContent = el.textContent + ' ' + prefix;
                }, 810);
            }
        });
    }

    function renderQuickAction(icon, title, sub, bg, page) {
        return `
      <div class="quick-action-card" onclick="App.navigate('${page}')" id="qa-${page}">
        <div class="quick-action-icon" style="background:${bg}">${icon}</div>
        <div class="quick-action-title">${title}</div>
        <div class="quick-action-sub">${sub}</div>
      </div>
    `;
    }

    function renderDocItem(doc) {
        const cardCount = doc.flashcards?.length || 0;
        const qCount = doc.quizQuestions?.length || 0;
        return `
      <div class="recent-upload-item hover-lift" onclick="App.openDoc('${doc.id}')" id="doc-${doc.id}">
        <div class="recent-upload-doc-icon">📄</div>
        <div class="recent-upload-info">
          <div class="recent-upload-name">${doc.title || doc.name}</div>
          <div class="recent-upload-meta">${cardCount} cards • ${qCount} questions • ${Helpers.formatDate(doc.uploadedAt)}</div>
        </div>
        <div class="recent-upload-action">
          <span class="badge badge-purple">${doc.topics?.length || 0} topics</span>
        </div>
      </div>
    `;
    }

    function renderTopicMastery(docs, allCards) {
        const topics = {};
        allCards.forEach(fc => {
            if (!topics[fc.topic]) topics[fc.topic] = { total: 0, mastered: 0 };
            topics[fc.topic].total++;
            if (fc.status === 'mastered') topics[fc.topic].mastered++;
        });

        const topicKeys = Object.keys(topics).slice(0, 4);
        if (topicKeys.length === 0) {
            return '<p style="color:var(--text-muted);font-size:var(--text-sm)">Upload a document to see topic mastery</p>';
        }

        return topicKeys.map(t => {
            const pct = topics[t].total > 0 ? Math.round(topics[t].mastered / topics[t].total * 100) : 0;
            return `
        <div>
          <div style="display:flex;justify-content:space-between;margin-bottom:4px">
            <span style="font-size:var(--text-sm);font-weight:600">${Helpers.truncate(t, 30)}</span>
            <span style="font-size:var(--text-xs);color:var(--text-secondary)">${pct}%</span>
          </div>
          <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
        </div>
      `;
        }).join('');
    }

    function renderHeatmap() {
        const cells = [];
        for (let i = 34; i >= 0; i--) {
            // Simulate activity levels (random for demo, real should come from Store)
            const level = Math.random() > 0.4 ? Math.floor(Math.random() * 5) : 0;
            cells.push(`<div class="heat-cell" data-level="${level}" title="${level > 0 ? level * 5 + ' cards reviewed' : 'No activity'}"></div>`);
        }
        return cells.join('');
    }

    function subscribe() {
        Store.on('documents:change', () => render());
        Store.on('points:change', () => render());
        Store.on('quiz:complete', () => render());
        Store.on('pomodoro:complete', () => render());
        Store.on('streak:change', () => render());
    }

    return { render, subscribe };
})();
