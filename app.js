// ============ 1. KONFIGURATION ============
// Google Apps Script Web App URL (samma sheet-dokument, se Code.gs)
const API_URL = 'https://script.google.com/macros/s/AKfycbx1TZZ3pE_ZnVNMtcAyk3nRnbqWCGUJlcTlqbA-ZEFBB_GDcgyM6x7_cb2u0L52sLoD/exec';

let expenseChart = null;
let historikChart = null;
let historikLoaded = false;
let loggLoaded = false;

// Fallback-data (visas tills Sheets har laddats, eller om anropet misslyckas)
let categories = ['HUS', 'TRANSPORT', 'FÖRSÄKRING', 'DRIFT/ENERGI', 'SPARANDE', 'MAT', 'ÖVRIGT'];
let items = [
  { id: 'item-1',  title: 'Amortering',        amount: 3685, cat: 'HUS' },
  { id: 'item-2',  title: 'Ränta',              amount: 5761, cat: 'HUS' },
  { id: 'item-3',  title: 'Underhåll',          amount: 3000, cat: 'HUS' },
  { id: 'item-4',  title: 'Leasingavgift',      amount: 6460, cat: 'TRANSPORT' },
  { id: 'item-5',  title: 'Underhåll',          amount: 500,  cat: 'TRANSPORT' },
  { id: 'item-6',  title: 'Busskort',           amount: 0,    cat: 'TRANSPORT' },
  { id: 'item-7',  title: 'Underhåll Skoda',    amount: 2000, cat: 'TRANSPORT' },
  { id: 'item-8',  title: 'Försäkring Skoda',   amount: 435,  cat: 'FÖRSÄKRING' },
  { id: 'item-9',  title: 'El & Uppvärmning',   amount: 3321, cat: 'DRIFT/ENERGI' },
  { id: 'item-10', title: 'Mona & Anton',       amount: 2363, cat: 'SPARANDE' },
  { id: 'item-11', title: 'Barn',               amount: 1733, cat: 'SPARANDE' },
  { id: 'item-12', title: 'Semesterspar',       amount: 2000, cat: 'SPARANDE' },
  { id: 'item-13', title: 'Mat',                amount: 7000, cat: 'MAT' },
  { id: 'item-14', title: 'SOS Barnbyar',       amount: 75,   cat: 'ÖVRIGT' },
  { id: 'item-15', title: 'Mobilabonnemang',    amount: 99,   cat: 'ÖVRIGT' },
  { id: 'item-16', title: 'Ridlektioner',       amount: 1425, cat: 'ÖVRIGT' }
];
// OBS: siffrorna ovan är ungefärliga (rekonstruerade från skärmdumpar) och
// skrivs över så fort riktig data hämtas från Google Sheets.

// Dynamisk lista över gemensamma inkomster (barnbidrag m.m.)
let gemInkomster = [
  { id: 'gem-1', label: 'Barnbidrag', amount: 2650 },
  { id: 'gem-2', label: 'Uttag amorteringsspar', amount: 2000 }
];

// Schablon = mål-belopp per person, redigerbart i Inställningar, sparas lokalt i webbläsaren
let schablon = {
  anton: parseFloat(localStorage.getItem('schablon-anton')) || 18000,
  mona: parseFloat(localStorage.getItem('schablon-mona')) || 12000
};

window.addEventListener('DOMContentLoaded', async () => {
  try {
    const savedGem = localStorage.getItem('gemInkomster');
    if (savedGem) gemInkomster = JSON.parse(savedGem);
  } catch (e) { /* ignorera trasig lokal data */ }

  setIfylltDatum();
  initChart();
  renderExpenses();
  renderCategoryDropdown();
  renderCategoryList();
  renderGemInkomster();
  document.getElementById('schablon-anton').value = schablon.anton;
  document.getElementById('schablon-mona').value = schablon.mona;
  calculateAll();

  // Hämta därefter från Sheets (skriver över fallback-datan om det lyckas)
  await loadDataFromSheets();
});

// ============ 2. NAVIGERING ============
function switchTab(tabName, btn) {
  document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));

  document.getElementById(`tab-${tabName}`).classList.add('active');
  btn.classList.add('active');

  if (tabName === 'historik' && !historikLoaded) loadHistorik();
  if (tabName === 'logg' && !loggLoaded) loadLogg();
}

