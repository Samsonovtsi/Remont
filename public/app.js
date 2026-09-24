const rub = new Intl.NumberFormat('ru-RU', {
  style: 'currency',
  currency: 'RUB',
  maximumFractionDigits: 0
});

let selectedPackage = 'comfort';
let packageData = {};
let latestEstimate = null;
const $ = (id) => document.getElementById(id);

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function packagePreviewImage(code) {
  const images = {
    minimal: '/images/packages/minimal.png?v=20260924-5',
    standard: '/images/packages/standard.png?v=20260924-5',
    comfort: '/images/packages/comfort.png?v=20260924-5',
    premium: '/images/packages/premium.png?v=20260924-5'
  };
  return images[code] || '';
}

function packageFullImage(code) {
  return packagePreviewImage(code);
}

function updatePackagePreview() {
  const pkg = packageData[selectedPackage];
  const image = $('selectedPackageImage');
  if (!image) return;

  const src = packagePreviewImage(selectedPackage);
  image.loading = 'eager';
  image.decoding = 'async';
  image.onerror = () => {
    image.style.display = 'none';
    console.error('Не удалось загрузить изображение пакета:', src);
  };
  image.onload = () => {
    image.style.display = 'block';
  };
  image.src = src;
  image.style.display = src ? 'block' : 'none';
  image.alt = pkg ? `Пример ремонта — пакет ${pkg.title}` : 'Пример ремонта';
  $('selectedPackageImageCaption').textContent = pkg ? `Пакет «${pkg.title}»` : '—';
}

async function loadPackages() {
  const response = await fetch('/api/v1/packages');
  if (!response.ok) throw new Error('Не удалось загрузить тарифы');
  const data = await response.json();
  packageData = data.packages;
  renderPackages();
}

function renderPackages() {
  const root = $('packages');
  root.innerHTML = '';

  Object.entries(packageData).forEach(([code, pkg]) => {
    const el = document.createElement('article');
    el.className = 'package package-' + code + (code === selectedPackage ? ' active' : '');

    const priceText = `от ${rub.format(pkg.minPerM2)} / м²`;

    const included = (pkg.included || []).map(item =>
      `<li><span class="pkg-icon">✓</span><span>${item}</span></li>`
    ).join('');

    const roomFinish = (pkg.roomFinish || []).map(item => `<li>${item}</li>`).join('');
    const bathroomFinish = (pkg.bathroomFinish || []).map(item => `<li>${item}</li>`).join('');
    const gifts = (pkg.gifts || []).map(item =>
      `<li><span class="gift-icon">✦</span><span>${item}</span></li>`
    ).join('');
    const notes = (pkg.notes || []).map(item => `<li>${item}</li>`).join('');
    const selectedImage = code === selectedPackage ? packagePreviewImage(code) : '';

    el.innerHTML = `
      <div class="package-visual">
        ${selectedImage ? `<img class="package-card-image" src="${selectedImage}" loading="eager" decoding="async" fetchpriority="high" onerror="this.style.display='none'" alt="Пример ремонта — пакет ${escapeHtml(pkg.title)}">` : ''}
        <div class="package-badge">Пакет ремонта</div>
        <div class="package-top">
          <div>
            <h3>${pkg.title}</h3>
            <p class="package-description">${pkg.description}</p>
          </div>
          <div class="radio-dot" aria-hidden="true"></div>
        </div>

        <div class="package-price">${priceText}</div>

        <div class="package-panel package-summary">
          <h4>В стоимость включено</h4>
          <ul class="package-list package-list-inline">${included}</ul>
        </div>

        <details class="package-details">
          <summary>Состав пакета</summary>
          <div class="package-content-grid">
            <div class="package-panel">
              <h4>Комнаты и общие зоны</h4>
              <ul class="detail-list">${roomFinish}</ul>
            </div>
            <div class="package-panel">
              <h4>Санузел</h4>
              <ul class="detail-list">${bathroomFinish}</ul>
            </div>
          </div>

          <div class="package-content-grid package-service-grid">
            <div class="package-panel gift-panel">
              <h4>В подарок</h4>
              <ul class="package-list">${gifts}</ul>
            </div>
            <div class="package-panel note-panel">
              <h4>Примечание</h4>
              <ul class="detail-list">${notes}</ul>
            </div>
          </div>
        </details>
      </div>
    `;

    el.addEventListener('click', (event) => {
      if (event.target.closest('details')) return;
      selectedPackage = code;
      renderPackages();
      $('calculator').requestSubmit();
    });

    root.appendChild(el);
  });

  updatePackagePreview();
}

