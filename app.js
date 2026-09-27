let expenseChart = null;

// Initiera cirkeldiagram och beräkningar
window.addEventListener('DOMContentLoaded', () => {
  initChart();
  calculateAll();
});

function calculateAll() {
  // 1. Hämta Inkomster
  const lonAnton = parseFloat(document.getElementById('lon-anton').value) || 0;
  const lonMona = parseFloat(document.getElementById('lon-mona').value) || 0;
  const gemInkomst1 = parseFloat(document.getElementById('gem-barnbidrag').value) || 0;
  const gemInkomst2 = parseFloat(document.getElementById('gem-amortering').value) || 0;

  const totalLon = lonAnton + lonMona;
  const totalGemInkomst = gemInkomst1 + gemInkomst2;

  // 2. Procentuell fördelning baserat på lön
  let pctAnton = 0;
  let pctMona = 0;
  if (totalLon > 0) {
    pctAnton = Math.round((lonAnton / totalLon) * 100);
    pctMona = 100 - pctAnton;
  }

  document.getElementById('pct-anton').innerText = pctAnton;
  document.getElementById('pct-mona').innerText = pctMona;

  // 3. Beräkna utgifter per kategori
  const expInputs = document.querySelectorAll('.exp-input');
  let totaltUtgifter = 0;
  let catTotals = { hus: 0, transport: 0, mat: 0 };

  expInputs.forEach(input => {
    const val = parseFloat(input.value) || 0;
    const cat = input.dataset.cat;
    totaltUtgifter += val;

    if (catTotals[cat] !== undefined) {
      catTotals[cat] += val;
    }
  });

  // Uppdatera kategori-summor
  document.getElementById('total-hus').innerText = catTotals.hus.toLocaleString('sv-SE') + ' kr';
  document.getElementById('total-transport').innerText = catTotals.transport.toLocaleString('sv-SE') + ' kr';
  document.getElementById('total-mat').innerText = catTotals.mat.toLocaleString('sv-SE') + ' kr';

  // 4. Slutresultat & Fördelning
  const nettoUtgifter = Math.max(0, totaltUtgifter - totalGemInkomst);

  const betalarAnton = Math.round((nettoUtgifter * pctAnton) / 100);
  const betalarMona = Math.round((nettoUtgifter * pctMona) / 100);

  document.getElementById('totalt-utgifter-text').innerText = `${totaltUtgifter.toLocaleString('sv-SE')} kr totalt`;
  document.getElementById('gem-inkomst-avdrag').innerText = `(-${totalGemInkomst.toLocaleString('sv-SE')} kr gem. inkomster)`;
  
  document.getElementById('betalar-anton').innerText = `${betalarAnton.toLocaleString('sv-SE')} kr`;
  document.getElementById('betalar-mona').innerText = `${betalarMona.toLocaleString('sv-SE')} kr`;

  // 5. Uppdatera Cirkeldiagrammet
  updateChart(catTotals);
}

function initChart() {
  const ctx = document.getElementById('expenseChart').getContext('2d');
  expenseChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Hus', 'Transport', 'Mat'],
      datasets: [{
        data: [0, 0, 0],
        backgroundColor: ['#3498db', '#e67e22', '#2ecc71'],
        borderWidth: 2
      }]
    },
    options: {
      cutout: '65%',
      plugins: {
        legend: {
          position: 'right',
          labels: { boxWidth: 12, font: { size: 11 } }
        }
      }
    }
  });
}

function updateChart(totals) {
  if (expenseChart) {
    expenseChart.data.datasets[0].data = [totals.hus, totals.transport, totals.mat];
    expenseChart.update();
  }
}

// Koppling till ditt Google Apps Script backend
async function saveToSheets() {
  const API_URL = 'DINA_APPS_SCRIPT_URL_HÄR'; // Ersätt med din URL

  const payload = {
    sheet: 'Transaktioner',
    Datum: new Date().toISOString().split('T')[0],
    Beskrivning: 'Månadsberäkning',
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