// ============ 3. DATUM / VECKA ============
function setIfylltDatum() {
  const now = new Date();
  const dagar = ['söndag', 'måndag', 'tisdag', 'onsdag', 'torsdag', 'fredag', 'lördag'];
  const manader = ['januari', 'februari', 'mars', 'april', 'maj', 'juni', 'juli', 'augusti', 'september', 'oktober', 'november', 'december'];
  document.getElementById('ifyllt-datum').innerText =
    `${dagar[now.getDay()]} ${now.getDate()} ${manader[now.getMonth()]} ${now.getFullYear()}`;
  document.getElementById('ifyllt-vecka').innerText = `v${getISOWeek(now)}`;
}

function getISOWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

// ============ 4. HÄMTA FRÅN SHEETS (Transaktioner) ============
async function loadDataFromSheets() {
  try {
    const response = await fetch(`${API_URL}?sheet=Transaktioner`);
    const data = await response.json();

    if (Array.isArray(data) && data.length > 0) {
      const getVal = (row, keys) => {
        const foundKey = Object.keys(row).find(k => keys.includes(k.toLowerCase().trim()));
        return foundKey ? row[foundKey] : null;
      };

      const fetchedItems = data.map((row, idx) => {
        const rawBelopp = getVal(row, ['belopp', 'belopp (kr)', 'summa', 'pris']) || 0;
        const cleanAmount = typeof rawBelopp === 'string'
          ? parseFloat(rawBelopp.replace(/[^\d,-]/g, '').replace(',', '.')) || 0
          : parseFloat(rawBelopp) || 0;

        const rawCat = getVal(row, ['kategori', 'cat', 'typ']) || 'ÖVRIGT';
        const title = getVal(row, ['beskrivning', 'titel', 'namn']) || `Rad ${idx + 1}`;

        return {
          id: `item-${idx}`,
          title: title,
          amount: cleanAmount,
          cat: rawCat.toString().toUpperCase().trim()
        };
      });

      if (fetchedItems.length > 0) {
        items = fetchedItems;
        const fetchedCats = [...new Set(items.map(i => i.cat))];
        if (fetchedCats.length > 0) categories = fetchedCats;
      }
    }

    renderExpenses();
    renderCategoryDropdown();
    renderCategoryList();
    calculateAll();
  } catch (err) {
    console.warn('Kunde inte läsa från Sheets, använder lokal data:', err);
  }
}

// ============ 5. RENDERING: UTGIFTER / KATEGORIER ============
function renderExpenses() {
  const container = document.getElementById('dynamic-expenses');
  if (!container) return;
  container.innerHTML = '';

  categories.forEach(cat => {
    let catHtml = `
      <div class="category-header">
        <span>${cat}</span>
        <span class="row-total" id="total-${cat.toLowerCase()}">0 kr</span>
      </div>
    `;

    const catItems = items.filter(item => item.cat === cat);
    catItems.forEach(item => {
      catHtml += `
        <div class="input-row">
          <div class="input-label"><main>${item.title}</main></div>
          <input type="number" id="${item.id}" class="num-input exp-input" data-cat="${cat.toLowerCase()}" value="${item.amount}" oninput="calculateAll()">
        </div>
      `;
    });

    container.innerHTML += catHtml;
  });
}

function renderCategoryDropdown() {
  const select = document.getElementById('select-category');
  if (!select) return;
  select.innerHTML = '';
  categories.forEach(cat => {
    select.innerHTML += `<option value="${cat}">${cat}</option>`;
  });
}

function renderCategoryList() {
  const container = document.getElementById('category-list');
  if (!container) return;
  container.innerHTML = '';
  categories.forEach(cat => {
    container.innerHTML += `
      <div class="cat-list-item">
        <span>${cat}</span>
        <button class="btn-delete-cat" onclick="deleteCategory('${cat}')">Ta bort</button>
      </div>
    `;
  });
}

function deleteCategory(catName) {
  if (!confirm(`Ta bort kategorin "${catName}" och alla dess utgifter?`)) return;
  categories = categories.filter(c => c !== catName);
  items = items.filter(i => i.cat !== catName);
  renderExpenses();
  renderCategoryDropdown();
  renderCategoryList();
  calculateAll();
}

