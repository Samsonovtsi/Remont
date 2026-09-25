const rub = new Intl.NumberFormat('ru-RU',{style:'currency',currency:'RUB',maximumFractionDigits:0});
const num = new Intl.NumberFormat('ru-RU',{maximumFractionDigits:1});
const $ = id => document.getElementById(id);
let token = sessionStorage.getItem('feedbackAdminToken') || '';
$('token').value = token;

function statusLabel(value){
  return {new:'Новая',in_progress:'В работе',fixed:'Исправлена'}[value] || value;
}
function packageLabel(value){
  return {minimal:'Минимальный',standard:'Стандарт',comfort:'Комфорт',premium:'Премиум'}[value] || value;
}
function esc(value=''){
  return String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
}
async function api(path, options={}){
  const response = await fetch(path,{
    ...options,
    headers:{'Content-Type':'application/json','Authorization':'Bearer '+token,...(options.headers||{})}
  });
  const data = await response.json().catch(()=>({}));
  if(!response.ok) throw new Error(data.message || data.error || 'Ошибка запроса');
  return data;
}
function render(rows){
  $('rows').innerHTML = rows.map(row => {
    const deviation = row.deviation_percent == null ? '—' : (Number(row.deviation_percent) > 0 ? '+' : '') + num.format(Number(row.deviation_percent)) + '%';
    const statusClass = row.status === 'error' ? 'badge-error' : 'badge-ok';
    const resolutionClass = row.resolution_status === 'fixed' ? 'badge-fixed' : row.resolution_status === 'in_progress' ? 'badge-progress' : 'badge-new';
    return `<tr>
      <td>${new Date(row.created_at).toLocaleString('ru-RU')}</td>
      <td><span class="badge ${statusClass}">${row.status==='error'?'Ошибка':'Верно'}</span></td>
      <td><span class="badge ${resolutionClass}">${statusLabel(row.resolution_status)}</span></td>
      <td>${esc(packageLabel(row.package_code))}</td>
      <td>${num.format(Number(row.area_m2))} м²</td>
      <td><strong>${rub.format(Number(row.estimate_total))}</strong><br><span class="muted">${rub.format(Number(row.price_per_m2))}/м²</span></td>
      <td>${row.expected_total == null ? '—' : rub.format(Number(row.expected_total))}</td>
      <td>${deviation}</td>
      <td>${esc(row.issue_type || '—')}</td>
      <td>${esc(row.comment || '—')}</td>
      <td>${rub.format(Number(row.works_total))}</td>
      <td>${rub.format(Number(row.materials_total))}</td>
      <td><div class="actions">
        <button type="button" data-id="${row.id}" data-state="new" class="secondary">Новая</button>
        <button type="button" data-id="${row.id}" data-state="in_progress">В работу</button>
        <button type="button" data-id="${row.id}" data-state="fixed" style="background:#1f7a4d">Исправлено</button>
      </div></td>
    </tr>`;
  }).join('');

  const errors = rows.filter(r=>r.status==='error');
  const deviations = errors.map(r=>Number(r.deviation_percent)).filter(Number.isFinite);
  $('countAll').textContent = rows.length;
  $('countErrors').textContent = errors.length;
  $('countNew').textContent = rows.filter(r=>r.resolution_status==='new').length;
  $('avgDeviation').textContent = deviations.length ? num.format(deviations.reduce((a,b)=>a+Math.abs(b),0)/deviations.length)+'%' : '—';
}

async function load(){
  token = $('token').value.trim();
  if(!token){ $('status').textContent='Введите код доступа.'; $('status').className='status error'; return; }
  sessionStorage.setItem('feedbackAdminToken', token);
  $('status').textContent='Загрузка...'; $('status').className='status';

  try{
    const filter = $('filter').value;
    const query = new URLSearchParams({limit:'300'});
    if(filter) query.set('status',filter);
    const data = await api('/api/v1/feedback?'+query.toString());
    render(data.rows || []);
    $('journal').classList.remove('hidden');
    $('status').textContent='Журнал загружен.';
  }catch(err){
    $('journal').classList.add('hidden');
    $('status').textContent=err.message;
    $('status').className='status error';
  }
}

async function updateState(id, resolutionStatus){
  try{
    await api('/api/v1/feedback/'+id,{
      method:'PATCH',
      body:JSON.stringify({resolutionStatus,note:''})
    });
    await load();
  }catch(err){
    $('status').textContent=err.message;
    $('status').className='status error';
  }
}

$('loadBtn').addEventListener('click', load);
$('refreshBtn').addEventListener('click', load);
$('filter').addEventListener('change', load);
$('rows').addEventListener('click', event=>{
  const button = event.target.closest('button[data-id]');
  if(!button) return;
  updateState(Number(button.dataset.id), button.dataset.state);
});
$('token').addEventListener('keydown', event=>{ if(event.key==='Enter') load(); });
if(token) load();
