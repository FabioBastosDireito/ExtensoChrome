// content.js - Código unificado (v2.4 - Com persistência e funil)
(function () {
  if (window.brazzaAppInitialized) {
    console.log("BrazzaWhats PRO já inicializado.");
    return;
  }
  window.brazzaAppInitialized = true;
  console.log("Inicializando BrazzaWhats PRO...");

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
        currentStep: 0
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
        delete this.funnels[contactId];
        const alarms = await chrome.alarms.getAll();
        alarms
          .filter(alarm => alarm.name.startsWith(`funil_${contactId}`))
          .forEach(alarm => chrome.alarms.clear(alarm.name));
        await this.save();
      }
    }
  }

  class BrazzaUI {
    constructor() {
      this.crm = new CRMManager();
      this.sequentialScripts = new SequentialScripts();
      this.activeTab = 'crm';
      this.initializeUI();
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
        
        #brazza-panel-header {
          padding: 15px;
          background: #25D366;
          color: white;
          border-bottom: 1px solid #128C7E;
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
        }
        
        .brazza-tab.active {
          background: white;
          border-bottom: 2px solid #25D366;
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
        }
        
        .brazza-btn:hover {
          background: #128C7E;
        }
      `;
      document.head.appendChild(style);
    }

    createMainPanel() {
      const panel = document.createElement('div');
      panel.id = 'brazza-panel';
      
      // Header
      const header = document.createElement('div');
      header.id = 'brazza-panel-header';
      header.innerHTML = '<h2 style="margin:0">BrazzaWhats PRO</h2>';
      
      // Tabs
      const tabs = document.createElement('div');
      tabs.id = 'brazza-tabs';
      tabs.innerHTML = `
        <button class="brazza-tab active" data-tab="crm">CRM</button>
        <button class="brazza-tab" data-tab="scripts">Scripts</button>
        <button class="brazza-tab" data-tab="funil">Funil</button>
      `;
      
      // Content
      const content = document.createElement('div');
      content.className = 'brazza-content';
      
      // CRM Section
      const crmSection = document.createElement('div');
      crmSection.className = 'brazza-section active';
      crmSection.dataset.section = 'crm';
      crmSection.innerHTML = `
        <h3>Gerenciar Contatos</h3>
        <button class="brazza-btn" id="btn-add-contact">Adicionar Contato</button>
        <div id="contacts-list"></div>
      `;
      
      // Scripts Section
      const scriptsSection = document.createElement('div');
      scriptsSection.className = 'brazza-section';
      scriptsSection.dataset.section = 'scripts';
      scriptsSection.innerHTML = `
        <h3>Scripts Sequenciais</h3>
        <button class="brazza-btn" id="btn-add-script">Novo Script</button>
        <div id="scripts-list"></div>
      `;
      
      // Funil Section
      const funilSection = document.createElement('div');
      funilSection.className = 'brazza-section';
      funilSection.dataset.section = 'funil';
      funilSection.innerHTML = `
        <h3>Funil de Mensagens</h3>
        <button class="brazza-btn" id="btn-create-funnel">Criar Funil</button>
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
        });
      });
    }

    setupEventListeners() {
      document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === 'b') {
          this.togglePanel();
        }
      });
      
      // Botões de ação
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

    ensurePanelVisible() {
      this.panel.style.right = '0px';
    }

    createNewFunnel() {
      // Implementação futura
      alert('Funcionalidade em desenvolvimento');
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
      // Implementação futura
      alert('Funcionalidade em desenvolvimento');
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
      // Implementação futura
      alert('Funcionalidade em desenvolvimento');
    }
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'SEND_FUNNEL_MESSAGE') {
      const { contactId, messageIndex, message: text } = message;
      console.log(`Enviando mensagem ${messageIndex} para ${contactId}: ${text}`);
    }
  });

  async function initApp() {
    setTimeout(async () => {
      try {
        const ui = new BrazzaUI();
        const funnelManager = new FunnelManager();
        
        window.brazzaApp = {
          ui,
          crm: ui.crm,
          scripts: ui.sequentialScripts,
          funnelManager,
          storageManager: StorageManager
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