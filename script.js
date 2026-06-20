// ==========================================
// SCRIPT.JS - MOTORE BASE, JUDO E FITARCO
// ==========================================
const { createClient } = window.supabase;
const supabaseUrl = 'https://nhsvadkqagsqgirvoibg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5oc3ZhZGtxYWdzcWdpcnZvaWJnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5NzQ1MjQsImV4cCI6MjA4NzU1MDUyNH0.v0PPOfmX1p_sHkV2ZwzaH8gxr7VwN9MMRB1AclEOhvQ';

const sb = createClient(supabaseUrl, supabaseKey);
window.sb = sb;

let idGaraCorrente = null;
let idSocietaCorrente = null;
let configurazioneSportCorrente = null;

// --- AUTH ---
async function signIn(email, password) {
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) alert('Credenziali non valide.');
    else window.location.href = 'scelta-evento.html';
}

async function signUp(email, password, nomeSocieta, cfs, cell) {
    const { data, error } = await sb.auth.signUp({ email, password });
    if (error) return alert("Errore: " + error.message);
    if (data.user) {
        await sb.from('societa').insert([{ nome: nomeSocieta, email: email, cfs: cfs, cell: cell, user_id: data.user.id }]);
    }
    alert('Registrazione completata! Controlla la tua email.');
    window.location.href = 'login.html';
}

window.logout = async function() {
    await sb.auth.signOut();
    window.location.href = "login.html";
};

// --- SCELTA EVENTO ---
async function caricaEventiScelta() {
    console.log("Caricamento eventi per la pagina di scelta...");
    const container = document.getElementById('eventListContainer') || document.getElementById('listaGare');
    if (!container) return;

    const { data: eventi, error } = await sb.from('eventi').select('*').eq('attivo', true).order('data_evento', { ascending: false });
    if (error || !eventi.length) {
        container.innerHTML = '<div class="alert alert-info text-center py-4">Nessuna competizione in programma.</div>';
        return;
    }

    container.innerHTML = "";
    eventi.forEach(e => {
        const sportId = e.sport_id ? e.sport_id.toLowerCase() : 'judo';
        let htmlDest = 'index-karate.html';
        if (sportId === 'judo') htmlDest = 'index-judo.html';
        if (sportId === 'fitarco') htmlDest = 'index-fitarco.html';

        container.innerHTML += `
            <div class="event-item p-3 border rounded mb-2 bg-white shadow-sm" style="cursor:pointer;" 
                 onclick="selezionaGara('${e.id}', '${htmlDest}', '${sportId}', '${e.nome.replace(/'/g, "\\'")}')">
                <h5 class="mb-1">${e.nome}</h5>
                <small class="text-muted">${e.data_evento} • ${e.luogo || ''}</small>
                <span class="badge bg-secondary ms-2 text-uppercase">${sportId}</span>
            </div>`;
    });
}

window.selezionaGara = function(id, htmlDest, sportId, nome) {
    sessionStorage.setItem('selectedEventId', id);
    sessionStorage.setItem('selectedSportId', sportId);
    sessionStorage.setItem('selectedEventName', nome);
    window.location.href = htmlDest;
};

// --- LOGICA DASHBOARD (Judo/Fitarco) ---
async function initDashboardSemplice() {
    console.log("Inizializzazione Dashboard Judo/Fitarco avviata...");

    idGaraCorrente = sessionStorage.getItem('selectedEventId');
    const nomeGara = sessionStorage.getItem('selectedEventName');
    const sportId = sessionStorage.getItem('selectedSportId') || 'judo';

    console.log("Dati Sessione -> ID Gara:", idGaraCorrente, "| Nome:", nomeGara, "| Sport:", sportId);

    if (!idGaraCorrente) {
        console.warn("Nessuna gara in sessione, torno alla selezione eventi.");
        return window.location.href = "scelta-evento.html";
    }

    // 1. CARICAMENTO NOME EVENTO
    const titleEl = document.getElementById('nomeGaraTitolo');
    const displayEl = document.getElementById('eventNameDisplay');
    
    if (titleEl) titleEl.innerText = nomeGara;
    if (displayEl) displayEl.innerText = nomeGara;

    // (Il resto del codice rimane silente per ora, lo testeremo al prossimo passaggio)
}

// --- DISPATCHER AUTOMATICO DELLE PAGINE ---
document.addEventListener('DOMContentLoaded', () => {
    const path = window.location.pathname.toLowerCase();
    console.log("Script.js ha rilevato il percorso:", path);
    
    if (path.includes("login") || path.includes("registrazione")) {
        document.getElementById('loginForm')?.addEventListener('submit', (e) => { e.preventDefault(); signIn(document.getElementById('email').value, document.getElementById('password').value); });
        document.getElementById('registrazioneForm')?.addEventListener('submit', (e) => { e.preventDefault(); signUp(document.getElementById('email').value, document.getElementById('password').value, document.getElementById('nomeSocieta').value, document.getElementById('cfs').value, document.getElementById('cell').value); });
    } else if (path.includes("scelta-evento")) {
        caricaEventiScelta();
    } else if (path.includes("judo") || path.includes("fitarco")) {
        // Avvia la dashboard forzatamente se siamo in una di queste due pagine
        initDashboardSemplice();
    }
});