$('calculationMode').addEventListener('change', () => {
  $('exactFields').classList.toggle('hidden', $('calculationMode').value !== 'exact');
});

function num(id) {
  return Number($(id).value || 0);
}

function payload() {
  const exact = $('calculationMode').value === 'exact';
  return {
    areaM2: num('areaM2'),
    package: selectedPackage,
    propertyType: $('propertyType').value,
    condition: $('condition').value,
    calculationMode: $('calculationMode').value,
    bathrooms: num('bathrooms'),
    rooms: num('rooms'),
    doors: num('doors'),
    doorways: num('doorways'),
    needsFullElectrical: $('needsFullElectrical').checked,
    needsFullPlumbing: $('needsFullPlumbing').checked,
    needsDemolition: $('needsDemolition').checked,
    needsCeiling: $('needsCeiling').checked,
    hasBalcony: $('hasBalcony').checked,
    warmFloorM2: num('warmFloorM2'),
    ...(exact ? {
      roughWallAreaM2: num('roughWallAreaM2'),
      cleanWallAreaM2: num('cleanWallAreaM2'),
      roughFloorAreaM2: num('roughFloorAreaM2'),
      dryFloorAreaM2: num('dryFloorAreaM2'),
      wetTileAreaM2: num('wetTileAreaM2'),
      balconyTileAreaM2: num('balconyTileAreaM2'),
      ceilingAreaM2: num('ceilingAreaM2'),
      ceilingWorkAreaM2: num('ceilingWorkAreaM2'),
      electricalAreaM2: num('electricalAreaM2'),
      demolitionAreaM2: num('demolitionAreaM2'),
      lights: num('lights'),
      sockets: num('sockets')
    } : {})
  };
}

function renderResult(result) {
  latestEstimate = result;
  $('estimateTotal').textContent = rub.format(result.clientTotal);
  $('rewardTotal').textContent = result.agentRewardBase > 0 ? rub.format(result.agentReward) : '—';
  $('worksTotal').textContent = result.worksTotal > 0 ? rub.format(result.worksTotal) : '—';
  $('rewardBase').textContent = result.agentRewardBase > 0 ? rub.format(result.agentRewardBase) : '—';
  $('pricePerM2').textContent = rub.format(result.pricePerM2Final);
  $('packageName').textContent = packageData[result.package]?.title || result.package;

  $('lines').innerHTML = result.lines.map(line => `
    <div class="line-item"><span>${line.title}</span><span>${rub.format(line.amount)}</span></div>
  `).join('');

  document.querySelector('.note').textContent = result.disclaimer;
}


function listHtml(items) {
  return (items || []).map(item => `<li>${escapeHtml(item)}</li>`).join('');
}