// ============ 6. GEMENSAMMA INKOMSTER (dynamisk lista) ============
function renderGemInkomster() {
  const container = document.getElementById('gem-inkomst-list');
  if (!container) return;
  container.innerHTML = '';
  gemInkomster.forEach(g => {
    container.innerHTML += `
      <div class="input-row" style="gap: 8px;">
        <input type="text" class="text-input" style="margin-bottom:0; flex:1;" value="${g.label}"
               placeholder="t.ex. barnbidrag" oninput="updateGemInkomst('${g.id}', 'label', this.value)">
        <input type="number" class="num-input" style="width:110px;" value="${g.amount}"
               oninput="updateGemInkomst('${g.id}', 'amount', this.value)">
        <button class="btn-remove-row" onclick="removeGemInkomst('${g.id}')">✕</button>
      </div>
    `;
  });
}

function addGemInkomst() {
  gemInkomster.push({ id: `gem-${Date.now()}`, label: '', amount: 0 });
  renderGemInkomster();
  calculateAll();
  saveGemInkomsterLocally();
}

function updateGemInkomst(id, field, value) {
  const g = gemInkomster.find(x => x.id === id);
  if (!g) return;
  g[field] = field === 'amount' ? (parseFloat(value) || 0) : value;
  calculateAll();
  saveGemInkomsterLocally();
}

function removeGemInkomst(id) {
  gemInkomster = gemInkomster.filter(g => g.id !== id);
  renderGemInkomster();
  calculateAll();
  saveGemInkomsterLocally();
}

function saveGemInkomsterLocally() {
  try {
    localStorage.setItem('gemInkomster', JSON.stringify(gemInkomster));
  } catch (e) { /* localStorage otillgängligt, ignorera */ }
}

// ============ 7. HUVUDBERÄKNING ============
function calculateAll() {
  // 1. Inkomster
  const lonAnton = parseFloat(document.getElementById('lon-anton')?.value) || 0;
  const lonMona = parseFloat(document.getElementById('lon-mona')?.value) || 0;
  const gemInkomst = gemInkomster.reduce((sum, g) => sum + (parseFloat(g.amount) || 0), 0);

  const totalLon = lonAnton + lonMona;

  // Avrundad procent, ENDAST för visning (t.ex. "63%")
  let pctAnton = 0, pctMona = 0;
  if (totalLon > 0) {
    pctAnton = Math.round((lonAnton / totalLon) * 100);
    pctMona = 100 - pctAnton;
  }
  const elPctAnton = document.getElementById('pct-anton');
  const elPctMona = document.getElementById('pct-mona');
  if (elPctAnton) elPctAnton.innerText = pctAnton;
  if (elPctMona) elPctMona.innerText = pctMona;

  // 2. Utgifter per kategori
  const expInputs = document.querySelectorAll('.exp-input');
  let totaltUtgifter = 0;
  let catTotals = {};
  categories.forEach(c => catTotals[c.toLowerCase()] = 0);

  expInputs.forEach(input => {
    const val = parseFloat(input.value) || 0;
    const cat = input.dataset.cat;
    totaltUtgifter += val;
    if (catTotals[cat] !== undefined) catTotals[cat] += val;
  });

  categories.forEach(cat => {
    const elem = document.getElementById(`total-${cat.toLowerCase()}`);
    if (elem) elem.innerText = (catTotals[cat.toLowerCase()] || 0).toLocaleString('sv-SE') + ' kr';
  });

  // 3. Slutsummering
  const nettoUtgifter = Math.max(0, totaltUtgifter - gemInkomst);

  // VIKTIGT (bugfix): fördela efter den EXAKTA löneandelen (lonAnton / totalLon),
  // inte den avrundade procentsatsen ovan. Annars blir beloppen fel med upp till
  // några hundra kronor per månad, och Anton + Mona summerar inte till totalen.
  let betalarAnton = 0, betalarMona = 0;
  if (totalLon > 0) {
    betalarAnton = Math.round(nettoUtgifter * (lonAnton / totalLon));
    betalarMona = nettoUtgifter - betalarAnton; // garanterar exakt summa
  }

  document.getElementById('totalt-utgifter-text').innerText = `${totaltUtgifter.toLocaleString('sv-SE')} kr totalt`;
  document.getElementById('gem-inkomst-avdrag').innerText = `(-${gemInkomst.toLocaleString('sv-SE')} kr gem. inkomster)`;

  document.getElementById('betalar-anton').innerText = `${betalarAnton.toLocaleString('sv-SE')} kr`;
  document.getElementById('betalar-mona').innerText = `${betalarMona.toLocaleString('sv-SE')} kr`;

  document.getElementById('satter-in-anton').innerText = `${betalarAnton.toLocaleString('sv-SE')} kr`;
  document.getElementById('satter-in-mona').innerText = `${betalarMona.toLocaleString('sv-SE')} kr`;

  renderAvvikelse('anton', betalarAnton);
  renderAvvikelse('mona', betalarMona);

  updateChart(catTotals);

  return { totaltUtgifter, gemInkomst, betalarAnton, betalarMona, catTotals };
}

