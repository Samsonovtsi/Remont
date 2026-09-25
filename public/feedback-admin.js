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
function editableRateCell(group, packageCode, key, value){
  const step=key.toLowerCase().includes('factor') ? '0.001' : '0.01';
  return '<div class="editable-value">'+
    '<input type="number" min="0" step="'+step+'" value="'+esc(Number(value || 0))+'" data-calc-input data-group="'+esc(group)+'" data-package="'+esc(packageCode || '')+'" data-key="'+esc(key)+'" />'+
    '<button type="button" data-save-calc>Сохранить</button>'+
  '</div>';
}

function renderCalculationSource(source){
  $('sourceAgentRateInput').value = String(Number(source.constants?.agentRewardRate || 0) * 100);
  $('sourceVatRateInput').value = String(Number(source.constants?.vatRate || 0) * 100);
  $('sourceDeliveryRateInput').value = String(Number(source.constants?.deliveryRate || 0) * 100);

  const conditionLabels={
    new_build:'Новостройка',
    secondary_good:'Вторичка, хорошее состояние',
    secondary_worn:'Вторичка, нужен ремонт',
    shell:'Черновая отделка'
  };
  const conditionFactors=source.conditionFactors || {};
  $('conditionFactorRows').innerHTML=['new_build','secondary_good','secondary_worn','shell'].map(code=>{
    const factor=Number(conditionFactors[code] ?? 1);
    const extra=Math.round((factor-1)*1000)/10;
    return `
      <tr>
        <td><strong>${esc(conditionLabels[code])}</strong></td>
        <td>${editableRateCell('condition','',code,factor)}</td>
        <td>${extra > 0 ? '+'+num.format(extra)+'%' : extra < 0 ? num.format(extra)+'%' : '0%'}</td>
      </tr>
    `;
  }).join('');

  const packages=source.packagePrices || {};
  $('packageMinRows').innerHTML=['minimal','standard','comfort','premium'].map(code=>`
    <tr>
      <td><strong>${esc(packageLabel(code))}</strong></td>
      <td>${editableRateCell('package',code,'minPerM2',packages[code]?.minPerM2)}</td>
      <td><span class="muted">Используется как нижний порог для квартир</span></td>
    </tr>
  `).join('');

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
  $('smetaRatesRows').innerHTML = Object.keys(smetaLabels).map(key => `
    <tr>
      <td><strong>${esc(smetaLabels[key])}</strong></td>
      ${['minimal','standard','comfort','premium'].map(pkg=>'<td>'+editableRateCell('smeta',pkg,key,smeta[pkg]?.[key])+'</td>').join('')}
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
      ${['minimal','standard','comfort','premium'].map(pkg=>'<td>'+editableRateCell('extra',pkg,key,extras[pkg]?.[key])+'</td>').join('')}
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

async function saveCalculationValue(input){
  const value=Number(input.value);
  if(!Number.isFinite(value) || value < 0) throw new Error('Введите корректное значение.');

  await api('/api/v1/admin/calculation-value',{
    method:'PUT',
    body:JSON.stringify({
      group:input.dataset.group,
      packageCode:input.dataset.package || undefined,
      key:input.dataset.key,
      value
    })
  });
  await refreshCalculationSource();
}

async function saveConstant(key){
  const id={
    agentRewardRate:'sourceAgentRateInput',
    vatRate:'sourceVatRateInput',
    deliveryRate:'sourceDeliveryRateInput'
  }[key];
  const input=$(id);
  const percentValue=Number(input.value);
  if(!Number.isFinite(percentValue) || percentValue < 0) throw new Error('Введите корректный процент.');

  await api('/api/v1/admin/calculation-value',{
    method:'PUT',
    body:JSON.stringify({
      group:'constant',
      key,
      value:percentValue/100
    })
  });
  await refreshCalculationSource();
}

const RATE_TARGETS = {
  smeta: {
    roughWallPerM2:'Черновые стены, ₽/м²',
    cleanWallPerM2:'Чистовые стены, ₽/м²',
    roughFloorPerM2:'Черновой пол, ₽/м²',
    cleanFloorPerM2:'Чистовой пол, ₽/м²',
    tilePerM2:'Плиточные работы, ₽/м²',
    plumbingRough:'Черновая сантехника, ₽',
    plumbingClean:'Чистовая сантехника, ₽'
  },
  extra: {
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
    warmFloorMaterialUpTo3M2:'Тёплый пол: комплект, ₽',
    warmFloorInstallPerM2:'Тёплый пол: монтаж, ₽/м²',
    balconyTileWorkPerM2:'Балкон: плиточные работы, ₽/м²',
    demolitionPerM2:'Демонтаж, ₽/м²'
  }
};

function targetOptions(selectedGroup, selectedKey){
  const rows=[];
  for(const [group,items] of Object.entries(RATE_TARGETS)){
    for(const [key,label] of Object.entries(items)){
      const value=group+':'+key;
      const selected=group===selectedGroup && key===selectedKey ? ' selected' : '';
      rows.push('<option value="'+esc(value)+'"'+selected+'>'+esc(label)+'</option>');
    }
  }
  return rows.join('');
}

function packageOptions(selected){
  return ['minimal','standard','comfort','premium'].map(code=>
    '<option value="'+code+'"'+(code===selected?' selected':'')+'>'+esc(packageLabel(code))+'</option>'
  ).join('');
}

function renderRateCandidates(rows){
  const root=$('rateCandidateRows');
  if(!root) return;

  root.innerHTML = rows.length ? rows.map(row=>{
    const status=row.review_status || 'pending';
    const confidence=Math.round(Number(row.confidence || 0)*100);
    const group=row.approved_group || row.suggested_group || 'smeta';
    const key=row.approved_key || row.suggested_key || 'roughWallPerM2';
    const pkg=row.approved_package_code || row.package_code || 'comfort';
    const value=Number(row.approved_value ?? row.unit_price ?? 0);
    const disabled=status!=='pending' ? ' disabled' : '';
    const statusLabelText=status==='approved'?'Применена':status==='rejected'?'Отклонена':'На проверке';

    return '<tr data-candidate-row="'+row.id+'">'+
      '<td><strong>'+esc(row.original_name || '')+'</strong><br><span class="muted">'+esc(row.source_ref || '')+'</span></td>'+
      '<td>'+esc(row.description || '')+'</td>'+
      '<td>'+esc(row.unit || '—')+'</td>'+
      '<td><strong>'+rub.format(Number(row.unit_price || 0))+'</strong></td>'+
      '<td><span class="confidence">'+confidence+'%</span></td>'+
      '<td><select data-candidate-package'+disabled+'>'+packageOptions(pkg)+'</select></td>'+
      '<td><select class="wide-select" data-candidate-target'+disabled+'>'+targetOptions(group,key)+'</select></td>'+
      '<td><input data-candidate-value type="number" min="0" step="0.01" value="'+esc(value)+'"'+disabled+' /></td>'+
      '<td><span class="badge '+(status==='approved'?'badge-fixed':status==='rejected'?'badge-progress':'badge-new')+'">'+statusLabelText+'</span></td>'+
      '<td><div class="actions">'+
        (status==='pending'
          ? '<button type="button" data-candidate-approve="'+row.id+'">Подтвердить</button><button type="button" data-candidate-reject="'+row.id+'" class="secondary">Отклонить</button>'
          : '—')+
      '</div></td>'+
    '</tr>';
  }).join('') : '<tr><td colspan="10" class="muted">Новых ставок для проверки пока нет.</td></tr>';
}

async function loadRateCandidates(){
  const data=await api('/api/v1/admin/rate-candidates');
  renderRateCandidates(data.rows || []);
}

async function approveCandidate(id){
  const row=document.querySelector('[data-candidate-row="'+id+'"]');
  if(!row) return;
  const target=String(row.querySelector('[data-candidate-target]').value || '').split(':');
  const packageCode=row.querySelector('[data-candidate-package]').value;
  const value=Number(row.querySelector('[data-candidate-value]').value);
  if(target.length!==2 || !Number.isFinite(value) || value<=0){
    throw new Error('Проверьте параметр и значение ставки.');
  }
  await api('/api/v1/admin/rate-candidates/'+id+'/approve',{
    method:'POST',
    body:JSON.stringify({group:target[0],key:target[1],packageCode,value})
  });
  await Promise.all([loadRateCandidates(), refreshCalculationSource()]);
}

async function rejectCandidate(id){
  await api('/api/v1/admin/rate-candidates/'+id+'/reject',{method:'POST',body:'{}'});
  await loadRateCandidates();
}

async function refreshCalculationSource(){
  const source=await api('/api/v1/admin/calculation-source');
  renderCalculationSource(source);
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
        <button type="button" data-smeta-analyze="${row.id}" class="secondary">Разобрать заново</button>
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
    const uploaded=await api('/api/v1/admin/smetas',{
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
    status.textContent=uploaded.analysis?.error
      ? 'Смета сохранена, но разбор завершился с ошибкой: '+uploaded.analysis.error
      : 'Смета сохранена. Найдено ставок: '+Number(uploaded.analysis?.count || 0)+'.';
    const data=await api('/api/v1/admin/smetas');
    renderSmetas(data.rows || []);
    await loadRateCandidates();
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
    const [data, analytics, source, smetas, candidates] = await Promise.all([
      api('/api/v1/feedback?'+query.toString()),
      api('/api/v1/analytics/summary?days='+encodeURIComponent(days)),
      api('/api/v1/admin/calculation-source'),
      api('/api/v1/admin/smetas'),
      api('/api/v1/admin/rate-candidates')
    ]);
    render(data.rows || []);
    renderAnalytics(analytics);
    renderCalculationSource(source);
    renderSmetas(smetas.rows || []);
    renderRateCandidates(candidates.rows || []);
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
  const analyzeButton=event.target.closest('button[data-smeta-analyze]');
  const downloadButton=event.target.closest('button[data-smeta-download]');
  const deleteButton=event.target.closest('button[data-smeta-delete]');
  try{
    if(analyzeButton){
      const result=await api('/api/v1/admin/smetas/'+Number(analyzeButton.dataset.smetaAnalyze)+'/analyze',{method:'POST',body:'{}'});
      $('smetaUploadStatus').textContent='Разбор завершён. Найдено ставок: '+Number(result.count || 0)+'.';
      await loadRateCandidates();
    }
    if(downloadButton) await downloadSmeta(Number(downloadButton.dataset.smetaDownload));
    if(deleteButton) await deleteSmeta(Number(deleteButton.dataset.smetaDelete));
  }catch(err){
    $('smetaUploadStatus').textContent=err.message;
    $('smetaUploadStatus').className='upload-status error';
  }
});

$('refreshCandidatesBtn')?.addEventListener('click', async ()=>{
  try{ await loadRateCandidates(); }catch(err){ $('status').textContent=err.message; $('status').className='status error'; }
});
$('rateCandidateRows')?.addEventListener('click', async event=>{
  const approve=event.target.closest('button[data-candidate-approve]');
  const reject=event.target.closest('button[data-candidate-reject]');
  try{
    if(approve) await approveCandidate(Number(approve.dataset.candidateApprove));
    if(reject) await rejectCandidate(Number(reject.dataset.candidateReject));
  }catch(err){
    $('status').textContent=err.message;
    $('status').className='status error';
  }
});

document.querySelectorAll('.admin-tab').forEach(button=>{
  button.addEventListener('click',()=>{
    const target=button.dataset.adminTab;
    document.querySelectorAll('.admin-tab').forEach(item=>item.classList.toggle('active',item===button));
    document.querySelectorAll('.admin-tab-panel').forEach(panel=>panel.classList.toggle('active',panel.dataset.adminTabPanel===target));
  });
});

document.addEventListener('click',async event=>{
  const saveButton=event.target.closest('button[data-save-calc]');
  const constantButton=event.target.closest('button[data-save-constant]');
  try{
    if(saveButton){
      const input=saveButton.closest('.editable-value')?.querySelector('[data-calc-input]');
      if(input) await saveCalculationValue(input);
    }
    if(constantButton){
      await saveConstant(constantButton.dataset.saveConstant);
    }
  }catch(err){
    $('status').textContent=err.message;
    $('status').className='status error';
  }
});
