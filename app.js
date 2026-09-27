// 1. KLISTRA IN DIN WEB APP URL FRÅN GOOGLE APPS SCRIPT HÄR:
const API_URL = 'https://script.google.com/macros/s/AKfycbzWIiWXONz7sxWpCJW7IMiWFi8MHmqBELqi6RbGUVY-MiFwDF6b_-aHJFozAtdXGpjp/exec'; 

let expenseChart = null;
let categories = ['HUS', 'TRANSPORT', 'MAT'];
let items = [];

window.addEventListener('DOMContentLoaded', async () => {
  initChart();
  await loadDataFromSheets();
});

// Switch mellan flikar
function switchTab(tabName, btn) {
  document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));

  document.getElementById(`tab-${tabName}`).classList.add('active');
  btn.classList.add('active');
}

/**
 * HÄMTA ALL DATA FRÅN GOOGLE SHEETS
 */
async function loadDataFromSheets() {
  try {
    const response = await fetch(`${API_URL}?sheet=Transaktioner`);
    const data = await response.json();

    if (Array.isArray(data) && data.length > 0) {
      // Filtrera ut objekt och bygg upp kategorier/rader från kalkylarket
      items = data.map((row, idx) => ({
        id: row.ID || `item-${idx}`,
        title: row.Beskrivning || row.Titel || 'Namnlös',
        amount: parseFloat(row.Belopp) || 0,
        cat: (row.Kategori || 'ÖVRIGT').toUpperCase()
      }));

      // Uppdatera kategorilistan dynamiskt utifrån vad som finns i kalkylarket
      const fetchedCats = [...new Set(items.map(i => i.cat))];
      if (fetchedCats.length > 0) {
        categories = fetchedCats;
      }
    }

    renderExpenses();
    renderCategoryDropdown();
    calculateAll();
  } catch (err) {
    console.error('Kunde inte hämta data från Google Sheets:', err);
  }
}

// Rendera utgifter dynamiskt
function renderExpenses() {
  const container = document.getElementById('dynamic-expenses');
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
          <input type="number" id="item-${item.id}" class="num-input exp-input" data-cat="${cat.toLowerCase()}" data-title="${item.title}" value="${item.amount}" oninput="calculateAll()">
        </div>
      `;
    });

    container.innerHTML += catHtml;
  });
}

// Rendera dropdown för inställningar
function renderCategoryDropdown() {
  const select = document.getElementById('select-category');
  if (!select) return;
  select.innerHTML = '';
  categories.forEach(cat => {
    select.innerHTML += `<option value="${cat}">${cat}</option>`;
  });
}

// Lägg till en ny kategori
function addCategory() {
  const nameInput = document.getElementById('new-cat-name');
  const catName = nameInput.value.trim().toUpperCase();

  if (catName && !categories.includes(catName)) {
    categories.push(catName);
    nameInput.value = '';
    renderExpenses();
    renderCategoryDropdown();
    calculateAll();
    alert(`Kategorin "${catName}" har lagts till!`);
  }
}

// Lägg till utgift i vald kategori och spara direkt till Sheets
async function addItemToCategory() {
  const title = document.getElementById('new-item-title').value.trim();
  const cat = document.getElementById('select-category').value;
  const amount = parseFloat(document.getElementById('new-item-amount').value) || 0;

  if (title) {
    const id = title.toLowerCase().replace(/\s+/g, '-');
    const newItem = { id, title, amount, cat };
    items.push(newItem);

    document.getElementById('new-item-title').value = '';
    document.getElementById('new-item-amount').value = '';

    renderExpenses();
    calculateAll();

    // Spara direkt till kalkylarket
    await saveRowToSheets(newItem);
  }
}

function calculateAll() {
  const lonAnton = parseFloat(document.getElementById('lon-anton').value) || 0;
  const lonMona = parseFloat(document.getElementById('lon-mona').value) || 0;
  const gemInkomst1 = parseFloat(document.getElementById('gem-barnbidrag').value) || 0;

  const totalLon = lonAnton + lonMona;
  
  let pctAnton = 0, pctMona = 0;
  if (totalLon > 0) {
    pctAnton = Math.round((lonAnton / totalLon) * 100);
    pctMona = 100 - pctAnton;
  }

  document.getElementById('pct-anton').innerText = pctAnton;
  document.getElementById('pct-mona').innerText = pctMona;

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
    if (elem) elem.innerText = catTotals[cat.toLowerCase()].toLocaleString('sv-SE') + ' kr';
  });

  const nettoUtgifter = Math.max(0, totaltUtgifter - gemInkomst1);
  const betalarAnton = Math.round((nettoUtgifter * pctAnton) / 100);
  const betalarMona = Math.round((nettoUtgifter * pctMona) / 100);

  document.getElementById('totalt-utgifter-text').innerText = `${totaltUtgifter.toLocaleString('sv-SE')} kr totalt`;
  document.getElementById('gem-inkomst-avdrag').innerText = `(-${gemInkomst1.toLocaleString('sv-SE')} kr gem. inkomster)`;
  
  document.getElementById('betalar-anton').innerText = `${betalarAnton.toLocaleString('sv-SE')} kr`;
  document.getElementById('betalar-mona').innerText = `${betalarMona.toLocaleString('sv-SE')} kr`;

  updateChart(catTotals);
}

function initChart() {
  const ctx = document.getElementById('expenseChart').getContext('2d');
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

/**
 * SPARA EN RAD TILL GOOGLE SHEETS
 */
async function saveRowToSheets(item) {
  const payload = {
    sheet: 'Transaktioner',
    Datum: new Date().toISOString().split('T')[0],
    Beskrivning: item.title,
    Kategori: item.cat,
    Belopp: item.amount
  };

  try {
    await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    });
  } catch (err) {
    console.error('Kunde inte spara rad till Sheets:', err);
  }
}

/**
 * SPARA MÅNADSSUMMERING TILL GOOGLE SHEETS
 */
async function saveToSheets() {
  const payload = {
    sheet: 'Transaktioner',
    Datum: new Date().toISOString().split('T')[0],
    Beskrivning: 'Månadsberäkning',
    Kategori: 'RESULTAT',
    Belopp: parseFloat(document.getElementById('totalt-utgifter-text').innerText.replace(/\D/g, ''))
  };

  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    });
    const result = await res.json();
    if (result.status === 'success') {
      alert('Månadens beräkning har sparats till Google Sheets!');
    }
  } catch (err) {
    alert('Kunde inte spara data: ' + err.message);
  }
}
