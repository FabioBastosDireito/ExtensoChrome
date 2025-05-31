// content.js - Código unificado (v2.4 - Com persistência e funil)
(function () {
  if (window.brazzaAppInitialized) {
    console.log("BrazzaWhats PRO já inicializado.");
    return;
  }

  // STORAGE KEYS
  const STORAGE_KEY_SCRIPTS = 'brazzaScripts';
  const STORAGE_KEY_CRM = 'brazza_crm_data';
  const STORAGE_KEY_UI_STATE = 'brazza_ui_state';
  const STORAGE_KEY_FUNNELS = 'brazza_funnels';
  const STORAGE_KEY_STATS = 'brazza_stats';

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

  class BrazzaUI {
    constructor() {
      this.initializeUI();
      this.crm = new CRMManager();
      this.sequentialScripts = new SequentialScripts();
      this.funnelManager = new FunnelManager();
      this.activeTab = 'crm';
      this.refreshUI();
    }

    initializeUI() {
      this.createStyles();
      this.createMainPanel();
      this.setupEventListeners();
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
          background: white;
          box-shadow: -2px 0 5px rgba(0,0,0,0.2);
          transition: right 0.3s;
          z-index: 9999;
          display: flex;
          flex-direction: column;
        }
        
        #brazza-panel.visible {
          right: 0;
        }
        
        #brazza-panel-header {
          padding: 15px;
          background: #25D366;
          color: white;
          border-bottom: 1px solid #128C7E;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        
        #brazza-tabs {
          display: flex;
          background: #f0f0f0;
          border-bottom: 1px solid #ddd;
        }
        
        .brazza-tab {
          padding: 10px 20px;
          cursor: pointer;
          border: none;
          background: none;
          font-size: 14px;
          flex: 1;
          text-align: center;
        }
        
        .brazza-tab.active {
          background: white;
          border-bottom: 2px solid #25D366;
          font-weight: bold;
        }
        
        .brazza-content {
          flex: 1;
          padding: 15px;
          overflow-y: auto;
        }
        
        .brazza-section {
          display: none;
        }
        
        .brazza-section.active {
          display: block;
        }
        
        .brazza-btn {
          background: #25D366;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
          margin: 5px 0;
          width: 100%;
          font-size: 14px;
        }
        
        .brazza-btn:hover {
          background: #128C7E;
        }

        .brazza-card {
          background: #f8f9fa;
          border: 1px solid #dee2e6;
          border-radius: 4px;
          padding: 10px;
          margin: 10px 0;
        }

        .brazza-card h4 {
          margin: 0 0 10px 0;
          color: #128C7E;
        }

        .brazza-badge {
          display: inline-block;
          padding: 3px 8px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: bold;
          margin-left: 5px;
        }

        .brazza-badge-success {
          background: #d4edda;
          color: #155724;
        }

        .brazza-badge-warning {
          background: #fff3cd;
          color: #856404;
        }

        .brazza-badge-danger {
          background: #f8d7da;
          color: #721c24;
        }
      `;
      document.head.appendChild(style);
    }

    createMainPanel() {
      const panel = document.createElement('div');
      panel.id = 'brazza-panel';
      
      const header = document.createElement('div');
      header.id = 'brazza-panel-header';
      header.innerHTML = `
        <h2 style="margin:0">BrazzaWhats PRO</h2>
        <button class="brazza-btn" style="width:auto;padding:5px 10px" id="brazza-close">×</button>
      `;
      
      const tabs = document.createElement('div');
      tabs.id = 'brazza-tabs';
      tabs.innerHTML = `
        <button class="brazza-tab active" data-tab="crm">CRM</button>
        <button class="brazza-tab" data-tab="scripts">Scripts</button>
        <button class="brazza-tab" data-tab="funil">Funil</button>
      `;
      
      const content = document.createElement('div');
      content.className = 'brazza-content';
      
      const crmSection = document.createElement('div');
      crmSection.className = 'brazza-section active';
      crmSection.dataset.section = 'crm';
      crmSection.innerHTML = `
        <button class="brazza-btn" id="btn-add-contact">+ Adicionar Contato</button>
        <div id="contacts-list"></div>
      `;
      
      const scriptsSection = document.createElement('div');
      scriptsSection.className = 'brazza-section';
      scriptsSection.dataset.section = 'scripts';
      scriptsSection.innerHTML = `
        <button class="brazza-btn" id="btn-add-script">+ Novo Script</button>
        <div id="scripts-list"></div>
      `;
      
      const funilSection = document.createElement('div');
      funilSection.className = 'brazza-section';
      funilSection.dataset.section = 'funil';
      funilSection.innerHTML = `
        <button class="brazza-btn" id="btn-create-funnel">+ Criar Funil</button>
        <div id="funnels-list"></div>
      `;
      
      content.appendChild(crmSection);
      content.appendChild(scriptsSection);
      content.appendChild(funilSection);
      
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

      this.panel.querySelector('#brazza-close').addEventListener('click', () => {
        this.togglePanel();
      });
      
      this.panel.querySelector('#btn-add-contact')?.addEventListener('click', () => {
        this.crm.addContact();
        this.refreshUI();
      });
      
      this.panel.querySelector('#btn-add-script')?.addEventListener('click', () => {
        this.sequentialScripts.addScript();
        this.refreshUI();
      });
      
      this.panel.querySelector('#btn-create-funnel')?.addEventListener('click', () => {
        this.createNewFunnel();
        this.refreshUI();
      });
    }

    togglePanel() {
      this.panel.classList.toggle('visible');
    }

    ensurePanelVisible() {
      this.panel.classList.add('visible');
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
      }
    }

    refreshContacts() {
      const contactsList = this.panel.querySelector('#contacts-list');
      if (!contactsList) return;
      
      contactsList.innerHTML = '';
      
      Object.entries(this.crm.contacts).forEach(([id, contact]) => {
        const card = document.createElement('div');
        card.className = 'brazza-card';
        card.innerHTML = `
          <h4>${contact.name}</h4>
          <p>${contact.phone}</p>
          <div class="brazza-actions">
            <button class="brazza-btn" onclick="window.brazzaApp.ui.crm.editContact('${id}')">Editar</button>
            <button class="brazza-btn" onclick="window.brazzaApp.ui.crm.deleteContact('${id}')">Excluir</button>
          </div>
        `;
        contactsList.appendChild(card);
      });
    }

    refreshScripts() {
      const scriptsList = this.panel.querySelector('#scripts-list');
      if (!scriptsList) return;
      
      scriptsList.innerHTML = '';
      
      this.sequentialScripts.scripts.forEach((script, index) => {
        const card = document.createElement('div');
        card.className = 'brazza-card';
        card.innerHTML = `
          <h4>${script.name}</h4>
          <p>${script.messages.length} mensagens</p>
          <div class="brazza-actions">
            <button class="brazza-btn" onclick="window.brazzaApp.ui.sequentialScripts.editScript(${index})">Editar</button>
            <button class="brazza-btn" onclick="window.brazzaApp.ui.sequentialScripts.deleteScript(${index})">Excluir</button>
          </div>
        `;
        scriptsList.appendChild(card);
      });
    }

    refreshFunnels() {
      const funnelsList = this.panel.querySelector('#funnels-list');
      if (!funnelsList) return;
      
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
            <button class="brazza-btn" onclick="window.brazzaApp.ui.funnelManager.cancelFunnel('${contactId}')">Cancelar</button>
          </div>
        `;
        funnelsList.appendChild(card);
      });
    }

    getStatusBadge(status) {
      const badges = {
        active: '<span class="brazza-badge brazza-badge-success">Ativo</span>',
        completed: '<span class="brazza-badge brazza-badge-warning">Concluído</span>',
        cancelled: '<span class="brazza-badge brazza-badge-danger">Cancelado</span>'
      };
      return badges[status] || '';
    }

    createNewFunnel() {
      const contactId = prompt('ID do contato:');
      if (!contactId || !this.crm.contacts[contactId]) {
        alert('Contato não encontrado!');
        return;
      }

      const messagesStr = prompt('Mensagens (separadas por |):');
      if (!messagesStr) return;
      
      const delaysStr = prompt('Atrasos em horas (separados por |):');
      if (!delaysStr) return;

      const messages = messagesStr.split('|');
      const delays = delaysStr.split('|').map(Number);

      try {
        this.funnelManager.createFunnel(contactId, messages, delays);
        this.refreshFunnels();
      } catch (error) {
        alert('Erro ao criar funil: ' + error.message);
      }
    }
  }

  // Listener para mensagens do background script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'SEND_FUNNEL_MESSAGE') {
      const { contactId, messageIndex, message: text } = message;
      console.log(`Enviando mensagem ${messageIndex} para ${contactId}: ${text}`);
      
      const contact = window.brazzaApp.crm.contacts[contactId];
      if (contact) {
        // TODO: Implementar envio real da mensagem
        console.log(`Mensagem enviada para ${contact.name} (${contact.phone}): ${text}`);
      }
    }
  });

  // Inicialização do app
  function initApp() {
    try {
      window.brazzaApp = {
        ui: new BrazzaUI(),
        storageManager: StorageManager
      };
      window.brazzaAppInitialized = true;
      console.log("BrazzaWhats PRO inicializado com sucesso!");
    } catch (error) {
      console.error("Falha ao inicializar BrazzaWhats PRO:", error);
    }
  }

  // Aguarda o carregamento completo da página
  if (document.readyState === 'complete') {
    setTimeout(initApp, 2000);
  } else {
    window.addEventListener('load', () => setTimeout(initApp, 2000));
  }
})();