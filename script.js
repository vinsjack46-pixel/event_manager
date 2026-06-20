// ==========================================
// 1. CONFIGURAZIONI GLOBALI E CONNESSIONE
// ==========================================
const { createClient } = window.supabase;
const supabaseUrl = 'https://nhsvadkqagsqgirvoibg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5oc3ZhZGtxYWdzcWdpcnZvaWJnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5NzQ1MjQsImV4cCI6MjA4NzU1MDUyNH0.v0PPOfmX1p_sHkV2ZwzaH8gxr7VwN9MMRB1AclEOhvQ';

// Inizializzazione sicura del client unico
if (!window.supabaseClient) {
    window.supabaseClient = createClient(supabaseUrl, supabaseKey);
}
const sb = window.supabaseClient;
window.sb = sb; // Esposizione globale di sicurezza

// Variabili di stato dell'applicazione
if (typeof window.currentSportConfig === 'undefined') { window.currentSportConfig = null; }
if (typeof window.currentSocietyId === 'undefined') { window.currentSocietyId = null; }

// ==========================================
// 2. GESTIONE AUTENTICAZIONE (Login / Register / Logout)
// ==========================================
async function signIn(email, password) {
    try {
        const { data, error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw error;
        window.location.href = 'scelta-evento.html'; 
    } catch (error) {
        alert('Credenziali non valide: ' + error.message);
    }
}

async function signUp(email, password, nomeSocieta, cfs, cell) {
    try {
        const { data, error } = await sb.auth.signUp({ email, password });
        if (error) throw error;

        if (data.user) {
            const { error: societaError } = await sb.from('societa').insert([{ 
                nome: nomeSocieta, 
                email: email, 
                cfs: cfs, 
                cell: cell,
                user_id: data.user.id 
            }]);
            if (societaError) throw societaError;
        }
        alert('Registrazione completata! Controlla la tua email per confermare.');
        window.location.href = 'login.html';
    } catch (error) {
        alert("Errore registrazione: " + error.message);
    }
}

async function logout() {
    try {
        await sb.auth.signOut();
        window.location.href = "login.html";
    } catch (error) {
        console.error("Errore logout:", error.message);
    }
}

// ==========================================
// 3. LOGICA DI SMISTAMENTO E FILTRI (scelta-evento.html)
// ==========================================
async function caricaEventiScelta() {
    const listaContenitore = document.getElementById('eventListContainer') || document.getElementById('listaGare');
    if (!listaContenitore) return; 

    try {
        const { data: eventi, error } = await sb
            .from('eventi')
            .select('*')
            .eq('attivo', true)
            .order('data_evento', { ascending: false });
        if (error) throw error;

        if (!eventi || eventi.length === 0) {
            listaContenitore.innerHTML = '<div class="alert alert-info text-center py-4">Nessuna competizione in programma.</div>';
            return;
        }

        listaContenitore.innerHTML = "";
        eventi.forEach(e => {
            const sportId = e.sport_id ? e.sport_id.toLowerCase() : 'karate';
            let destinazioneHtml = 'index-karate.html'; 
            if (sportId === 'judo') destinazioneHtml = 'index-judo.html';
            if (sportId === 'fitarco') destinazioneHtml = 'index-fitarco.html';

            listaContenitore.innerHTML += `
                <div class="event-item" style="cursor:pointer;" onclick="selezionaGaraEInvia('${e.id}', '${destinazioneHtml}', '${sportId}', '${e.nome.replace(/'/g, "\\'")}')">
                    <div class="p-3 border rounded mb-2 bg-white shadow-sm d-flex justify-content-between align-items-center">
                        <div>
                            <h5 class="mb-1">${e.nome}</h5>
                            <small class="text-muted">${e.data_evento} • ${e.luogo || 'Sede da definire'}</small>
                            <span class="badge bg-secondary text-uppercase ms-2">${sportId}</span>
                        </div>
                        <i class="fas fa-chevron-right text-muted"></i>
                    </div>
                </div>`;
        });
    } catch (err) {
        listaContenitore.innerHTML = '<div class="alert alert-danger text-center">Errore nel caricamento degli eventi.</div>';
    }
}

window.selezionaGaraEInvia = function(idGara, paginaTarget, sportId, nomeGara) {
    sessionStorage.setItem('selectedEventId', idGara);
    sessionStorage.setItem('selectedSportId', sportId);
    sessionStorage.setItem('selectedEventName', nomeGara);
    window.location.href = paginaTarget;
};

// ==========================================
// 4. LOGICA DASHBOARD COMPETIZIONE (Ex Script2)
// ==========================================
async function inizializzaDashboardGara() {
    // A. CARICAMENTO IMMEDIATO DATI GARA DA SESSIONSTORAGE
    const eventId = sessionStorage.getItem('selectedEventId');
    const eventName = sessionStorage.getItem('selectedEventName');
    
    if (!eventId) {
        console.warn("Nessun evento selezionato. Reindirizzo.");
        window.location.href = "scelta-evento.html";
        return;
    }

    // Mostra il nome dell'evento ovunque sia richiesto nell'HTML
    ['eventNameDisplay', 'nomeGara', 'nomeGaraTitolo'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerText = eventName || "Gara Selezionata";
    });

    // B. IDENTIFICAZIONE DISCIPLINA SPORTIVA
    let sportId = "karate";
    const pathname = window.location.pathname.toLowerCase();
    if (pathname.includes("judo")) sportId = "judo";
    else if (pathname.includes("fitarco")) sportId = "fitarco";
    else sportId = sessionStorage.getItem('selectedSportId') || "karate";
    
    sessionStorage.setItem('selectedSportId', sportId);

    // Recupero configurazioni regole sport
    try {
        const { data: config } = await sb.from('configurazioni_sport').select('*').eq('sport_id', sportId).single();
        if (config) {
            window.currentSportConfig = config.regole;
            if (typeof adattaInterfacciaAlloSport === 'function') adattaInterfacciaAlloSport();
        }
    } catch (e) { console.warn("Regole sport non trovate nel database."); }

    // C. COLLEGAMENTO SOCIETA SPORTIVA AUTENTICATA
    try {
        const { data: { user } } = await sb.auth.getUser();
        if (user) {
            const { data: soc } = await sb.from('societa').select('*').eq('user_id', user.id).single();
            if (soc) {
                window.currentSocietyId = soc.id;
                
                // Aggiorna interfaccia con il nome della società
                const displaySoc = document.getElementById('societyNameDisplay') || document.getElementById('nomeSocietaIscritta');
                if (displaySoc) displaySoc.innerText = soc.nome;
            } else {
                mostraErroreSocieta("Profilo società mancante.");
            }
        } else {
            mostraErroreSocieta("Sessione utente non attiva.");
        }
    } catch (err) {
        mostraErroreSocieta("Errore verifica account.");
    }

    // D. AGGIORNAMENTO TABELLE DATI
    await scaricaListaAtletiIscritti(eventId);
    await scaricaListaSquadreIscritte(eventId);
}

