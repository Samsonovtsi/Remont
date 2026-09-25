const rub = new Intl.NumberFormat('ru-RU', {
  style: 'currency',
  currency: 'RUB',
  maximumFractionDigits: 0
});

let selectedPackage = 'comfort';
let selectedDesignProject = 'none';
let packageData = {};

const DESIGN_PROJECTS = {
  technical: {
    title: 'Технический проект',
    pricePerM2: 1800,
    image: '/images/design/technical.webp?v=20260925-2',
    description: 'Комплект технических чертежей и схем для выполнения ремонта без визуализации.',
    highlights: ['12 базовых планов и схем', 'Замеры и фото/видеофиксация', 'Без визуализации'],
    includes: [
      'Составление технического задания',
      'Выезд на объект, замеры, фото- и видеофиксация',
      'План расстановки мебели',
      'План демонтажа и монтажа',
      'План расстановки сантехники',
      'План потолка',
      'План светильников',
      'План выключателей',
      'План розеток',
      'План тёплого пола',
      'План напольных покрытий',
      'План настенных покрытий'
    ]
  },
  express: {
    title: 'Экспресс-проект с коллажами',
    pricePerM2: 2300,
    image: '/images/design/express.webp?v=20260925-2',
    description: 'Техническая база плюс коллажи для согласования стиля, цветов и материалов.',
    highlights: ['Всё из технического проекта', 'Коллажи помещений', 'Спецификация отделочных материалов'],
    includes: ['Всё из технического проекта', 'Коллажи по помещениям', 'Спецификация отделочных материалов']
  },
  full: {
    title: 'Полный проект',
    pricePerM2: 3000,
    image: '/images/design/full.webp?v=20260925-2',
    description: 'Полный рабочий проект с развёртками стен и визуализацией помещений.',
    highlights: ['Всё из экспресс-проекта', 'Развёртки стен', 'Визуализация помещений'],
    includes: ['Всё из экспресс-проекта', 'Развёртки стен помещений', 'Визуализация помещений']
  },
  extended: {
    title: 'Расширенный проект',
    pricePerM2: 3500,
    image: '/images/design/extended.webp?v=20260925-2',
    description: 'Максимальная детализация проекта, мебельные решения и обзор интерьера 360°.',
    highlights: ['Всё из полного проекта', 'Эскизы корпусной мебели', 'Визуализация + обзор 360°'],
    includes: ['Всё из полного проекта', 'Эскизные чертежи корпусной мебели', 'Визуализация помещений с обзором 360°']
  }
};
let latestEstimate = null;
let autoCalcTimer = null;
let estimateAbortController = null;
let feedbackSending = false;
const $ = (id) => document.getElementById(id);

const analyticsSessionId = (() => {
  const key = 'remontAnalyticsSession';
  const existing = sessionStorage.getItem(key);
  if (existing) return existing;
  const created = (globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2) + Date.now().toString(36));
  sessionStorage.setItem(key, created);
  return created;
})();

function trackEvent(eventType, eventName = '', meta = {}) {
  const body = JSON.stringify({
    eventType,
    eventName,
    sessionId: analyticsSessionId,
    path: location.pathname,
    referrer: document.referrer || '',
    meta
  });

  fetch('/api/v1/analytics', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true
  }).catch(() => {});
}

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
    minimal: '/images/packages/minimal-preview.jpg?v=20260925-1',
    standard: '/images/packages/standard-preview.jpg?v=20260925-1',
    comfort: '/images/packages/comfort-preview.jpg?v=20260925-1',
    premium: '/images/packages/premium-preview.jpg?v=20260925-1'
  };
  return images[code] || '';
}

function packageFullImage(code) {
  const images = {
    minimal: '/images/packages/minimal.png?v=20260924-5',
    standard: '/images/packages/standard.png?v=20260924-5',
    comfort: '/images/packages/comfort.png?v=20260924-5',
    premium: '/images/packages/premium.png?v=20260924-5'
  };
  return images[code] || '';
}

