const rub = new Intl.NumberFormat('ru-RU', {
  style: 'currency',
  currency: 'RUB',
  maximumFractionDigits: 0
});

let selectedPackage = 'comfort';
let packageData = {};
const $ = (id) => document.getElementById(id);

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

    el.innerHTML = `
      <div class="package-visual">
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
    });

    root.appendChild(el);
  });
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
      demolitionAreaM2: num('demolitionAreaM2'),
      lights: num('lights'),
      sockets: num('sockets')
    } : {})
  };
}

function renderResult(result) {
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

(async () => {
  try {
    await loadPackages();
    $('calculator').requestSubmit();
  } catch {
    $('formError').textContent = 'Не удалось загрузить калькулятор. Проверьте backend.';
    $('formError').classList.remove('hidden');
  }
})();
