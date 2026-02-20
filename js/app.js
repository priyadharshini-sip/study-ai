/**
 * app.js — Application Bootstrap & Router
 * Initializes state, registers all modules, handles navigation,
 * dark/light mode, sidebar toggle, and global event plumbing.
 */

const App = (() => {
    const PAGES = {
        dashboard: { title: 'Dashboard', module: DashboardModule },
        upload: { title: 'Upload Document', module: UploadModule },
        flashcards: { title: 'Flashcards', module: FlashcardsModule },
        quiz: { title: 'Quiz', module: QuizModule },
        pomodoro: { title: 'Pomodoro', module: PomodoroModule },
        progress: { title: 'Progress', module: ProgressModule },
        groups: { title: 'Group Study', module: GroupsModule },
        achievements: { title: 'Achievements', module: AchievementsModule },
    };

    // ===== INIT =====
    function init() {
        // Initialize state store
        const state = Store.init();

        // Apply saved theme
        const theme = state.settings.theme || 'dark';
        document.documentElement.setAttribute('data-theme', theme);

        // Subscribe all modules to store events
        Object.values(PAGES).forEach(page => {
            if (page.module?.subscribe) page.module.subscribe();
        });

        // Subscribe to global store events
        Store.on('points:change', updatePointsDisplay);
        Store.on('xp:change', updateXPDisplay);
        Store.on('streak:change', updateStreakDisplay);
        Store.on('level:up', onLevelUp);
        // page:change is handled inline — no separate listener needed

        // Render initial page
        navigate('dashboard');

        // Bind all UI events
        bindSidebarNav();
        bindThemeToggle();
        bindSidebarCollapse();
        bindMobileMenu();
        bindRippleEffects();

        // Update gamification displays
        updatePointsDisplay({ total: Store.get.points() });
        updateXPDisplay(Store.get.gamification());
        updateStreakDisplay(Store.get.streak());

        // Check achievements on load
        AchievementsModule.checkAll();

        // Mark today as active
        Store.markActiveToday();

        console.log('🌟 StudyAI initialized!');
    }

    // ===== NAVIGATION =====
    function navigate(pageId) {
        if (!PAGES[pageId]) return;

        // Deactivate all pages & nav items
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

        // Activate new page
        const pageEl = document.getElementById(`page-${pageId}`);
        const navEl = document.getElementById(`nav-${pageId}`);
        if (pageEl) pageEl.classList.add('active');
        if (navEl) navEl.classList.add('active');

        // Update title
        const titleEl = document.getElementById('page-title');
        if (titleEl) titleEl.textContent = PAGES[pageId].title;

        // Check focus lock (Pomodoro) — prevent navigation
        const pomo = Store.get.state();
        if (
            pageId !== 'pomodoro' &&
            pomo.settings?.pomodoro?.focusLock &&
            document.getElementById('page-pomodoro')?.classList.contains('active')
        ) {
            // Don't check here — PomodoroModule handles focus lock state internally
        }

        // Render the module
        PAGES[pageId].module?.render();

        // Update store UI state
        Store.setPage(pageId);

        // Close mobile sidebar
        closeMobileSidebar();

        // Scroll content to top
        document.getElementById('main-content')?.scrollTo(0, 0);
    }

    function openDoc(docId) {
        Store.setActiveDoc(docId);
    }

    // ===== SIDEBAR NAV =====
    function bindSidebarNav() {
        document.querySelectorAll('.nav-item[data-page]').forEach(item => {
            item.addEventListener('click', e => {
                e.preventDefault();
                navigate(item.dataset.page);
            });
        });
    }

    // ===== THEME TOGGLE =====
    function bindThemeToggle() {
        const btn = document.getElementById('theme-toggle');
        btn?.addEventListener('click', () => {
            const current = document.documentElement.getAttribute('data-theme');
            const next = current === 'dark' ? 'light' : 'dark';
            Store.setTheme(next);
            _updateThemeLabel(next);
        });
        // Set initial label
        _updateThemeLabel(document.documentElement.getAttribute('data-theme') || 'dark');
    }

    function _updateThemeLabel(theme) {
        const label = document.querySelector('.theme-label');
        if (label) label.textContent = theme === 'dark' ? 'Light Mode' : 'Dark Mode';
    }

    // ===== SIDEBAR COLLAPSE =====
    function bindSidebarCollapse() {
        const toggle = document.getElementById('sidebar-toggle');
        const sidebar = document.getElementById('sidebar');
        toggle?.addEventListener('click', () => {
            sidebar?.classList.toggle('collapsed');
        });
    }

    // ===== MOBILE MENU =====
    function bindMobileMenu() {
        const btn = document.getElementById('mobile-menu-btn');
        btn?.addEventListener('click', openMobileSidebar);

        // Create backdrop
        const backdrop = document.createElement('div');
        backdrop.className = 'sidebar-backdrop';
        backdrop.id = 'sidebar-backdrop';
        document.body.appendChild(backdrop);
        backdrop.addEventListener('click', closeMobileSidebar);
    }

    function openMobileSidebar() {
        document.getElementById('sidebar')?.classList.add('mobile-open');
        document.getElementById('sidebar-backdrop')?.classList.add('active');
    }

    function closeMobileSidebar() {
        document.getElementById('sidebar')?.classList.remove('mobile-open');
        document.getElementById('sidebar-backdrop')?.classList.remove('active');
    }

    // ===== RIPPLE EFFECTS =====
    function bindRippleEffects() {
        document.addEventListener('click', e => {
            const btn = e.target.closest('.btn-primary, .btn-secondary, .btn-success, .btn-danger');
            if (!btn) return;
            const rect = btn.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const ripple = document.createElement('span');
            ripple.className = 'btn-ripple';
            const size = Math.max(rect.width, rect.height);
            ripple.style.cssText = `width:${size}px;height:${size}px;left:${x - size / 2}px;top:${y - size / 2}px;`;
            btn.style.position = 'relative';
            btn.style.overflow = 'hidden';
            btn.appendChild(ripple);
            setTimeout(() => ripple.remove(), 600);
        });
    }

    // ===== GAMIFICATION UPDATES =====
    function updatePointsDisplay({ total }) {
        const el = document.getElementById('points-display');
        if (el) el.textContent = `${total} pts`;
    }

    function updateXPDisplay(gam) {
        const totalXp = document.getElementById('total-xp');
        const fillMini = document.getElementById('xp-fill-mini');
        if (totalXp) totalXp.textContent = gam.xp + gam.level * (gam.xpForNextLevel || 200);
        if (fillMini) fillMini.style.width = Math.round(gam.xp / (gam.xpForNextLevel || 200) * 100) + '%';
    }

    function updateStreakDisplay(streak) {
        const el = document.getElementById('streak-count-display');
        if (el) el.textContent = streak;
    }

    function onLevelUp(level) {
        Helpers.toast(`🎉 Level Up! You're now Level ${level}!`, 'success', 4000);
        Helpers.confetti(25);
    }

    // ===== KEYBOARD SHORTCUTS =====
    document.addEventListener('keydown', e => {
        // Ctrl/Cmd + number to navigate pages
        if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey) {
            const numMap = { '1': 'dashboard', '2': 'upload', '3': 'flashcards', '4': 'quiz', '5': 'pomodoro', '6': 'progress', '7': 'groups', '8': 'achievements' };
            if (numMap[e.key]) {
                e.preventDefault();
                navigate(numMap[e.key]);
            }
        }
    });

    return { init, navigate, openDoc };
})();

// ===== BOOT =====
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
