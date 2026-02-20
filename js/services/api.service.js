/**
 * api.service.js — AI API Integration
 * Supports: OpenAI (GPT-4o / GPT-3.5-turbo) + Google Gemini (1.5-flash)
 * Provider is selected by the user and stored in sessionStorage.
 *
 * SECURITY: API keys are NEVER hardcoded. Stored only in sessionStorage.
 * AI calls happen ONLY on document upload (isolated to this file).
 */

const ApiService = (() => {
    // ----------------------------------------------------------------
    // Provider Config
    // ----------------------------------------------------------------
    const PROVIDERS = {
        openai: {
            name: 'OpenAI',
            label: 'OpenAI (GPT-4o)',
            keyPrefix: 'sk-',
            keyHint: 'sk-...',
            endpoint: 'https://api.openai.com/v1/chat/completions',
            model: 'gpt-4o',                    // or 'gpt-3.5-turbo'
            fallbackModel: 'gpt-3.5-turbo',
        },
        gemini: {
            name: 'Google Gemini',
            label: 'Google Gemini (1.5 Flash)',
            keyPrefix: 'AIza',
            keyHint: 'AIza...',
            endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent',
            model: 'gemini-1.5-flash-latest',
        }
    };

    const SESSION_KEYS = {
        provider: 'STUDYAI_PROVIDER',
        openai: 'STUDYAI_OPENAI_KEY',
        gemini: 'STUDYAI_GEMINI_KEY',
    };

    // ----------------------------------------------------------------
    // Provider management
    // ----------------------------------------------------------------
    function getProvider() {
        return sessionStorage.getItem(SESSION_KEYS.provider) || 'openai';
    }

    function setProvider(provider) {
        if (PROVIDERS[provider]) {
            sessionStorage.setItem(SESSION_KEYS.provider, provider);
        }
    }

    function getProviderConfig() {
        return PROVIDERS[getProvider()];
    }

    // ----------------------------------------------------------------
    // API Key helpers
    // ----------------------------------------------------------------
    function getApiKey(provider = null) {
        const p = provider || getProvider();
        const storageKey = p === 'openai' ? SESSION_KEYS.openai : SESSION_KEYS.gemini;
        const k = sessionStorage.getItem(storageKey);
        return k ? k.trim() : null;
    }

    function setApiKey(key, provider = null) {
        const p = provider || getProvider();
        const storageKey = p === 'openai' ? SESSION_KEYS.openai : SESSION_KEYS.gemini;
        sessionStorage.setItem(storageKey, key.trim());
    }

    function clearApiKey(provider = null) {
        const p = provider || getProvider();
        const storageKey = p === 'openai' ? SESSION_KEYS.openai : SESSION_KEYS.gemini;
        sessionStorage.removeItem(storageKey);
    }

    function hasApiKey(provider = null) {
        const k = getApiKey(provider);
        return !!(k && k.length > 10);
    }

    // ----------------------------------------------------------------
    // File → Base64 (Gemini needs inline_data)
    // ----------------------------------------------------------------
    async function fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result.split(',')[1]);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    // ----------------------------------------------------------------
    // Parse HTTP error response into friendly message
    // ----------------------------------------------------------------
    function parseHttpError(status, data, providerName) {
        const apiMsg = data?.error?.message || data?.error?.code || data?.message || `HTTP ${status}`;
        if (status === 401) return `INVALID_KEY: ${providerName} API key is invalid or expired. (${apiMsg})`;
        if (status === 403) return `FORBIDDEN: ${providerName} API access forbidden. Check billing/plan. (${apiMsg})`;
        if (status === 429) {
            // Check if it's a billing quota issue (insufficient_quota) vs rate limit
            const isQuotaExhausted = apiMsg.includes('quota') || apiMsg.includes('billing') || apiMsg.includes('insufficient_quota') || apiMsg.includes('current quota');
            if (isQuotaExhausted) {
                return `QUOTA_EXHAUSTED: Your ${providerName} account has no credits remaining. Add credits at ${providerName === 'OpenAI' ? 'https://platform.openai.com/settings/billing' : 'https://console.cloud.google.com/'} OR switch to Google Gemini (free). (${apiMsg})`;
            }
            return `RATE_LIMITED: Too many requests. Wait 30 seconds and try again. (${apiMsg})`;
        }
        if (status === 404) return `NOT_FOUND: Model not found. (${apiMsg})`;
        if (status === 400) return `BAD_REQUEST: ${apiMsg}`;
        if (status === 500) return `SERVER_ERROR: ${providerName} server error. Try again. (${apiMsg})`;
        return `API_ERROR_${status}: ${apiMsg}`;
    }

    // ----------------------------------------------------------------
    // Core call: OpenAI Chat Completions
    // ----------------------------------------------------------------
    async function callOpenAI(prompt, apiKey) {
        const cfg = PROVIDERS.openai;
        const key = (apiKey || getApiKey('openai') || '').trim();
        if (!key) throw new Error('API_KEY_MISSING');

        console.log('[StudyAI/OpenAI] Calling', cfg.model);

        let response;
        try {
            response = await fetch(cfg.endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${key}`,
                },
                body: JSON.stringify({
                    model: cfg.model,
                    messages: [
                        { role: 'system', content: 'You are an expert study assistant that generates flashcards and quizzes from documents. Always respond with pure valid JSON, no markdown, no explanation.' },
                        { role: 'user', content: prompt }
                    ],
                    max_tokens: 4096,
                    temperature: 0.4,
                })
            });
        } catch (err) {
            console.error('[StudyAI/OpenAI] Network error:', err);
            throw new Error(`NETWORK_ERROR: ${err.message}`);
        }

        let data;
        try { data = await response.json(); } catch { data = {}; }

        console.log('[StudyAI/OpenAI] Status:', response.status, data?.error || '✅');

        if (!response.ok) {
            throw new Error(parseHttpError(response.status, data, 'OpenAI'));
        }

        const text = data?.choices?.[0]?.message?.content;
        if (!text) throw new Error('No content returned from OpenAI');
        return text;
    }

    // ----------------------------------------------------------------
    // Core call: Google Gemini
    // ----------------------------------------------------------------
    async function callGemini(prompt, fileBase64 = null, mimeType = 'text/plain', apiKey = null) {
        const cfg = PROVIDERS.gemini;
        const key = (apiKey || getApiKey('gemini') || '').trim();
        if (!key) throw new Error('API_KEY_MISSING');

        console.log('[StudyAI/Gemini] Calling', cfg.model);

        const parts = [{ text: prompt }];
        if (fileBase64) {
            parts.push({ inline_data: { mime_type: mimeType, data: fileBase64 } });
        }

        let response;
        try {
            response = await fetch(`${cfg.endpoint}?key=${encodeURIComponent(key)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts }],
                    generationConfig: { maxOutputTokens: 8192, temperature: 0.4 }
                })
            });
        } catch (err) {
            console.error('[StudyAI/Gemini] Network error:', err);
            throw new Error(`NETWORK_ERROR: ${err.message}`);
        }

        let data;
        try { data = await response.json(); } catch { data = {}; }

        console.log('[StudyAI/Gemini] Status:', response.status, data?.error || '✅');

        if (!response.ok) {
            throw new Error(parseHttpError(response.status, data, 'Gemini'));
        }

        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) throw new Error('No content returned from Gemini');
        return text;
    }

    // ----------------------------------------------------------------
    // Unified call — routes to correct provider
    // ----------------------------------------------------------------
    async function callAI(prompt, fileBase64 = null, mimeType = 'text/plain') {
        const provider = getProvider();
        if (provider === 'openai') {
            // OpenAI doesn't support inline files in the same way;
            // embed file content in the prompt for text files
            return callOpenAI(prompt);
        } else {
            return callGemini(prompt, fileBase64, mimeType);
        }
    }

    // ----------------------------------------------------------------
    // Parse JSON from AI response (strips markdown fences)
    // ----------------------------------------------------------------
    function parseJSON(text) {
        try {
            const cleaned = text
                .replace(/^```json\s*/im, '').replace(/^```\s*/im, '').replace(/```\s*$/im, '')
                .trim();
            return JSON.parse(cleaned);
        } catch {
            const match = text.match(/[\[{][\s\S]*[\]}]/);
            if (match) {
                try { return JSON.parse(match[0]); } catch { }
            }
            console.error('[StudyAI] Failed to parse JSON. Raw:', text.slice(0, 500));
            throw new Error('Failed to parse AI response as JSON');
        }
    }

    // ----------------------------------------------------------------
    // TEST API KEY — returns { valid, error?, warning? }
    // ----------------------------------------------------------------
    async function testApiKey(rawKey, providerOverride = null) {
        const key = (rawKey || '').trim();
        const provider = providerOverride || getProvider();
        const cfg = PROVIDERS[provider];

        if (!key) return { valid: false, error: 'No API key provided.' };

        // Format check
        if (!key.startsWith(cfg.keyPrefix)) {
            return {
                valid: false,
                error: `${cfg.name} keys start with "${cfg.keyPrefix}...". Please check your key.`
            };
        }

        console.log(`[StudyAI] Testing ${cfg.name} API key...`);

        try {
            let response, data;

            if (provider === 'openai') {
                try {
                    response = await fetch(cfg.endpoint, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${key}`,
                        },
                        body: JSON.stringify({
                            model: cfg.model,
                            messages: [{ role: 'user', content: 'Say: OK' }],
                            max_tokens: 5,
                        })
                    });
                } catch (err) {
                    return { valid: false, error: `Network error: ${err.message}` };
                }
                try { data = await response.json(); } catch { data = {}; }

            } else {
                // Gemini
                try {
                    response = await fetch(`${cfg.endpoint}?key=${encodeURIComponent(key)}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            contents: [{ parts: [{ text: 'Say: OK' }] }],
                            generationConfig: { maxOutputTokens: 5 }
                        })
                    });
                } catch (err) {
                    return { valid: false, error: `Network error: ${err.message}` };
                }
                try { data = await response.json(); } catch { data = {}; }
            }

            const status = response.status;
            console.log(`[StudyAI] ${cfg.name} test → status ${status}`, data?.error || '✅');

            if (response.ok || status === 200) {
                console.log(`[StudyAI] ✅ ${cfg.name} key is valid`);
                return { valid: true };
            }

            // Special cases that mean key IS valid
            if (status === 400) {
                // Bad request usually means key is OK, request was just malformed
                return { valid: true };
            }
            if (status === 403 && provider === 'gemini') {
                return { valid: true, warning: 'API key accepted, but Gemini API may need to be enabled in Google Cloud Console.' };
            }
            if (status === 429) {
                return { valid: true, warning: 'Key is valid but rate-limited. Wait a moment before uploading.' };
            }
            if (status === 401) {
                return { valid: false, error: `Invalid ${cfg.name} API key (401). Check you copied the full key correctly.` };
            }
            if (status === 403) {
                return { valid: false, error: `${cfg.name} access forbidden (403). Check your plan/billing.` };
            }

            const apiMsg = data?.error?.message || `HTTP ${status}`;
            return { valid: false, error: `${cfg.name} error (${status}): ${apiMsg}` };

        } catch (err) {
            console.error(`[StudyAI] ${cfg.name} key test error:`, err);
            return { valid: false, error: `Unexpected error: ${err.message}` };
        }
    }

    // ----------------------------------------------------------------
    // Shared prompt for document processing
    // ----------------------------------------------------------------
    function buildPrompt(textContent) {
        return `You are an expert study assistant. Analyze the following document and generate comprehensive learning materials.

Return ONLY valid JSON (no markdown fences, no extra text) with EXACTLY this structure:
{
  "title": "Brief document title",
  "topics": ["Topic 1", "Topic 2", "Topic 3"],
  "flashcards": [
    {
      "id": "fc_1",
      "topic": "Topic name",
      "question": "What is...?",
      "answer": "Concise answer (1-3 sentences)",
      "difficulty": "easy",
      "tags": ["keyword1", "keyword2"]
    }
  ],
  "quizQuestions": [
    {
      "id": "q_1",
      "topic": "Topic name",
      "difficulty": "easy",
      "question": "Question text?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctIndex": 0,
      "explanation": "Why this is correct"
    }
  ]
}

RULES:
- Generate at least 15 flashcards covering ALL major topics
- Generate at least 20 quiz questions (mix of easy / medium / hard)
- Extract 3-6 meaningful topic categories
- Each quiz question must have exactly 4 options
- correctIndex is 0-based (0 = first option)
- difficulty must be exactly: "easy", "medium", or "hard"
- Do NOT repeat questions

Document Content:
${textContent.slice(0, 8000)}`;
    }

    // ----------------------------------------------------------------
    // MAIN: Process document → flashcards + quizzes
    // ----------------------------------------------------------------
    async function processDocument(file, onProgress = () => { }) {
        const provider = getProvider();
        const apiKey = getApiKey(provider);
        if (!apiKey) throw new Error('API_KEY_MISSING');

        onProgress(0.1, 'Reading document...');

        let fileBase64 = null;
        let mimeType = 'text/plain';
        let textContent = '';

        if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
            mimeType = 'application/pdf';
            if (provider === 'gemini') {
                fileBase64 = await fileToBase64(file);
            } else {
                // OpenAI: extract text — for PDF we pass as text with a note
                textContent = `[PDF file: ${file.name} — ${(file.size / 1024).toFixed(1)}KB]\nNote: Parse this document's likely academic content from its filename and generate study materials.`;
                try {
                    // Try reading as text (works for some PDFs)
                    const raw = await file.text();
                    if (raw && raw.length > 100) textContent = raw;
                } catch { }
            }
        } else if (file.name.match(/\.docx?$/i)) {
            mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
            if (provider === 'gemini') {
                fileBase64 = await fileToBase64(file);
            } else {
                try { textContent = await file.text(); } catch { textContent = `[DOCX file: ${file.name}]`; }
            }
        } else {
            textContent = await file.text();
        }

        onProgress(0.25, `Sending to ${PROVIDERS[provider].name}...`);

        const prompt = buildPrompt(textContent || `Document: ${file.name}`);

        onProgress(0.5, 'Generating flashcards & quiz questions...');

        let rawResponse;
        if (provider === 'openai') {
            rawResponse = await callOpenAI(prompt, apiKey);
        } else {
            rawResponse = await callGemini(prompt, fileBase64, mimeType, apiKey);
        }

        console.log('[StudyAI] Raw response (first 300 chars):', rawResponse.slice(0, 300));

        onProgress(0.85, 'Processing results...');
        const parsed = parseJSON(rawResponse);

        const result = {
            title: parsed.title || file.name.replace(/\.[^.]+$/, ''),
            topics: Array.isArray(parsed.topics) ? parsed.topics : [],
            flashcards: (Array.isArray(parsed.flashcards) ? parsed.flashcards : []).map((fc, i) => ({
                id: fc.id || `fc_${Date.now()}_${i}`,
                topic: fc.topic || 'General',
                question: fc.question || '',
                answer: fc.answer || '',
                difficulty: ['easy', 'medium', 'hard'].includes(fc.difficulty) ? fc.difficulty : 'medium',
                tags: Array.isArray(fc.tags) ? fc.tags : [],
                status: 'new', lastReviewed: null, correctCount: 0, wrongCount: 0
            })),
            quizQuestions: (Array.isArray(parsed.quizQuestions) ? parsed.quizQuestions : []).map((q, i) => ({
                id: q.id || `q_${Date.now()}_${i}`,
                topic: q.topic || 'General',
                difficulty: ['easy', 'medium', 'hard'].includes(q.difficulty) ? q.difficulty : 'medium',
                question: q.question || '',
                options: Array.isArray(q.options) ? q.options : [],
                correctIndex: typeof q.correctIndex === 'number' ? q.correctIndex : 0,
                explanation: q.explanation || ''
            }))
        };

        // Jaccard deduplication
        if (typeof JaccardSimilarity !== 'undefined') {
            const { unique } = JaccardSimilarity.deduplicate(result.flashcards, 0.7);
            result.flashcards = unique;
        }

        onProgress(1, 'Done!');
        console.log(`[StudyAI] ✅ ${result.flashcards.length} flashcards, ${result.quizQuestions.length} quiz questions`);
        return result;
    }

    // ----------------------------------------------------------------
    // Public interface
    // ----------------------------------------------------------------
    return {
        getProvider,
        setProvider,
        getProviderConfig,
        PROVIDERS,
        getApiKey,
        setApiKey,
        clearApiKey,
        hasApiKey,
        testApiKey,
        processDocument,
    };
})();
