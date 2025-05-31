(function(){(function(){if(window.brazzaAppInitialized){console.log("BrazzaWhats PRO já inicializado.");return}const d="brazzaScripts",l="brazza_crm_data",p="brazza_funnels";class c{static async get(t){return new Promise(e=>{chrome.storage.sync.get([t],a=>{e(a[t])})})}static async set(t,e){return new Promise(a=>{chrome.storage.sync.set({[t]:e},a)})}}class b{constructor(){this.contacts={},this.load()}async load(){this.contacts=await c.get(l)||{}}async save(){await c.set(l,this.contacts)}addContact(){const t=prompt("Nome do contato:");if(!t)return;const e=prompt("Número do WhatsApp:");if(!e)return;const a=Date.now().toString();this.contacts[a]={name:t,phone:e},this.save()}editContact(t){const e=this.contacts[t];if(!e)return;const a=prompt("Nome do contato:",e.name);if(!a)return;const s=prompt("Número do WhatsApp:",e.phone);s&&(this.contacts[t]={name:a,phone:s},this.save(),window.brazzaApp.ui.refreshUI())}deleteContact(t){confirm("Tem certeza que deseja excluir este contato?")&&(delete this.contacts[t],this.save(),window.brazzaApp.ui.refreshUI())}}class h{constructor(){this.scripts=[],this.load()}async load(){this.scripts=await c.get(d)||[]}async save(){await c.set(d,this.scripts)}addScript(){const t=prompt("Nome do script:");if(!t)return;const e=prompt("Mensagens (separadas por |):");if(!e)return;const a=e.split("|");this.scripts.push({name:t,messages:a}),this.save()}editScript(t){const e=this.scripts[t];if(!e)return;const a=prompt("Nome do script:",e.name);if(!a)return;const s=prompt("Mensagens (separadas por |):",e.messages.join("|"));if(!s)return;const n=s.split("|");this.scripts[t]={name:a,messages:n},this.save(),window.brazzaApp.ui.refreshUI()}deleteScript(t){confirm("Tem certeza que deseja excluir este script?")&&(this.scripts.splice(t,1),this.save(),window.brazzaApp.ui.refreshUI())}}class z{constructor(){this.funnels={},this.load()}async load(){this.funnels=await c.get(p)||{}}async save(){await c.set(p,this.funnels)}async createFunnel(t,e,a){if(!Array.isArray(e)||!Array.isArray(a)||e.length!==a.length)throw new Error("Formato inválido de funil");this.funnels[t]={messages:e,delays:a,startTime:Date.now(),currentStep:0,status:"active"};let s=0;e.forEach((n,r)=>{s+=a[r],chrome.alarms.create(`funil_${t}_${r}`,{when:Date.now()+s*60*60*1e3})}),await this.save()}async cancelFunnel(t){this.funnels[t]&&(this.funnels[t].status="cancelled",(await chrome.alarms.getAll()).filter(a=>a.name.startsWith(`funil_${t}`)).forEach(a=>chrome.alarms.clear(a.name)),await this.save())}getFunnelStatus(t){var e;return((e=this.funnels[t])==null?void 0:e.status)||"none"}}class m{constructor(){this.initializeUI(),this.crm=new b,this.sequentialScripts=new h,this.funnelManager=new z,this.activeTab="crm",this.refreshUI()}initializeUI(){this.createStyles(),this.createMainPanel(),this.setupEventListeners()}createStyles(){const t=document.createElement("style");t.textContent=`
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
      `,document.head.appendChild(t)}createMainPanel(){const t=document.createElement("div");t.id="brazza-panel";const e=document.createElement("div");e.id="brazza-panel-header",e.innerHTML=`
        <h2 style="margin:0">BrazzaWhats PRO</h2>
        <button class="brazza-btn" style="width:auto;padding:5px 10px" id="brazza-close">×</button>
      `;const a=document.createElement("div");a.id="brazza-tabs",a.innerHTML=`
        <button class="brazza-tab active" data-tab="crm">CRM</button>
        <button class="brazza-tab" data-tab="scripts">Scripts</button>
        <button class="brazza-tab" data-tab="funil">Funil</button>
      `;const s=document.createElement("div");s.className="brazza-content";const n=document.createElement("div");n.className="brazza-section active",n.dataset.section="crm",n.innerHTML=`
        <button class="brazza-btn" id="btn-add-contact">+ Adicionar Contato</button>
        <div id="contacts-list"></div>
      `;const r=document.createElement("div");r.className="brazza-section",r.dataset.section="scripts",r.innerHTML=`
        <button class="brazza-btn" id="btn-add-script">+ Novo Script</button>
        <div id="scripts-list"></div>
      `;const o=document.createElement("div");o.className="brazza-section",o.dataset.section="funil",o.innerHTML=`
        <button class="brazza-btn" id="btn-create-funnel">+ Criar Funil</button>
        <div id="funnels-list"></div>
      `,s.appendChild(n),s.appendChild(r),s.appendChild(o),t.appendChild(e),t.appendChild(a),t.appendChild(s),document.body.appendChild(t),this.panel=t,this.setupTabEvents()}setupTabEvents(){const t=this.panel.querySelectorAll(".brazza-tab");t.forEach(e=>{e.addEventListener("click",()=>{t.forEach(s=>s.classList.remove("active")),e.classList.add("active"),this.panel.querySelectorAll(".brazza-section").forEach(s=>{s.classList.remove("active"),s.dataset.section===e.dataset.tab&&s.classList.add("active")}),this.activeTab=e.dataset.tab,this.refreshUI()})})}setupEventListeners(){var t,e,a;document.addEventListener("keydown",s=>{s.ctrlKey&&s.key==="b"&&this.togglePanel()}),this.panel.querySelector("#brazza-close").addEventListener("click",()=>{this.togglePanel()}),(t=this.panel.querySelector("#btn-add-contact"))==null||t.addEventListener("click",()=>{this.crm.addContact(),this.refreshUI()}),(e=this.panel.querySelector("#btn-add-script"))==null||e.addEventListener("click",()=>{this.sequentialScripts.addScript(),this.refreshUI()}),(a=this.panel.querySelector("#btn-create-funnel"))==null||a.addEventListener("click",()=>{this.createNewFunnel(),this.refreshUI()})}togglePanel(){this.panel.classList.toggle("visible")}ensurePanelVisible(){this.panel.classList.add("visible")}refreshUI(){switch(this.activeTab){case"crm":this.refreshContacts();break;case"scripts":this.refreshScripts();break;case"funil":this.refreshFunnels();break}}refreshContacts(){const t=this.panel.querySelector("#contacts-list");t&&(t.innerHTML="",Object.entries(this.crm.contacts).forEach(([e,a])=>{const s=document.createElement("div");s.className="brazza-card",s.innerHTML=`
          <h4>${a.name}</h4>
          <p>${a.phone}</p>
          <div class="brazza-actions">
            <button class="brazza-btn" onclick="window.brazzaApp.ui.crm.editContact('${e}')">Editar</button>
            <button class="brazza-btn" onclick="window.brazzaApp.ui.crm.deleteContact('${e}')">Excluir</button>
          </div>
        `,t.appendChild(s)}))}refreshScripts(){const t=this.panel.querySelector("#scripts-list");t&&(t.innerHTML="",this.sequentialScripts.scripts.forEach((e,a)=>{const s=document.createElement("div");s.className="brazza-card",s.innerHTML=`
          <h4>${e.name}</h4>
          <p>${e.messages.length} mensagens</p>
          <div class="brazza-actions">
            <button class="brazza-btn" onclick="window.brazzaApp.ui.sequentialScripts.editScript(${a})">Editar</button>
            <button class="brazza-btn" onclick="window.brazzaApp.ui.sequentialScripts.deleteScript(${a})">Excluir</button>
          </div>
        `,t.appendChild(s)}))}refreshFunnels(){const t=this.panel.querySelector("#funnels-list");t&&(t.innerHTML="",Object.entries(this.funnelManager.funnels).forEach(([e,a])=>{const s=this.crm.contacts[e];if(!s)return;const n=document.createElement("div");n.className="brazza-card";const r=this.getStatusBadge(a.status);n.innerHTML=`
          <h4>${s.name} ${r}</h4>
          <p>${a.messages.length} mensagens agendadas</p>
          <div class="brazza-actions">
            <button class="brazza-btn" onclick="window.brazzaApp.ui.funnelManager.cancelFunnel('${e}')">Cancelar</button>
          </div>
        `,t.appendChild(n)}))}getStatusBadge(t){return{active:'<span class="brazza-badge brazza-badge-success">Ativo</span>',completed:'<span class="brazza-badge brazza-badge-warning">Concluído</span>',cancelled:'<span class="brazza-badge brazza-badge-danger">Cancelado</span>'}[t]||""}createNewFunnel(){const t=prompt("ID do contato:");if(!t||!this.crm.contacts[t]){alert("Contato não encontrado!");return}const e=prompt("Mensagens (separadas por |):");if(!e)return;const a=prompt("Atrasos em horas (separados por |):");if(!a)return;const s=e.split("|"),n=a.split("|").map(Number);try{this.funnelManager.createFunnel(t,s,n),this.refreshFunnels()}catch(r){alert("Erro ao criar funil: "+r.message)}}}chrome.runtime.onMessage.addListener((i,t,e)=>{if(i.type==="SEND_FUNNEL_MESSAGE"){const{contactId:a,messageIndex:s,message:n}=i;console.log(`Enviando mensagem ${s} para ${a}: ${n}`);const r=window.brazzaApp.crm.contacts[a];r&&console.log(`Mensagem enviada para ${r.name} (${r.phone}): ${n}`)}});function u(){try{window.brazzaApp={ui:new m,storageManager:c},window.brazzaAppInitialized=!0,console.log("BrazzaWhats PRO inicializado com sucesso!")}catch(i){console.error("Falha ao inicializar BrazzaWhats PRO:",i)}}document.readyState==="complete"?setTimeout(u,2e3):window.addEventListener("load",()=>setTimeout(u,2e3))})();
})()