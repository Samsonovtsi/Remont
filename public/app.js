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
    const el = document.createElement('div');
    el.className = 'package' + (code === selectedPackage ? ' active' : '');
    const mode = pkg.calculationMode === 'smeta' ? 'детальная сметная модель' : 'пакетный диапазон';
    el.innerHTML = `
      <div class="package-top"><h3>${pkg.title}</h3><div class="radio-dot"></div></div>
      <p>${pkg.description}</p>
      <div class="package-price">${rub.format(pkg.minPerM2)} — ${rub.format(pkg.maxPerM2)} / м²</div>
      <p><strong>${mode}</strong></p>
    `;
    el.addEventListener('click', () => {
      selectedPackage = code;
      renderPackages();
    });
    root.appendChild(el);
  });

  const selected = packageData[selectedPackage];
  $('finishLevel').closest('.range-wrap').style.display =
    selected?.calculationMode === 'range' ? 'block' : 'none';
}

function finishText(value) {
  if (value < 0.34) return 'Базовый';
  if (value < 0.67) return 'Средний';
  return 'Расширенный';
}

$('finishLevel').addEventListener('input', (event) => {
  $('finishLabel').textContent = finishText(Number(event.target.value));
});

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
    finishLevel: num('finishLevel'),
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
