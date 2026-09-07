(() => {
  const cfg = window.BRIEFING_CONFIG;
  const qs = new URLSearchParams(location.search);
  const incomingToken = qs.get('token');
  if (incomingToken) {
    sessionStorage.setItem('briefing_token', incomingToken);
    history.replaceState({}, document.title, location.pathname + location.hash);
  }
  const token = sessionStorage.getItem('briefing_token');
  const app = document.getElementById('app');
  const invalid = document.getElementById('invalid');
  const invalidReason = document.getElementById('invalidReason');
  const success = document.getElementById('success');
  const form = document.getElementById('briefingForm');
  const steps = [...document.querySelectorAll('.step')];
  let step = 0;
  let family = '';
  const presetFamily = {odontologia:'health',estetica:'health',fisioterapia:'health',barbearia:'lifestyle','barbearia-kids':'lifestyle','salao-beleza':'lifestyle',advocacia:'professional',arquitetura:'professional',contabilidade:'professional'};

  const getPayload = () => Object.fromEntries(new FormData(form).entries());
  const api = async (action, body, isForm = false) => {
    if (cfg.demoMode) {
      if (action === 'bootstrap') return {status:'PENDING', payload: JSON.parse(localStorage.getItem('briefing_demo') || '{}')};
      if (action === 'save') { localStorage.setItem('briefing_demo', JSON.stringify(body.payload || {})); return {ok:true}; }
      if (action === 'upload') return {ok:true, asset:{kind:body.get('kind'), filename:body.get('file').name}};
      if (action === 'submit') { localStorage.removeItem('briefing_demo'); return {ok:true,status:'SUBMITTED'}; }
    }
    const headers = {'X-Briefing-Token': token || ''};
    if (!isForm) headers['Content-Type']='application/json';
    const res = await fetch(cfg.apiUrl, {method: action==='bootstrap'?'GET':'POST', headers, body: action==='bootstrap'?undefined:(isForm?body:JSON.stringify({action,...body}))});
    if (!res.ok) {
      const details = await res.json().catch(()=>({}));
      const err = new Error(details.error || `Falha na comunicação (${res.status})`);
      err.status = res.status;
      throw err;
    }
    return res.json();
  };

  function showInvalid(message){
    if (invalidReason && message) invalidReason.textContent = message;
    invalid.classList.remove('hidden');
  }

  function setFamily() {
    family = presetFamily[form.elements.preset.value] || '';
    document.querySelectorAll('.health-only').forEach(el=>el.classList.toggle('hidden',family!=='health'));
    document.querySelectorAll('.lifestyle-only').forEach(el=>el.classList.toggle('hidden',family!=='lifestyle'));
    document.querySelectorAll('.professional-only').forEach(el=>el.classList.toggle('hidden',family!=='professional'));
    document.querySelectorAll('.health-lifestyle-only').forEach(el=>el.classList.toggle('hidden',!['health','lifestyle'].includes(family)));
    document.querySelectorAll('.family-image').forEach(el=>el.classList.toggle('hidden',!(el.dataset.families||'').split(',').includes(family)));
  }
  function renderStep() {
    steps.forEach((s,i)=>s.classList.toggle('active',i===step));
    const pct = Math.round((step+1)/steps.length*100);
    document.getElementById('stepText').textContent=`Etapa ${step+1} de ${steps.length}`;
    document.getElementById('percentText').textContent=`${pct}%`;
    document.getElementById('progressBar').style.width=`${pct}%`;
    document.getElementById('prev').style.visibility=step===0?'hidden':'visible';
    document.getElementById('next').classList.toggle('hidden',step===steps.length-1);
    document.getElementById('submit').classList.toggle('hidden',step!==steps.length-1);
    if(step===steps.length-1) renderSummary();
    window.scrollTo({top:0,behavior:'smooth'});
  }
  function validateCurrent() {
    const required = [...steps[step].querySelectorAll('[required]')].filter(el=>!el.closest('.hidden'));
    for (const el of required) { if(!el.checkValidity()){ el.reportValidity(); return false; } }
    return true;
  }
  function restore(payload){
    for(const [k,v] of Object.entries(payload||{})){
      const el=form.elements[k]; if(!el) continue;
      if(el.type==='checkbox') el.checked=Boolean(v); else el.value=v;
    }
    setFamily(); toggleAddress(); toggleDomain();
  }
  async function save(){
    const p=getPayload();
    document.getElementById('saveState').textContent='salvando...';
    try{ await api('save',{payload:p}); document.getElementById('saveState').textContent='salvo'; }
    catch(err){ document.getElementById('saveState').textContent='falha ao salvar'; throw err; }
  }
  function renderSummary(){
    const p=getPayload();
    document.getElementById('summary').innerHTML=`<strong>Revise antes de enviar</strong><br>Negócio: ${esc(p.businessName||'—')}<br>Segmento: ${esc(p.preset||'—')}<br>Responsável: ${esc(p.responsibleName||'—')}<br>WhatsApp: ${esc(p.whatsapp||'—')}<br>Domínio: ${esc(p.hasDomain==='yes'?(p.domain||'já possui'):p.hasDomain==='no'?(p.desiredDomain||'a definir'):'não informado')}`;
  }
  function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));}
  function toggleAddress(){ document.getElementById('addressFields').classList.toggle('hidden',form.elements.noPhysicalAddress.checked); }
  function toggleDomain(){const v=form.elements.hasDomain.value;document.getElementById('domainYes').classList.toggle('hidden',v!=='yes');document.getElementById('domainNo').classList.toggle('hidden',v!=='no');}

  document.getElementById('next').onclick=async()=>{if(!validateCurrent())return;try{await save();step++;renderStep();}catch(err){alert(err.message);}};
  document.getElementById('prev').onclick=()=>{step=Math.max(0,step-1);renderStep();};
  form.elements.preset.addEventListener('change',setFamily);
  form.elements.noPhysicalAddress.addEventListener('change',toggleAddress);
  [...form.querySelectorAll('[name=hasDomain]')].forEach(r=>r.addEventListener('change',toggleDomain));
  form.addEventListener('change',()=>{document.getElementById('saveState').textContent='alterações não salvas';});
  form.addEventListener('submit',async e=>{e.preventDefault();if(!validateCurrent())return;const btn=document.getElementById('submit');btn.disabled=true;btn.textContent='Enviando...';try{await save();await api('submit',{payload:getPayload()});app.classList.add('hidden');success.classList.remove('hidden');sessionStorage.removeItem('briefing_token');}catch(err){alert(err.message);btn.disabled=false;btn.textContent='Enviar informações para implantação';}});

  [...document.querySelectorAll('input[type=file]')].forEach(input=>input.addEventListener('change',async()=>{
    const files=[...input.files]; const note=input.parentElement.querySelector('.file-note'); if(!files.length)return;
    for(const file of files){ if(!cfg.allowedImageTypes.includes(file.type)||file.size>cfg.maxImageBytes){ input.value=''; note.textContent='Arquivo inválido. Use JPG, PNG ou WebP com até 5 MB.'; return; }}
    note.textContent=files.map(f=>f.name).join(', ')+' — pronto para enviar';
    try { for(const file of files){const fd=new FormData();fd.append('action','upload');fd.append('kind',input.dataset.kind||'other');fd.append('file',file);await api('upload',fd,true);} note.textContent=files.map(f=>f.name).join(', ')+' — enviado'; } catch(err){ note.textContent='Falha no upload: '+err.message; }
  }));

  (async()=>{
    if(!token && !cfg.demoMode){ showInvalid('O link não contém um token de briefing. Solicite um novo link ao responsável pela implantação.'); return; }
    try{
      const state=await api('bootstrap');
      if(['SUBMITTED','COMPLETED'].includes(state.status)){showInvalid('Este briefing já foi enviado ou concluído. Solicite um novo link caso precise enviar novas informações.');return;}
      restore(state.payload||{});app.classList.remove('hidden');renderStep();
    }
    catch(err){
      if(err.status===401) showInvalid('Este token não possui um briefing ativo no Supabase, expirou ou foi revogado. O responsável precisa gerar o link pelo cadastro de briefing antes do preenchimento.');
      else if(err.status===403) showInvalid('O domínio publicado não está autorizado a acessar o backend do briefing.');
      else showInvalid(`Não foi possível validar o briefing: ${err.message}`);
    }
  })();
})();