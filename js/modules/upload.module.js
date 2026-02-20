/**
 * upload.module.js — Document Upload + AI Processing
 * Supports OpenAI (GPT-4o) and Google Gemini (1.5 Flash)
 */

const UploadModule = (() => {
  let dragCounter = 0;

  function render() {
    const el = document.getElementById('page-upload');
    if (!el) return;

    const provider = ApiService.getProvider();
    const cfg = ApiService.getProviderConfig();
    const hasKey = ApiService.hasApiKey();

    el.innerHTML = `
      <div class="upload-container anim-stagger">
        <div class="section-header">
          <div>
            <h1 class="section-title">Upload Document</h1>
            <p class="section-subtitle">AI will auto-generate flashcards &amp; quizzes from your PDF or Word file</p>
          </div>
        </div>

        <!-- PROVIDER SELECTOR -->
        <div style="margin-bottom:var(--sp-5)">
          <label class="label">Choose AI Provider</label>
          <div style="display:flex;gap:var(--sp-3);flex-wrap:wrap">
            <button id="btn-provider-openai"
              onclick="UploadModule.switchProvider('openai')"
              class="provider-btn ${provider === 'openai' ? 'active' : ''}">
              <span style="font-size:1.4rem">🤖</span>
              <div>
                <div style="font-weight:700;font-size:var(--text-sm)">OpenAI</div>
                <div style="font-size:var(--text-xs);color:var(--text-muted)">GPT-4o</div>
              </div>
            </button>
            <button id="btn-provider-gemini"
              onclick="UploadModule.switchProvider('gemini')"
              class="provider-btn ${provider === 'gemini' ? 'active' : ''}">
              <span style="font-size:1.4rem">✨</span>
              <div>
                <div style="font-weight:700;font-size:var(--text-sm)">Google Gemini</div>
                <div style="font-size:var(--text-xs);color:var(--text-muted)">Gemini 1.5 Flash</div>
              </div>
            </button>
          </div>
        </div>

        <!-- API KEY SETUP (shown when no key saved) -->
        <div class="api-key-setup" id="api-key-setup" style="${hasKey ? 'display:none' : ''}">
          <div class="api-key-icon">${provider === 'openai' ? '🤖' : '✨'}</div>
          <div class="api-key-content">
            <div class="api-key-title">Set Up Your ${cfg.name} API Key</div>
            <div class="api-key-desc">
              Your ${cfg.name} key is stored only in your browser session — never sent anywhere except ${cfg.name === 'OpenAI' ? 'OpenAI' : 'Google'}.
            </div>
            <div class="api-key-input-row">
              <input type="password" id="api-key-input" class="input"
                placeholder="Enter your ${cfg.name} API key (${cfg.keyHint})"
                autocomplete="off" />
              <button class="btn btn-primary" id="btn-save-key">Save Key</button>
            </div>
            <p style="font-size:var(--text-xs);color:var(--text-muted);margin-top:var(--sp-2)">
              ${provider === 'openai'
        ? 'Get your key at <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener" style="color:var(--brand-blue)">OpenAI Platform</a>'
        : 'Get a free key at <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener" style="color:var(--brand-blue)">Google AI Studio</a>'
      }
            </p>
          </div>
        </div>

        <!-- KEY ACTIVE BANNER (shown when key is set) -->
        <div id="key-active-banner" class="api-key-setup" style="${hasKey ? '' : 'display:none'};background:linear-gradient(135deg,rgba(16,185,129,0.08),rgba(6,182,212,0.05));border-color:rgba(16,185,129,0.2)">
          <div class="api-key-icon">✅</div>
          <div class="api-key-content">
            <div class="api-key-title">${cfg.name} Key Active</div>
            <div class="api-key-desc">Your ${cfg.name} API key is ready. Upload a document to generate AI-powered flashcards &amp; quizzes.</div>
            <button class="btn btn-ghost btn-sm" id="btn-change-key" style="color:var(--text-muted)">Change Key</button>
          </div>
        </div>

        <!-- DROP ZONE -->
        <div class="upload-drop-zone" id="upload-drop-zone" tabindex="0" role="button" aria-label="Upload document">
          <div class="upload-icon">📄</div>
          <div class="upload-title">Drop your document here</div>
          <div class="upload-sub">or click to browse files</div>
          <div class="upload-formats">
            <span class="badge badge-purple">PDF</span>
            <span class="badge badge-blue">DOCX</span>
            <span class="badge badge-green">DOC</span>
            <span class="badge badge-amber">TXT</span>
          </div>
          <div style="font-size:var(--text-xs);color:var(--text-muted);margin-top:var(--sp-2)">Max file size: 20MB</div>
          <input type="file" id="file-input" class="upload-file-input" accept=".pdf,.doc,.docx,.txt" />
        </div>

        <!-- UPLOAD PROGRESS -->
        <div class="upload-progress-wrap" id="upload-progress-wrap">
          <div class="upload-progress-header">
            <span class="upload-file-name" id="upload-file-name">document.pdf</span>
            <span class="upload-progress-pct" id="upload-pct">0%</span>
          </div>
          <div class="upload-progress-bar-wrap">
            <div class="upload-progress-bar-fill" id="upload-bar"></div>
          </div>
          <p style="font-size:var(--text-xs);color:var(--text-secondary);margin-top:var(--sp-2)" id="upload-status-text">Processing...</p>
        </div>

        <!-- RECENT UPLOADS -->
        <div id="recent-uploads-section">
          ${renderRecentUploads()}
        </div>

        <!-- SAMPLE DATA -->
        <div style="text-align:center;padding:var(--sp-4)">
          <p style="font-size:var(--text-sm);color:var(--text-muted);margin-bottom:var(--sp-3)">Don't have a document? Try with sample data:</p>
          <button class="btn btn-secondary" id="btn-load-sample">📚 Load Sample Flashcards</button>
        </div>
      </div>
    `;

    bindEvents();
  }

  function renderRecentUploads() {
    const docs = Store.get.documents();
    if (docs.length === 0) return '';
    return `
      <div>
        <div class="section-header" style="margin-top:var(--sp-4)">
          <h2 class="section-title" style="font-size:var(--text-lg)">Recent Uploads</h2>
        </div>
        <div style="display:flex;flex-direction:column;gap:var(--sp-3)">
          ${docs.map(d => `
            <div class="recent-upload-item" id="recent-upload-${d.id}">
              <div class="recent-upload-doc-icon">${d.name.endsWith('.pdf') ? '📕' : '📄'}</div>
              <div class="recent-upload-info">
                <div class="recent-upload-name">${d.title || d.name}</div>
                <div class="recent-upload-meta">${d.flashcards?.length || 0} flashcards • ${d.topics?.length || 0} topics • ${Helpers.formatDate(d.uploadedAt)}</div>
              </div>
              <div class="recent-upload-action" style="display:flex;gap:var(--sp-2)">
                <button class="btn btn-secondary btn-sm" onclick="App.openDoc('${d.id}');App.navigate('flashcards')" id="btn-open-${d.id}">Study</button>
                <button class="btn btn-ghost btn-sm" onclick="UploadModule.deleteDoc('${d.id}')" id="btn-del-${d.id}" title="Delete">🗑️</button>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  function bindEvents() {
    const dropZone = document.getElementById('upload-drop-zone');
    const fileInput = document.getElementById('file-input');
    const saveKeyBtn = document.getElementById('btn-save-key');
    const changeKeyBtn = document.getElementById('btn-change-key');
    const sampleBtn = document.getElementById('btn-load-sample');

    // File click
    dropZone?.addEventListener('click', () => fileInput?.click());
    dropZone?.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') fileInput?.click(); });

    // Drag & drop
    document.addEventListener('dragover', e => e.preventDefault());
    dropZone?.addEventListener('dragenter', () => { dragCounter++; dropZone.classList.add('drag-over'); });
    dropZone?.addEventListener('dragleave', () => { dragCounter--; if (dragCounter <= 0) { dropZone.classList.remove('drag-over'); dragCounter = 0; } });
    dropZone?.addEventListener('drop', e => {
      e.preventDefault();
      dropZone.classList.remove('drag-over');
      dragCounter = 0;
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    });

    // File input change
    fileInput?.addEventListener('change', e => {
      const file = e.target.files[0];
      if (file) handleFile(file);
    });

    // API Key save
    saveKeyBtn?.addEventListener('click', async () => {
      const keyInput = document.getElementById('api-key-input');
      const key = keyInput?.value?.trim();
      if (!key) { Helpers.toast('Please enter your API key', 'warning'); return; }

      saveKeyBtn.textContent = 'Verifying...';
      saveKeyBtn.disabled = true;

      const result = await ApiService.testApiKey(key);

      if (result.valid) {
        ApiService.setApiKey(key);
        if (result.warning) {
          Helpers.toast(`Key saved! ⚠️ ${result.warning}`, 'warning', 6000);
        } else {
          const cfg = ApiService.getProviderConfig();
          Helpers.toast(`✅ ${cfg.name} API key saved & verified!`, 'success');
        }
        render();
      } else {
        const errMsg = result.error || 'Invalid API key. Please check and try again.';
        Helpers.toast(`❌ ${errMsg}`, 'error', 7000);
        saveKeyBtn.textContent = 'Save Key';
        saveKeyBtn.disabled = false;
      }
    });

    changeKeyBtn?.addEventListener('click', () => {
      ApiService.clearApiKey();
      render();
    });

    sampleBtn?.addEventListener('click', loadSampleData);
  }

  async function handleFile(file) {
    // Validate size
    if (file.size > 20 * 1024 * 1024) {
      Helpers.toast('File too large. Maximum size is 20MB.', 'error');
      return;
    }

    // Validate type
    const allowedTypes = ['.pdf', '.doc', '.docx', '.txt'];
    const ext = '.' + file.name.split('.').pop().toLowerCase();
    if (!allowedTypes.includes(ext)) {
      Helpers.toast('Unsupported file type. Use PDF, DOC, DOCX, or TXT.', 'error');
      return;
    }

    if (!ApiService.hasApiKey()) {
      Helpers.toast('Please set up your API key first!', 'warning');
      document.getElementById('api-key-input')?.focus();
      return;
    }

    showProgress(file.name);

    try {
      const overlay = document.getElementById('processing-overlay');
      const subText = document.getElementById('processing-sub');
      const fillEl = document.getElementById('processing-progress-fill');
      const stepEl = document.getElementById('processing-step');
      overlay.hidden = false;

      const steps = [
        'Reading your document...',
        'Analyzing content structure...',
        'Generating flashcards with AI...',
        'Creating quiz questions...',
      ];

      const onProgress = (pct, msg) => {
        updateProgress(pct);
        if (overlay) {
          const stepIdx = Math.floor(pct * steps.length);
          if (subText) subText.textContent = steps[Math.min(stepIdx, steps.length - 1)];
          if (fillEl) fillEl.style.width = (pct * 100) + '%';
          if (stepEl) stepEl.textContent = `Step ${Math.min(stepIdx + 1, steps.length)} of ${steps.length}`;
        }
      };

      const result = await ApiService.processDocument(file, onProgress);
      overlay.hidden = true;

      // Save to store
      const doc = Store.addDocument({
        name: file.name,
        size: file.size,
        ...result
      });

      Store.markActiveToday();
      Store.addPoints(30, 'Document uploaded');
      AchievementsModule.checkAll();

      Helpers.toast(`🎉 Generated ${result.flashcards.length} flashcards & ${result.quizQuestions.length} questions!`, 'success');
      Helpers.confetti(15);

      hideProgress();
      render();

      // Navigate to flashcards
      setTimeout(() => App.navigate('flashcards'), 1200);

    } catch (err) {
      document.getElementById('processing-overlay').hidden = true;
      hideProgress();

      if (err.message === 'API_KEY_MISSING') {
        Helpers.toast('Please set your API key first.', 'error');
      } else {
        Helpers.toast('Failed to process document: ' + err.message, 'error');
        console.error(err);
      }
    }
  }

  function showProgress(filename) {
    const wrap = document.getElementById('upload-progress-wrap');
    const nameEl = document.getElementById('upload-file-name');
    if (wrap) wrap.classList.add('active');
    if (nameEl) nameEl.textContent = filename;
  }

  function hideProgress() {
    const wrap = document.getElementById('upload-progress-wrap');
    if (wrap) wrap.classList.remove('active');
  }

  function updateProgress(pct) {
    const pctEl = document.getElementById('upload-pct');
    const barEl = document.getElementById('upload-bar');
    if (pctEl) pctEl.textContent = Math.round(pct * 100) + '%';
    if (barEl) barEl.style.width = (pct * 100) + '%';
  }

  function deleteDoc(docId) {
    Store.deleteDocument(docId);
    Helpers.toast('Document deleted', 'info');
    render();
  }

  function loadSampleData() {
    const sampleDoc = {
      name: 'biology-sample.pdf',
      size: 1024 * 512,
      title: 'Introduction to Cell Biology',
      topics: ['Cell Structure', 'Organelles', 'Cell Division', 'Membrane Transport'],
      flashcards: [
        { id: 'sf1', topic: 'Cell Structure', question: 'What is the powerhouse of the cell?', answer: 'The mitochondria is the powerhouse of the cell, responsible for producing ATP through cellular respiration.', difficulty: 'easy', tags: ['mitochondria', 'ATP', 'energy'], status: 'new', correctCount: 0, wrongCount: 0 },
        { id: 'sf2', topic: 'Cell Structure', question: 'What does the cell membrane do?', answer: 'It controls what enters and exits the cell, maintaining homeostasis. It is selectively permeable and made of a phospholipid bilayer.', difficulty: 'easy', tags: ['membrane', 'homeostasis'], status: 'new', correctCount: 0, wrongCount: 0 },
        { id: 'sf3', topic: 'Organelles', question: 'What is the function of the nucleus?', answer: 'The nucleus is the control center of the cell, containing the cell\'s DNA and directing gene expression, protein synthesis, and cell reproduction.', difficulty: 'easy', tags: ['nucleus', 'DNA', 'control'], status: 'new', correctCount: 0, wrongCount: 0 },
        { id: 'sf4', topic: 'Organelles', question: 'What does the endoplasmic reticulum do?', answer: 'The ER is a network of membranes involved in protein (rough ER) and lipid synthesis (smooth ER). Rough ER has ribosomes; smooth ER does not.', difficulty: 'medium', tags: ['ER', 'protein', 'lipid'], status: 'new', correctCount: 0, wrongCount: 0 },
        { id: 'sf5', topic: 'Organelles', question: 'What is the Golgi apparatus?', answer: 'The Golgi apparatus processes, sorts, and packages proteins and lipids for secretion or delivery to other organelles. Like a postal system.', difficulty: 'medium', tags: ['Golgi', 'secretion', 'packaging'], status: 'new', correctCount: 0, wrongCount: 0 },
        { id: 'sf6', topic: 'Cell Division', question: 'What are the stages of mitosis?', answer: 'Prophase, Metaphase, Anaphase, Telophase (PMAT). During these stages, duplicated chromosomes are separated into two identical daughter cells.', difficulty: 'medium', tags: ['mitosis', 'PMAT'], status: 'new', correctCount: 0, wrongCount: 0 },
        { id: 'sf7', topic: 'Cell Division', question: 'What is meiosis?', answer: 'Meiosis is cell division that produces four genetically unique haploid gametes (sperm/egg) from one diploid cell. Involves two rounds of division.', difficulty: 'hard', tags: ['meiosis', 'gametes', 'haploid'], status: 'new', correctCount: 0, wrongCount: 0 },
        { id: 'sf8', topic: 'Membrane Transport', question: 'What is osmosis?', answer: 'Osmosis is the diffusion of water molecules across a semipermeable membrane from a region of low solute concentration to high solute concentration.', difficulty: 'medium', tags: ['osmosis', 'diffusion', 'water'], status: 'new', correctCount: 0, wrongCount: 0 },
        { id: 'sf9', topic: 'Membrane Transport', question: 'What is active transport?', answer: 'Active transport moves molecules against their concentration gradient using energy (ATP). Examples include the sodium-potassium pump.', difficulty: 'hard', tags: ['active transport', 'ATP', 'gradient'], status: 'new', correctCount: 0, wrongCount: 0 },
        { id: 'sf10', topic: 'Cell Structure', question: 'What is the cytoskeleton?', answer: 'The cytoskeleton is a network of protein filaments (microtubules, actin filaments, intermediate filaments) that maintains cell shape and enables movement.', difficulty: 'hard', tags: ['cytoskeleton', 'filaments', 'shape'], status: 'new', correctCount: 0, wrongCount: 0 },
        { id: 'sf11', topic: 'Organelles', question: 'What is the function of ribosomes?', answer: 'Ribosomes are molecular machines that synthesize proteins by translating messenger RNA (mRNA). They can be free in cytoplasm or attached to rough ER.', difficulty: 'easy', tags: ['ribosomes', 'protein synthesis', 'mRNA'], status: 'new', correctCount: 0, wrongCount: 0 },
        { id: 'sf12', topic: 'Cell Division', question: 'What is the cell cycle?', answer: 'The cell cycle consists of Interphase (G1, S, G2 phases) and the Mitotic phase. Interphase is when the cell grows and duplicates its DNA.', difficulty: 'medium', tags: ['cell cycle', 'interphase', 'mitosis'], status: 'new', correctCount: 0, wrongCount: 0 },
      ],
      quizQuestions: [
        { id: 'sq1', topic: 'Cell Structure', difficulty: 'easy', question: 'Which organelle is known as the "powerhouse of the cell"?', options: ['Nucleus', 'Mitochondria', 'Ribosome', 'Golgi apparatus'], correctIndex: 1, explanation: 'Mitochondria produce ATP through cellular respiration, providing energy for cell functions.' },
        { id: 'sq2', topic: 'Cell Structure', difficulty: 'easy', question: 'What is the function of the cell membrane?', options: ['Protein synthesis', 'DNA storage', 'Controls what enters/exits the cell', 'Energy production'], correctIndex: 2, explanation: 'The cell membrane is selectively permeable, regulating the passage of substances.' },
        { id: 'sq3', topic: 'Organelles', difficulty: 'medium', question: 'Which type of ER is studded with ribosomes?', options: ['Smooth ER', 'Rough ER', 'Both types', 'Neither type'], correctIndex: 1, explanation: 'Rough ER has ribosomes on its surface, making it appear "rough" under a microscope.' },
        { id: 'sq4', topic: 'Cell Division', difficulty: 'medium', question: 'What is the correct order of mitosis stages?', options: ['MAPT', 'PMAT', 'TAMP', 'AMPT'], correctIndex: 1, explanation: 'The stages are Prophase, Metaphase, Anaphase, Telophase (PMAT).' },
        { id: 'sq5', topic: 'Membrane Transport', difficulty: 'easy', question: 'Which process moves water across a semipermeable membrane?', options: ['Active transport', 'Osmosis', 'Phagocytosis', 'Exocytosis'], correctIndex: 1, explanation: 'Osmosis is the diffusion of water from low to high solute concentration.' },
        { id: 'sq6', topic: 'Membrane Transport', difficulty: 'hard', question: 'Active transport differs from passive transport because it:', options: ['Moves water molecules', 'Requires energy (ATP)', 'Moves with the gradient', 'Does not use proteins'], correctIndex: 1, explanation: 'Active transport moves molecules against their concentration gradient, requiring ATP.' },
        { id: 'sq7', topic: 'Cell Division', difficulty: 'hard', question: 'How many cells result from one round of meiosis?', options: ['2 diploid cells', '2 haploid cells', '4 diploid cells', '4 haploid cells'], correctIndex: 3, explanation: 'Meiosis produces 4 genetically unique haploid cells (gametes).' },
        { id: 'sq8', topic: 'Organelles', difficulty: 'easy', question: 'What does the Golgi apparatus do?', options: ['Produces energy', 'Sorts and packages proteins', 'Stores DNA', 'Produces ribosomes'], correctIndex: 1, explanation: 'The Golgi apparatus processes and packages proteins and lipids for secretion or delivery.' },
      ]
    };

    const doc = Store.addDocument(sampleDoc);
    Store.markActiveToday();
    Store.addPoints(10, 'Loaded sample data');
    Helpers.toast('🎉 Sample data loaded! 12 flashcards & 8 quiz questions ready.', 'success');
    render();
    setTimeout(() => App.navigate('flashcards'), 1000);
  }

  function subscribe() {
    Store.on('documents:change', () => {
      const section = document.getElementById('recent-uploads-section');
      if (section) section.innerHTML = renderRecentUploads();
    });
  }

  function switchProvider(provider) {
    ApiService.setProvider(provider);
    render(); // Re-render to show correct key state & placeholder
  }

  return { render, subscribe, deleteDoc, loadSampleData, switchProvider };
})();
