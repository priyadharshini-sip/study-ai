/**
 * pomodoro.module.js — Pomodoro Timer
 * SVG ring progress, focus lock, cycle tracking, session summary
 */

const PomodoroModule = (() => {
    let state = {
        mode: 'focus',       // 'focus' | 'short' | 'long'
        isRunning: false,
        timeLeft: 25 * 60,
        totalTime: 25 * 60,
        completedCycles: 0,
        currentCycle: 1,
        interval: null,
        sessionStart: null,
        sessionFocusMinutes: 0,
        focusLocked: false,
    };

    const CIRCUMFERENCE = 2 * Math.PI * 100; // r=100

    function getConfig() {
        const cfg = Store.get.pomodoroConfig();
        return {
            focus: cfg.focusMinutes * 60,
            short: cfg.shortBreakMinutes * 60,
            long: cfg.longBreakMinutes * 60,
            cycles: cfg.cyclesBeforeLong,
            autoBreak: cfg.autoStartBreak,
            focusLock: cfg.focusLock,
            sound: cfg.soundEnabled
        };
    }

    function render() {
        const el = document.getElementById('page-pomodoro');
        if (!el) return;

        const cfg = getConfig();
        const sessions = Store.get.pomodoroSessions();
        const totalFocus = sessions.reduce((a, s) => a + (s.focusMinutes || 0), 0);
        const totalSessions = sessions.length;

        const dashOffset = ((state.timeLeft / state.totalTime) * CIRCUMFERENCE);

        el.innerHTML = `
      <div>
        <div class="section-header">
          <div>
            <h1 class="section-title">Pomodoro Timer 🍅</h1>
            <p class="section-subtitle">Focus in sprints, rest, repeat</p>
          </div>
          <div style="display:flex;gap:var(--sp-2)">
            <span class="badge badge-purple">🔥 ${state.completedCycles} sessions today</span>
            <span class="badge badge-green">⏱️ ${totalFocus}m total</span>
          </div>
        </div>

        <div class="pomodoro-layout">
          <!-- TIMER CARD -->
          <div class="pomodoro-card">
            <!-- Mode Tabs -->
            <div class="pomo-mode-tabs">
              <button class="pomo-mode-tab ${state.mode === 'focus' ? 'active' : ''}"
                      onclick="PomodoroModule.setMode('focus')" id="tab-focus">🎯 Focus</button>
              <button class="pomo-mode-tab ${state.mode === 'short' ? 'active' : ''}"
                      onclick="PomodoroModule.setMode('short')" id="tab-short">☕ Short Break</button>
              <button class="pomo-mode-tab ${state.mode === 'long' ? 'active' : ''}"
                      onclick="PomodoroModule.setMode('long')" id="tab-long">🛌 Long Break</button>
            </div>

            <!-- SVG Ring Timer -->
            <div class="timer-ring-container ${state.focusLocked ? 'focus-locked' : ''}" id="timer-ring-container">
              <div class="focus-lock-ring"></div>
              <svg class="timer-svg" viewBox="0 0 220 220">
                <defs>
                  <linearGradient id="timerGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" style="stop-color:#7C3AED"/>
                    <stop offset="100%" style="stop-color:#3B82F6"/>
                  </linearGradient>
                </defs>
                <circle class="timer-ring-bg" cx="110" cy="110" r="100" />
                <circle class="timer-ring-progress" cx="110" cy="110" r="100"
                        stroke-dasharray="${CIRCUMFERENCE}"
                        stroke-dashoffset="${CIRCUMFERENCE - dashOffset}"
                        id="ring-progress" />
              </svg>
              <div class="timer-display">
                <div class="timer-digits" id="timer-digits">${Helpers.formatTime(state.timeLeft)}</div>
                <div class="timer-mode-label" id="timer-mode">${getModeLabel()}</div>
              </div>
            </div>

            <!-- Cycle Dots -->
            <div class="cycle-dots" id="cycle-dots">
              ${renderCycleDots(cfg.cycles)}
            </div>
            <div class="cycle-label">Cycle ${state.currentCycle} of ${cfg.cycles} before long break</div>

            <!-- Controls -->
            <div class="pomo-controls">
              <button class="pomo-btn-secondary" onclick="PomodoroModule.reset()" id="btn-pomo-reset" title="Reset">↺</button>
              <button class="pomo-btn-main" onclick="PomodoroModule.toggle()" id="btn-pomo-play"
                      aria-label="${state.isRunning ? 'Pause' : 'Start'}">
                ${state.isRunning ? '⏸' : '▶'}
              </button>
              <button class="pomo-btn-secondary" onclick="PomodoroModule.skip()" id="btn-pomo-skip" title="Skip">⏭</button>
            </div>

            <!-- Focus Lock Banner -->
            <div class="focus-lock-banner ${state.focusLocked ? 'active' : ''}" id="focus-lock-banner">
              <span class="focus-lock-banner-icon">🔒</span>
              Focus Lock Active — Stay on task! Navigation is restricted.
            </div>
          </div>

          <!-- SETTINGS PANEL -->
          <div>
            <div class="pomo-settings">
              <div class="pomo-settings-title">⚙️ Timer Settings</div>

              ${renderSetting('Focus Duration', 'Minutes of focused work', 'focusMinutes', cfg.focus / 60, 1, 90)}
              ${renderSetting('Short Break', 'Minutes for short break', 'shortBreakMinutes', cfg.short / 60, 1, 30)}
              ${renderSetting('Long Break', 'Minutes for long break', 'longBreakMinutes', cfg.long / 60, 5, 60)}
              ${renderSetting('Cycles', 'Pomodoros before long break', 'cyclesBeforeLong', cfg.cycles, 1, 8)}

              <div class="divider"></div>

              ${renderToggle('Auto-start Break', 'Start break timer automatically', 'autoStartBreak', cfg.autoBreak)}
              ${renderToggle('Focus Lock', 'Restrict navigation during focus', 'focusLock', cfg.focusLock)}
              ${renderToggle('Sound Alerts', 'Play sound when session ends', 'soundEnabled', cfg.sound)}
            </div>

            <!-- Today's Sessions -->
            <div class="card mt-6">
              <div class="section-title" style="font-size:var(--text-base);margin-bottom:var(--sp-4)">📊 Today's Stats</div>
              <div class="session-stats">
                <div>
                  <div class="session-stat-value">${state.completedCycles}</div>
                  <div class="session-stat-label">Sessions</div>
                </div>
                <div>
                  <div class="session-stat-value">${state.sessionFocusMinutes}m</div>
                  <div class="session-stat-label">Focused</div>
                </div>
                <div>
                  <div class="session-stat-value">${totalSessions}</div>
                  <div class="session-stat-label">All Time</div>
                </div>
              </div>

              <div class="divider"></div>

              <div style="font-size:var(--text-sm);font-weight:600;margin-bottom:var(--sp-3)">Recent Sessions</div>
              ${sessions.slice(0, 3).map(s => `
                <div style="display:flex;align-items:center;justify-content:space-between;padding:var(--sp-2) 0;border-bottom:1px solid var(--border-subtle);font-size:var(--text-sm)">
                  <span>🍅 ${s.completedCycles || 1} cycles</span>
                  <span style="color:var(--text-secondary)">${s.focusMinutes}m focus</span>
                  <span style="color:var(--text-muted)">${Helpers.formatDate(s.date)}</span>
                </div>
              `).join('') || '<p style="color:var(--text-muted);font-size:var(--text-xs);text-align:center">No sessions yet. Start your first!</p>'}
            </div>
          </div>
        </div>
      </div>
    `;

        bindSettingsEvents();
    }

    function renderCycleDots(cycles) {
        let html = '';
        for (let i = 1; i <= cycles; i++) {
            const cls = i < state.currentCycle ? 'completed' : i === state.currentCycle && state.mode === 'focus' ? 'current' : '';
            html += `<div class="cycle-dot ${cls}"></div>`;
        }
        return html;
    }

    function renderSetting(name, desc, key, value, min, max) {
        return `
      <div class="setting-row">
        <div class="setting-label-group">
          <div class="setting-name">${name}</div>
          <div class="setting-desc">${desc}</div>
        </div>
        <div class="setting-control">
          <button class="stepper-btn" onclick="PomodoroModule.adjustSetting('${key}', -1, ${min}, ${max})" id="dec-${key}">−</button>
          <span class="setting-value" id="sv-${key}">${value}</span>
          <button class="stepper-btn" onclick="PomodoroModule.adjustSetting('${key}', 1, ${min}, ${max})" id="inc-${key}">+</button>
        </div>
      </div>
    `;
    }

    function renderToggle(name, desc, key, value) {
        return `
      <div class="setting-row">
        <div class="setting-label-group">
          <div class="setting-name">${name}</div>
          <div class="setting-desc">${desc}</div>
        </div>
        <label class="toggle">
          <input type="checkbox" id="toggle-${key}" ${value ? 'checked' : ''} onchange="PomodoroModule.toggleSetting('${key}', this.checked)">
          <span class="toggle-slider"></span>
        </label>
      </div>
    `;
    }

    function bindSettingsEvents() {
        // Settings buttons are bound via inline onclick — nothing extra needed
    }

    function getModeLabel() {
        return { focus: '🎯 Focus Time', short: '☕ Short Break', long: '🛌 Long Break' }[state.mode];
    }

    // ===== CONTROLS =====
    function toggle() {
        if (state.isRunning) {
            pause();
        } else {
            start();
        }
    }

    function start() {
        state.isRunning = true;
        state.sessionStart = state.sessionStart || Date.now();
        state.focusLocked = state.mode === 'focus' && Store.get.pomodoroConfig().focusLock;

        clearInterval(state.interval);
        state.interval = setInterval(() => {
            state.timeLeft--;
            updateTimerUI();

            if (state.timeLeft <= 0) {
                clearInterval(state.interval);
                onSessionComplete();
            }
        }, 1000);

        updatePlayBtn();
    }

    function pause() {
        state.isRunning = false;
        state.focusLocked = false;
        clearInterval(state.interval);
        updatePlayBtn();
    }

    function reset() {
        pause();
        const cfg = getConfig();
        state.timeLeft = cfg[state.mode] || cfg.focus;
        state.totalTime = state.timeLeft;
        updateTimerUI();
        render();
    }

    function skip() {
        pause();
        onSessionComplete();
    }

    function setMode(mode) {
        if (state.isRunning) pause();
        state.mode = mode;
        const cfg = getConfig();
        state.timeLeft = cfg[mode] || cfg.focus;
        state.totalTime = state.timeLeft;
        state.focusLocked = false;
        render();
    }

    function onSessionComplete() {
        state.isRunning = false;
        state.focusLocked = false;

        if (state.mode === 'focus') {
            const focusMin = Math.round(Store.get.pomodoroConfig().focusMinutes);
            state.sessionFocusMinutes += focusMin;
            state.completedCycles++;

            Store.savePomodorSession({
                focusMinutes: focusMin,
                completedCycles: state.completedCycles,
                breaks: 0
            });

            Store.markActiveToday();
            AchievementsModule.checkAll();
            Helpers.toast('🎉 Focus session complete! Time for a break.', 'success');
            Helpers.floatReward('🍅', document.getElementById('btn-pomo-play'));

            // Check if long break needed
            const cfg = getConfig();
            if (state.currentCycle >= cfg.cycles) {
                state.currentCycle = 1;
                setMode('long');
            } else {
                state.currentCycle++;
                setMode('short');
            }

            // Auto-start break
            if (cfg.autoBreak) start();
        } else {
            Helpers.toast('Break over! Ready to focus? 💪', 'info');
            setMode('focus');
        }

        render();
    }

    function updateTimerUI() {
        const digitsEl = document.getElementById('timer-digits');
        const progressEl = document.getElementById('ring-progress');
        if (digitsEl) digitsEl.textContent = Helpers.formatTime(state.timeLeft);
        if (progressEl) {
            const dashOffset = (state.timeLeft / state.totalTime) * CIRCUMFERENCE;
            progressEl.style.strokeDashoffset = CIRCUMFERENCE - dashOffset;
        }
    }

    function updatePlayBtn() {
        const btn = document.getElementById('btn-pomo-play');
        if (btn) btn.textContent = state.isRunning ? '⏸' : '▶';
        const container = document.getElementById('timer-ring-container');
        if (container) container.classList.toggle('focus-locked', state.focusLocked);
        const banner = document.getElementById('focus-lock-banner');
        if (banner) banner.classList.toggle('active', state.focusLocked);
    }

    function adjustSetting(key, delta, min, max) {
        if (state.isRunning) { Helpers.toast('Pause the timer before changing settings.', 'warning'); return; }
        const cfg = Store.get.pomodoroConfig();
        const newVal = Helpers.clamp((cfg[key] || 1) + delta, min, max);
        Store.updatePomodoroConfig({ [key]: newVal });

        const svEl = document.getElementById(`sv-${key}`);
        if (svEl) svEl.textContent = newVal;

        // Update current timer if it matches mode
        if ((key === 'focusMinutes' && state.mode === 'focus') ||
            (key === 'shortBreakMinutes' && state.mode === 'short') ||
            (key === 'longBreakMinutes' && state.mode === 'long')) {
            state.timeLeft = newVal * 60;
            state.totalTime = newVal * 60;
            updateTimerUI();
        }
    }

    function toggleSetting(key, value) {
        Store.updatePomodoroConfig({ [key]: value });
        if (key === 'focusLock' && !value) { state.focusLocked = false; updatePlayBtn(); }
    }

    function subscribe() {
        Store.on('settings:change', () => {
            if (document.getElementById('page-pomodoro')?.classList.contains('active')) render();
        });
    }

    return { render, subscribe, toggle, start, pause, reset, skip, setMode, adjustSetting, toggleSetting };
})();