function generateClientOffer() {
  if (!latestEstimate) {
    alert('Сначала рассчитайте смету.');
    return;
  }

  const pkg = packageData[selectedPackage];
  if (!pkg) {
    alert('Не удалось определить выбранный пакет.');
    return;
  }

  const offerComment = escapeHtml($('offerComment').value.trim());
  const imageSrc = packageFullImage(selectedPackage);

  const estimateRows = (latestEstimate.lines || []).map(line => `
    <tr>
      <td>${escapeHtml(line.title)}</td>
      <td>${rub.format(line.amount)}</td>
    </tr>
  `).join('');

  const popup = window.open('', '_blank');
  if (!popup) {
    alert('Браузер заблокировал новое окно. Разрешите всплывающие окна для сайта и повторите.');
    return;
  }

  popup.document.open();
  popup.document.write(`<!doctype html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Предложение по ремонту — ${escapeHtml(pkg.title)}</title>
<style>
  *{box-sizing:border-box}
  body{margin:0;font-family:Arial,sans-serif;color:#181818;background:#f3f0ec}
  .sheet{max-width:980px;margin:24px auto;background:white;padding:38px;border-radius:24px}
  .top{display:flex;justify-content:space-between;gap:20px;align-items:flex-start}
  .brand{font-size:22px;font-weight:800;color:#d83228}
  h1{font-size:42px;line-height:1;margin:10px 0}
  .desc{color:#6f6964;line-height:1.45;max-width:650px}
  .hero{display:block;width:100%;height:auto;max-height:none;object-fit:contain;border-radius:20px;margin:24px 0}
  .price{background:#fff0ed;border-radius:18px;padding:20px;margin:18px 0}
  .price small{display:block;color:#706963;margin-bottom:6px}
  .price strong{font-size:36px}
  .meta{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:18px 0}
  .meta>div{padding:12px;background:#faf8f5;border-radius:12px}
  .meta span{display:block;font-size:11px;color:#777}
  .meta strong{display:block;margin-top:4px}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:18px}
  .box{border:1px solid #e7e0da;border-radius:16px;padding:18px}
  .box h2{font-size:17px;margin:0 0 10px}
  ul{padding-left:20px;margin:0;line-height:1.5;font-size:13px}
  table{width:100%;border-collapse:collapse;margin-top:10px}
  td{padding:9px 0;border-bottom:1px solid #eee;font-size:13px}
  td:last-child{text-align:right;font-weight:700;white-space:nowrap}
  .comment{margin-top:18px;padding:15px;background:#faf8f5;border-radius:14px;white-space:pre-wrap}
  .disclaimer{margin-top:18px;font-size:11px;line-height:1.45;color:#777}
  .actions{max-width:980px;margin:16px auto;display:flex;gap:10px}
  button{border:0;border-radius:12px;padding:13px 18px;font-weight:700;cursor:pointer}
  .print{background:#d83228;color:white}
  @media(max-width:700px){.sheet{margin:0;padding:20px;border-radius:0}.grid,.meta{grid-template-columns:1fr}.top{display:block}h1{font-size:34px}}
  @media print{body{background:white}.sheet{max-width:none;margin:0;padding:0;border-radius:0}.actions{display:none}.hero{width:100%;height:auto;max-height:170mm;object-fit:contain;page-break-inside:avoid}}
</style>
</head>
<body>
<div class="actions">
  <button class="print" onclick="window.print()">Печать / сохранить PDF</button>
  <button onclick="window.close()">Закрыть</button>
</div>
<main class="sheet">
  <div class="top">
    <div>
      <div class="brand">Этажи.Ремонт</div>
      <h1>Пакет «${escapeHtml(pkg.title)}»</h1>
      <div class="desc">${escapeHtml(pkg.description)}</div>
    </div>
  </div>

  ${imageSrc ? `<img class="hero" src="${imageSrc}" decoding="sync" alt="Пример ремонта — пакет ${escapeHtml(pkg.title)}">` : ''}

  <div class="price">
    <small>Предварительная стоимость ремонта</small>
    <strong>${rub.format(latestEstimate.clientTotal)}</strong>
  </div>

  <div class="meta">
    <div><span>Площадь</span><strong>${latestEstimate.areaM2} м²</strong></div>
    <div><span>Цена за м²</span><strong>${rub.format(latestEstimate.pricePerM2Final)}</strong></div>
    <div><span>Пакет</span><strong>${escapeHtml(pkg.title)}</strong></div>
  </div>

  <div class="grid">
    <section class="box"><h2>В стоимость включено</h2><ul>${listHtml(pkg.included)}</ul></section>
    <section class="box"><h2>В подарок</h2><ul>${listHtml(pkg.gifts)}</ul></section>
    <section class="box"><h2>Комнаты и общие зоны</h2><ul>${listHtml(pkg.roomFinish)}</ul></section>
    <section class="box"><h2>Санузел</h2><ul>${listHtml(pkg.bathroomFinish)}</ul></section>
  </div>

  <section class="box" style="margin-top:14px"><h2>Примечания по пакету</h2><ul>${listHtml(pkg.notes)}</ul></section>

  <section class="box" style="margin-top:14px">
    <h2>Состав расчёта</h2>
    <table>${estimateRows}</table>
  </section>

  ${offerComment ? `<div class="comment"><strong>Комментарий:</strong><br>${offerComment}</div>` : ''}

  <div class="disclaimer">${escapeHtml(latestEstimate.disclaimer || 'Предварительный расчёт. Финальная стоимость уточняется после замера.')}</div>
</main>
</body>
</html>`);
  popup.document.close();
}

$('calculator').addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = $('submitButton');
  const error = $('formError');
  error.classList.add('hidden');
  button.disabled = true;
  button.textContent = 'Считаем...';

  try {
    const response = await fetch('/api/v1/estimate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload())
    });
    const data = await response.json();
    if (!response.ok) throw new Error('Проверьте введённые параметры');
    renderResult(data);
  } catch (err) {
    error.textContent = err.message || 'Ошибка расчёта';
    error.classList.remove('hidden');
  } finally {
    button.disabled = false;
    button.textContent = 'Рассчитать смету';
  }
});

$('generateOfferButton').addEventListener('click', generateClientOffer);

(async () => {
  try {
    await loadPackages();
    $('calculator').requestSubmit();
  } catch {
    $('formError').textContent = 'Не удалось загрузить калькулятор. Проверьте backend.';
    $('formError').classList.remove('hidden');
  }
})();