function renderAvvikelse(person, beraknat) {
  const mal = schablon[person] || 0;
  const diff = beraknat - mal;
  const namn = person === 'anton' ? 'Anton' : 'Mona';
  const tecken = diff >= 0 ? '+' : '';
  const farg = diff >= 0 ? 'var(--accent-green-text)' : 'var(--accent-red-text)';
  const ord = diff >= 0 ? 'extra' : 'mindre';
  const el = document.getElementById(`avvikelse-${person}`);
  if (!el) return;
  el.innerHTML =
    `<b>${namn}</b>: schablon ${mal.toLocaleString('sv-SE')} kr → beräknat ${beraknat.toLocaleString('sv-SE')} kr = ` +
    `<span style="color:${farg}; font-weight:700;">${tecken}${diff.toLocaleString('sv-SE')} kr ${ord} denna månad</span>`;
}

function saveSchablon() {
  schablon.anton = parseFloat(document.getElementById('schablon-anton').value) || 0;
  schablon.mona = parseFloat(document.getElementById('schablon-mona').value) || 0;
  try {
    localStorage.setItem('schablon-anton', schablon.anton);
    localStorage.setItem('schablon-mona', schablon.mona);
  } catch (e) { /* ignorera */ }
  calculateAll();
}

// ============ 8. DIAGRAM (cirkel: Beräkna-fliken) ============
function initChart() {
  const ctx = document.getElementById('expenseChart')?.getContext('2d');
  if (!ctx) return;
  expenseChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: categories,
      datasets: [{
        data: categories.map(() => 0),
        backgroundColor: ['#3498db', '#e67e22', '#9b59b6', '#2ecc71', '#e74c3c', '#f1c40f', '#8e8e93'],
        borderWidth: 2
      }]
    },
    options: {
      cutout: '65%',
      plugins: { legend: { position: 'right' } }
    }
  });
}

function updateChart(totals) {
  if (expenseChart) {
    expenseChart.data.labels = categories;
    expenseChart.data.datasets[0].data = categories.map(c => totals[c.toLowerCase()] || 0);
    expenseChart.update();
  }
}

// ============ 9. HISTORIK-FLIKEN (trend över tid) ============
async function loadHistorik() {
  try {
    const response = await fetch(`${API_URL}?sheet=Historik`);
    const data = await response.json();
    historikLoaded = true;

    if (!Array.isArray(data) || data.length === 0) return;

    const labels = data.map(row => row['Datum'] || '');
    const excluded = ['Datum', 'TotaltUtgifter', 'GemInkomst', 'BetalarAnton', 'BetalarMona'];
    const catKeys = Object.keys(data[0]).filter(k => !excluded.includes(k));
    const colors = ['#3498db', '#e67e22', '#9b59b6', '#2ecc71', '#e74c3c', '#f1c40f', '#8e8e93'];

    const datasets = catKeys.map((cat, i) => ({
      label: cat,
      data: data.map(row => parseFloat(row[cat]) || 0),
      borderColor: colors[i % colors.length],
      backgroundColor: 'transparent',
      tension: 0.3
    }));

    const ctx = document.getElementById('historikChart')?.getContext('2d');
    if (!ctx) return;
    if (historikChart) historikChart.destroy();
    historikChart = new Chart(ctx, {
      type: 'line',
      data: { labels, datasets },
      options: {
        plugins: { legend: { position: 'bottom' } },
        scales: { y: { beginAtZero: true } }
      }
    });
  } catch (err) {
    console.warn('Kunde inte ladda historik:', err);
  }
}