function updatePackagePreview() {
  const pkg = packageData[selectedPackage];
  const image = $('selectedPackageImage');
  if (!image) return;

  const src = packagePreviewImage(selectedPackage);
  image.loading = 'eager';
  image.decoding = 'async';
  image.onerror = () => {
    const fallback = packageFullImage(selectedPackage);
    if (image.src.includes('-preview.jpg')) {
      image.onerror = () => {
        image.style.display = 'none';
        console.error('Не удалось загрузить изображение пакета:', fallback);
      };
      image.src = fallback;
      return;
    }
    image.style.display = 'none';
    console.error('Не удалось загрузить изображение пакета:', src);
  };
  image.onload = () => {
    image.style.display = 'block';
  };
  image.src = src;
  image.style.display = src ? 'block' : 'none';
  image.alt = pkg ? `Пример ремонта — пакет ${pkg.title}` : 'Пример ремонта';
  const caption = $('selectedPackageImageCaption');
  if (caption) caption.textContent = pkg ? `Пакет «${pkg.title}»` : '—';
}

async function loadPackages() {
  const response = await fetch('/api/v1/packages');
  if (!response.ok) throw new Error('Не удалось загрузить тарифы');
  const data = await response.json();
  packageData = data.packages;
  renderPackages();
}

const packageOrder = ['minimal', 'standard', 'comfort', 'premium'];

function packageDelta(code, field) {
  const current = packageData[code]?.[field] || [];
  const index = packageOrder.indexOf(code);
  if (index <= 0) return current;

  const previousCode = packageOrder[index - 1];
  const previous = new Set(packageData[previousCode]?.[field] || []);
  return current.filter(item => !previous.has(item));
}

function previousPackageTitle(code) {
  const index = packageOrder.indexOf(code);
  if (index <= 0) return '';
  return packageData[packageOrder[index - 1]]?.title || '';
}

function isApartmentProperty() {
  return ['apartment', 'apartment_new_build', 'apartment_secondary'].includes($('propertyType')?.value);
}

function getSelectedDesignProject() {
  return selectedDesignProject === 'none' ? null : DESIGN_PROJECTS[selectedDesignProject] || null;
}

function getDesignProjectTotal() {
  const project = getSelectedDesignProject();
  const area = Math.max(num('areaM2'), 0);
  return project && area > 0 ? Math.round(project.pricePerM2 * area) : 0;
}

function getAgentRewardWithDesign(result = latestEstimate) {
  if (!result) return { base: 0, reward: 0, rate: 0.05 };

  const worksBase = Number(result.agentRewardBase || result.worksTotal || 0);
  const backendReward = Number(result.agentReward || 0);
  const rate = worksBase > 0 && backendReward >= 0
    ? backendReward / worksBase
    : 0.05;
  const designBase = isApartmentProperty() ? getDesignProjectTotal() : 0;
  const base = worksBase + designBase;

  return {
    base,
    reward: Math.round(base * rate),
    rate
  };
}

function renderAgentReward(result = latestEstimate) {
  const rewardTotal = $('rewardTotal');
  const rewardBase = $('rewardBase');

  if (!result) {
    if (rewardTotal) rewardTotal.textContent = '—';
    if (rewardBase) rewardBase.textContent = '—';
    return;
  }

  const calculated = getAgentRewardWithDesign(result);
  if (rewardTotal) rewardTotal.textContent = calculated.base > 0 ? rub.format(calculated.reward) : '—';
  if (rewardBase) rewardBase.textContent = calculated.base > 0 ? rub.format(calculated.base) : '—';
}

function renderDesignSummary() {
  const summary = $('designSummary');
  const name = $('designProjectName');
  const total = $('designProjectTotal');
  const combined = $('combinedTotal');
  const project = getSelectedDesignProject();
  const designTotal = getDesignProjectTotal();

  if (!summary) return;
  summary.classList.toggle('hidden', !project || !isApartmentProperty());

  if (project && isApartmentProperty()) {
    if (name) name.textContent = project.title;
    if (total) total.textContent = rub.format(designTotal);
    if (combined && latestEstimate) combined.textContent = rub.format(latestEstimate.clientTotal + designTotal);
  }

  renderAgentReward();
}

