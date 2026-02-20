/**
 * helpers.js — Shared utility functions
 */

const Helpers = (() => {

    /** Generate a unique ID */
    function uid() {
        return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    }

    /** Format seconds as mm:ss */
    function formatTime(seconds) {
        const m = Math.floor(seconds / 60).toString().padStart(2, '0');
        const s = (seconds % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    }

    /** Format bytes to human-readable */
    function formatBytes(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }

    /** Capitalize first letter of each word */
    function titleCase(str) {
        return str.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
    }

    /** Clamp a number between min and max */
    function clamp(val, min, max) {
        return Math.min(Math.max(val, min), max);
    }

    /** Deep clone an object */
    function deepClone(obj) {
        return JSON.parse(JSON.stringify(obj));
    }

    /** Shuffle an array in-place (Fisher-Yates) */
    function shuffle(arr) {
        const a = [...arr];
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }

    /** Debounce a function */
    function debounce(fn, delay = 300) {
        let timer;
        return (...args) => {
            clearTimeout(timer);
            timer = setTimeout(() => fn(...args), delay);
        };
    }

    /** Throttle a function */
    function throttle(fn, limit = 100) {
        let lastCall = 0;
        return (...args) => {
            const now = Date.now();
            if (now - lastCall >= limit) {
                lastCall = now;
                fn(...args);
            }
        };
    }

    /** Show a toast notification */
    function toast(message, type = 'info', duration = 3500) {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
        const el = document.createElement('div');
        el.className = `toast toast-${type}`;
        el.innerHTML = `
      <span class="toast-icon">${icons[type] || 'ℹ️'}</span>
      <span class="toast-message">${message}</span>
    `;
        container.appendChild(el);

        setTimeout(() => {
            el.style.animation = 'toastOut 0.3s ease forwards';
            setTimeout(() => el.remove(), 300);
        }, duration);
    }

    /** Add ripple effect to a button on click */
    function addRipple(button) {
        button.addEventListener('click', function (e) {
            const rect = button.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            const ripple = document.createElement('span');
            ripple.className = 'btn-ripple';
            ripple.style.cssText = `
        width: ${Math.max(rect.width, rect.height)}px;
        height: ${Math.max(rect.width, rect.height)}px;
        left: ${x - Math.max(rect.width, rect.height) / 2}px;
        top: ${y - Math.max(rect.width, rect.height) / 2}px;
      `;
            button.appendChild(ripple);
            setTimeout(() => ripple.remove(), 600);
        });
    }

    /** Float a reward emoji from an element */
    function floatReward(emoji, fromEl) {
        const rect = fromEl ? fromEl.getBoundingClientRect() : { top: window.innerHeight / 2, left: window.innerWidth / 2 };
        const el = document.createElement('div');
        el.className = 'reward-float';
        el.textContent = emoji;
        el.style.cssText = `top:${rect.top}px; left:${rect.left + 20}px;`;
        document.body.appendChild(el);
        setTimeout(() => el.remove(), 2100);
    }

    /** Animate a number from start to end */
    function animateNumber(el, start, end, duration = 800) {
        const startTime = performance.now();
        const update = (now) => {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3); // ease out cubic
            el.textContent = Math.round(start + (end - start) * eased);
            if (progress < 1) requestAnimationFrame(update);
        };
        requestAnimationFrame(update);
    }

    /** Spawn confetti particles */
    function confetti(count = 20) {
        const colors = ['#7C3AED', '#3B82F6', '#EC4899', '#F59E0B', '#10B981', '#06B6D4'];
        for (let i = 0; i < count; i++) {
            const el = document.createElement('div');
            el.className = 'confetti-particle';
            el.style.cssText = `
        left: ${Math.random() * 100}vw;
        top: -20px;
        background: ${colors[Math.floor(Math.random() * colors.length)]};
        animation-delay: ${Math.random() * 1}s;
        animation-duration: ${2 + Math.random() * 2}s;
        transform: rotate(${Math.random() * 360}deg);
        width: ${6 + Math.random() * 8}px;
        height: ${6 + Math.random() * 8}px;
        border-radius: ${Math.random() > 0.5 ? '50%' : '2px'};
      `;
            document.body.appendChild(el);
            setTimeout(() => el.remove(), 4000);
        }
    }

    /** Format a date as "Today", "Yesterday", or formatted date */
    function formatDate(dateString) {
        const date = new Date(dateString);
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(today.getDate() - 1);

        if (date.toDateString() === today.toDateString()) return 'Today';
        if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }

    /** Get time string like "2:34 PM" */
    function formatClock(dateString) {
        return new Date(dateString).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    }

    /** Truncate text at word boundary */
    function truncate(text, maxLength = 80) {
        if (text.length <= maxLength) return text;
        return text.slice(0, maxLength).replace(/\s+\S*$/, '') + '…';
    }

    /** LocalStorage helpers with JSON support */
    const storage = {
        get(key, fallback = null) {
            try {
                const val = localStorage.getItem(key);
                return val !== null ? JSON.parse(val) : fallback;
            } catch { return fallback; }
        },
        set(key, value) {
            try { localStorage.setItem(key, JSON.stringify(value)); } catch { }
        },
        remove(key) { localStorage.removeItem(key); }
    };

    return {
        uid, formatTime, formatBytes, titleCase, clamp, deepClone, shuffle,
        debounce, throttle, toast, addRipple, floatReward, animateNumber,
        confetti, formatDate, formatClock, truncate, storage
    };
})();
