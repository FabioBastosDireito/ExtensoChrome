// Gerenciador de alarmes para mensagens agendadas
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name.startsWith('funil_')) {
    const [_, contactId, messageIndex] = alarm.name.split('_');
    chrome.storage.sync.get(['funnels'], (result) => {
      const funnels = result.funnels || {};
      if (funnels[contactId]) {
        const funnel = funnels[contactId];
        // Envia notificação para o content script
        chrome.tabs.query({url: 'https://web.whatsapp.com/*'}, (tabs) => {
          if (tabs.length > 0) {
            chrome.tabs.sendMessage(tabs[0].id, {
              type: 'SEND_FUNNEL_MESSAGE',
              contactId: contactId,
              messageIndex: parseInt(messageIndex),
              message: funnel.messages[messageIndex]
            });
          }
        });
      }
    });
  }
});