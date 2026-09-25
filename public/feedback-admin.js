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


function percent(part, total){
  if(!total) return '—';
  return num.format((Number(part || 0) / Number(total)) * 100) + '%';
}
function eventLabel(value){
  return {
    page_view:'Переходы',
    package_click:'Клики по пакетам',
    option_change:'Изменения параметров',
    calculate:'Ручные расчёты',
    offer_generate:'Предложения клиенту',
    feedback_open:'Открытие формы ошибки',
    feedback_submit:'Отправка обратной связи',
    contact_click:'Переходы в контакты'
  }[value] || value;
}
function optionLabel(value){
  return {
    areaM2:'Площадь',
    propertyType:'Тип объекта',
    condition:'Состояние',
    rooms:'Комнаты',
    bathrooms:'Санузлы',
    doors:'Двери',
    doorways:'Проёмы',
    calculationMode:'Режим расчёта',
    needsFullElectrical:'Электрика',
    needsFullPlumbing:'Сантехника',
    needsDemolition:'Демонтаж',
    needsCeiling:'Потолок',
    hasBalcony:'Балкон',
    warmFloorM2:'Тёплый пол'
  }[value] || value;
}
function contactLabel(value){
  return {phone:'Телефон',telegram:'Telegram',max:'MAX'}[value] || value;
}
function renderBars(rootId, rows, labelFn){
  const root = $(rootId);
  const max = Math.max(1, ...rows.map(r=>Number(r.count)||0));
  root.innerHTML = rows.length ? rows.map(row=>{
    const label = labelFn(row.package ?? row.channel ?? row.option ?? row.event_type ?? '');
    const count = Number(row.count)||0;
    return '<div class="bar-row"><span>'+esc(label)+'</span><div class="bar-track"><div class="bar-fill" style="width:'+Math.max(3,(count/max)*100)+'%"></div></div><strong>'+count+'</strong></div>';
  }).join('') : '<div class="muted">Пока нет данных.</div>';
}
function renderDaily(rows){
  const root = $('dailyChart');
  if(!rows.length){
    root.innerHTML='<div class="muted">Пока нет данных.</div>';
    return;
  }
  const max = Math.max(1, ...rows.map(r=>Number(r.page_views)||0));
  root.innerHTML = rows.map(row=>{
    const views=Number(row.page_views)||0;
    const height=Math.max(2,(views/max)*120);
    const day=String(row.day || '').slice(5);
    return '<div class="day-col" title="'+esc(row.day)+': '+views+' просмотров"><div class="day-bar" style="height:'+height+'px"></div><span class="day-label">'+esc(day)+'</span></div>';
  }).join('');
}
function renderAnalytics(summary){
  const t=summary.totals || {};
  $('analyticsViews').textContent = Number(t.page_views || 0);
  $('analyticsSessions').textContent = Number(t.unique_sessions || 0);
  $('analyticsOffers').textContent = Number(t.offers || 0);
  $('analyticsContacts').textContent = Number(t.contact_clicks || 0);
  $('offerConversion').textContent = 'Конверсия от сессий: '+percent(t.offers, t.unique_sessions);
  $('contactConversion').textContent = 'Конверсия от сессий: '+percent(t.contact_clicks, t.unique_sessions);
  renderDaily(summary.daily || []);
  renderBars('packageBars', summary.packageClicks || [], packageLabel);
  renderBars('contactBars', summary.contacts || [], contactLabel);
  renderBars('optionBars', summary.optionChanges || [], optionLabel);
  renderBars('eventBars', summary.eventBreakdown || [], eventLabel);
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
    const days = $('analyticsDays').value || '30';
    const [data, analytics] = await Promise.all([
      api('/api/v1/feedback?'+query.toString()),
      api('/api/v1/analytics/summary?days='+encodeURIComponent(days))
    ]);
    render(data.rows || []);
    renderAnalytics(analytics);
    $('journal').classList.remove('hidden');
    $('status').textContent='Панель загружена.';
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
$('analyticsDays').addEventListener('change', load);
$('rows').addEventListener('click', event=>{
  const button = event.target.closest('button[data-id]');
  if(!button) return;
  updateState(Number(button.dataset.id), button.dataset.state);
});
$('token').addEventListener('keydown', event=>{ if(event.key==='Enter') load(); });
if(token) load();
