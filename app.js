// Comma-separated API URL från Google Apps Script (Deployment Web App URL)
const API_URL = 'https://script.google.com/macros/s/AKfycbzWIiWXONz7sxWpCJW7IMiWFi8MHmqBELqi6RbGUVY-MiFwDF6b_-aHJFozAtdXGpjp/exec'; 

// Sätt dagens datum som standard i formuläret
document.getElementById('datum').value = new Date().toISOString().split('T')[0];

/**
 * 1. Hämta alla transaktioner och rita upp tabellen
 */
async function loadTransactions() {
  const statusMsg = document.getElementById('status-message');
  const table = document.getElementById('transactions-table');
  const tbody = document.getElementById('table-body');

  try {
    statusMsg.innerText = 'Hämtar data...';
    statusMsg.style.display = 'block';

    const response = await fetch(`${API_URL}?sheet=Transaktioner`);
    const data = await response.json();

    if (!Array.isArray(data) || data.length === 0) {
      statusMsg.innerText = 'Inga transaktioner hittades.';
      table.style.display = 'none';
      return;
    }

    // Töm tabellen innan ny data läggs till
    tbody.innerHTML = '';

    // Sortera transaktionerna så att de nyaste visas överst
    data.reverse().forEach(item => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${item.Datum || '-'}</td>
        <td>${item.Beskrivning || '-'}</td>
        <td>${item.Kategori || '-'}</td>
        <td><strong>${item.Belopp ? item.Belopp + ' kr' : '-'}</strong></td>
      `;
      tbody.appendChild(row);
    });

    statusMsg.style.display = 'none';
    table.style.display = 'table';
  } catch (error) {
    console.error('Fel vid hämtning:', error);
    statusMsg.innerText = 'Kunde inte hämta data. Kontrollera skript-URL:en.';
  }
}

/**
 * 2. Hantera när användaren skickar in formuläret
 */
document.getElementById('transaction-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const submitBtn = document.getElementById('submit-btn');
  submitBtn.disabled = true;
  submitBtn.innerText = 'Sparar...';

  const newTransaction = {
    sheet: 'Transaktioner',
    Datum: document.getElementById('datum').value,
    Beskrivning: document.getElementById('beskrivning').value,
    Kategori: document.getElementById('kategori').value,
    Belopp: parseFloat(document.getElementById('belopp').value)
  };

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(newTransaction),
    });

    const result = await response.json();

    if (result.status === 'success') {
      // Återställ formuläret men behåll dagens datum
      document.getElementById('beskrivning').value = '';
      document.getElementById('belopp').value = '';
      document.getElementById('datum').value = new Date().toISOString().split('T')[0];

      // Ladda om tabellen direkt så den nya raden syns
      await loadTransactions();
    } else {
      alert('Ett fel uppstod: ' + result.message);
    }
  } catch (error) {
    console.error('Fel vid sparande:', error);
    alert('Kunde inte spara transaktionen.');
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerText = 'Spara';
  }
});

// Ladda alla transaktioner direkt när sidan öppnas
loadTransactions();
