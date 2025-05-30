// content.js - Código unificado (v2.4 - Com persistência e funil)
(function () {
  // Evitar re-injeção
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

  // --- CLASSES PRINCIPAIS ---
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

      // Configura os alarmes para as mensagens
      let totalDelay = 0;
      messages.forEach((_, index) => {
        totalDelay += delays[index];
        chrome.alarms.create(`funil_${contactId}_${index}`, {
          when: Date.now() + (totalDelay * 60 * 60 * 1000) // Converte horas para milissegundos
        });
      });

      await this.save();
    }

    async cancelFunnel(contactId) {
      if (this.funnels[contactId]) {
        delete this.funnels[contactId];
        // Cancela todos os alarmes relacionados
        const alarms = await chrome.alarms.getAll();
        alarms
          .filter(alarm => alarm.name.startsWith(`funil_${contactId}`))
          .forEach(alarm => chrome.alarms.clear(alarm.name));
        await this.save();
      }
    }
  }

  // [Resto do código existente permanece o mesmo, apenas substituindo localStorage por StorageManager]
  
  // Adiciona listener para mensagens do background script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'SEND_FUNNEL_MESSAGE') {
      const { contactId, messageIndex, message: text } = message;
      // Implementar lógica para enviar a mensagem no WhatsApp
      console.log(`Enviando mensagem ${messageIndex} para ${contactId}: ${text}`);
    }
  });

  // --- Inicialização ---
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

        // Exemplo de criação de funil (24h e 48h)
        // await funnelManager.createFunnel('123@c.us', [
        //   'Primeira mensagem',
        //   'Segunda mensagem (24h)',
        //   'Terceira mensagem (48h)'
        // ], [0, 24, 48]);

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