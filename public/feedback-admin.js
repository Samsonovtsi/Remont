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


function pct(value){
  return num.format(Number(value || 0) * 100) + '%';
}
function formatRate(value, key=''){
  const n = Number(value);
  if(!Number.isFinite(n)) return '—';
  if(key.toLowerCase().includes('factor')) return num.format(n);
  return rub.format(n);
}
function renderCalculationSource(source){
  $('sourceAgentRate').textContent = pct(source.constants?.agentRewardRate);
  $('sourceVatRate').textContent = pct(source.constants?.vatRate);
  $('sourceDeliveryRate').textContent = pct(source.constants?.deliveryRate);

  const bands = source.officialApartmentPriceBands2026 || [];
  $('officialRatesRows').innerHTML = bands.map(row => `
    <tr>
      <td><strong>${esc(row.label)}</strong></td>
      <td>${rub.format(Number(row.prices?.minimal || 0))}/м²</td>
      <td>${rub.format(Number(row.prices?.standard || 0))}/м²</td>
      <td>${rub.format(Number(row.prices?.comfort || 0))}/м²</td>
      <td>${rub.format(Number(row.prices?.premium || 0))}/м²</td>
    </tr>`
  ).join('');

  const smetaLabels = {
    roughWallPerM2:'Черновые стены, ₽/м²',
    cleanWallPerM2:'Чистовые стены, ₽/м²',
    roughFloorPerM2:'Черновой пол, ₽/м²',
    cleanFloorPerM2:'Чистовой пол, ₽/м²',
    tilePerM2:'Плиточные работы, ₽/м²',
    plumbingRough:'Черновая сантехника, ₽',
    plumbingClean:'Чистовая сантехника, ₽',
    roughMaterialsFactor:'Коэффициент черновых материалов',
    cleanMaterialsFactor:'Коэффициент чистовых материалов'
  };
  const smeta = source.smetaRates || {};
  const smetaKeys = Object.keys(smetaLabels);
  $('smetaRatesRows').innerHTML = smetaKeys.map(key => `
    <tr>
      <td><strong>${esc(smetaLabels[key])}</strong></td>
      ${['minimal','standard','comfort','premium'].map(pkg=>`<td>${formatRate(smeta[pkg]?.[key],key)}</td>`).join('')}
    </tr>`
  ).join('');

  const extraLabels = {
    electricalPerM2:'Электрика, ₽/м²',
    ceilingMaterialPerM2:'Потолок: материал, ₽/м²',
    ceilingInstallPerM2:'Потолок: монтаж, ₽/м²',
    doorMaterial:'Дверь: материал, ₽/шт.',
    doorInstall:'Дверь: монтаж, ₽/шт.',
    doorwayMaterial:'Открытый проём: материал, ₽/шт.',
    doorwayInstall:'Открытый проём: монтаж, ₽/шт.',
    lightMaterial:'Светильник: материал, ₽/шт.',
    lightInstall:'Светильник: монтаж, ₽/шт.',
    socketMaterial:'Розетка/выключатель: материал, ₽/шт.',
    socketInstall:'Розетка/выключатель: монтаж, ₽/шт.',
    warmFloorMaterialUpTo3M2:'Тёплый пол: комплект до 3 м², ₽',
    warmFloorInstallPerM2:'Тёплый пол: монтаж, ₽/м²',
    balconyTileWorkPerM2:'Балкон: плиточные работы, ₽/м²',
    demolitionPerM2:'Демонтаж, ₽/м²'
  };
  const extras = source.extraRatesByPackage || {};
  $('extraRatesRows').innerHTML = Object.keys(extraLabels).map(key => `
    <tr>
      <td><strong>${esc(extraLabels[key])}</strong></td>
      ${['minimal','standard','comfort','premium'].map(pkg=>`<td>${formatRate(extras[pkg]?.[key],key)}</td>`).join('')}
    </tr>`
  ).join('');

  const commercialLabels = {
    floorPrimerWorkPerM2:'Грунтование пола, работа',
    tileWorkPerM2:'Укладка плитки, работа',
    tileMaterialPerM2:'Плитка, материал'
  };
  const commercial = source.commercialTileRates || {};
  $('commercialRatesRows').innerHTML = Object.keys(commercialLabels).map(key => `
    <tr><td><strong>${esc(commercialLabels[key])}</strong></td><td>${rub.format(Number(commercial[key] || 0))}/м²</td></tr>
  `).join('');

  $('calculationNotes').innerHTML = (source.calculationNotes || [])
    .map(note=>'<div style="margin:4px 0">• '+esc(note)+'</div>')
    .join('');
}

