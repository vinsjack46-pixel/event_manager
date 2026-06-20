// ==========================================
// CONFIGURAZIONI GLOBALI (Evita conflitti)
// ==========================================
if (typeof window.currentSportConfig === 'undefined') {
    window.currentSportConfig = null;
}

// ==========================================
// INIZIALIZZATORE CON CONTROLLO DI TIMING
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    console.log("Script2 pronto. Verifico la presenza di Supabase...");
    
    // Funzione ricorsiva che controlla ogni 100ms se script.js ha inizializzato Supabase
    const checkSupabase = setInterval(async () => {
        const sb = window.supabaseClient || window.sb || window.supabase;
        
        if (sb) {
            clearInterval(checkSupabase); // Supabase è pronto! Fermiamo il timer
            console.log("Supabase rilevato con successo! Avvio initPage...");
            await initPage(sb);
        } else {
            console.log("In attesa che script.js inizializzi Supabase...");
        }
    }, 100); // Controlla ogni 100 millisecondi
});

// ==========================================
// FUNZIONE PRINCIPALE: INIZIALIZZAZIONE PAGINA
// ==========================================
async function initPage(sb) {
    // 1. RECUPERO E STAMPA IMMEDIATA DELL'EVENTO
    const eventId = sessionStorage.getItem('selectedEventId');
    const eventName = sessionStorage.getItem('selectedEventName');
    
    if (!eventId) {
        console.warn("Nessun Event ID trovato in sessione! Ritorno alla selezione.");
        window.location.href = "scelta-evento.html";
        return;
    }

    // Aggiorna l'interfaccia con il nome della gara
    const idsToUpdate = ['eventNameDisplay', 'nomeGara', 'nomeGaraTitolo'];
    idsToUpdate.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerText = eventName ? eventName : "Gara Selezionata";
    });

    if (document.getElementById('selectedEventId')) {
        document.getElementById('selectedEventId').value = eventId;
    }

    // 2. GESTIONE E IDENTIFICAZIONE DELLO SPORT
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
            window.currentSportConfig = config.regole;
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
        const { data: { user }, error: authErr } = await sb.auth.getUser();
        
        if (authErr || !user) {
            console.warn("Nessun utente autenticato trovato.");
            gestisciSocietaNonTrovata("Sessione scaduta. Effettua nuovamente il login.");
        } else {
            const { data: soc, error: socErr } = await sb
                .from('societa')
                .select('*')
                .eq('user_id', user.id)
                .single();

            if (socErr || !soc) {
                console.error("Società non trovata nel database per questo utente:", socErr);
                gestisciSocietaNonTrovata("Profilo società non configurato.");
                window.currentSocietyId = null;
            } else {
                window.currentSocietyId = soc.id;
                
                const displaySoc = document.getElementById('societyNameDisplay') || document.getElementById('nomeSocietaIscritta');
                if (displaySoc) {
                    displaySoc.innerText = soc.nome;
                }
            }
        }

    } catch (err) {
        console.error("Errore nel blocco società:", err);
        gestisciSocietaNonTrovata("Errore caricamento dati societari.");
    }

    // 4. CARICAMENTO DELLE TABELLE DEI PARTECIPANTI
    await fetchAthletes(sb);
    await fetchTeams(sb);
}

function gestisciSocietaNonTrovata(messaggio) {
    const displaySoc = document.getElementById('societyNameDisplay') || document.getElementById('nomeSocietaIscritta');
    if (displaySoc) {
        displaySoc.innerHTML = `<span class="text-danger" style="font-size: 0.9rem;"><i class="fas fa-exclamation-triangle"></i> ${messaggio}</span>`;
    }
}

// ==========================================
// FUNZIONI DI RECUPERO TABELLE ATLETI E SQUADRE
// ==========================================
async function fetchAthletes(sb) {
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

async function fetchTeams(sb) {
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
