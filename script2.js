let currentSportConfig = null;

// Sincronizzazione sicura con il client Supabase inizializzato in script.js
const sb = window.supabaseClient || window.sb;

// ==========================================
// INIZIALIZZATORE UNICO (DOMContentLoaded)
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    console.log("Script2 inizializzato. Avvio caricamento controllato dell'evento...");
    await initPage();
});

// ==========================================
// FUNZIONE PRINCIPALE: INIZIALIZZAZIONE PAGINA
// ==========================================
async function initPage() {
    // 1. RECUPERO E STAMPA IMMEDIATA DELL'EVENTO (Senza badare alla società)
    const eventId = sessionStorage.getItem('selectedEventId');
    const eventName = sessionStorage.getItem('selectedEventName');
    
    console.log("ID Evento rilevato:", eventId, "Nome Evento:", eventName);

    if (!eventId) {
        console.warn("Nessun Event ID trovato in sessione! Ritorno alla selezione.");
        window.location.href = "scelta-evento.html";
        return;
    }

    // Forza la scrittura del nome dell'evento su tutti i possibili ID usati nei tuoi HTML
    const idsToUpdate = ['eventNameDisplay', 'nomeGara', 'nomeGaraTitolo'];
    idsToUpdate.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.innerText = eventName ? eventName : "Gara Selezionata";
        }
    });

    // Aggiorna l'eventuale campo nascosto del form se presente
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
    console.log("Sport identificato per questa pagina:", sportId);
    
    // Recupero regole dello sport dal DB (senza bloccare la pagina in caso di errore)
    try {
        const { data: config, error: configErr } = await sb
            .from('configurazioni_sport')
            .select('*')
            .eq('sport_id', sportId)
            .single();
        
        if (!configErr && config) {
            currentSportConfig = config.regole;
            console.log("Regole sport caricate con successo.");
            
            // Se hai funzioni per adattare i menu a tendina delle categorie, le eseguiamo qui
            if (typeof adattaInterfacciaAlloSport === 'function') {
                adattaInterfacciaAlloSport();
            }
        }
    } catch (err) {
        console.warn("Impossibile caricare le regole sport dal DB, procedo con l'interfaccia standard.");
    }

    // Avvia eventuali listener aggiuntivi sulla data di nascita (se usati nel tuo form)
    if (typeof setupBirthdateListeners === 'function') {
        setupBirthdateListeners(); 
    }

    // 3. ISOLAMENTO BLOCCO SOCIETÀ & TABELLE (Contenuto in un try/catch atomico)
    // Se fallisce questa parte, l'evento sopra resta comunque visibile e stampato a schermo!
    try {
        const { data: { user } } = await sb.auth.getUser();
        if (user) {
            const { data: soc, error: socErr } = await sb.from('societa').select('*').eq('user_id', user.id).single();
            if (!socErr && soc) {
                window.currentSocietyId = soc.id;
                console.log("Società agganciata con ID:", soc.id);
                
                // Aggiorna il nome della società nell'interfaccia se il campo esiste
                const displaySoc = document.getElementById('societyNameDisplay') || document.getElementById('nomeSocietaIscritta');
                if (displaySoc) displaySoc.innerText = soc.nome;
            }
        }
        
        // Prova a caricare gli iscritti nelle tabelle
        await fetchAthletes();
        await fetchTeams();

    } catch (err) {
        console.log("Nota: Accesso società saltato o non configurato. Tabelle vuote, ma evento attivo.");
    }
}

// ==========================================
// FUNZIONI COMPLEMENTARI (Evitano errori 'is not defined')
// ==========================================
async function fetchAthletes() {
    const eventId = sessionStorage.getItem('selectedEventId');
    // Cerca i due possibili ID che hai usato nei vari HTML (athleteList o iscrittiGaraList)
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
                    <td class="text-end"><small class="text-muted">Registrato</small></td>
                </tr>`;
        });
    } catch (err) {
        console.error("Errore tabelle atleti:", err.message);
    }
}

async function fetchTeams() {
    const tbody = document.getElementById('teamList');
    if (!tbody) return; // Se la pagina non prevede squadre (es. Judo/Fitarco), esce senza errori
    
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
                    <td class="text-end"><small class="text-muted">Registrata</small></td>
                </tr>`;
        });
    } catch (err) {
        console.error("Errore tabella squadre:", err.message);
    }
}
