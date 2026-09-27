// 1. DINA GOOGLE APPS SCRIPT WEB APP URL:
const API_URL = 'https://script.google.com/macros/s/AKfycbx1TZZ3pE_ZnVNMtcAyk3nRnbqWCGUJlcTlqbA-ZEFBB_GDcgyM6x7_cb2u0L52sLoD/exec'; 

let expenseChart = null;

// Fallback-data om Sheets är tomt eller inte kan nås
let categories = ['HUS', 'TRANSPORT', 'MAT'];
let items = [
  { id: 'item-1', title: 'Amortering', amount: 3685, cat: 'HUS' },
  { id: 'item-2', title: 'Ränta', amount: 5761, cat: 'HUS' },
  { id: 'item-3', title: 'Leasingavgift', amount: 6460, cat: 'TRANSPORT' },
  { id: 'item-4', title: 'Mat', amount: 7000, cat: 'MAT' }
];

window.addEventListener('DOMContentLoaded', async () => {
  initChart();
  renderExpenses();
  renderCategoryDropdown();
  calculateAll(); // Kör direkt med fallback-data

  // Hämta därefter från Sheets
  await loadDataFromSheets();
});

function switchTab(tabName, btn) {
  document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));

  document.getElementById(`tab-${tabName}`).classList.add('active');
  btn.classList.add('active');
}

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
    calculateAll();
  } catch (err) {
    console.warn('Kunde inte läsa från Sheets, använder lokal data:', err);
  }
}

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

function calculateAll() {
  // 1. Inkomster
  const lonAnton = parseFloat(document.getElementById('lon-anton')?.value) || 0;
  const lonMona = parseFloat(document.getElementById('lon-mona')?.value) || 0;
  const gemInkomst = parseFloat(document.getElementById('gem-inkomst')?.value) || 0;

  const totalLon = lonAnton + lonMona;
  
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

  // Uppdatera kategoriernas delsummor
  categories.forEach(cat => {
    const elem = document.getElementById(`total-${cat.toLowerCase()}`);
    if (elem) elem.innerText = (catTotals[cat.toLowerCase()] || 0).toLocaleString('sv-SE') + ' kr';
  });

  // 3. Slutsummering
  const nettoUtgifter = Math.max(0, totaltUtgifter - gemInkomst);
  const betalarAnton = Math.round((nettoUtgifter * pctAnton) / 100);
  const betalarMona = Math.round((nettoUtgifter * pctMona) / 100);

  document.getElementById('totalt-utgifter-text').innerText = `${totaltUtgifter.toLocaleString('sv-SE')} kr totalt`;
  document.getElementById('gem-inkomst-avdrag').innerText = `(-${gemInkomst.toLocaleString('sv-SE')} kr gem. inkomster)`;
  
  document.getElementById('betalar-anton').innerText = `${betalarAnton.toLocaleString('sv-SE')} kr`;
  document.getElementById('betalar-mona').innerText = `${betalarMona.toLocaleString('sv-SE')} kr`;

  updateChart(catTotals);
}

function initChart() {
  const ctx = document.getElementById('expenseChart')?.getContext('2d');
  if (!ctx) return;
  expenseChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: categories,
      datasets: [{
        data: categories.map(() => 0),
        backgroundColor: ['#3498db', '#e67e22', '#2ecc71', '#9b59b6', '#f1c40f'],
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

function addCategory() {
  const nameInput = document.getElementById('new-cat-name');
  const catName = nameInput.value.trim().toUpperCase();

  if (catName && !categories.includes(catName)) {
    categories.push(catName);
    nameInput.value = '';
    renderExpenses();
    renderCategoryDropdown();
    calculateAll();
  }
}

function addItemToCategory() {
  const title = document.getElementById('new-item-title').value.trim();
  const cat = document.getElementById('select-category').value;
  const amount = parseFloat(document.getElementById('new-item-amount').value) || 0;

  if (title) {
    items.push({ id: `item-${Date.now()}`, title, amount, cat });
    document.getElementById('new-item-title').value = '';
    document.getElementById('new-item-amount').value = '';
    renderExpenses();
    calculateAll();
  }
}

async function saveToSheets() {
  const payload = {
    sheet: 'Transaktioner',
    Datum: new Date().toISOString().split('T')[0],
    Beskrivning: 'Månadsberäkning',
    Kategori: 'RESULTAT',
    Belopp: parseFloat(document.getElementById('totalt-utgifter-text').innerText.replace(/\D/g, '')) || 0
  };

  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    });
    alert('Sparat!');
  } catch (err) {
    alert('Nätverksfel: ' + err.message);
  }
}