function fileSize(bytes){
  const n=Number(bytes)||0;
  if(n < 1024) return n+' Б';
  if(n < 1024*1024) return num.format(n/1024)+' КБ';
  return num.format(n/(1024*1024))+' МБ';
}
function renderSmetas(rows){
  $('smetaRows').innerHTML = rows.length ? rows.map(row=>`
    <tr>
      <td>${new Date(row.created_at).toLocaleString('ru-RU')}</td>
      <td><strong>${esc(row.original_name)}</strong></td>
      <td>${fileSize(row.file_size)}</td>
      <td>${esc(row.note || '—')}</td>
      <td><span class="badge badge-new">${esc(row.status || 'uploaded')}</span></td>
      <td><div class="file-actions">
        <button type="button" data-smeta-download="${row.id}">Скачать</button>
        <button type="button" data-smeta-delete="${row.id}" class="danger">Удалить</button>
      </div></td>
    </tr>`
  ).join('') : '<tr><td colspan="6" class="muted">Загруженных смет пока нет.</td></tr>';
}
function fileToBase64(file){
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onload=()=>{
      const value=String(reader.result || '');
      resolve(value.includes(',') ? value.split(',')[1] : value);
    };
    reader.onerror=()=>reject(new Error('Не удалось прочитать файл'));
    reader.readAsDataURL(file);
  });
}
async function uploadSmeta(){
  const file=$('smetaFile').files?.[0];
  const note=$('smetaNote').value.trim();
  const status=$('smetaUploadStatus');
  if(!file){ status.textContent='Выберите файл сметы.'; status.className='upload-status error'; return; }
  if(file.size > 15*1024*1024){ status.textContent='Максимальный размер файла — 15 МБ.'; status.className='upload-status error'; return; }

  const button=$('uploadSmetaBtn');
  button.disabled=true;
  status.textContent='Загрузка...';
  status.className='upload-status';
  try{
    const base64=await fileToBase64(file);
    await api('/api/v1/admin/smetas',{
      method:'POST',
      body:JSON.stringify({
        fileName:file.name,
        mimeType:file.type || 'application/octet-stream',
        size:file.size,
        base64,
        note
      })
    });
    $('smetaFile').value='';
    $('smetaNote').value='';
    status.textContent='Смета сохранена.';
    const data=await api('/api/v1/admin/smetas');
    renderSmetas(data.rows || []);
  }catch(err){
    status.textContent=err.message;
    status.className='upload-status error';
  }finally{
    button.disabled=false;
  }
}
async function downloadSmeta(id){
  const response=await fetch('/api/v1/admin/smetas/'+id+'/download',{
    headers:{'Authorization':'Bearer '+token}
  });
  if(!response.ok){
    const data=await response.json().catch(()=>({}));
    throw new Error(data.message || data.error || 'Не удалось скачать файл');
  }
  const blob=await response.blob();
  const disposition=response.headers.get('Content-Disposition') || '';
  const match=disposition.match(/filename\*=UTF-8''([^;]+)/i);
  const fileName=match ? decodeURIComponent(match[1]) : 'smeta-'+id;
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;
  a.download=fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
async function deleteSmeta(id){
  if(!confirm('Удалить эту смету из хранилища?')) return;
  await api('/api/v1/admin/smetas/'+id,{method:'DELETE'});
  const data=await api('/api/v1/admin/smetas');
  renderSmetas(data.rows || []);
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
    const [data, analytics, source, smetas] = await Promise.all([
      api('/api/v1/feedback?'+query.toString()),
      api('/api/v1/analytics/summary?days='+encodeURIComponent(days)),
      api('/api/v1/admin/calculation-source'),
      api('/api/v1/admin/smetas')
    ]);
    render(data.rows || []);
    renderAnalytics(analytics);
    renderCalculationSource(source);
    renderSmetas(smetas.rows || []);
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

$('uploadSmetaBtn').addEventListener('click', uploadSmeta);
$('smetaRows').addEventListener('click', async event=>{
  const downloadButton=event.target.closest('button[data-smeta-download]');
  const deleteButton=event.target.closest('button[data-smeta-delete]');
  try{
    if(downloadButton) await downloadSmeta(Number(downloadButton.dataset.smetaDownload));
    if(deleteButton) await deleteSmeta(Number(deleteButton.dataset.smetaDelete));
  }catch(err){
    $('smetaUploadStatus').textContent=err.message;
    $('smetaUploadStatus').className='upload-status error';
  }
});