function renderDesignProjects() {
  const section = $('designProjectSection');
  const root = $('designProjects');
  const noneButton = $('designNoneButton');
  if (!section || !root || !noneButton) return;

  const apartment = isApartmentProperty();
  section.classList.toggle('hidden', !apartment);

  if (!apartment) {
    selectedDesignProject = 'none';
    renderDesignSummary();
    return;
  }

  noneButton.classList.toggle('active', selectedDesignProject === 'none');
  const area = Math.max(num('areaM2'), 0);

  root.innerHTML = Object.entries(DESIGN_PROJECTS).map(([code, project]) => {
    const active = selectedDesignProject === code;
    const total = area > 0 ? Math.round(area * project.pricePerM2) : 0;
    const highlights = project.highlights.map(item =>
      '<li><span>✓</span><em>' + escapeHtml(item) + '</em></li>'
    ).join('');
    const details = project.includes.map(item => '<li>' + escapeHtml(item) + '</li>').join('');

    return '<article class="design-project-card' + (active ? ' active' : '') + '" data-design-project="' + code + '">' +
      '<div class="design-project-image-wrap">' +
        '<img class="design-project-image" src="' + project.image + '" loading="lazy" decoding="async" alt="' + escapeHtml(project.title) + '">' +
        '<span class="design-project-check">✓</span>' +
      '</div>' +
      '<div class="design-project-body">' +
        '<div class="design-project-badge">Дизайн-проект</div>' +
        '<h3>' + escapeHtml(project.title) + '</h3>' +
        '<p>' + escapeHtml(project.description) + '</p>' +
        '<div class="design-project-price"><strong>от ' + rub.format(project.pricePerM2) + ' / м²</strong>' +
        '<span>' + (area > 0 ? '≈ ' + rub.format(total) + ' за проект' : 'Укажите площадь квартиры') + '</span></div>' +
        '<ul class="design-project-highlights">' + highlights + '</ul>' +
        '<button type="button" class="design-select-button" data-select-design="' + code + '">' + (active ? 'Выбрано' : 'Выбрать') + '</button>' +
        '<details class="design-project-details"><summary>Полный состав</summary><ul>' + details + '</ul></details>' +
      '</div>' +
    '</article>';
  }).join('');

  renderDesignSummary();
}

