/**
 * store.js — Client-Side State Management
 * Single source of truth, persisted to localStorage.
 * All modules read/write through this store.
 */

const Store = (() => {
    const STORAGE_KEY = 'studyai_state_v2';

    // ===== DEFAULT STATE =====
    const DEFAULT_STATE = {
        // User info
        user: {
            name: 'Student',
            avatar: 'S',
            joinDate: new Date().toISOString(),
        },

        // Settings
        settings: {
            theme: 'dark',
            apiKey: null, // stored separately in sessionStorage for security
            pomodoro: {
                focusMinutes: 25,
                shortBreakMinutes: 5,
                longBreakMinutes: 15,
                cyclesBeforeLong: 4,
                autoStartBreak: false,
                focusLock: false,
                soundEnabled: true
            }
        },

        // Documents & Content
        documents: [], // { id, name, size, uploadedAt, title, topics[], flashcards[], quizQuestions[] }

        // Flashcard performance data
        flashcardStats: {
            // keyed by flashcard id
            // { status: 'new'|'learning'|'mastered', correctCount, wrongCount, lastReviewed }
        },

        // Quiz history
        quizHistory: [],
        // { id, docId, topic, difficulty, date, score, total, time, correct: [], wrong: [] }

        // Pomodoro sessions
        pomodoroSessions: [],
        // { id, date, focusMinutes, completedCycles, breaks }

        // Streaks & Gamification
        gamification: {
            points: 0,
            xp: 0,
            level: 1,
            xpForNextLevel: 200,
            streak: 0,
            longestStreak: 0,
            lastActiveDate: null,
            achievements: [],
            unlockedAchievementIds: new Set(),
        },

        // Group Study (frontend-only state)
        groups: [], // { id, name, emoji, color, members[], messages[], createdAt }
        activeGroupId: null,

        // UI state (not persisted)
        ui: {
            currentPage: 'dashboard',
            activeDocId: null,
            activeTopicFilter: 'all',
            quizDifficulty: 'medium',
        }
    };

    // ===== INTERNAL STATE =====
    let _state = null;
    const _listeners = new Map(); // eventName -> Set of callbacks

    // ===== INIT =====
    function init() {
        const saved = Helpers.storage.get(STORAGE_KEY, null);
        if (saved) {
            // Deep merge saved state with defaults
            _state = deepMerge(DEFAULT_STATE, saved);
            // Restore Set (serialized as array in JSON)
            if (Array.isArray(_state.gamification.unlockedAchievementIds)) {
                _state.gamification.unlockedAchievementIds = new Set(_state.gamification.unlockedAchievementIds);
            } else {
                _state.gamification.unlockedAchievementIds = new Set();
            }
        } else {
            _state = Helpers.deepClone(DEFAULT_STATE);
            _state.gamification.unlockedAchievementIds = new Set();
        }
        // Don't persist UI state
        _state.ui = { ...DEFAULT_STATE.ui };
        _checkAndUpdateStreak();
        return _state;
    }

    function deepMerge(base, override) {
        const result = { ...base };
        for (const key of Object.keys(override)) {
            if (
                override[key] !== null &&
                typeof override[key] === 'object' &&
                !Array.isArray(override[key]) &&
                !(override[key] instanceof Set) &&
                typeof base[key] === 'object' &&
                base[key] !== null
            ) {
                result[key] = deepMerge(base[key], override[key]);
            } else {
                result[key] = override[key];
            }
        }
        return result;
    }

    // ===== SAVE =====
    function _save() {
        try {
            const toSave = {
                ..._state,
                gamification: {
                    ..._state.gamification,
                    unlockedAchievementIds: [..._state.gamification.unlockedAchievementIds]
                },
                ui: undefined // don't persist UI
            };
            Helpers.storage.set(STORAGE_KEY, toSave);
        } catch (e) {
            console.warn('State save failed:', e);
        }
    }

    // ===== EVENT SYSTEM =====
    function on(event, cb) {
        if (!_listeners.has(event)) _listeners.set(event, new Set());
        _listeners.get(event).add(cb);
        return () => off(event, cb);
    }

    function off(event, cb) {
        _listeners.get(event)?.delete(cb);
    }

    function emit(event, payload) {
        _listeners.get(event)?.forEach(cb => cb(payload));
        _listeners.get('*')?.forEach(cb => cb({ event, payload }));
    }

    // ===== GETTERS =====
    const get = {
        state: () => _state,
        user: () => _state.user,
        settings: () => _state.settings,
        documents: () => _state.documents,
        activeDoc: () => _state.documents.find(d => d.id === _state.ui.activeDocId) || null,
        allFlashcards: () => _state.documents.flatMap(d => d.flashcards || []),
        allQuizQuestions: () => _state.documents.flatMap(d => d.quizQuestions || []),
        flashcardStat: (id) => _state.flashcardStats[id] || { status: 'new', correctCount: 0, wrongCount: 0 },
        quizHistory: () => _state.quizHistory,
        pomodoroSessions: () => _state.pomodoroSessions,
        gamification: () => _state.gamification,
        groups: () => _state.groups,
        activeGroup: () => _state.groups.find(g => g.id === _state.activeGroupId) || null,
        ui: () => _state.ui,
        points: () => _state.gamification.points,
        xp: () => _state.gamification.xp,
        level: () => _state.gamification.level,
        streak: () => _state.gamification.streak,
        pomodoroConfig: () => _state.settings.pomodoro,
    };

    // ===== DOCUMENT ACTIONS =====
    function addDocument(docData) {
        const doc = { id: Helpers.uid(), uploadedAt: new Date().toISOString(), ...docData };
        _state.documents.unshift(doc);
        _state.ui.activeDocId = doc.id;
        _save();
        emit('documents:change', _state.documents);
        emit('ui:change', _state.ui);
        return doc;
    }

    function deleteDocument(docId) {
        _state.documents = _state.documents.filter(d => d.id !== docId);
        if (_state.ui.activeDocId === docId) {
            _state.ui.activeDocId = _state.documents[0]?.id || null;
        }
        _save();
        emit('documents:change', _state.documents);
    }

    function setActiveDoc(docId) {
        _state.ui.activeDocId = docId;
        emit('ui:change', _state.ui);
    }

    // ===== FLASHCARD ACTIONS =====
    function updateFlashcardStat(cardId, result) {
        // result: 'correct' | 'hard' | 'wrong'
        const stat = _state.flashcardStats[cardId] || { status: 'new', correctCount: 0, wrongCount: 0 };

        if (result === 'correct') {
            stat.correctCount = (stat.correctCount || 0) + 1;
            stat.status = stat.correctCount >= 3 ? 'mastered' : 'learning';
        } else if (result === 'wrong') {
            stat.wrongCount = (stat.wrongCount || 0) + 1;
            stat.status = 'learning';
        } else {
            stat.status = 'learning';
        }
        stat.lastReviewed = new Date().toISOString();
        _state.flashcardStats[cardId] = stat;

        // Update flashcard within document
        for (const doc of _state.documents) {
            const fc = doc.flashcards?.find(f => f.id === cardId);
            if (fc) {
                fc.status = stat.status;
                fc.correctCount = stat.correctCount;
                fc.wrongCount = stat.wrongCount;
                fc.lastReviewed = stat.lastReviewed;
                break;
            }
        }

        if (result === 'correct') {
            addPoints(5, 'Correct flashcard');
        }

        _save();
        emit('flashcard:update', { cardId, stat });
    }

    // ===== QUIZ ACTIONS =====
    function saveQuizResult(result) {
        const entry = {
            id: Helpers.uid(),
            date: new Date().toISOString(),
            ...result
        };
        _state.quizHistory.unshift(entry);
        _save();
        emit('quiz:complete', entry);
        return entry;
    }

    // ===== POMODORO =====
    function savePomodorSession(session) {
        _state.pomodoroSessions.unshift({ id: Helpers.uid(), date: new Date().toISOString(), ...session });
        addPoints(20, 'Completed Pomodoro session');
        _save();
        emit('pomodoro:complete', session);
    }

    function updatePomodoroConfig(cfg) {
        _state.settings.pomodoro = { ..._state.settings.pomodoro, ...cfg };
        _save();
        emit('settings:change', _state.settings);
    }

    // ===== GAMIFICATION =====
    function addPoints(amount, reason = '') {
        _state.gamification.points += amount;
        addXP(amount);
        _save();
        emit('points:change', { amount, total: _state.gamification.points, reason });
    }

    function addXP(amount) {
        _state.gamification.xp += amount;
        while (_state.gamification.xp >= _state.gamification.xpForNextLevel) {
            _state.gamification.xp -= _state.gamification.xpForNextLevel;
            _state.gamification.level += 1;
            _state.gamification.xpForNextLevel = Math.round(_state.gamification.xpForNextLevel * 1.3);
            emit('level:up', _state.gamification.level);
        }
        emit('xp:change', _state.gamification);
    }

    function unlockAchievement(achievementId, achievementData) {
        if (_state.gamification.unlockedAchievementIds.has(achievementId)) return false;
        _state.gamification.unlockedAchievementIds.add(achievementId);
        _state.gamification.achievements.push({
            id: achievementId,
            unlockedAt: new Date().toISOString(),
            ...achievementData
        });
        addXP(achievementData.xp || 50);
        _save();
        emit('achievement:unlock', achievementData);
        return true;
    }

    function hasAchievement(id) {
        return _state.gamification.unlockedAchievementIds.has(id);
    }

    // ===== STREAK CHECK =====
    function _checkAndUpdateStreak() {
        const today = new Date().toDateString();
        const last = _state.gamification.lastActiveDate;

        if (!last) {
            _state.gamification.lastActiveDate = today;
            return;
        }

        const lastDate = new Date(last);
        const todayDate = new Date(today);
        const dayDiff = Math.floor((todayDate - lastDate) / (1000 * 60 * 60 * 24));

        if (dayDiff === 0) return; // same day
        if (dayDiff === 1) {
            // consecutive day
            _state.gamification.streak += 1;
            if (_state.gamification.streak > _state.gamification.longestStreak) {
                _state.gamification.longestStreak = _state.gamification.streak;
            }
        } else {
            // streak broken
            _state.gamification.streak = 1;
        }
        _state.gamification.lastActiveDate = today;
        _save();
        emit('streak:change', _state.gamification.streak);
    }

    function markActiveToday() {
        _checkAndUpdateStreak();
        if (!_state.gamification.lastActiveDate) {
            _state.gamification.lastActiveDate = new Date().toDateString();
            _state.gamification.streak = 1;
            _save();
            emit('streak:change', _state.gamification.streak);
        }
    }

    // ===== UI ACTIONS =====
    function setPage(page) {
        _state.ui.currentPage = page;
        emit('page:change', page);
    }

    function setTopicFilter(topic) {
        _state.ui.activeTopicFilter = topic;
        emit('ui:change', _state.ui);
    }

    function setQuizDifficulty(diff) {
        _state.ui.quizDifficulty = diff;
    }

    // ===== GROUPS =====
    function createGroup(data) {
        const group = {
            id: Helpers.uid(),
            createdAt: new Date().toISOString(),
            members: [{ id: 'me', name: _state.user.name, role: 'admin', status: 'online', points: 0 }],
            messages: [],
            ...data
        };
        _state.groups.push(group);
        _state.activeGroupId = group.id;
        _save();
        emit('groups:change', _state.groups);
        return group;
    }

    function joinGroup(code) {
        // In frontend-only mode, we simulate joining via code
        const group = {
            id: Helpers.uid(),
            name: `Study Group #${code}`,
            emoji: '📚',
            color: 'color-3',
            members: [
                { id: 'me', name: _state.user.name, role: 'member', status: 'online', points: 0 },
                { id: 'alice', name: 'Alice K.', role: 'admin', status: 'online', points: 340 },
                { id: 'bob', name: 'Bob M.', role: 'member', status: 'away', points: 215 },
            ],
            messages: [
                { id: 'm0', senderId: 'alice', senderName: 'Alice K.', text: 'Welcome to the group! 🎉', time: new Date(Date.now() - 60000).toISOString(), type: 'text' }
            ],
            createdAt: new Date().toISOString()
        };
        _state.groups.push(group);
        _state.activeGroupId = group.id;
        _save();
        emit('groups:change', _state.groups);
        return group;
    }

    function sendMessage(groupId, message) {
        const group = _state.groups.find(g => g.id === groupId);
        if (!group) return;
        const msg = {
            id: Helpers.uid(),
            senderId: 'me',
            senderName: _state.user.name,
            time: new Date().toISOString(),
            type: 'text',
            ...message
        };
        group.messages.push(msg);
        _save();
        emit('group:message', { groupId, message: msg });
        return msg;
    }

    function setActiveGroup(groupId) {
        _state.activeGroupId = groupId;
        emit('ui:change', _state.ui);
    }

    // ===== THEME =====
    function setTheme(theme) {
        _state.settings.theme = theme;
        document.documentElement.setAttribute('data-theme', theme);
        _save();
        emit('settings:change', _state.settings);
    }

    // Reset all data
    function reset() {
        Helpers.storage.remove(STORAGE_KEY);
        _state = Helpers.deepClone(DEFAULT_STATE);
        _state.gamification.unlockedAchievementIds = new Set();
        _save();
        emit('reset', null);
    }

    return {
        init, on, off, emit, get,
        addDocument, deleteDocument, setActiveDoc,
        updateFlashcardStat,
        saveQuizResult,
        savePomodorSession, updatePomodoroConfig,
        addPoints, addXP, unlockAchievement, hasAchievement, markActiveToday,
        setPage, setTopicFilter, setQuizDifficulty,
        createGroup, joinGroup, sendMessage, setActiveGroup,
        setTheme, reset
    };
})();
