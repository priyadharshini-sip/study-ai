/**
 * achievements.module.js — Streaks, Badges, XP, Leaderboard
 * Shows animated achievement modal, manages all achievement definitions,
 * and checks achievement conditions after each key user action.
 */

const AchievementsModule = (() => {
    // All possible achievements
    const ACHIEVEMENTS = [
        { id: 'first_upload', emoji: '📄', title: 'First Document!', desc: 'Upload your first document.', xp: 50, condition: (s) => s.documents.length >= 1 },
        { id: 'first_card', emoji: '🃏', title: 'Card Collector', desc: 'Review your first flashcard.', xp: 25, condition: (s) => Object.keys(s.flashcardStats).length >= 1 },
        { id: 'first_quiz', emoji: '❓', title: 'Quiz Taker', desc: 'Complete your first quiz.', xp: 40, condition: (s) => s.quizHistory.length >= 1 },
        { id: 'streak_3', emoji: '🔥', title: 'On Fire!', desc: 'Maintain a 3-day streak.', xp: 75, condition: (s) => s.gamification.streak >= 3 },
        { id: 'streak_7', emoji: '🔥🔥', title: 'Week Warrior', desc: 'Maintain a 7-day streak.', xp: 150, condition: (s) => s.gamification.streak >= 7 },
        { id: 'streak_30', emoji: '🌟', title: 'Study Legend', desc: '30-day streak. Incredible!', xp: 500, condition: (s) => s.gamification.streak >= 30 },
        { id: 'mastered_10', emoji: '🏅', title: 'Sharp Mind', desc: 'Master 10 flashcards.', xp: 100, condition: (s) => Object.values(s.flashcardStats).filter(f => f.status === 'mastered').length >= 10 },
        { id: 'mastered_50', emoji: '🥇', title: 'Expert', desc: 'Master 50 flashcards.', xp: 300, condition: (s) => Object.values(s.flashcardStats).filter(f => f.status === 'mastered').length >= 50 },
        { id: 'perfect_quiz', emoji: '🎯', title: 'Perfect Score!', desc: 'Score 100% on a quiz.', xp: 200, condition: (s) => s.quizHistory.some(h => h.score === h.total && h.total > 0) },
        { id: 'quiz_5', emoji: '📝', title: 'Quiz Machine', desc: 'Complete 5 quizzes.', xp: 120, condition: (s) => s.quizHistory.length >= 5 },
        { id: 'pomodoro_1', emoji: '🍅', title: 'Pomodoro Pro', desc: 'Complete your first Pomodoro session.', xp: 50, condition: (s) => s.pomodoroSessions.length >= 1 },
        { id: 'pomodoro_10', emoji: '🍅🍅', title: 'Focus Master', desc: 'Complete 10 Pomodoro sessions.', xp: 200, condition: (s) => s.pomodoroSessions.length >= 10 },
        { id: 'points_100', emoji: '⭐', title: 'Point Collector', desc: 'Earn 100 points.', xp: 50, condition: (s) => s.gamification.points >= 100 },
        { id: 'points_500', emoji: '💎', title: 'Diamond Scholar', desc: 'Earn 500 points.', xp: 150, condition: (s) => s.gamification.points >= 500 },
        { id: 'level_5', emoji: '🏆', title: 'High Achiever', desc: 'Reach Level 5.', xp: 300, condition: (s) => s.gamification.level >= 5 },
        { id: 'hard_quiz', emoji: '🔥', title: 'Hard Mode', desc: 'Complete a hard difficulty quiz.', xp: 150, condition: (s) => s.quizHistory.some(h => h.difficulty === 'hard') },
        { id: 'group_join', emoji: '👥', title: 'Team Player', desc: 'Join or create a study group.', xp: 75, condition: (s) => s.groups.length >= 1 },
        { id: 'night_owl', emoji: '🦉', title: 'Night Owl', desc: 'Study after 10 PM.', xp: 50, condition: () => new Date().getHours() >= 22 },
        { id: 'early_bird', emoji: '🌅', title: 'Early Bird', desc: 'Study before 7 AM.', xp: 50, condition: () => new Date().getHours() < 7 },
    ];

    function checkAll() {
        const state = Store.get.state();
        for (const achievement of ACHIEVEMENTS) {
            if (!Store.hasAchievement(achievement.id)) {
                try {
                    if (achievement.condition(state)) {
                        const unlocked = Store.unlockAchievement(achievement.id, achievement);
                        if (unlocked) {
                            showAchievementModal(achievement);
                        }
                    }
                } catch { }
            }
        }
    }

    function showAchievementModal(achievement) {
        const modal = document.getElementById('achievement-modal');
        const badge = document.getElementById('achievement-badge-icon');
        const title = document.getElementById('achievement-title');
        const desc = document.getElementById('achievement-desc');
        const xp = document.getElementById('achievement-xp-gained');
        const closeBtn = document.getElementById('achievement-close');

        if (!modal) return;

        if (badge) badge.textContent = achievement.emoji;
        if (title) title.textContent = achievement.title;
        if (desc) desc.textContent = achievement.desc;
        if (xp) xp.textContent = `+${achievement.xp} XP`;

        modal.hidden = false;
        Helpers.confetti(20);

        const close = () => { modal.hidden = true; };
        closeBtn?.addEventListener('click', close, { once: true });
        modal.addEventListener('click', e => { if (e.target === modal) close(); }, { once: true });
    }

    function render() {
        const el = document.getElementById('page-achievements');
        if (!el) return;

        const gam = Store.get.gamification();
        const history = Store.get.quizHistory();
        const state = Store.get.state();

        const unlockedIds = gam.unlockedAchievementIds;
        const unlockedAchs = ACHIEVEMENTS.filter(a => unlockedIds.has(a.id));
        const lockedAchs = ACHIEVEMENTS.filter(a => !unlockedIds.has(a.id));

        el.innerHTML = `
      <div class="anim-stagger">
        <div class="section-header">
          <div>
            <h1 class="section-title">Achievements 🏆</h1>
            <p class="section-subtitle">${unlockedAchs.length} of ${ACHIEVEMENTS.length} unlocked</p>
          </div>
          <span class="badge badge-amber">⭐ ${gam.points} points</span>
        </div>

        <!-- STREAK CARD -->
        <div class="streak-card mb-6">
          <div class="streak-card-fire">🔥</div>
          <div>
            <div class="streak-card-num" id="streak-anim-num">${gam.streak}</div>
            <div class="streak-card-label">Day Streak</div>
            <div class="streak-card-best">Best: ${gam.longestStreak} days</div>
          </div>
          <div style="flex:1"></div>
          <div style="text-align:right">
            <div style="font-size:var(--text-sm);color:var(--text-secondary);margin-bottom:var(--sp-2)">Keep it going!</div>
            <div style="font-size:var(--text-xs);color:var(--text-muted)">Last active: ${gam.lastActiveDate || 'Today'}</div>
          </div>
        </div>

        <!-- POINTS & LEVEL -->
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
            <span>${gam.xpForNextLevel} XP needed</span>
          </div>
        </div>

        <!-- UNLOCKED ACHIEVEMENTS -->
        ${unlockedAchs.length > 0 ? `
          <div class="section-header">
            <h2 class="section-title" style="font-size:var(--text-lg)">Unlocked (${unlockedAchs.length})</h2>
          </div>
          <div class="achievements-grid mb-6">
            ${unlockedAchs.map(a => renderAchievementCard(a, true, state)).join('')}
          </div>
        ` : ''}

        <!-- LOCKED ACHIEVEMENTS -->
        <div class="section-header">
          <h2 class="section-title" style="font-size:var(--text-lg)">Locked (${lockedAchs.length})</h2>
          <span class="badge badge-blue">Keep going!</span>
        </div>
        <div class="achievements-grid mb-6">
          ${lockedAchs.map(a => renderAchievementCard(a, false, state)).join('')}
        </div>

        <!-- LEADERBOARD (Simulated) -->
        <div class="section-header">
          <h2 class="section-title" style="font-size:var(--text-lg)">🏆 Leaderboard</h2>
          <span class="badge badge-purple">Top Learners</span>
        </div>
        <div class="leaderboard-card">
          <div class="leaderboard-header">🏆 Points Leaderboard</div>
          ${renderLeaderboard(gam.points)}
        </div>
      </div>
    `;

        // Animate streak number
        const streakEl = document.getElementById('streak-anim-num');
        if (streakEl && gam.streak > 0) {
            Helpers.animateNumber(streakEl, 0, gam.streak, 600);
        }
    }

    function renderAchievementCard(achievement, unlocked, state) {
        const unlockedData = state?.gamification?.achievements?.find(a => a.id === achievement.id);
        return `
      <div class="achievement-card ${unlocked ? 'unlocked' : 'locked'}">
        <div class="achievement-card-badge">${achievement.emoji}</div>
        <div class="achievement-card-title">${achievement.title}</div>
        <div class="achievement-card-desc">${achievement.desc}</div>
        <div class="achievement-card-xp">+${achievement.xp} XP</div>
        ${unlocked && unlockedData ? `<div class="achievement-unlock-date">Unlocked ${Helpers.formatDate(unlockedData.unlockedAt)}</div>` : ''}
        ${!unlocked ? '<div class="achievement-locked-icon">🔒</div>' : ''}
      </div>
    `;
    }

    function renderLeaderboard(userPoints) {
        // Simulated leaderboard with user's actual points
        const board = [
            { name: 'Alex K.', points: Math.max(userPoints + 320, 650), streak: 12 },
            { name: 'Priya M.', points: Math.max(userPoints + 150, 420), streak: 8 },
            { name: 'James L.', points: Math.max(userPoints + 80, 310), streak: 5 },
            { name: Store.get.user().name + ' (You)', points: userPoints, streak: Store.get.gamification().streak, isYou: true },
            { name: 'Sam T.', points: Math.max(userPoints - 50, 100), streak: 3 },
        ].sort((a, b) => b.points - a.points);

        return board.map((row, i) => `
      <div class="leaderboard-row ${row.isYou ? 'self' : ''}">
        <div class="lb-rank ${i < 3 ? 'top' : ''}">${i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}</div>
        <div class="avatar" style="width:32px;height:32px;font-size:var(--text-xs)">${row.name[0]}</div>
        <div class="lb-name">${row.name}</div>
        <div class="lb-streak">🔥 ${row.streak}d</div>
        <div class="lb-points">⭐ ${row.points}</div>
      </div>
    `).join('');
    }

    function subscribe() {
        Store.on('achievement:unlock', () => {
            if (document.getElementById('page-achievements')?.classList.contains('active')) render();
        });
        Store.on('points:change', () => {
            const el = document.getElementById('page-achievements');
            if (el?.classList.contains('active')) render();
        });
        Store.on('streak:change', () => {
            const el = document.getElementById('page-achievements');
            if (el?.classList.contains('active')) render();
            // Update sidebar streak
            const sideEl = document.getElementById('streak-count-display');
            if (sideEl) sideEl.textContent = Store.get.gamification().streak;
        });
    }

    return { render, subscribe, checkAll, showAchievementModal };
})();
