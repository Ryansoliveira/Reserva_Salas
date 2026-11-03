// API REST do sistema: comunicação com o servidor exclusivamente por fetch().

const script = document.createElement('script');
script.src = '/js/api.js';
script.onload = init;
document.head.appendChild(script);
async function init() {
  const $ = id => document.getElementById(id);
  let salas = [], reservas = [];
  const toast = (msg, type='ok') => { $('toast').textContent = msg; $('toast').className = `toast show ${type}`; window.clearTimeout(toast.timer); toast.timer = setTimeout(() => $('toast').className='toast', 4500); };
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const dateBR = value => new Date(`${value}T12:00:00`).toLocaleDateString('pt-BR');
  async function load() {
    try {
      [salas, reservas] = await Promise.all([api.get('/api/salas'), api.get('/api/reservas')]);
      render();
    } catch(e) { toast(e.message, 'error'); }
  }
  function render() {
    $('totalSalas').textContent = salas.length;
    $('totalReservas').textContent = reservas.filter(r => r.status === 'Ativa').length;
    const hoje = new Date().toISOString().slice(0,10);
    $('proximasReservas').textContent = reservas.filter(r => r.status === 'Ativa' && r.data >= hoje).length;
    const salaOptions = salas.map(s => `<option value="${esc(s.id)}">${esc(s.nome)}</option>`).join('');
    $('filtroSala').innerHTML = '<option value="">Todas as salas</option>' + salaOptions;
    const selected = $('resSala').value;
    $('resSala').innerHTML = '<option value="">Selecione uma sala</option>' + salaOptions;
    if (selected) $('resSala').value = selected;
    renderReservas(); renderSalas();
  }
  function renderReservas() {
    let list = [...reservas];
    const data = $('filtroData').value, salaId = $('filtroSala').value, status = $('filtroStatus').value;
    if (data) list = list.filter(r => r.data === data);
    if (salaId) list = list.filter(r => r.salaId === salaId);
    if (status) list = list.filter(r => r.status === status);
    list.sort((a,b) => (a.data+a.inicio).localeCompare(b.data+b.inicio));
    $('listaReservas').innerHTML = list.length ? list.map(r => {
      const sala = salas.find(s => s.id === r.salaId);
      const [y,m,d] = r.data.split('-');
      return `<article class="reservation"><div class="datebox"><strong>${d}</strong><span>${new Date(`${r.data}T12:00:00`).toLocaleDateString('pt-BR',{month:'short'})}</span></div><div><h3>${esc(sala?.nome || 'Sala removida')} <span class="pill ${r.status==='Cancelada'?'cancel':''}">${esc(r.status)}</span></h3><p>${esc(r.aluno)} · ${esc(r.email)}</p><p>${esc(r.inicio)}–${esc(r.fim)} · ${esc(r.participantes)} participantes · ${esc(r.finalidade)}</p></div><div class="actions"><button class="mini" data-edit-res="${r.id}">Editar</button><button class="mini danger" data-del-res="${r.id}">Excluir</button></div></article>`;
    }).join('') : '<div class="empty">Nenhuma reserva encontrada com esses filtros.</div>';
  }
  function renderSalas() {
    $('listaSalas').innerHTML = salas.length ? salas.map(s => `<article class="room"><h3>${esc(s.nome)} <span class="pill ${s.situacao==='Inativa'?'cancel':''}">${esc(s.situacao)}</span></h3><p>⌖ ${esc(s.localizacao)}</p><p>♧ Capacidade: ${s.capacidade} pessoas</p><div class="resources">${(s.recursos||[]).map(x=>`<span class="tag">${esc(x)}</span>`).join('') || '<span class="tag">Sem recursos informados</span>'}</div><div class="room-foot"><small>${reservas.filter(r=>r.salaId===s.id).length} reserva(s) vinculada(s)</small><div class="actions"><button class="mini" data-edit-sala="${s.id}">Editar</button><button class="mini danger" data-del-sala="${s.id}">Excluir</button></div></div></article>`).join('') : '<div class="empty">Cadastre a primeira sala para começar.</div>';
  }
  document.querySelectorAll('.tab').forEach(btn => btn.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(x=>x.classList.toggle('active',x===btn));
    $('view-reservas').classList.toggle('hidden',btn.dataset.tab!=='reservas');
    $('view-salas').classList.toggle('hidden',btn.dataset.tab!=='salas');
  }));
  $('novaSala').onclick = () => { $('formSala').reset(); $('salaId').value=''; $('tituloSala').textContent='Cadastrar sala'; $('modalSala').showModal(); };
  $('novaReserva').onclick = () => {
    if (!salas.some(s=>s.situacao==='Disponível')) return toast('Cadastre uma sala disponível antes de reservar.', 'error');
    $('formReserva').reset(); $('reservaId').value=''; $('tituloReserva').textContent='Nova reserva'; $('resStatus').value='Ativa'; $('feriadoAviso').classList.add('hidden'); $('modalReserva').showModal();
  };
  document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>b.closest('dialog').close());
  $('formSala').onsubmit = async e => {
    e.preventDefault();
    const id=$('salaId').value, payload={nome:$('salaNome').value,localizacao:$('salaLocal').value,capacidade:Number($('salaCapacidade').value),situacao:$('salaSituacao').value,recursos:$('salaRecursos').value};
    try { if(id) await api.put(`/api/salas/${id}`,payload); else await api.post('/api/salas',payload); $('modalSala').close(); toast('Sala salva com sucesso!'); await load(); }
    catch(err){toast(err.message,'error');}
  };
  $('formReserva').onsubmit = async e => {
    e.preventDefault();
    const id=$('reservaId').value,payload={aluno:$('aluno').value,email:$('email').value,salaId:$('resSala').value,data:$('resData').value,inicio:$('inicio').value,fim:$('fim').value,participantes:Number($('participantes').value),finalidade:$('finalidade').value,status:$('resStatus').value};
    try { if(id) await api.put(`/api/reservas/${id}`,payload); else await api.post('/api/reservas',payload); $('modalReserva').close(); toast('Reserva salva com sucesso!'); await load(); }
    catch(err){toast(err.message,'error');}
  };
  $('resData').addEventListener('change', async () => {
    const date=$('resData').value, box=$('feriadoAviso'); box.classList.add('hidden');
    if(!date) return;
    try {
      const feriados=await api.get(`/api/feriados/${date.slice(0,4)}`);
      const found=feriados.find(f=>f.date===date);
      if(found){box.textContent=`Feriado nacional: ${found.name}. A consulta é apenas informativa; você pode continuar com a reserva.`;box.classList.remove('hidden');}
    } catch { box.textContent='Não foi possível consultar os feriados na BrasilAPI. Você pode continuar com a reserva.';box.classList.remove('hidden'); }
  });
  $('participantes').addEventListener('change',()=>{
    const sala=salas.find(s=>s.id===$('resSala').value);
    if(sala && Number($('participantes').value)>sala.capacidade) toast(`A sala selecionada comporta até ${sala.capacidade} participantes.`,'error');
  });
  ['filtroData','filtroSala','filtroStatus'].forEach(id=>$(id).addEventListener('change',renderReservas));
  $('limparFiltros').onclick=()=>{ $('filtroData').value='';$('filtroSala').value='';$('filtroStatus').value='';renderReservas(); };
  $('listaSalas').addEventListener('click', async e=>{
    const edit=e.target.closest('[data-edit-sala]')?.dataset.editSala, del=e.target.closest('[data-del-sala]')?.dataset.delSala;
    if(edit){const s=salas.find(x=>x.id===edit);$('salaId').value=s.id;$('salaNome').value=s.nome;$('salaLocal').value=s.localizacao;$('salaCapacidade').value=s.capacidade;$('salaSituacao').value=s.situacao;$('salaRecursos').value=(s.recursos||[]).join(', ');$('tituloSala').textContent='Editar sala';$('modalSala').showModal();}
    if(del && confirm('Deseja realmente excluir esta sala?')) try{await api.delete(`/api/salas/${del}`);toast('Sala excluída.');await load();}catch(err){toast(err.message,'error');}
  });
  $('listaReservas').addEventListener('click', async e=>{
    const edit=e.target.closest('[data-edit-res]')?.dataset.editRes,del=e.target.closest('[data-del-res]')?.dataset.delRes;
    if(edit){const r=reservas.find(x=>x.id===edit);for(const [id,val] of Object.entries({reservaId:r.id,aluno:r.aluno,email:r.email,resSala:r.salaId,resData:r.data,inicio:r.inicio,fim:r.fim,participantes:r.participantes,finalidade:r.finalidade,resStatus:r.status}))$(id).value=val;$('tituloReserva').textContent='Editar reserva';$('feriadoAviso').classList.add('hidden');$('modalReserva').showModal();}
    if(del && confirm('Deseja realmente excluir esta reserva?'))try{await api.delete(`/api/reservas/${del}`);toast('Reserva excluída.');await load();}catch(err){toast(err.message,'error');}
  });
  await load();
}