// ============ 10. LOGG-FLIKEN (rålista av alla transaktioner) ============
async function loadLogg() {
  const container = document.getElementById('logg-list');
  if (!container) return;
  try {
    const response = await fetch(`${API_URL}?sheet=Transaktioner`);
    const data = await response.json();
    loggLoaded = true;

    if (!Array.isArray(data) || data.length === 0) {
      container.innerHTML = '<div style="color: var(--text-muted); font-size: 14px;">Inga transaktioner ännu.</div>';
      return;
    }

    const sorted = [...data].reverse(); // senast tillagda överst
    container.innerHTML = sorted.map(row => `
      <div class="cat-list-item" style="flex-direction: column; align-items: flex-start; gap: 2px;">
        <div style="display:flex; justify-content:space-between; width:100%;">
          <span>${row['Beskrivning'] || '—'}</span>
          <span>${(parseFloat(row['Belopp']) || 0).toLocaleString('sv-SE')} kr</span>
        </div>
        <div style="font-size:12px; color: var(--text-muted); font-weight:400;">
          ${row['Datum'] || ''} · ${row['Kategori'] || ''}
        </div>
      </div>
    `).join('');
  } catch (err) {
    container.innerHTML = '<div style="color: var(--accent-red-text); font-size: 14px;">Kunde inte ladda loggen.</div>';
  }
}

// ============ 11. INSTÄLLNINGAR: lägg till kategori / utgift ============
function addCategory() {
  const nameInput = document.getElementById('new-cat-name');
  const catName = nameInput.value.trim().toUpperCase();

  if (catName && !categories.includes(catName)) {
    categories.push(catName);
    nameInput.value = '';
    renderExpenses();
    renderCategoryDropdown();
    renderCategoryList();
    calculateAll();
  }
}

async function addItemToCategory() {
  const titleInput = document.getElementById('new-item-title');
  const catSelect = document.getElementById('select-category');
  const amountInput = document.getElementById('new-item-amount');

  const title = titleInput.value.trim();
  const cat = catSelect.value;
  const amount = parseFloat(amountInput.value) || 0;

  if (!title) {
    alert('Vänligen fyll i en beskrivning.');
    return;
  }

  const newItem = { id: `item-${Date.now()}`, title: title, amount: amount, cat: cat };
  items.push(newItem);

  titleInput.value = '';
  amountInput.value = '';

  renderExpenses();
  calculateAll();

  try {
    const payload = {
      sheet: 'Transaktioner',
      Datum: new Date().toISOString().split('T')[0],
      Beskrivning: newItem.title,
      Kategori: newItem.cat,
      Belopp: newItem.amount
    };

    await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    });

    loggLoaded = false; // ladda om loggen nästa gång fliken öppnas
    alert(`"${title}" lades till under ${cat} och sparades i Google Sheets!`);
  } catch (err) {
    console.error('Kunde inte spara ny rad till Sheets:', err);
    alert('Kunde inte spara raden till Google Sheets. Kontrollera anslutningen.');
  }
}

// ============ 12. SPARA MÅNADSSNAPSHOT (Beräkna + Historik) ============
async function saveToSheets() {
  const result = calculateAll();
  const datum = new Date().toISOString().split('T')[0];

  const historikPayload = {
    sheet: 'Historik',
    Datum: datum,
    TotaltUtgifter: result.totaltUtgifter,
    GemInkomst: result.gemInkomst,
    BetalarAnton: result.betalarAnton,
    BetalarMona: result.betalarMona
  };
  categories.forEach(cat => {
    historikPayload[cat] = result.catTotals[cat.toLowerCase()] || 0;
  });

  try {
    await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(historikPayload)
    });
    historikLoaded = false; // ladda om historik-grafen nästa gång fliken öppnas
    alert('Sparat!');
  } catch (err) {
    alert('Nätverksfel: ' + err.message);
  }
}