function renderPackages() {
  const root = $('packages');
  root.innerHTML = '';

  Object.entries(packageData).forEach(([code, pkg]) => {
    const el = document.createElement('article');
    el.className = 'package package-' + code + (code === selectedPackage ? ' active' : '');

    const isApartment = isApartmentProperty();
    const area = Math.max(num('areaM2'), 0);
    const minimumTotal = isApartment && area > 0 ? area * pkg.minPerM2 : 0;
    const priceText = isApartment
      ? `от ${rub.format(pkg.minPerM2)} / м²`
      : 'Индивидуальный расчёт';
    const totalHint = isApartment && minimumTotal > 0
      ? `≈ от ${rub.format(minimumTotal)} за объект`
      : 'Стоимость рассчитывается по смете';

    const includedItems = (pkg.included || []).slice(0, 4);
    const included = includedItems.map(item =>
      `<li><span class="pkg-icon">✓</span><span>${escapeHtml(item)}</span></li>`
    ).join('');

    const roomFinishItems = packageDelta(code, 'roomFinish');
    const bathroomFinishItems = packageDelta(code, 'bathroomFinish');
    const giftItems = packageDelta(code, 'gifts');
    const noteItems = packageDelta(code, 'notes');

    const roomFinish = roomFinishItems.map(item => `<li>${escapeHtml(item)}</li>`).join('');
    const bathroomFinish = bathroomFinishItems.map(item => `<li>${escapeHtml(item)}</li>`).join('');
    const gifts = giftItems.map(item =>
      `<li><span class="gift-icon">✦</span><span>${escapeHtml(item)}</span></li>`
    ).join('');
    const notes = noteItems.map(item => `<li>${escapeHtml(item)}</li>`).join('');

    const previousTitle = previousPackageTitle(code);
    const inheritanceNote = previousTitle
      ? `<div class="package-inheritance-note">Уже включено всё из пакета «${escapeHtml(previousTitle)}». Ниже — только дополнительные или улучшенные позиции.</div>`
      : '<div class="package-inheritance-note base-note">Базовый состав пакета показан полностью.</div>';

    const selectedImage = packagePreviewImage(code);
    const popular = code === 'comfort' ? '<span class="package-popular">Чаще выбирают</span>' : '';

    el.innerHTML = `
      <div class="package-visual">
        <div class="package-media">
          ${selectedImage ? `<img class="package-card-image" src="${selectedImage}" loading="eager" decoding="async" data-fallback="${packageFullImage(code)}" onerror="if(this.dataset.fallback){const f=this.dataset.fallback;this.dataset.fallback='';this.src=f}else{this.style.display='none'}" alt="Пример ремонта — пакет ${escapeHtml(pkg.title)}">` : ''}
          ${popular}
          <span class="package-selected-mark" aria-hidden="true">✓</span>
        </div>

        <div class="package-body">
          <div class="package-top">
            <div>
              <div class="package-badge">Пакет ремонта</div>
              <h3>${escapeHtml(pkg.title)}</h3>
            </div>
            <div class="radio-dot" aria-hidden="true"></div>
          </div>

          <p class="package-description">${escapeHtml(pkg.description)}</p>

          <div class="package-price-block">
            <strong class="package-price">${priceText}</strong>
            <span class="package-total-hint">${totalHint}</span>
          </div>

          <ul class="package-list package-list-inline package-quick-list">${included}</ul>

          <details class="package-details">
            <summary>Что входит и чем отличается</summary>
            ${inheritanceNote}

            ${roomFinishItems.length || bathroomFinishItems.length ? `
            <div class="package-content-grid">
              ${roomFinishItems.length ? `
              <div class="package-panel">
                <h4>Комнаты и общие зоны</h4>
                <ul class="detail-list">${roomFinish}</ul>
              </div>` : ''}
              ${bathroomFinishItems.length ? `
              <div class="package-panel">
                <h4>Санузел</h4>
                <ul class="detail-list">${bathroomFinish}</ul>
              </div>` : ''}
            </div>` : ''}

            ${giftItems.length || noteItems.length ? `
            <div class="package-content-grid package-service-grid">
              ${giftItems.length ? `
              <div class="package-panel gift-panel">
                <h4>В подарок</h4>
                <ul class="package-list">${gifts}</ul>
              </div>` : ''}
              ${noteItems.length ? `
              <div class="package-panel note-panel">
                <h4>Примечание</h4>
                <ul class="detail-list">${notes}</ul>
              </div>` : ''}
            </div>` : ''}
          </details>
        </div>
      </div>
    `;

    el.addEventListener('click', (event) => {
      if (event.target.closest('details')) return;
      selectedPackage = code;
      trackEvent('package_click', code, { packageTitle: pkg.title });
      renderPackages();
      scheduleAutoCalculation();
    });

    root.appendChild(el);
  });

  updatePackagePreview();
}

$('calculationMode').addEventListener('change', () => {
  $('exactFields').classList.toggle('hidden', $('calculationMode').value !== 'exact');
});

const conditionOptionsByProperty = {
  apartment_new_build: [
    ['shell', 'Без отделки (черновая)'],
    ['white_box', 'Предчистовая (White Box)'],
    ['developer_finish', 'Чистовая от застройщика']
  ],
  apartment_secondary: [
    ['secondary_good', 'Хорошее состояние'],
    ['secondary_cosmetic', 'Требуется косметический ремонт'],
    ['secondary_worn', 'Требуется капитальный ремонт']
  ],
  house: [
    ['shell', 'Без отделки / черновая'],
    ['white_box', 'Предчистовая'],
    ['secondary_good', 'Хорошее состояние'],
    ['secondary_worn', 'Требуется капитальный ремонт']
  ],
  commercial: [
    ['shell', 'Без отделки / черновое помещение'],
    ['white_box', 'Подготовлено под чистовую отделку'],
    ['secondary_good', 'Эксплуатируемое, хорошее состояние'],
    ['secondary_worn', 'Требуется капитальный ремонт']
  ]
};

