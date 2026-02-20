/**
 * flashcards.module.js — Premium 3D Flashcard Study System
 * Features: topic grouping, flip animation, swipe gestures,
 * performance reordering, Jaccard similarity suggestions
 */

const FlashcardsModule = (() => {
    let currentCards = [];
    let currentIndex = 0;
    let isFlipped = false;
    let touchStartX = 0;
    let touchStartY = 0;
    let touchDelta = 0;

    function render() {
        const el = document.getElementById('page-flashcards');
        if (!el) return;

        const docs = Store.get.documents();
        const allCards = Store.get.allFlashcards();

        if (allCards.length === 0) {
            el.innerHTML = `
        <div class="empty-state">
          <span class="empty-state-icon">🃏</span>
          <h1 class="empty-state-title">No Flashcards Yet</h1>
          <p class="empty-state-desc">Upload a document to automatically generate AI-powered flashcards, or load sample data to try it out.</p>
          <div style="display:flex;gap:var(--sp-3);flex-wrap:wrap;justify-content:center">
            <button class="btn btn-primary" onclick="App.navigate('upload')" id="btn-fc-upload">Upload Document</button>
            <button class="btn btn-secondary" onclick="UploadModule.loadSampleData()" id="btn-fc-sample">Load Sample</button>
          </div>
        </div>
      `;
            return;
        }

        const topics = [...new Set(allCards.map(c => c.topic))];
        const activeFilter = Store.get.ui().activeTopicFilter;
        const filteredCards = activeFilter === 'all' ? allCards : allCards.filter(c => c.topic === activeFilter);

        // Sort: wrong first, then learning, then new, then mastered
        const sortedCards = sortByPerformance(filteredCards);
        currentCards = sortedCards;
        currentIndex = Math.min(currentIndex, currentCards.length - 1);
        if (currentIndex < 0) currentIndex = 0;

        const masteredCount = filteredCards.filter(c => c.status === 'mastered').length;
        const masteryPct = filteredCards.length > 0 ? Math.round(masteredCount / filteredCards.length * 100) : 0;

        // Get similar cards suggestions
        const currentCard = currentCards[currentIndex];
        const suggestions = currentCard
            ? JaccardSimilarity.findSimilar(
                currentCard.question,
                allCards.filter(c => c.id !== currentCard.id).map(c => ({ id: c.id, text: c.question })),
                0.3
            ).slice(0, 2)
            : [];

        el.innerHTML = `
      <div class="study-layout">
        <!-- MAIN STUDY AREA -->
        <div>
          <!-- Topic Filter Tabs -->
          <div class="filter-tabs anim-fadeInDown" id="topic-filter-tabs">
            <button class="filter-tab ${activeFilter === 'all' ? 'active' : ''}" onclick="FlashcardsModule.filterTopic('all')" id="tab-all">All (${allCards.length})</button>
            ${topics.map(t => `
              <button class="filter-tab ${activeFilter === t ? 'active' : ''}" onclick="FlashcardsModule.filterTopic('${t}')" id="tab-${t.replace(/\s+/g, '_')}">
                ${Helpers.truncate(t, 20)} (${allCards.filter(c => c.topic === t).length})
              </button>
            `).join('')}
          </div>

          <!-- Mastery Progress -->
          <div style="margin-bottom:var(--sp-5)">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--sp-2)">
              <span style="font-size:var(--text-sm);font-weight:600;color:var(--text-secondary)">Topic Mastery</span>
              <span style="font-size:var(--text-sm);font-weight:700;color:var(--brand-purple)">${masteryPct}% (${masteredCount}/${filteredCards.length})</span>
            </div>
            <div class="progress-bar">
              <div class="progress-fill" style="width:${masteryPct}%"></div>
            </div>
          </div>

          ${currentCards.length > 0 ? `
            <!-- 3D FLASHCARD -->
            <div class="flashcard-scene ${isFlipped ? 'flipped-init' : ''}" id="flashcard-scene" tabindex="0" role="button" aria-label="Flashcard. Press Space to flip.">
              <div class="flashcard ${isFlipped ? 'flipped' : ''}" id="flashcard-inner">
                <!-- FRONT -->
                <div class="flashcard-front">
                  <span class="flashcard-label">❓ QUESTION</span>
                  <div class="flashcard-question" id="fc-question">${currentCard.question}</div>
                  <span class="flashcard-topic-tag">${currentCard.topic}</span>
                  <div class="flashcard-flip-hint">
                    <span>👆</span> Click to reveal answer
                  </div>
                </div>
                <!-- BACK -->
                <div class="flashcard-back">
                  <span class="flashcard-label" style="color:rgba(255,255,255,0.5)">💡 ANSWER</span>
                  <div class="flashcard-answer" id="fc-answer">${currentCard.answer}</div>
                  <span class="flashcard-topic-tag" style="background:rgba(255,255,255,0.1);color:rgba(255,255,255,0.7)">${currentCard.difficulty}</span>
                </div>
              </div>
            </div>

            <!-- CONTROLS -->
            <div class="flashcard-controls">
              <button class="flashcard-nav-btn" id="fc-prev" onclick="FlashcardsModule.prev()" aria-label="Previous card" ${currentIndex === 0 ? 'disabled' : ''}>◀</button>
              <span class="flashcard-counter">${currentIndex + 1} / ${currentCards.length}</span>
              <button class="flashcard-nav-btn" id="fc-next" onclick="FlashcardsModule.next()" aria-label="Next card" ${currentIndex === currentCards.length - 1 ? 'disabled' : ''}>▶</button>
            </div>

            <!-- RATE BUTTONS (shown after flip) -->
            <div class="flashcard-rate-row" id="rate-row" style="display:${isFlipped ? 'flex' : 'none'}">
              <button class="rate-btn wrong" onclick="FlashcardsModule.rate('wrong')" id="rate-wrong">❌ Forgot</button>
              <button class="rate-btn hard" onclick="FlashcardsModule.rate('hard')" id="rate-hard">😐 Hard</button>
              <button class="rate-btn correct" onclick="FlashcardsModule.rate('correct')" id="rate-correct">✅ Got it!</button>
            </div>

            <!-- SIMILARITY SUGGESTIONS -->
            ${suggestions.length > 0 ? `
              <div class="similarity-alert">
                <span class="similarity-icon">🔗</span>
                <div>
                  <strong>Related cards:</strong> This card is similar to <em>${suggestions.map(s => {
            const c = allCards.find(c => c.id === s.item.id);
            return c ? Helpers.truncate(c.question, 50) : '';
        }).filter(Boolean).join('; ')}</em>. Consider reviewing them together for stronger retention.
                </div>
              </div>
            ` : ''}

            <!-- MINI GRID (all cards for current topic) -->
            <div class="section-header" style="margin-top:var(--sp-8)">
              <h2 class="section-title" style="font-size:var(--text-lg)">All Cards${activeFilter !== 'all' ? ` — ${activeFilter}` : ''}</h2>
              <div style="display:flex;gap:var(--sp-2)">
                <span class="badge badge-green">✅ ${filteredCards.filter(c => c.status === 'mastered').length} mastered</span>
                <span class="badge badge-amber">📖 ${filteredCards.filter(c => c.status === 'learning').length} learning</span>
                <span class="badge badge-blue">🆕 ${filteredCards.filter(c => c.status === 'new').length} new</span>
              </div>
            </div>
            <div class="flashcard-grid anim-stagger" id="fc-mini-grid">
              ${filteredCards.map((card, idx) => renderMiniCard(card, idx)).join('')}
            </div>
          ` : `
            <div class="empty-state">
              <span class="empty-state-icon">🔍</span>
              <h3 class="empty-state-title">No cards in this topic</h3>
            </div>
          `}
        </div>

        <!-- SIDEBAR -->
        <div class="study-sidebar">
          <div class="study-sidebar-title">📚 Topics</div>
          <button class="topic-list-item ${activeFilter === 'all' ? 'active' : ''}" onclick="FlashcardsModule.filterTopic('all')" id="side-all">
            <span class="topic-list-dot"></span>
            All Topics
            <span style="margin-left:auto;font-size:var(--text-xs);color:var(--text-muted)">${allCards.length}</span>
          </button>
          ${topics.map(t => {
            const tCards = allCards.filter(c => c.topic === t);
            const tMastered = tCards.filter(c => c.status === 'mastered').length;
            const tPct = tCards.length > 0 ? Math.round(tMastered / tCards.length * 100) : 0;
            return `
              <div>
                <button class="topic-list-item ${activeFilter === t ? 'active' : ''}" onclick="FlashcardsModule.filterTopic('${t}')" id="side-${t.replace(/\s+/g, '_')}">
                  <span class="topic-list-dot"></span>
                  ${Helpers.truncate(t, 22)}
                  <span style="margin-left:auto;font-size:var(--text-xs);color:var(--text-muted)">${tCards.length}</span>
                </button>
                <div style="padding:0 var(--sp-3) var(--sp-2)">
                  <div class="progress-bar" style="height:3px"><div class="progress-fill" style="width:${tPct}%"></div></div>
                </div>
              </div>
            `;
        }).join('')}

          <div class="divider"></div>

          <!-- STATS -->
          <div class="study-sidebar-title">📊 Session Stats</div>
          <div style="display:flex;flex-direction:column;gap:var(--sp-2)">
            ${[
                ['🃏', 'Total Cards', allCards.length],
                ['✅', 'Mastered', allCards.filter(c => c.status === 'mastered').length],
                ['📖', 'Learning', allCards.filter(c => c.status === 'learning').length],
                ['🆕', 'New', allCards.filter(c => c.status === 'new').length]
            ].map(([icon, label, val]) => `
              <div style="display:flex;justify-content:space-between;font-size:var(--text-sm)">
                <span>${icon} ${label}</span>
                <span style="font-weight:700">${val}</span>
              </div>
            `).join('')}
          </div>

          <div class="divider"></div>

          <button class="btn btn-secondary" style="width:100%" onclick="App.navigate('quiz')" id="btn-take-quiz">
            ❓ Take Quiz
          </button>
          <button class="btn btn-ghost" style="width:100%;font-size:var(--text-xs);color:var(--text-muted)" onclick="FlashcardsModule.shuffleCards()" id="btn-shuffle">
            🔀 Shuffle Cards
          </button>
        </div>
      </div>
    `;

        bindFlashcardEvents();
    }

    function renderMiniCard(card, idx) {
        const statusColors = { mastered: 'status-mastered', learning: 'status-learning', new: 'status-new' };
        return `
      <div class="flashcard-mini" onclick="FlashcardsModule.jumpToCard(${idx})" id="mini-${card.id}">
        <div class="flashcard-mini-q">${Helpers.truncate(card.question, 80)}</div>
        <div class="flashcard-mini-meta">
          <span class="${card.difficulty === 'easy' ? 'chip-easy' : card.difficulty === 'medium' ? 'chip-medium' : 'chip-hard'}">${card.difficulty}</span>
          <div class="flashcard-mini-status ${statusColors[card.status] || 'status-new'}"></div>
        </div>
      </div>
    `;
    }

    function sortByPerformance(cards) {
        const weight = { learning: 0, new: 1, mastered: 2 };
        return [...cards].sort((a, b) => {
            const wa = (weight[a.status] || 1) - (a.wrongCount || 0) * 0.3;
            const wb = (weight[b.status] || 1) - (b.wrongCount || 0) * 0.3;
            return wa - wb;
        });
    }

    function bindFlashcardEvents() {
        const scene = document.getElementById('flashcard-scene');
        if (!scene) return;

        // Flip on click
        scene.addEventListener('click', flip);
        scene.addEventListener('keydown', e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); flip(); } });

        // Arrow key navigation
        document.addEventListener('keydown', handleKeyNav);

        // Touch/swipe for mobile
        scene.addEventListener('touchstart', e => {
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
            touchDelta = 0;
        }, { passive: true });

        scene.addEventListener('touchmove', e => {
            touchDelta = e.touches[0].clientX - touchStartX;
            if (Math.abs(touchDelta) > Math.abs(e.touches[0].clientY - touchStartY)) {
                scene.classList.toggle('swipe-left', touchDelta < -30);
                scene.classList.toggle('swipe-right', touchDelta > 30);
            }
        }, { passive: true });

        scene.addEventListener('touchend', () => {
            scene.classList.remove('swipe-left', 'swipe-right');
            if (touchDelta < -60) next();
            else if (touchDelta > 60) prev();
        });
    }

    function handleKeyNav(e) {
        if (document.getElementById('page-flashcards')?.classList.contains('active')) {
            if (e.key === 'ArrowRight') next();
            if (e.key === 'ArrowLeft') prev();
        }
    }

    function flip() {
        isFlipped = !isFlipped;
        const inner = document.getElementById('flashcard-inner');
        const rateRow = document.getElementById('rate-row');
        if (inner) inner.classList.toggle('flipped', isFlipped);
        if (rateRow) rateRow.style.display = isFlipped ? 'flex' : 'none';
    }

    function next() {
        if (currentIndex < currentCards.length - 1) {
            currentIndex++;
            isFlipped = false;
            render();
        }
    }

    function prev() {
        if (currentIndex > 0) {
            currentIndex--;
            isFlipped = false;
            render();
        }
    }

    function jumpToCard(idx) {
        currentIndex = idx;
        isFlipped = false;
        render();
        // Scroll to flashcard scene
        document.getElementById('flashcard-scene')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    function rate(result) {
        const card = currentCards[currentIndex];
        if (!card) return;

        Store.updateFlashcardStat(card.id, result);
        Store.markActiveToday();

        // Visual feedback
        if (result === 'correct') {
            Helpers.floatReward('✅', document.getElementById('rate-correct'));
            AchievementsModule.checkAll();
        } else if (result === 'wrong') {
            Helpers.floatReward('❌', document.getElementById('rate-wrong'));
        }

        // Auto-advance
        setTimeout(() => {
            isFlipped = false;
            if (currentIndex < currentCards.length - 1) {
                currentIndex++;
            }
            render();
        }, 400);
    }

    function filterTopic(topic) {
        Store.setTopicFilter(topic);
        currentIndex = 0;
        isFlipped = false;
        render();
    }

    function shuffleCards() {
        currentCards = Helpers.shuffle(currentCards);
        currentIndex = 0;
        isFlipped = false;
        Helpers.toast('Cards shuffled! 🔀', 'info', 1500);
        render();
    }

    function subscribe() {
        Store.on('documents:change', () => render());
        Store.on('ui:change', () => {
            if (document.getElementById('page-flashcards')?.classList.contains('active')) render();
        });
        Store.on('flashcard:update', () => {
            // Update mini card status without full re-render
        });
    }

    return { render, subscribe, flip, next, prev, jumpToCard, rate, filterTopic, shuffleCards };
})();
