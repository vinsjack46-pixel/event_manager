// ==========================================
// CONFIGURAZIONI GLOBALI
// ==========================================
let currentSportConfig = null;

// Sincronizzazione sicura con il client Supabase inizializzato in script.js
const sb = window.supabaseClient || window.sb;

// ==========================================
// INIZIALIZZATORE UNICO (DOMContentLoaded)
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    console.log("Script2 inizializzato. Avvio caricamento controllato di evento e società...");
    await initPage();
});

// ==========================================
// FUNZIONE PRINCIPALE: INIZIALIZZAZIONE PAGINA
// ==========================================
async function initPage() {
    // 1. RECUPERO E STAMPA IMMEDIATA DELL'EVENTO
    const eventId = sessionStorage.getItem('selectedEventId');
    const eventName = sessionStorage.getItem('selectedEventName');
    
    if (!eventId) {
        console.warn("Nessun Event ID trovato in sessione! Ritorno alla selezione.");
        window.location.href = "scelta-evento.html";
        return;
    }

    // Aggiorna i campi del nome della gara nell'interfaccia
    const idsToUpdate = ['eventNameDisplay', 'nomeGara', 'nomeGaraTitolo'];
    idsToUpdate.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerText = eventName ? eventName : "Gara Selezionata";
    });

    if (document.getElementById('selectedEventId')) {
        document.getElementById('selectedEventId').value = eventId;
    }

    // 2. GESTIONE E IDENTIFICAZIONE DELLO SPORT (Fitarco / Judo / Karate)
    let sportId = null;
    const pathname = window.location.pathname.toLowerCase();
    
    if (pathname.includes("judo")) sportId = "judo";
    else if (pathname.includes("fitarco")) sportId = "fitarco";
    else if (pathname.includes("karate")) sportId = "karate";
    else sportId = sessionStorage.getItem('selectedSportId') || "karate";
    
    sportId = sportId.toLowerCase();
    sessionStorage.setItem('selectedSportId', sportId);
    
    try {
        const { data: config, error: configErr } = await sb
            .from('configurazioni_sport')
            .select('*')
            .eq('sport_id', sportId)
            .single();
        
        if (!configErr && config) {
            currentSportConfig = config.regole;
            if (typeof adattaInterfacciaAlloSport === 'function') {
                adattaInterfacciaAlloSport();
            }
        }
    } catch (err) {
        console.warn("Impossibile caricare le regole sport dal DB, procedo con l'interfaccia standard.");
    }

    if (typeof setupBirthdateListeners === 'function') {
        setupBirthdateListeners(); 
    }

    // 3. RECUPERO E INTEGRAZIONE DELLA SOCIETÀ SPORTIVA
    try {
        // Recupera l'utente correntemente autenticato su Supabase Auth
        const { data: { user }, error: authErr } = await sb.auth.getUser();
        
        if (authErr || !user) {
            console.warn("Nessun utente autenticato trovato.");
            gestisciSocietaNonTrovata("Sessione non attiva. Effettua il login.");
            return;
        }

        console.log("Utente autenticato rilevato. ID Auth:", user.id);

        // Cerca la riga corrispondente nella tabella 'societa' usando lo user_id
        const { data: soc, error: socErr } = await sb
            .from('societa')
            .select('*')
            .eq('user_id', user.id)
            .single();

        if (socErr || !soc) {
            console.error("Società non trovata nel database per questo utente:", socErr);
            gestisciSocietaNonTrovata("Profilo società incompleto o non configurato.");
            window.currentSocietyId = null;
        } else {
            // Associa l'ID della società a livello globale per l'invio dei moduli successivi
            window.currentSocietyId = soc.id;
            console.log("Società agganciata correttamente:", soc.nome, "(ID:", soc.id, ")");
            
            // Stampa il nome della società sugli elementi HTML predisposti
            const displaySoc = document.getElementById('societyNameDisplay') || document.getElementById('nomeSocietaIscritta');
            if (displaySoc) {
                displaySoc.innerText = soc.nome;
            }
        }

    } catch (err) {
        console.error("Errore critico durante il recupero della società:", err);
        gestisciSocietaNonTrovata("Errore di connessione ai dati societari.");
    }

    // 4. CARICAMENTO DELLE TABELLE DEI PARTECIPANTI
    await fetchAthletes();
    await fetchTeams();
}

// Funzione di supporto in caso di problemi con la società
function gestisciSocietaNonTrovata(messaggio) {
    const displaySoc = document.getElementById('societyNameDisplay') || document.getElementById('nomeSocietaIscritta');
    if (displaySoc) {
        displaySoc.innerHTML = `<span class="text-danger" style="font-size: 0.9rem;"><i class="fas fa-exclamation-triangle"></i> ${messaggio}</span>`;
    }
}

// ==========================================
// FUNZIONI DI RECUPERO TABELLE ATLETI E SQUADRE
// ==========================================
async function fetchAthletes() {
    const eventId = sessionStorage.getItem('selectedEventId');
    const tbody = document.getElementById('athleteList') || document.getElementById('iscrittiGaraList');
    if (!tbody) return;

    try {
        const { data, error } = await sb
            .from('atleti')
            .select('*')
            .eq('event_id', eventId)
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (!data || data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="10" class="text-center text-muted py-3">Nessun atleta iscritto a questa gara.</td></tr>`;
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
    } catch (err) {
        console.error("Errore tabelle atleti:", err.message);
    }
}

async function fetchTeams() {
    const tbody = document.getElementById('teamList');
    if (!tbody) return; 
    
    const eventId = sessionStorage.getItem('selectedEventId');
    try {
        const { data, error } = await sb
            .from('squadre')
            .select('*')
            .eq('event_id', eventId);

        if (error) throw error;

        if (!data || data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted py-3">Nessuna squadra iscritta.</td></tr>`;
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
    } catch (err) {
        console.error("Errore tabella squadre:", err.message);
    }
}