function updateConditionOptions() {
  const propertyType = $('propertyType').value;
  const condition = $('condition');
  const previous = condition.value;
  const options = conditionOptionsByProperty[propertyType] || conditionOptionsByProperty.apartment_new_build;

  condition.innerHTML = options
    .map(([value, label]) => `<option value="${value}">${label}</option>`)
    .join('');

  if (options.some(([value]) => value === previous)) {
    condition.value = previous;
  }
}

$('propertyType').addEventListener('change', () => {
  updateConditionOptions();
  renderPackages();
  renderDesignProjects();
  scheduleAutoCalculation();
});

updateConditionOptions();

function setupCountChoice(groupId, hiddenId, otherId, otherMin) {
  const group = $(groupId);
  const hidden = $(hiddenId);
  const other = $(otherId);
  if (!group || !hidden || !other) return;

  const setValue = (value, fromOther = false) => {
    if (value === 'other') {
      other.classList.remove('hidden');
      const numeric = Math.max(otherMin, Number(other.value || otherMin));
      other.value = String(numeric);
      hidden.value = String(numeric);
    } else {
      other.classList.add('hidden');
      hidden.value = String(value);
    }

    group.querySelectorAll('button[data-value]').forEach(button => {
      const active = fromOther
        ? button.dataset.value === 'other'
        : button.dataset.value === String(value);
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });

    hidden.dispatchEvent(new Event('change', { bubbles: true }));
  };

  group.addEventListener('click', event => {
    const button = event.target.closest('button[data-value]');
    if (!button) return;
    setValue(button.dataset.value);
  });

  other.addEventListener('input', () => {
    const numeric = Math.max(otherMin, Number(other.value || otherMin));
    hidden.value = String(numeric);
    group.querySelectorAll('button[data-value]').forEach(button => {
      const active = button.dataset.value === 'other';
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    hidden.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

setupCountChoice('roomsChoices', 'rooms', 'roomsOther', 4);
setupCountChoice('bathroomsChoices', 'bathrooms', 'bathroomsOther', 0);

function changeDoors(delta) {
  const field = $('doors');
  if (!field) return;
  const min = Number(field.min || 0);
  const max = Number(field.max || 100);
  const next = Math.min(max, Math.max(min, Number(field.value || 0) + delta));
  field.value = String(next);
  field.dispatchEvent(new Event('input', { bubbles: true }));
  field.dispatchEvent(new Event('change', { bubbles: true }));
}

$('doorsMinus')?.addEventListener('click', () => changeDoors(-1));
$('doorsPlus')?.addEventListener('click', () => changeDoors(1));

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
    doorways: exact ? num('doorways') : 0,
    needsFullElectrical: $('needsFullElectrical').checked,
    needsFullPlumbing: $('needsFullPlumbing').checked,
    needsDemolition: $('needsDemolition').checked,
    needsCeiling: $('needsCeiling').checked,
    hasBalcony: $('hasBalcony').checked,
    warmFloorM2: num('warmFloorM2'),
    designProject: selectedDesignProject,
    designProjectTotal: getDesignProjectTotal(),
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
  const feedbackStatus = $('feedbackStatus');
  if (feedbackStatus) {
    feedbackStatus.textContent = '';
    feedbackStatus.className = 'feedback-status';
  }
  const estimateTotal = $('estimateTotal');
  const rewardTotal = $('rewardTotal');
  const worksTotal = $('worksTotal');
  const materialsTotal = $('materialsTotal');
  const deliveryTotal = $('deliveryTotal');
  const vatTotal = $('vatTotal');
  const adjustmentRow = $('adjustmentRow');
  const adjustmentLabel = $('adjustmentLabel');
  const adjustmentTotal = $('adjustmentTotal');
  const rewardBase = $('rewardBase');
  const pricePerM2 = $('pricePerM2');
  const packageName = $('packageName');
  const lines = $('lines');
  const note = document.querySelector('.note');

  if (estimateTotal) estimateTotal.textContent = rub.format(result.clientTotal);
  renderAgentReward(result);
  if (worksTotal) worksTotal.textContent = result.worksTotal > 0 ? rub.format(result.worksTotal) : '—';
  if (materialsTotal) materialsTotal.textContent = result.materialsTotal > 0 ? rub.format(result.materialsTotal) : '—';
  if (deliveryTotal) deliveryTotal.textContent = result.deliveryTotal > 0 ? rub.format(result.deliveryTotal) : '—';
  if (vatTotal) vatTotal.textContent = result.vat > 0 ? rub.format(result.vat) : '—';

  const adjustmentLines = Array.isArray(result.lines)
    ? result.lines.filter(line => line.group === 'adjustment')
    : [];
  const adjustmentAmount = adjustmentLines.reduce((sum, line) => sum + Number(line.amount || 0), 0);
  if (adjustmentRow) adjustmentRow.classList.toggle('hidden', Math.abs(adjustmentAmount) < 1);
  if (adjustmentTotal && Math.abs(adjustmentAmount) >= 1) adjustmentTotal.textContent = rub.format(adjustmentAmount);
  if (adjustmentLabel && adjustmentLines.length) {
    adjustmentLabel.textContent = adjustmentLines.length === 1
      ? adjustmentLines[0].title
      : 'Корректировки';
  }

  if (pricePerM2) pricePerM2.textContent = rub.format(result.pricePerM2Final);
  if (packageName) packageName.textContent = packageData[result.package]?.title || result.package;

  if (lines) {
    lines.innerHTML = result.lines.map(line => `
      <div class="line-item"><span>${line.title}</span><span>${rub.format(line.amount)}</span></div>
    `).join('');
  }

  if (note) note.textContent = result.disclaimer;
  renderDesignSummary();
}



function setFeedbackStatus(message, state = '') {
  const status = $('feedbackStatus');
  if (!status) return;
  status.textContent = message;
  status.className = 'feedback-status' + (state ? ' ' + state : '');
}

async function sendFeedback(status) {
  if (!latestEstimate || feedbackSending) return;

  feedbackSending = true;
  const okButton = $('feedbackOkButton');
  const sendButton = $('feedbackSendButton');
  if (okButton) okButton.disabled = true;
  if (sendButton) sendButton.disabled = true;
  setFeedbackStatus('Сохраняем...');

  const expectedRaw = $('feedbackExpectedTotal')?.value;
  const expectedTotal = expectedRaw ? Number(expectedRaw) : undefined;

  const body = {
    status,
    issueType: status === 'error' ? $('feedbackIssueType').value : '',
    expectedTotal: Number.isFinite(expectedTotal) ? expectedTotal : undefined,
    comment: status === 'error' ? $('feedbackComment').value.trim() : '',
    input: payload(),
    estimate: latestEstimate
  };

  try {
    const response = await fetch('/api/v1/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.message || 'Не удалось сохранить обратную связь');
    }

    setFeedbackStatus(
      status === 'ok'
        ? 'Спасибо. Отметка сохранена.'
        : 'Спасибо. Ошибка записана в журнал.',
      'success'
    );

    trackEvent('feedback_submit', status, {
      issueType: body.issueType,
      expectedTotal: body.expectedTotal ?? null,
      package: selectedPackage,
      areaM2: body.input.areaM2
    });

    if (status === 'error') {
      $('feedbackForm').classList.add('hidden');
      $('feedbackExpectedTotal').value = '';
      $('feedbackComment').value = '';
    }
  } catch (err) {
    setFeedbackStatus(err.message || 'Не удалось отправить обратную связь', 'error-state');
  } finally {
    feedbackSending = false;
    if (okButton) okButton.disabled = false;
    if (sendButton) sendButton.disabled = false;
  }
}

function openFeedbackForm() {
  if (!latestEstimate) {
    setFeedbackStatus('Сначала дождитесь расчёта сметы.', 'error-state');
    return;
  }
  trackEvent('feedback_open', 'error_form', {
    package: selectedPackage,
    areaM2: latestEstimate.areaM2
  });
  $('feedbackForm').classList.remove('hidden');
  $('feedbackExpectedTotal').focus();
}

function closeFeedbackForm() {
  $('feedbackForm').classList.add('hidden');
  setFeedbackStatus('');
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
  const designProject = getSelectedDesignProject();
  const designTotal = getDesignProjectTotal();
  const combinedTotal = latestEstimate.clientTotal + designTotal;

  const estimateRows = (latestEstimate.lines || []).map(line => `
    <tr>
      <td>${escapeHtml(line.title)}</td>
      <td>${rub.format(line.amount)}</td>
    </tr>
  `).join('');

  trackEvent('offer_generate', selectedPackage, {
    areaM2: latestEstimate.areaM2,
    clientTotal: latestEstimate.clientTotal,
    pricePerM2: latestEstimate.pricePerM2Final,
    designProject: selectedDesignProject,
    designProjectTotal: designTotal
  });

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
  .design-offer{margin-top:18px;padding:18px;border:1px solid #e7e0da;border-radius:16px;background:#fffaf8}
  .design-offer-head{display:grid;grid-template-columns:140px 1fr;gap:16px;align-items:center}
  .design-offer img{width:140px;height:92px;object-fit:cover;border-radius:12px;background:#f3f0ec}
  .design-offer h2{margin:0 0 6px;font-size:19px}
  .design-offer p{margin:0;color:#6f6964;font-size:12px;line-height:1.4}
  .design-offer-price{margin-top:7px;font-size:18px;font-weight:800}
  .combined-offer{display:flex;justify-content:space-between;gap:14px;align-items:center;margin-top:14px;padding:16px 18px;background:#181818;color:#fff;border-radius:14px}
  .combined-offer span{font-size:12px;color:#ddd}
  .combined-offer strong{font-size:24px}
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
    <div><span>Итоговая цена за м²</span><strong>${rub.format(latestEstimate.pricePerM2Final)}</strong></div>
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

  ${designProject ? `
    <section class="design-offer">
      <div class="design-offer-head">
        <img src="${designProject.image}" alt="${escapeHtml(designProject.title)}">
        <div>
          <h2>${escapeHtml(designProject.title)}</h2>
          <p>${escapeHtml(designProject.description)}</p>
          <div class="design-offer-price">${rub.format(designProject.pricePerM2)} / м² · ${rub.format(designTotal)}</div>
        </div>
      </div>
      <div class="combined-offer">
        <span>Ремонт + дизайн-проект</span>
        <strong>${rub.format(combinedTotal)}</strong>
      </div>
    </section>
  ` : ''}

  ${offerComment ? `<div class="comment"><strong>Комментарий:</strong><br>${offerComment}</div>` : ''}

  <div class="disclaimer">${escapeHtml(latestEstimate.disclaimer || 'Предварительный расчёт. Финальная стоимость уточняется после замера.')}</div>
</main>
</body>
</html>`);
  popup.document.close();
}

async function calculateAndRender({ showButtonState = false } = {}) {
  const button = $('submitButton');
  const error = $('formError');

  if (!num('areaM2') || num('areaM2') <= 0) return;

  if (estimateAbortController) {
    estimateAbortController.abort();
  }
  estimateAbortController = new AbortController();

  error.classList.add('hidden');

  if (showButtonState) {
    button.disabled = true;
    button.textContent = 'Считаем...';
  }

  try {
    const response = await fetch('/api/v1/estimate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload()),
      signal: estimateAbortController.signal
    });

    const data = await response.json();
    if (!response.ok) throw new Error('Проверьте введённые параметры');
    renderResult(data);
  } catch (err) {
    if (err.name === 'AbortError') return;
    error.textContent = err.message || 'Ошибка расчёта';
    error.classList.remove('hidden');
  } finally {
    if (showButtonState) {
      button.disabled = false;
      button.textContent = 'Рассчитать смету';
    }
  }
}

function scheduleAutoCalculation() {
  clearTimeout(autoCalcTimer);
  autoCalcTimer = setTimeout(() => {
    calculateAndRender();
  }, 300);
}

$('calculator').addEventListener('submit', async (event) => {
  event.preventDefault();
  clearTimeout(autoCalcTimer);
  trackEvent('calculate', 'manual', {
    package: selectedPackage,
    areaM2: num('areaM2'),
    calculationMode: $('calculationMode').value
  });
  await calculateAndRender({ showButtonState: true });
});

$('calculator').querySelectorAll('input, select').forEach((field) => {
  field.addEventListener('input', () => {
    scheduleAutoCalculation();
    if (field.id === 'areaM2') {
      renderPackages();
      renderDesignProjects();
    }
  });
  field.addEventListener('change', () => {
    scheduleAutoCalculation();
    const value = field.type === 'checkbox' ? field.checked : field.value;
    trackEvent('option_change', field.id || field.name || 'field', {
      value,
      package: selectedPackage
    });
  });
});

$('designProjects')?.addEventListener('click', (event) => {
  if (event.target.closest('details')) return;
  const button = event.target.closest('[data-select-design]');
  const card = event.target.closest('[data-design-project]');
  const code = button?.dataset.selectDesign || card?.dataset.designProject;
  if (!code || !DESIGN_PROJECTS[code]) return;

  selectedDesignProject = code;
  trackEvent('option_change', 'design_project', {
    value: code,
    title: DESIGN_PROJECTS[code].title,
    areaM2: num('areaM2'),
    total: getDesignProjectTotal()
  });
  renderDesignProjects();
});

$('designNoneButton')?.addEventListener('click', () => {
  selectedDesignProject = 'none';
  trackEvent('option_change', 'design_project', { value: 'none' });
  renderDesignProjects();
});

$('generateOfferButton').addEventListener('click', generateClientOffer);

$('feedbackOkButton').addEventListener('click', () => sendFeedback('ok'));
$('feedbackErrorButton').addEventListener('click', openFeedbackForm);
$('feedbackSendButton').addEventListener('click', () => sendFeedback('error'));
$('feedbackCancelButton').addEventListener('click', closeFeedbackForm);

document.querySelectorAll('a[href^="tel:"], a[href*="t.me/"], a[href*="max.ru/"]').forEach((link) => {
  link.addEventListener('click', () => {
    const href = link.getAttribute('href') || '';
    const channel = href.startsWith('tel:') ? 'phone' : href.includes('t.me/') ? 'telegram' : 'max';
    trackEvent('contact_click', channel);
  });
});

trackEvent('page_view', 'calculator');

(async () => {
  try {
    await loadPackages();
    renderDesignProjects();
    await calculateAndRender();
  } catch {
    $('formError').textContent = 'Не удалось загрузить калькулятор. Проверьте backend.';
    $('formError').classList.remove('hidden');
  }
})();


const floatingPhoneButton = $('floatingPhoneButton');
const floatingPhonePopover = $('floatingPhonePopover');
const floatingContacts = $('floatingContacts');

if (floatingPhoneButton && floatingPhonePopover && floatingContacts) {
  floatingPhoneButton.addEventListener('click', (event) => {
    event.stopPropagation();
    const isOpen = floatingPhonePopover.classList.toggle('is-open');
    floatingPhoneButton.setAttribute('aria-expanded', String(isOpen));
    trackEvent('contact_click', 'phone_reveal');
  });

  document.addEventListener('click', (event) => {
    if (!floatingContacts.contains(event.target)) {
      floatingPhonePopover.classList.remove('is-open');
      floatingPhoneButton.setAttribute('aria-expanded', 'false');
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      floatingPhonePopover.classList.remove('is-open');
      floatingPhoneButton.setAttribute('aria-expanded', 'false');
    }
  });

  const revealedPhoneLink = floatingPhonePopover.querySelector('a[href^="tel:"]');
  if (revealedPhoneLink) {
    revealedPhoneLink.addEventListener('click', () => trackEvent('contact_click', 'phone'));
  }
}
