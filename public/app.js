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
    el.dataset.code = code;
    const mode = pkg.calculationMode === 'smeta' ? 'по реальным сметам' : 'по диапазону';
    el.innerHTML = `
      <div class="package-top">
        <h3>${pkg.title}</h3>
        <div class="radio-dot"></div>
      </div>
      <p>${pkg.description}</p>
      <div class="package-price">${rub.format(pkg.minPerM2)} — ${rub.format(pkg.maxPerM2)} / м²</div>
      <p><strong>${mode}</strong></p>
    `;
    el.addEventListener('click', () => {
      selectedPackage = code;
      renderPackages();
      const range = $('finishLevel').closest('.range-wrap');
      range.style.display = pkg.calculationMode === 'range' ? 'block' : 'none';
    });
    root.appendChild(el);
  });

  const selected = packageData[selectedPackage];
  if (selected) {
    $('finishLevel').closest('.range-wrap').style.display =
      selected.calculationMode === 'range' ? 'block' : 'none';
  }
}

function finishText(value) {
  if (value < 0.34) return 'Базовый';
  if (value < 0.67) return 'Средний';
  return 'Расширенный';
}

$('finishLevel').addEventListener('input', (event) => {
  $('finishLabel').textContent = finishText(Number(event.target.value));
});

function payload() {
  return {
    areaM2: Number($('areaM2').value),
    package: selectedPackage,
    propertyType: $('propertyType').value,
    condition: $('condition').value,
    bathrooms: Number($('bathrooms').value),
    rooms: Number($('rooms').value),
    doors: Number($('doors').value),
    needsFullElectrical: $('needsFullElectrical').checked,
    needsFullPlumbing: $('needsFullPlumbing').checked,
    needsDemolition: $('needsDemolition').checked,
    needsCeiling: $('needsCeiling').checked,
    hasBalcony: $('hasBalcony').checked,
    warmFloorM2: Number($('warmFloorM2').value || 0),
    finishLevel: Number($('finishLevel').value)
  };
}

function renderResult(result) {
  $('estimateTotal').textContent = rub.format(result.clientTotal);
  $('rewardTotal').textContent = rub.format(result.agentReward);
  $('pricePerM2').textContent = rub.format(result.pricePerM2Final);
  $('packageName').textContent = packageData[result.package]?.title || result.package;

  $('lines').innerHTML = result.lines.map(line => `
    <div class="line-item">
      <span>${line.title}</span>
      <span>${rub.format(line.amount)}</span>
    </div>
  `).join('');

  const note = document.querySelector('.note');
  const assumptions = result.assumptions || {};
  const details = result.calculationMode === 'smeta'
    ? ` Автооценка: стены ${assumptions.roughWallAreaM2 || 0} м², плитка ${assumptions.wetTileAreaM2 || 0} м², светильники ${assumptions.lights || 0}, розетки/выключатели ${assumptions.sockets || 0}.`
    : '';
  note.textContent = result.disclaimer + details;
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

    if (!response.ok) {
      throw new Error('Проверьте введённые параметры');
    }

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
  } catch (err) {
    $('formError').textContent = 'Не удалось загрузить калькулятор. Проверьте backend.';
    $('formError').classList.remove('hidden');
  }
})();
