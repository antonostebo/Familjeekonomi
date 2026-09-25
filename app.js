// 1. Ersätt med din URL från Google Apps Script (Deploy > Web app URL)
const API_URL = 'https://script.google.com/macros/s/AKfycbzWIiWXONz7sxWpCJW7IMiWFi8MHmqBELqi6RbGUVY-MiFwDF6b_-aHJFozAtdXGpjp/exec';

/**
 * Hämta data från kalkylarket (doGet)
 */
async function fetchTransactions(sheetName = 'Transaktioner') {
  try {
    const response = await fetch(`${API_URL}?sheet=${encodeURIComponent(sheetName)}`);
    
    if (!response.ok) {
      throw new Error(`HTTP-fel! Status: ${response.status}`);
    }

    const data = await response.json();
    console.log('Hämtad data från Google Sheets:', data);
    return data;
  } catch (error) {
    console.error('Kunde inte hämta data:', error);
  }
}

/**
 * Spara ny rad till kalkylarket (doPost)
 */
async function addTransaction(transactionData) {
  try {
    // text/plain används för att undvika CORS-preflight (OPTIONS)
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(transactionData),
    });

    const result = await response.json();
    console.log('Svar från Google Apps Script:', result);
    return result;
  } catch (error) {
    console.error('Kunde inte spara data:', error);
  }
}

// Körs automatiskt när app.js laddas för att testa anslutningen
fetchTransactions();