function mostraErroreSocieta(testo) {
    const el = document.getElementById('societyNameDisplay') || document.getElementById('nomeSocietaIscritta');
    if (el) el.innerHTML = `<span class="text-danger"><i class="fas fa-times-circle"></i> ${testo}</span>`;
}

// ==========================================
// 5. RECUPERO TABELLE PARTECIPANTI
// ==========================================
async function scaricaListaAtletiIscritti(eventId) {
    const tbody = document.getElementById('athleteList') || document.getElementById('iscrittiGaraList');
    if (!tbody) return;

    try {
        const { data, error } = await sb.from('atleti').select('*').eq('event_id', eventId).order('created_at', { ascending: false });
        if (error) throw error;

        if (!data || data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="10" class="text-center text-muted py-3">Nessun partecipante iscritto.</td></tr>`;
            return;
        }

        tbody.innerHTML = "";
        data.forEach(a => {
            tbody.innerHTML += `
                <tr>
                    <td><strong>${a.last_name} ${a.first_name}</strong></td>
                    <td>${a.classe || '-'}</td>
                    <td><span class="badge bg-light text-dark border">${a.gender || '-'}</span></td>
                    <td>${a.specialty || a.divisione || '-'}</td>
                    <td>${a.belt || a.grado || '-'}</td>
                    <td><span class="badge bg-secondary">${a.weight_category || 'Open'}</span></td>
                </tr>`;
        });
    } catch (err) { console.error("Errore render tabella atleti:", err); }
}

async function scaricaListaSquadreIscritte(eventId) {
    const tbody = document.getElementById('teamList');
    if (!tbody) return;

    try {
        const { data, error } = await sb.from('squadre').select('*').eq('event_id', eventId);
        if (error) throw error;

        if (!data || data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted py-3">Nessuna squadra presente.</td></tr>`;
            return;
        }

        tbody.innerHTML = "";
        data.forEach(t => {
            tbody.innerHTML += `
                <tr>
                    <td><strong>${t.nome_squadra}</strong></td>
                    <td>${t.classe || '-'}</td>
                    <td>${t.gender || '-'}</td>
                    <td>${t.specialty || '-'}</td>
                    <td>${t.belt || '-'}</td>
                    <td>${t.peso || '-'}</td>
                </tr>`;
        });
    } catch (err) { console.error("Errore render tabella squadre:", err); }
}

// ==========================================
// 6. DISPATCHER E INIZIALIZZATORE DI PAGINA
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    const pathname = window.location.pathname.toLowerCase();

    // Gestione reindirizzamento Home ciclico fallimentare
    if (pathname === '/' || pathname === '/index.html' || pathname.endsWith('/')) {
        try {
            const { data: { session } } = await sb.auth.getSession();
            window.location.href = session ? 'scelta-evento.html' : 'login.html';
        } catch (e) { window.location.href = 'login.html'; }
        return;
    }

    // Setup listener modulo Login
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            signIn(document.getElementById('email').value, document.getElementById('password').value);
        });
    }

    // Setup listener modulo Registrazione
    const regForm = document.getElementById('registrazioneForm');
    if (regForm) {
        regForm.addEventListener('submit', (e) => {
            e.preventDefault();
            if (document.getElementById('email').value !== document.getElementById('emailConfirm').value) return alert("Le email non coincidono.");
            if (document.getElementById('password').value !== document.getElementById('passwordConfirm').value) return alert("Le password non coincidono.");
            signUp(document.getElementById('email').value, document.getElementById('password').value, document.getElementById('nomeSocieta').value, document.getElementById('cfs').value, document.getElementById('cell').value);
        });
    }

    // Se si trova in scelta-evento.html caricherà la lista competizioni
    if (document.getElementById('eventListContainer') || document.getElementById('listaGare')) {
        await caricaEventiScelta();
        return;
    }

    // Se si trova in index-judo, index-karate o index-fitarco esegue l'aggancio completo
    if (document.getElementById('athleteList') || document.getElementById('iscrittiGaraList') || document.getElementById('registrationForm')) {
        await inizializzaDashboardGara();
    }
});
