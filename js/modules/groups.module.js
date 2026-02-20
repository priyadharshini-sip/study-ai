/**
 * groups.module.js — Group Study & Chat
 * Create/join groups, private chat, group quiz, member list
 */

const GroupsModule = (() => {
    let activeTab = 'chat';  // 'chat' | 'members' | 'quiz'
    let createModalOpen = false;

    function render() {
        const el = document.getElementById('page-groups');
        if (!el) return;

        const groups = Store.get.groups();
        const activeGroup = Store.get.activeGroup();

        el.innerHTML = `
      <div>
        <div class="section-header">
          <div>
            <h1 class="section-title">Group Study 👥</h1>
            <p class="section-subtitle">Collaborate and learn together</p>
          </div>
          <div style="display:flex;gap:var(--sp-2)">
            <button class="btn btn-primary" onclick="GroupsModule.openCreateModal()" id="btn-create-group">+ Create Group</button>
            <button class="btn btn-secondary" onclick="GroupsModule.joinGroup()" id="btn-join-group">🔗 Join Group</button>
          </div>
        </div>

        ${groups.length === 0 ? renderEmptyGroups() : `
          <div class="groups-layout">
            <!-- Groups List -->
            <div class="groups-list-panel">
              <div class="groups-panel-header">
                <span style="font-weight:700;font-size:var(--text-sm)">Your Groups (${groups.length})</span>
              </div>
              <div class="groups-search">
                <input type="text" class="input" id="groups-search" placeholder="🔍 Search groups..." oninput="GroupsModule.filterGroups(this.value)">
              </div>
              <div class="groups-list" id="groups-list">
                ${groups.map(g => renderGroupListItem(g, g.id === Store.get.state().activeGroupId)).join('')}
              </div>
            </div>

            <!-- Group Main Panel -->
            ${activeGroup ? renderGroupMain(activeGroup) : `
              <div class="group-main-panel" style="display:flex;align-items:center;justify-content:center">
                <div class="empty-state">
                  <span class="empty-state-icon">💬</span>
                  <h3 class="empty-state-title">Select a Group</h3>
                  <p class="empty-state-desc">Choose a group from the list to start chatting and studying together.</p>
                </div>
              </div>
            `}
          </div>
        `}

        <!-- Create Group Modal -->
        ${createModalOpen ? renderCreateModal() : ''}
      </div>
    `;

        bindEvents();
    }

    function renderEmptyGroups() {
        return `
      <div class="empty-state">
        <span class="empty-state-icon">👥</span>
        <h2 class="empty-state-title">No Study Groups Yet</h2>
        <p class="empty-state-desc">Create your own group or join an existing one with a group code to start studying together.</p>
        <div style="display:flex;gap:var(--sp-3);flex-wrap:wrap;justify-content:center">
          <button class="btn btn-primary" onclick="GroupsModule.openCreateModal()" id="btn-create-first">Create a Group</button>
          <button class="btn btn-secondary" onclick="GroupsModule.joinGroup()" id="btn-join-first">Join with Code</button>
        </div>
      </div>
    `;
    }

    function renderGroupListItem(group, isActive) {
        const lastMsg = group.messages[group.messages.length - 1];
        const unreadCount = isActive ? 0 : Math.floor(Math.random() * 3);
        return `
      <div class="group-list-item ${isActive ? 'active' : ''}" onclick="GroupsModule.selectGroup('${group.id}')" id="gl-${group.id}">
        <div class="group-avatar ${group.color || 'color-1'}">${group.emoji || group.name[0]}</div>
        ${group.members.some(m => m.status === 'online' && m.id !== 'me') ? '<div class="group-online-dot"></div>' : ''}
        <div class="group-list-info">
          <div class="group-list-name">${group.name}</div>
          <div class="group-list-preview">${lastMsg ? Helpers.truncate(lastMsg.text || '📎 Message', 35) : 'No messages yet'}</div>
        </div>
        <div class="group-list-meta">
          <div class="group-list-time">${lastMsg ? Helpers.formatClock(lastMsg.time) : ''}</div>
          ${unreadCount > 0 ? `<div class="group-unread">${unreadCount}</div>` : ''}
        </div>
      </div>
    `;
    }

    function renderGroupMain(group) {
        return `
      <div class="group-main-panel">
        <!-- Chat Header -->
        <div class="chat-header">
          <div class="group-avatar ${group.color || 'color-1'}" style="width:44px;height:44px;font-size:1.25rem;border-radius:var(--radius-md)">${group.emoji || group.name[0]}</div>
          <div class="chat-header-info">
            <div class="chat-header-name">${group.name}</div>
            <div class="chat-header-meta">
              <div class="online-indicator"></div>
              ${group.members.filter(m => m.status === 'online').length} online • ${group.members.length} members
            </div>
          </div>
          <div class="chat-header-actions">
            <button class="btn btn-ghost btn-icon" title="Group Quiz" onclick="GroupsModule.setTab('quiz')" id="btn-group-quiz">❓</button>
            <button class="btn btn-ghost btn-icon" title="Members" onclick="GroupsModule.setTab('members')" id="btn-group-members">👥</button>
          </div>
        </div>

        <!-- Tabs -->
        <div class="chat-tabs">
          <button class="chat-tab ${activeTab === 'chat' ? 'active' : ''}" onclick="GroupsModule.setTab('chat')" id="tab-chat">💬 Chat</button>
          <button class="chat-tab ${activeTab === 'members' ? 'active' : ''}" onclick="GroupsModule.setTab('members')" id="tab-members">👥 Members (${group.members.length})</button>
          <button class="chat-tab ${activeTab === 'quiz' ? 'active' : ''}" onclick="GroupsModule.setTab('quiz')" id="tab-group-quiz">🎯 Group Quiz</button>
        </div>

        ${activeTab === 'chat' ? renderChatView(group) :
                activeTab === 'members' ? renderMembersView(group) :
                    renderGroupQuizView(group)}
      </div>
    `;
    }

    function renderChatView(group) {
        return `
      <div class="chat-messages" id="chat-messages">
        <div class="chat-date-divider">Today</div>
        ${group.messages.map(msg => renderMessage(msg)).join('')}
        ${group.messages.length === 0 ? `
          <div class="empty-state" style="padding:var(--sp-8)">
            <span class="empty-state-icon">💬</span>
            <p class="empty-state-desc">No messages yet. Say hello!</p>
          </div>
        ` : ''}
      </div>
      <div class="chat-input-area">
        <div class="chat-input-row">
          <button class="btn btn-ghost btn-sm" onclick="GroupsModule.shareQuestion()" id="btn-share-q" title="Share a flashcard question" style="padding:4px 8px;font-size:1rem">📌</button>
          <textarea class="chat-input" id="chat-input" placeholder="Message the group..." rows="1"
            onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();GroupsModule.sendMessage()}"
            oninput="this.style.height='auto';this.style.height=this.scrollHeight+'px'"></textarea>
          <button class="chat-send-btn" onclick="GroupsModule.sendMessage()" id="btn-send-msg">➤</button>
        </div>
      </div>
    `;
    }

    function renderMessage(msg) {
        const isSelf = msg.senderId === 'me';
        if (msg.type === 'question') {
            return `
        <div class="chat-message ${isSelf ? 'self' : ''}">
          <div class="msg-avatar">${msg.senderName[0]}</div>
          <div class="msg-content">
            <div class="msg-sender">${msg.senderName}</div>
            <div class="msg-bubble">
              ${msg.text}
              <div class="msg-question-card">
                <div class="msg-question-label">📌 Shared Flashcard</div>
                <div style="font-weight:600">${msg.question}</div>
              </div>
            </div>
            <div class="msg-time">${Helpers.formatClock(msg.time)}</div>
          </div>
        </div>
      `;
        }
        return `
      <div class="chat-message ${isSelf ? 'self' : ''}">
        ${!isSelf ? `<div class="msg-avatar">${msg.senderName[0]}</div>` : ''}
        <div class="msg-content">
          ${!isSelf ? `<div class="msg-sender">${msg.senderName}</div>` : ''}
          <div class="msg-bubble">${msg.text}</div>
          <div class="msg-time">${Helpers.formatClock(msg.time)}</div>
        </div>
        ${isSelf ? `<div class="msg-avatar">${msg.senderName[0]}</div>` : ''}
      </div>
    `;
    }

    function renderMembersView(group) {
        return `
      <div class="members-panel">
        <div style="font-size:var(--text-xs);font-weight:600;color:var(--text-muted);letter-spacing:0.06em;text-transform:uppercase;margin-bottom:var(--sp-2)">
          Online — ${group.members.filter(m => m.status === 'online').length}
        </div>
        ${group.members.filter(m => m.status === 'online').map(m => renderMemberRow(m)).join('')}
        ${group.members.filter(m => m.status !== 'online').length > 0 ? `
          <div style="font-size:var(--text-xs);font-weight:600;color:var(--text-muted);letter-spacing:0.06em;text-transform:uppercase;margin-bottom:var(--sp-2);margin-top:var(--sp-3)">Offline</div>
          ${group.members.filter(m => m.status !== 'online').map(m => renderMemberRow(m)).join('')}
        ` : ''}
      </div>
    `;
    }

    function renderMemberRow(member) {
        const statusClass = { online: 'status-online', away: 'status-away', offline: 'status-offline' }[member.status] || 'status-offline';
        return `
      <div class="member-row">
        <div class="member-avatar">
          ${member.name[0]}
          <div class="member-status-dot ${statusClass}"></div>
        </div>
        <div>
          <div class="member-name">${member.name} ${member.id === 'me' ? '(You)' : ''}</div>
          <div class="member-role">${member.role === 'admin' ? '👑 Admin' : '👤 Member'}</div>
        </div>
        <div class="member-points">⭐ ${member.points}</div>
      </div>
    `;
    }

    function renderGroupQuizView(group) {
        const allQ = Store.get.allQuizQuestions().slice(0, 5);
        return `
      <div style="padding:var(--sp-6);flex:1;overflow-y:auto">
        <h3 style="font-weight:700;margin-bottom:var(--sp-4)">🎯 Group Quiz Challenge</h3>
        ${allQ.length > 0 ? `
          <p style="color:var(--text-secondary);font-size:var(--text-sm);margin-bottom:var(--sp-5)">
            Only group members can participate. ${group.members.filter(m => m.status === 'online').length} members online.
          </p>
          <button class="btn btn-primary" style="width:100%;margin-bottom:var(--sp-5)" onclick="App.navigate('quiz')" id="btn-launch-quiz">
            🚀 Launch Group Quiz
          </button>
          <div style="background:var(--bg-elevated);border:1px solid var(--border-subtle);border-radius:var(--radius-md);padding:var(--sp-4)">
            <div style="font-size:var(--text-sm);font-weight:600;margin-bottom:var(--sp-3)">Sample Questions:</div>
            ${allQ.slice(0, 3).map(q => `
              <div style="padding:var(--sp-2) 0;border-bottom:1px solid var(--border-subtle);font-size:var(--text-sm)">
                ❓ ${Helpers.truncate(q.question, 60)}
              </div>
            `).join('')}
          </div>
        ` : `
          <div class="empty-state">
            <span class="empty-state-icon">❓</span>
            <p class="empty-state-desc">Upload a document to generate quiz questions for the group.</p>
            <button class="btn btn-secondary" onclick="App.navigate('upload')" id="btn-group-upload">Upload Document</button>
          </div>
        `}
      </div>
    `;
    }

    function renderCreateModal() {
        return `
      <div class="modal-overlay" id="create-group-modal" style="display:flex">
        <div class="modal" style="max-width:420px;text-align:left">
          <h2 style="font-family:var(--font-display);font-size:var(--text-xl);font-weight:800;margin-bottom:var(--sp-5)">Create Study Group</h2>
          <div class="create-group-form">
            <div>
              <label class="label">Group Name</label>
              <input type="text" id="group-name-input" class="input" placeholder="e.g. Biology Study Squad" maxlength="50">
            </div>
            <div>
              <label class="label">Emoji Icon</label>
              <div style="display:flex;gap:var(--sp-2);flex-wrap:wrap" id="emoji-picker">
                ${['📚', '🔬', '🧪', '🧮', '🌍', '🏛️', '📐', '🎨', '💻', '🧬'].map(e => `
                  <button class="btn btn-ghost" onclick="GroupsModule.selectEmoji('${e}')" id="em-${e}" style="font-size:1.5rem;padding:var(--sp-2)">${e}</button>
                `).join('')}
              </div>
            </div>
            <div>
              <label class="label">Color Theme</label>
              <div style="display:flex;gap:var(--sp-2)">
                ${['color-1', 'color-2', 'color-3', 'color-4'].map((c, i) => `
                  <div onclick="GroupsModule.selectColor('${c}')" id="col-${c}" style="width:32px;height:32px;border-radius:50%;cursor:pointer;background:${['linear-gradient(135deg,#7C3AED,#3B82F6)', 'linear-gradient(135deg,#EC4899,#7C3AED)', 'linear-gradient(135deg,#10B981,#06B6D4)', 'linear-gradient(135deg,#F59E0B,#EF4444)'][i]};border:3px solid transparent"></div>
                `).join('')}
              </div>
            </div>
            <div style="display:flex;gap:var(--sp-3);margin-top:var(--sp-4)">
              <button class="btn btn-secondary" style="flex:1" onclick="GroupsModule.closeModal()" id="btn-cancel-create">Cancel</button>
              <button class="btn btn-primary" style="flex:1" onclick="GroupsModule.confirmCreate()" id="btn-confirm-create">Create Group</button>
            </div>
          </div>
        </div>
      </div>
    `;
    }

    // ===== STATE =====
    let selectedEmoji = '📚';
    let selectedColor = 'color-1';

    function selectEmoji(emoji) {
        selectedEmoji = emoji;
        document.querySelectorAll('#emoji-picker button').forEach(btn => btn.style.background = 'transparent');
        const btn = document.getElementById(`em-${emoji}`);
        if (btn) btn.style.background = 'rgba(124,58,237,0.15)';
    }

    function selectColor(color) {
        selectedColor = color;
        document.querySelectorAll('[id^="col-"]').forEach(el => el.style.borderColor = 'transparent');
        const el = document.getElementById(`col-${color}`);
        if (el) el.style.borderColor = 'white';
    }

    function openCreateModal() {
        createModalOpen = true;
        selectedEmoji = '📚';
        selectedColor = 'color-1';
        render();
    }

    function closeModal() {
        createModalOpen = false;
        render();
    }

    function confirmCreate() {
        const nameInput = document.getElementById('group-name-input');
        const name = nameInput?.value?.trim();
        if (!name) { Helpers.toast('Please enter a group name', 'warning'); return; }
        Store.createGroup({ name, emoji: selectedEmoji, color: selectedColor });
        AchievementsModule.checkAll();
        Helpers.toast(`Group "${name}" created! 🎉`, 'success');
        createModalOpen = false;
        activeTab = 'chat';
        render();
    }

    function joinGroup() {
        const code = prompt('Enter group code (any 4-6 digit code for demo):');
        if (!code || code.trim() === '') return;
        Store.joinGroup(code.trim().toUpperCase());
        AchievementsModule.checkAll();
        Helpers.toast('Joined group successfully! 👋', 'success');
        activeTab = 'chat';
        render();
    }

    function selectGroup(groupId) {
        Store.setActiveGroup(groupId);
        activeTab = 'chat';
        render();
        setTimeout(() => scrollChatToBottom(), 100);
    }

    function setTab(tab) {
        activeTab = tab;
        render();
        if (tab === 'chat') setTimeout(() => scrollChatToBottom(), 100);
    }

    function sendMessage() {
        const activeGroupId = Store.get.state().activeGroupId;
        const input = document.getElementById('chat-input');
        const text = input?.value?.trim();
        if (!text || !activeGroupId) return;

        Store.sendMessage(activeGroupId, { text, type: 'text' });
        if (input) { input.value = ''; input.style.height = 'auto'; }

        // Re-render chat messages area only
        const chatEl = document.getElementById('chat-messages');
        const group = Store.get.activeGroup();
        if (chatEl && group) {
            chatEl.innerHTML = '<div class="chat-date-divider">Today</div>' +
                group.messages.map(msg => renderMessage(msg)).join('');
            scrollChatToBottom();
        }

        // Simulate a reply after delay
        setTimeout(() => simulateReply(activeGroupId), 1500 + Math.random() * 2000);
    }

    function simulateReply(groupId) {
        const group = Store.get.groups().find(g => g.id === groupId);
        if (!group) return;
        const otherMembers = group.members.filter(m => m.id !== 'me' && m.status === 'online');
        if (otherMembers.length === 0) return;

        const responder = otherMembers[Math.floor(Math.random() * otherMembers.length)];
        const replies = ['Great point! 👍', 'I agree!', 'Can you explain more?', 'That makes sense 🙌', 'Good luck everyone! 💪', 'Let\'s ace this exam!', 'I was confused about that too!'];
        const text = replies[Math.floor(Math.random() * replies.length)];

        Store.sendMessage(groupId, { text, type: 'text', senderId: responder.id, senderName: responder.name });

        const chatEl = document.getElementById('chat-messages');
        const updatedGroup = Store.get.activeGroup();
        if (chatEl && updatedGroup) {
            chatEl.innerHTML = '<div class="chat-date-divider">Today</div>' +
                updatedGroup.messages.map(msg => renderMessage(msg)).join('');
            scrollChatToBottom();
        }
    }

    function shareQuestion() {
        const allCards = Store.get.allFlashcards();
        if (allCards.length === 0) { Helpers.toast('No flashcards to share. Upload a document first!', 'warning'); return; }

        const activeGroupId = Store.get.state().activeGroupId;
        if (!activeGroupId) return;

        const card = allCards[Math.floor(Math.random() * allCards.length)];
        Store.sendMessage(activeGroupId, {
            text: '📌 Shared a flashcard for the group:',
            type: 'question',
            question: card.question,
            answer: card.answer
        });

        const chatEl = document.getElementById('chat-messages');
        const group = Store.get.activeGroup();
        if (chatEl && group) {
            chatEl.innerHTML = '<div class="chat-date-divider">Today</div>' +
                group.messages.map(msg => renderMessage(msg)).join('');
            scrollChatToBottom();
        }
    }

    function filterGroups(query) {
        const groups = Store.get.groups();
        const filtered = groups.filter(g => g.name.toLowerCase().includes(query.toLowerCase()));
        const listEl = document.getElementById('groups-list');
        const activeId = Store.get.state().activeGroupId;
        if (listEl) {
            listEl.innerHTML = filtered.map(g => renderGroupListItem(g, g.id === activeId)).join('');
        }
    }

    function scrollChatToBottom() {
        const el = document.getElementById('chat-messages');
        if (el) el.scrollTop = el.scrollHeight;
    }

    function bindEvents() {
        setTimeout(() => scrollChatToBottom(), 50);
    }

    function subscribe() {
        Store.on('groups:change', () => render());
        Store.on('group:message', () => {
            if (document.getElementById('page-groups')?.classList.contains('active')) {
                const chatEl = document.getElementById('chat-messages');
                const group = Store.get.activeGroup();
                if (chatEl && group) {
                    chatEl.innerHTML = '<div class="chat-date-divider">Today</div>' +
                        group.messages.map(msg => renderMessage(msg)).join('');
                    scrollChatToBottom();
                }
            }
        });
    }

    return { render, subscribe, openCreateModal, closeModal, confirmCreate, joinGroup, setTab, selectGroup, sendMessage, shareQuestion, filterGroups, selectEmoji, selectColor };
})();
