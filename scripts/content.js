// content.js - Código unificado e aprimorado (v3.0)
(function () {
  if (window.brazzaAppInitialized) {
    console.log("BrazzaWhats PRO já inicializado.");
    return;
  }
  window.brazzaAppInitialized = true;
  console.log("Inicializando BrazzaWhats PRO v3.0...");

  // STORAGE KEYS
  const STORAGE_KEY_SCRIPTS = 'brazzaScripts';
  const STORAGE_KEY_CRM = 'brazza_crm_data';
  const STORAGE_KEY_UI_STATE = 'brazza_ui_state';
  const STORAGE_KEY_FUNNELS = 'brazza_funnels';
  const STORAGE_KEY_STATS = 'brazza_stats';
  const STORAGE_KEY_THEME = 'brazza_theme';
  const STORAGE_KEY_NOTES = 'brazza_notes';
  const STORAGE_KEY_TAGS = 'brazza_tags';

  class StorageManager {
    static async get(key) {
      return new Promise((resolve) => {
        chrome.storage.sync.get([key], (result) => {
          resolve(result[key]);
        });
      });
    }

    static async set(key, value) {
      return new Promise((resolve) => {
        chrome.storage.sync.set({ [key]: value }, resolve);
      });
    }

    static async export() {
      const data = await chrome.storage.sync.get(null);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `brazzawhats_backup_${new Date().toISOString().slice(0,10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }

    static async import(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
          try {
            const data = JSON.parse(e.target.result);
            await chrome.storage.sync.clear();
            await chrome.storage.sync.set(data);
            resolve(true);
          } catch (error) {
            reject(error);
          }
        };
        reader.readAsText(file);
      });
    }
  }

  class ThemeManager {
    constructor() {
      this.currentTheme = 'light';
      this.load();
    }

    async load() {
      this.currentTheme = await StorageManager.get(STORAGE_KEY_THEME) || 'light';
      this.applyTheme();
    }

    async toggleTheme() {
      this.currentTheme = this.currentTheme === 'light' ? 'dark' : 'light';
      await StorageManager.set(STORAGE_KEY_THEME, this.currentTheme);
      this.applyTheme();
    }

    applyTheme() {
      const panel = document.getElementById('brazza-panel');
      if (panel) {
        panel.setAttribute('data-theme', this.currentTheme);
      }
    }
  }

  class StatsManager {
    constructor() {
      this.stats = {
        messagesTotal: 0,
        funnelsCreated: 0,
        contactsTotal: 0,
        lastActivity: null
      };
      this.load();
    }

    async load() {
      this.stats = await StorageManager.get(STORAGE_KEY_STATS) || this.stats;
    }

    async save() {
      await StorageManager.set(STORAGE_KEY_STATS, this.stats);
    }

    async updateStats(type) {
      switch(type) {
        case 'message':
          this.stats.messagesTotal++;
          break;
        case 'funnel':
          this.stats.funnelsCreated++;
          break;
        case 'contact':
          this.stats.contactsTotal++;
          break;
      }
      this.stats.lastActivity = new Date().toISOString();
      await this.save();
    }
  }

  class NotesManager {
    constructor() {
      this.notes = {};
      this.load();
    }

    async load() {
      this.notes = await StorageManager.get(STORAGE_KEY_NOTES) || {};
    }

    async save() {
      await StorageManager.set(STORAGE_KEY_NOTES, this.notes);
    }

    async addNote(contactId, text) {
      if (!this.notes[contactId]) {
        this.notes[contactId] = [];
      }
      this.notes[contactId].push({
        text,
        date: new Date().toISOString()
      });
      await this.save();
    }

    async deleteNote(contactId, index) {
      if (this.notes[contactId] && this.notes[contactId][index]) {
        this.notes[contactId].splice(index, 1);
        await this.save();
      }
    }
  }

  class TagManager {
    constructor() {
      this.tags = {};
      this.load();
    }

    async load() {
      this.tags = await StorageManager.get(STORAGE_KEY_TAGS) || {};
    }

    async save() {
      await StorageManager.set(STORAGE_KEY_TAGS, this.tags);
    }

    async addTag(contactId, tag) {
      if (!this.tags[contactId]) {
        this.tags[contactId] = [];
      }
      if (!this.tags[contactId].includes(tag)) {
        this.tags[contactId].push(tag);
        await this.save();
      }
    }

    async removeTag(contactId, tag) {
      if (this.tags[contactId]) {
        this.tags[contactId] = this.tags[contactId].filter(t => t !== tag);
        await this.save();
      }
    }
  }

  class WhatsAppIntegration {
    constructor() {
      this.setupObserver();
    }

    setupObserver() {
      const observer = new MutationObserver(() => {
        this.detectContacts();
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
    }

    detectContacts() {
      // Implementar detecção de contatos do WhatsApp
      const contacts = document.querySelectorAll('[data-testid="cell-frame-container"]');
      contacts.forEach(contact => {
        const name = contact.querySelector('[data-testid="cell-frame-title"]')?.textContent;
        if (name) {
          // Adicionar botão de ação rápida
          this.addQuickActionButton(contact, name);
        }
      });
    }

    addQuickActionButton(element, contactName) {
      if (element.querySelector('.brazza-quick-action')) return;

      const button = document.createElement('button');
      button.className = 'brazza-quick-action';
      button.innerHTML = '⚡';
      button.title = 'Ações rápidas BrazzaWhats';
      button.onclick = (e) => {
        e.stopPropagation();
        this.showQuickActions(contactName);
      };

      element.appendChild(button);
    }

    showQuickActions(contactName) {
      const menu = document.createElement('div');
      menu.className = 'brazza-quick-menu';
      menu.innerHTML = `
        <button onclick="window.brazzaApp.whatsapp.addToCRM('${contactName}')">Adicionar ao CRM</button>
        <button onclick="window.brazzaApp.whatsapp.createFunnel('${contactName}')">Criar Funil</button>
        <button onclick="window.brazzaApp.whatsapp.addNote('${contactName}')">Adicionar Nota</button>
      `;
      document.body.appendChild(menu);

      // Fechar menu ao clicar fora
      const closeMenu = (e) => {
        if (!menu.contains(e.target)) {
          menu.remove();
          document.removeEventListener('click', closeMenu);
        }
      };
      setTimeout(() => document.addEventListener('click', closeMenu), 0);
    }

    async sendMessage(phone, message) {
      // Implementar envio de mensagem
      const chatWindow = document.querySelector('[data-testid="conversation-compose-box-input"]');
      if (chatWindow) {
        // Simular digitação
        chatWindow.textContent = message;
        chatWindow.dispatchEvent(new InputEvent('input', { bubbles: true }));
        
        // Enviar mensagem
        const sendButton = document.querySelector('[data-testid="send"]');
        if (sendButton) {
          sendButton.click();
          return true;
        }
      }
      return false;
    }
  }

  class BrazzaUI {
    constructor() {
      this.crm = new CRMManager();
      this.sequentialScripts = new SequentialScripts();
      this.funnelManager = new FunnelManager();
      this.themeManager = new ThemeManager();
      this.statsManager = new StatsManager();
      this.notesManager = new NotesManager();
      this.tagManager = new TagManager();
      this.whatsapp = new WhatsAppIntegration();
      this.activeTab = 'crm';
      this.initializeUI();
    }

    createStyles() {
      const style = document.createElement('style');
      style.textContent = `
        #brazza-panel {
          position: fixed;
          top: 0;
          right: -350px;
          width: 350px;
          height: 100vh;
          background: var(--bg-color);
          box-shadow: -2px 0 5px rgba(0,0,0,0.2);
          transition: all 0.3s;
          z-index: 9999;
          display: flex;
          flex-direction: column;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        }

        #brazza-panel[data-theme="dark"] {
          --bg-color: #1a1a1a;
          --text-color: #ffffff;
          --border-color: #333333;
          --hover-color: #2a2a2a;
          --primary-color: #25D366;
          --secondary-color: #128C7E;
        }

        #brazza-panel[data-theme="light"] {
          --bg-color: #ffffff;
          --text-color: #000000;
          --border-color: #e0e0e0;
          --hover-color: #f5f5f5;
          --primary-color: #25D366;
          --secondary-color: #128C7E;
        }

        #brazza-panel * {
          color: var(--text-color);
        }

        #brazza-panel-header {
          padding: 15px;
          background: var(--primary-color);
          border-bottom: 1px solid var(--secondary-color);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .brazza-tab {
          padding: 10px 20px;
          cursor: pointer;
          border: none;
          background: none;
          font-size: 14px;
          flex: 1;
          text-align: center;
          transition: all 0.2s;
        }

        .brazza-tab:hover {
          background: var(--hover-color);
        }

        .brazza-tab.active {
          background: var(--bg-color);
          border-bottom: 2px solid var(--primary-color);
          font-weight: bold;
        }

        .brazza-content {
          flex: 1;
          padding: 15px;
          overflow-y: auto;
        }

        .brazza-card {
          background: var(--bg-color);
          border: 1px solid var(--border-color);
          border-radius: 8px;
          padding: 15px;
          margin: 10px 0;
          transition: all 0.2s;
        }

        .brazza-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 8px rgba(0,0,0,0.1);
        }

        .brazza-btn {
          background: var(--primary-color);
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 8px;
          cursor: pointer;
          margin: 5px 0;
          width: 100%;
          font-size: 14px;
          transition: all 0.2s;
        }

        .brazza-btn:hover {
          background: var(--secondary-color);
          transform: translateY(-1px);
        }

        .brazza-quick-action {
          position: absolute;
          right: 10px;
          top: 50%;
          transform: translateY(-50%);
          background: var(--primary-color);
          color: white;
          border: none;
          border-radius: 50%;
          width: 24px;
          height: 24px;
          cursor: pointer;
          opacity: 0;
          transition: opacity 0.2s;
        }

        [data-testid="cell-frame-container"]:hover .brazza-quick-action {
          opacity: 1;
        }

        .brazza-quick-menu {
          position: fixed;
          background: var(--bg-color);
          border: 1px solid var(--border-color);
          border-radius: 8px;
          padding: 10px;
          box-shadow: 0 4px 8px rgba(0,0,0,0.1);
          z-index: 10000;
        }

        .brazza-tag {
          display: inline-block;
          padding: 2px 8px;
          border-radius: 12px;
          font-size: 12px;
          margin: 2px;
          background: var(--primary-color);
          color: white;
        }

        .brazza-note {
          background: var(--hover-color);
          padding: 10px;
          border-radius: 8px;
          margin: 5px 0;
        }

        .brazza-stats {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 10px;
          margin-bottom: 15px;
        }

        .brazza-stat-card {
          background: var(--hover-color);
          padding: 10px;
          border-radius: 8px;
          text-align: center;
        }

        .brazza-stat-value {
          font-size: 24px;
          font-weight: bold;
          color: var(--primary-color);
        }

        .brazza-search {
          width: 100%;
          padding: 8px;
          border: 1px solid var(--border-color);
          border-radius: 8px;
          margin-bottom: 10px;
          background: var(--bg-color);
        }

        @keyframes slideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }

        .brazza-notification {
          position: fixed;
          bottom: 20px;
          right: 20px;
          padding: 10px 20px;
          background: var(--primary-color);
          color: white;
          border-radius: 8px;
          animation: slideIn 0.3s ease-out;
        }
      `;
      document.head.appendChild(style);
    }

    initializeUI() {
      this.createStyles();
      this.createMainPanel();
      this.setupEventListeners();
      this.refreshUI();
    }

    createMainPanel() {
      const panel = document.createElement('div');
      panel.id = 'brazza-panel';
      
      const header = document.createElement('div');
      header.id = 'brazza-panel-header';
      header.innerHTML = `
        <h2 style="margin:0">BrazzaWhats PRO</h2>
        <div>
          <button class="brazza-theme-toggle" onclick="window.brazzaApp.ui.themeManager.toggleTheme()">🌓</button>
          <button class="brazza-close-btn">×</button>
        </div>
      `;
      
      const tabs = document.createElement('div');
      tabs.id = 'brazza-tabs';
      tabs.innerHTML = `
        <button class="brazza-tab active" data-tab="crm">CRM</button>
        <button class="brazza-tab" data-tab="scripts">Scripts</button>
        <button class="brazza-tab" data-tab="funil">Funil</button>
        <button class="brazza-tab" data-tab="stats">Stats</button>
      `;
      
      const content = document.createElement('div');
      content.className = 'brazza-content';
      
      const sections = {
        crm: `
          <input type="text" class="brazza-search" placeholder="Buscar contatos...">
          <button class="brazza-btn" id="btn-add-contact">+ Adicionar Contato</button>
          <div id="contacts-list"></div>
        `,
        scripts: `
          <button class="brazza-btn" id="btn-add-script">+ Novo Script</button>
          <div id="scripts-list"></div>
        `,
        funil: `
          <button class="brazza-btn" id="btn-create-funnel">+ Criar Funil</button>
          <div id="funnels-list"></div>
        `,
        stats: `
          <div class="brazza-stats">
            <div class="brazza-stat-card">
              <div class="brazza-stat-value" id="stats-messages">0</div>
              <div>Mensagens</div>
            </div>
            <div class="brazza-stat-card">
              <div class="brazza-stat-value" id="stats-contacts">0</div>
              <div>Contatos</div>
            </div>
            <div class="brazza-stat-card">
              <div class="brazza-stat-value" id="stats-funnels">0</div>
              <div>Funis</div>
            </div>
            <div class="brazza-stat-card">
              <div class="brazza-stat-value" id="stats-conversion">0%</div>
              <div>Conversão</div>
            </div>
          </div>
          <button class="brazza-btn" onclick="window.brazzaApp.ui.exportData()">Exportar Dados</button>
        `
      };
      
      Object.entries(sections).forEach(([key, html]) => {
        const section = document.createElement('div');
        section.className = `brazza-section ${key === 'crm' ? 'active' : ''}`;
        section.dataset.section = key;
        section.innerHTML = html;
        content.appendChild(section);
      });
      
      panel.appendChild(header);
      panel.appendChild(tabs);
      panel.appendChild(content);
      
      document.body.appendChild(panel);
      this.panel = panel;
      
      this.setupTabEvents();
    }

    setupTabEvents() {
      const tabs = this.panel.querySelectorAll('.brazza-tab');
      tabs.forEach(tab => {
        tab.addEventListener('click', () => {
          tabs.forEach(t => t.classList.remove('active'));
          tab.classList.add('active');
          
          const sections = this.panel.querySelectorAll('.brazza-section');
          sections.forEach(section => {
            section.classList.remove('active');
            if (section.dataset.section === tab.dataset.tab) {
              section.classList.add('active');
            }
          });
          
          this.activeTab = tab.dataset.tab;
          this.refreshUI();
        });
      });
    }

    setupEventListeners() {
      document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === 'b') {
          this.togglePanel();
        }
      });

      this.panel.querySelector('.brazza-close-btn').addEventListener('click', () => {
        this.togglePanel();
      });

      this.panel.querySelector('.brazza-search').addEventListener('input', (e) => {
        this.filterContacts(e.target.value);
      });
      
      this.panel.querySelector('#btn-add-contact').addEventListener('click', () => {
        this.crm.addContact();
      });
      
      this.panel.querySelector('#btn-add-script').addEventListener('click', () => {
        this.sequentialScripts.addScript();
      });
      
      this.panel.querySelector('#btn-create-funnel').addEventListener('click', () => {
        this.createNewFunnel();
      });
    }

    togglePanel() {
      this.panel.style.right = this.panel.style.right === '0px' ? '-350px' : '0px';
    }

    filterContacts(query) {
      const contactsList = this.panel.querySelector('#contacts-list');
      const contacts = Object.entries(this.crm.contacts);
      
      contactsList.innerHTML = '';
      contacts
        .filter(([_, contact]) => 
          contact.name.toLowerCase().includes(query.toLowerCase()) ||
          contact.phone.includes(query)
        )
        .forEach(([id, contact]) => {
          this.createContactCard(id, contact, contactsList);
        });
    }

    createContactCard(id, contact, container) {
      const card = document.createElement('div');
      card.className = 'brazza-card';
      
      const tags = this.tagManager.tags[id] || [];
      const notes = this.notesManager.notes[id] || [];
      
      card.innerHTML = `
        <h4>${contact.name}</h4>
        <p>${contact.phone}</p>
        <div class="brazza-tags">
          ${tags.map(tag => `<span class="brazza-tag">${tag}</span>`).join('')}
        </div>
        <div class="brazza-notes">
          ${notes.map(note => `
            <div class="brazza-note">
              <p>${note.text}</p>
              <small>${new Date(note.date).toLocaleString()}</small>
            </div>
          `).join('')}
        </div>
        <div class="brazza-actions">
          <button class="brazza-btn brazza-small-btn" onclick="window.brazzaApp.ui.addTag('${id}')">+ Tag</button>
          <button class="brazza-btn brazza-small-btn" onclick="window.brazzaApp.ui.addNote('${id}')">+ Nota</button>
          <button class="brazza-btn brazza-small-btn" onclick="window.brazzaApp.ui.editContact('${id}')">Editar</button>
          <button class="brazza-btn brazza-small-btn" onclick="window.brazzaApp.ui.deleteContact('${id}')">Excluir</button>
        </div>
      `;
      
      container.appendChild(card);
    }

    async addTag(contactId) {
      const tag = prompt('Digite a tag:');
      if (tag) {
        await this.tagManager.addTag(contactId, tag);
        this.refreshUI();
      }
    }

    async addNote(contactId) {
      const text = prompt('Digite a nota:');
      if (text) {
        await this.notesManager.addNote(contactId, text);
        this.refreshUI();
      }
    }

    showNotification(message) {
      const notification = document.createElement('div');
      notification.className = 'brazza-notification';
      notification.textContent = message;
      document.body.appendChild(notification);
      
      setTimeout(() => {
        notification.remove();
      }, 3000);
    }

    async exportData() {
      await StorageManager.export();
      this.showNotification('Dados exportados com sucesso!');
    }

    refreshUI() {
      switch (this.activeTab) {
        case 'crm':
          this.refreshContacts();
          break;
        case 'scripts':
          this.refreshScripts();
          break;
        case 'funil':
          this.refreshFunnels();
          break;
        case 'stats':
          this.refreshStats();
          break;
      }
    }

    refreshContacts() {
      const contactsList = this.panel.querySelector('#contacts-list');
      contactsList.innerHTML = '';
      
      Object.entries(this.crm.contacts).forEach(([id, contact]) => {
        this.createContactCard(id, contact, contactsList);
      });
    }

    refreshScripts() {
      const scriptsList = this.panel.querySelector('#scripts-list');
      scriptsList.innerHTML = '';
      
      this.sequentialScripts.scripts.forEach((script, index) => {
        const card = document.createElement('div');
        card.className = 'brazza-card';
        card.innerHTML = `
          <h4>${script.name}</h4>
          <p>${script.messages.length} mensagens</p>
          <div class="brazza-actions">
            <button class="brazza-btn brazza-small-btn" onclick="window.brazzaApp.ui.editScript(${index})">Editar</button>
            <button class="brazza-btn brazza-small-btn" onclick="window.brazzaApp.ui.deleteScript(${index})">Excluir</button>
          </div>
        `;
        scriptsList.appendChild(card);
      });
    }

    refreshFunnels() {
      const funnelsList = this.panel.querySelector('#funnels-list');
      funnelsList.innerHTML = '';
      
      Object.entries(this.funnelManager.funnels).forEach(([contactId, funnel]) => {
        const contact = this.crm.contacts[contactId];
        if (!contact) return;

        const card = document.createElement('div');
        card.className = 'brazza-card';
        
        const statusBadge = this.getStatusBadge(funnel.status);
        
        card.innerHTML = `
          <h4>${contact.name} ${statusBadge}</h4>
          <p>${funnel.messages.length} mensagens agendadas</p>
          <div class="brazza-actions">
            <button class="brazza-btn brazza-small-btn" onclick="window.brazzaApp.ui.cancelFunnel('${contactId}')">Cancelar</button>
          </div>
        `;
        funnelsList.appendChild(card);
      });
    }

    refreshStats() {
      const stats = this.statsManager.stats;
      
      document.getElementById('stats-messages').textContent = stats.messagesTotal;
      document.getElementById('stats-contacts').textContent = stats.contactsTotal;
      document.getElementById('stats-funnels').textContent = stats.funnelsCreated;
      
      const conversion = stats.contactsTotal > 0 
        ? ((stats.messagesTotal / stats.contactsTotal) * 100).toFixed(1)
        : 0;
      document.getElementById('stats-conversion').textContent = `${conversion}%`;
    }

    getStatusBadge(status) {
      const badges = {
        active: '<span class="brazza-badge brazza-badge-success">Ativo</span>',
        completed: '<span class="brazza-badge brazza-badge-warning">Concluído</span>',
        cancelled: '<span class="brazza-badge brazza-badge-danger">Cancelado</span>'
      };
      return badges[status] || '';
    }
  }

  class CRMManager {
    constructor() {
      this.contacts = {};
      this.load();
    }

    async load() {
      this.contacts = await StorageManager.get(STORAGE_KEY_CRM) || {};
    }

    async save() {
      await StorageManager.set(STORAGE_KEY_CRM, this.contacts);
    }

    addContact() {
      const name = prompt('Nome do contato:');
      if (!name) return;
      
      const phone = prompt('Número do WhatsApp:');
      if (!phone) return;

      const id = Date.now().toString();
      this.contacts[id] = { name, phone };
      this.save();
      window.brazzaApp.ui.statsManager.updateStats('contact');
      window.brazzaApp.ui.refreshUI();
    }

    editContact(id) {
      const contact = this.contacts[id];
      if (!contact) return;

      const name = prompt('Nome do contato:', contact.name);
      if (!name) return;
      
      const phone = prompt('Número do WhatsApp:', contact.phone);
      if (!phone) return;

      this.contacts[id] = { name, phone };
      this.save();
      window.brazzaApp.ui.refreshUI();
    }

    deleteContact(id) {
      if (!confirm('Tem certeza que deseja excluir este contato?')) return;
      
      delete this.contacts[id];
      this.save();
      window.brazzaApp.ui.refreshUI();
    }
  }

  class SequentialScripts {
    constructor() {
      this.scripts = [];
      this.load();
    }

    async load() {
      this.scripts = await StorageManager.get(STORAGE_KEY_SCRIPTS) || [];
    }

    async save() {
      await StorageManager.set(STORAGE_KEY_SCRIPTS, this.scripts);
    }

    addScript() {
      const name = prompt('Nome do script:');
      if (!name) return;
      
      const messagesStr = prompt('Mensagens (separadas por |):');
      if (!messagesStr) return;

      const messages = messagesStr.split('|');
      this.scripts.push({ name, messages });
      this.save();
      window.brazzaApp.ui.refreshUI();
    }

    editScript(index) {
      const script = this.scripts[index];
      if (!script) return;

      const name = prompt('Nome do script:', script.name);
      if (!name) return;
      
      const messagesStr = prompt('Mensagens (separadas por |):', script.messages.join('|'));
      if (!messagesStr) return;

      const messages = messagesStr.split('|');
      this.scripts[index] = { name, messages };
      this.save();
      window.brazzaApp.ui.refreshUI();
    }

    deleteScript(index) {
      if (!confirm('Tem certeza que deseja excluir este script?')) return;
      
      this.scripts.splice(index, 1);
      this.save();
      window.brazzaApp.ui.refreshUI();
    }
  }

  class FunnelManager {
    constructor() {
      this.funnels = {};
      this.load();
    }

    async load() {
      this.funnels = await StorageManager.get(STORAGE_KEY_FUNNELS) || {};
    }

    async save() {
      await StorageManager.set(STORAGE_KEY_FUNNELS, this.funnels);
    }

    async createFunnel(contactId, messages, delays) {
      if (!Array.isArray(messages) || !Array.isArray(delays) || messages.length !== delays.length) {
        throw new Error('Formato inválido de funil');
      }

      this.funnels[contactId] = {
        messages,
        delays,
        startTime: Date.now(),
        currentStep: 0,
        status: 'active'
      };

      let totalDelay = 0;
      messages.forEach((_, index) => {
        totalDelay += delays[index];
        chrome.alarms.create(`funil_${contactId}_${index}`, {
          when: Date.now() + (totalDelay * 60 * 60 * 1000)
        });
      });

      await this.save();
      window.brazzaApp.ui.statsManager.updateStats('funnel');
    }

    async cancelFunnel(contactId) {
      if (this.funnels[contactId]) {
        this.funnels[contactId].status = 'cancelled';
        const alarms = await chrome.alarms.getAll();
        alarms
          .filter(alarm => alarm.name.startsWith(`funil_${contactId}`))
          .forEach(alarm => chrome.alarms.clear(alarm.name));
        await this.save();
      }
    }

    getFunnelStatus(contactId) {
      return this.funnels[contactId]?.status || 'none';
    }
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'SEND_FUNNEL_MESSAGE') {
      const { contactId, messageIndex, message: text } = message;
      console.log(`Enviando mensagem ${messageIndex} para ${contactId}: ${text}`);
      
      const contact = window.brazzaApp.crm.contacts[contactId];
      if (contact) {
        window.brazzaApp.whatsapp.sendMessage(contact.phone, text)
          .then(success => {
            if (success) {
              window.brazzaApp.ui.statsManager.updateStats('message');
              window.brazzaApp.ui.showNotification('Mensagem enviada com sucesso!');
            }
          });
      }
    }
  });

  async function initApp() {
    setTimeout(async () => {
      try {
        window.brazzaApp = {
          ui: new BrazzaUI(),
          storageManager: StorageManager,
          whatsapp: new WhatsAppIntegration()
        };
      } catch (error) {
        console.error("Falha ao inicializar BrazzaWhats PRO:", error);
      }
    }, 2000);
  }

  if (document.readyState === 'complete') {
    initApp();
  } else {
    window.addEventListener('load', initApp);
  }
})();