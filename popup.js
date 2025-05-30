document.getElementById('abrirPainel').addEventListener('click', () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    // Verifica se a aba ativa é o WhatsApp Web antes de tentar executar o script
    if (tabs[0]?.url?.includes('web.whatsapp.com')) {
      chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        func: () => {
          // Tenta chamar uma função no content script para garantir que o painel esteja visível
          if (window.brazzaApp && typeof window.brazzaApp.ui.ensurePanelVisible === 'function') {
            window.brazzaApp.ui.ensurePanelVisible();
          } else {
            // Se a função não existir (script ainda não carregado ou erro), recarrega a extensão ou avisa
            // Poderia tentar injetar o script aqui como fallback, mas é mais complexo
            alert('Painel BrazzaWhats não encontrado. Verifique se o WhatsApp Web está totalmente carregado ou tente recarregar a página.');
          }
        }
      }).catch(err => {
        console.error("BrazzaWhats: Erro ao executar script no popup:", err);
        alert("Não foi possível comunicar com a aba do WhatsApp. Verifique se a página está carregada.");
      });
    } else {
      alert("Por favor, abra ou navegue para a aba do WhatsApp Web primeiro.");
    }
  });
});

document.getElementById('abrirWhatsapp').addEventListener('click', () => {
  chrome.tabs.create({ url: 'https://web.whatsapp.com/' });
});