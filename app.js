// Klistra in din Web App URL från Google Apps Script här:
const API_URL = "https://script.google.com/macros/s/AKfycbzBsEowRWX-SkqXnP_DlP113HMGwQRbk22YR1pa-LfG70OB0p4Fg-bNm5559Yup3HuB/exec";

const form = document.getElementById('transaktionForm');
const lista = document.getElementById('transaktionsLista');
const submitBtn = document.getElementById('submitBtn');

// Hämta och visa alla transaktioner
async function hamtaTransaktioner() {
  try {
    const response = await fetch(`${API_URL}?sheet=Transaktioner`);
    const data = await response.json();
    
    lista.innerHTML = "";
    if (data.length === 0) {
      lista.innerHTML = "<li>Inga utgifter registrerade än.</li>";
      return;
    }

    // Visa transaktionerna i omvänd ordning (senaste först)
    data.reverse().forEach(t => {
      const li = document.createElement('li');
      li.innerHTML = `
        <span><strong>${t.Beskrivning || 'Utan namn'}</strong> (${t.Kategori}) - <em>${t.RegistreradAv || ''}</em></span>
        <span><strong>${t.Belopp} kr</strong></span>
      `;
      lista.appendChild(li);
    });
  } catch (err) {
    lista.innerHTML = "<li>Kunde inte hämta data från kalkylarket.</li>";
    console.error(err);
  }
}

// Skicka ny utgift till Google Sheets
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  submitBtn.disabled = true;
  submitBtn.innerText = "Sparar...";

  const nyUtgift = {
    sheet: 'Transaktioner',
    Beskrivning: document.getElementById('beskrivning').value,
    Belopp: parseFloat(document.getElementById('belopp').value),
    Kategori: document.getElementById('kategori').value,
    RegistreradAv: document.getElementById('registreradAv').value,
    Datum: new Date().toISOString().split('T')[0]
  };

  try {
    await fetch(API_URL, {
      method: 'POST',
      body: JSON.stringify(nyUtgift)
    });

    form.reset();
    await hamtaTransaktioner(); // Uppdatera listan när det sparas
  } catch (err) {
    alert("Något gick fel när utgiften skulle sparas.");
    console.error(err);
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerText = "Spara utgift";
  }
});

// Ladda data när sidan startar
hamtaTransaktioner();
