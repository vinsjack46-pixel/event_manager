// ==========================================
// 1. CONFIGURAZIONI GLOBALI E CONNESSIONE
// ==========================================
const { createClient } = window.supabase;
const supabaseUrl = 'https://nhsvadkqagsqgirvoibg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5oc3ZhZGtxYWdzcWdpcnZvaWJnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5NzQ1MjQsImV4cCI6MjA4NzU1MDUyNH0.v0PPOfmX1p_sHkV2ZwzaH8gxr7VwN9MMRB1AclEOhvQ';

if (!window.supabaseClient) {
    window.supabaseClient = createClient(supabaseUrl, supabaseKey);
}
const sb = window.supabaseClient;
window.sb = sb;

window.currentSportConfig = null;
window.currentSocietyId = null;

// ==========================================
// 2. GESTIONE AUTENTICAZIONE
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
        alert('Registrazione completata! Controlla la tua email.');
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
// 3. LOGICA DI SELEZIONE EVENTI (scelta-evento.html)
// ==========================================
async function caricaEventiScelta() {
    const listaContenitore = document.getElementById('eventListContainer') || document.getElementById('listaGare');
    if (!listaContenitore) return; 

    try {
        const { data: eventi, error } = await sb.from('eventi').select('*').eq('attivo', true).order('data_evento', { ascending: false });
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
        listaContenitore.innerHTML = '<div class="alert alert-danger text-center">Errore nel caricamento delle competizioni.</div>';
    }
}

window.selezionaGaraEInvia = function(idGara, paginaTarget, sportId, nomeGara) {
    sessionStorage.setItem('selectedEventId', idGara);
    sessionStorage.setItem('selectedSportId', sportId);
    sessionStorage.setItem('selectedEventName', nomeGara);
    window.location.href = paginaTarget;
};

// ==========================================
// 4. LOGICA DASHBOARD DI GARA (Multisport)
// ==========================================
async function inizializzaDashboardGara() {
    const eventId = sessionStorage.getItem('selectedEventId');
    const eventName = sessionStorage.getItem('selectedEventName');
    
    if (!eventId) {
        console.warn("Nessun evento selezionato. Reindirizzo.");
        window.location.href = "scelta-evento.html";
        return;
    }

    // Scrittura immediata nome gara
    ['eventNameDisplay', 'nomeGara', 'nomeGaraTitolo'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerText = eventName || "Gara Selezionata";
    });

    // Identificazione dello Sport
    let sportId = "karate";
    const pathname = window.location.pathname.toLowerCase();
    if (pathname.includes("judo")) sportId = "judo";
    else if (pathname.includes("fitarco")) sportId = "fitarco";
    else sportId = sessionStorage.getItem('selectedSportId') || "karate";
    
    sessionStorage.setItem('selectedSportId', sportId);

    // RECUPERO SOCIETÀ SPORTIVA AUTENTICATA
    try {
        const { data: { user }, error: authErr } = await sb.auth.getUser();
        if (authErr || !user) {
            mostraErroreSocieta("Sessione non attiva. Fai il login.");
        } else {
            const { data: soc, error: socErr } = await sb.from('societa').select('*').eq('user_id', user.id).single();
            if (!socErr && soc) {
                window.currentSocietyId = soc.id;
                ['societyNameDisplay', 'nomeSocietaIscritta', 'nomeSocietaHeader'].forEach(id => {
                    const el = document.getElementById(id);
                    if (el) el.innerText = soc.nome;
                });
            } else {
                mostraErroreSocieta("Profilo società non trovato.");
                console.error("Dettaglio errore società:", socErr);
            }
        }
    } catch (err) {
        mostraErroreSocieta("Errore profilo societario.");
    }

    // Caricamento sicuro regole sport dal DB (senza crashare se la tabella manca)
    try {
        const { data: config, error: configErr } = await sb.from('configurazioni_sport').select('*').eq('sport_id', sportId).single();
        if (!configErr && config && config.regole) {
            window.currentSportConfig = config.regole;
            adattaInterfacciaAlloSport();
        }
    } catch (e) { console.warn("Tabella configurazioni_sport non accessibile."); }

    setupBirthdateListeners();
    setupFormSubmissionListeners();

    // Caricamento tabelle atleti/squadre
    await scaricaListaAtletiIscritti(eventId);
    await scaricaListaSquadreIscritte(eventId);
}

function mostraErroreSocieta(testo) {
    ['societyNameDisplay', 'nomeSocietaIscritta'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = `<span class="text-danger" style="font-size:0.85rem;"><i class="fas fa-times-circle"></i> ${testo}</span>`;
    });
}

// ==========================================
// 5. AUTOMAZIONI ED EVENTI DINAMICI FORMS
// ==========================================
function adattaInterfacciaAlloSport() {
    const config = window.currentSportConfig;
    if (!config) return;

    const selectBelt = document.getElementById('regBelt') || document.getElementById('teamBelt');
    if (selectBelt && config.cinture) {
        const valPrecedente = selectBelt.value;
        selectBelt.innerHTML = '<option value="">-- Seleziona Cintura --</option>';
        config.cinture.forEach(c => { selectBelt.innerHTML += `<option value="${c}">${c}</option>`; });
        if (valPrecedente) selectBelt.value = valPrecedente;
    }

    const selectSpecialty = document.getElementById('regSpecialty');
    if (selectSpecialty && config.divisioni && window.location.pathname.includes("fitarco")) {
        selectSpecialty.innerHTML = '<option value="">-- Seleziona Divisione --</option>';
        config.divisioni.forEach(d => { selectSpecialty.innerHTML += `<option value="${d}">${d}</option>`; });
    }
}

function setupBirthdateListeners() {
    const inputData = document.getElementById('regBirthdate') || document.getElementById('teamBirthdate');
    if (!inputData) return;

    inputData.addEventListener('change', () => {
        const dataNascita = new Date(inputData.value);
        if (isNaN(dataNascita.getTime())) return;

        const etaApprossimata = new Date().getFullYear() - dataNascita.getFullYear();
        const selectClasse = document.getElementById('regClasse') || document.getElementById('teamClasse');
        if (!selectClasse) return;

        let classeIndividuata = "Senior";
        if (etaApprossimata <= 11) classeIndividuata = "Bambini / Ragazzi";
        else if (etaApprossimata <= 13) classeIndividuata = "Esordienti";
        else if (etaApprossimata <= 15) classeIndividuata = "Cadetti";
        else if (etaApprossimata <= 17) classeIndividuata = "Juniores";
        else if (etaApprossimata <= 35) classeIndividuata = "Seniores";
        else classeIndividuata = "Master";

        selectClasse.value = classeIndividuata;
        if (inputData.id === 'regBirthdate') aggiornaOpzioniPeso();
    });

    const selectGender = document.getElementById('regGender');
    if (selectGender) selectGender.addEventListener('change', aggiornaOpzioniPeso);
}

function aggiornaOpzioniPeso() {
    const selectClasse = document.getElementById('regClasse');
    const selectGender = document.getElementById('regGender');
    const selectPeso = document.getElementById('regWeightCategory');

    if (!selectClasse || !selectGender || !selectPeso) return;

    const classe = selectClasse.value;
    const sesso = selectGender.value;
    const config = window.currentSportConfig;

    selectPeso.innerHTML = '<option value="">-- Seleziona Categoria Peso --</option>';

    if (!classe || !sesso || !config || !config.pesi) {
        selectPeso.innerHTML += '<option value="Open">Categoria Unica / Open</option>';
        return;
    }

    const listaPesi = config.pesi[sesso]?.[classe] || config.pesi[classe];
    if (listaPesi && Array.isArray(listaPesi)) {
        listaPesi.forEach(p => { selectPeso.innerHTML += `<option value="${p}">${p}</option>`; });
    } else {
        selectPeso.innerHTML += '<option value="Open">Categoria Unica / Open</option>';
    }
}

function setupFormSubmissionListeners() {
    const formAtleta = document.getElementById('registrationForm') || document.getElementById('registerForm');
    if (formAtleta) {
        formAtleta.removeAttribute('onsubmit');
        formAtleta.addEventListener('submit', async (e) => {
            e.preventDefault();
            await inviaIscrizioneAtleta();
        });
    }

    const formSquadra = document.getElementById('teamRegistrationForm');
    if (formSquadra) {
        formSquadra.addEventListener('submit', async (e) => {
            e.preventDefault();
            await inviaIscrizioneSquadra();
        });
    }
}

// ==========================================
// 6. INVIO E SALVATAGGIO DEI DATI (POST)
// ==========================================
async function inviaIscrizioneAtleta() {
    if (!window.currentSocietyId) {
        alert("Impossibile procedere: Nessuna società agganciata alla sessione attuale.");
        return;
    }

    // Lettura sicura dei campi con fallback per evitare errori se un elemento manca nell'HTML
    const payload = {
        event_id: sessionStorage.getItem('selectedEventId'),
        society_id: window.currentSocietyId,
        first_name: document.getElementById('regFirstName')?.value.trim() || '',
        last_name: document.getElementById('regLastName')?.value.trim() || '',
        gender: document.getElementById('regGender')?.value || 'M',
        classe: document.getElementById('regClasse')?.value || 'Senior',
        specialty: document.getElementById('regSpecialty')?.value || 'Shiai',
        belt: document.getElementById('regBelt')?.value || document.getElementById('regGrado')?.value || 'Bianca',
        weight_category: document.getElementById('regWeightCategory')?.value || 'Open'
    };

    try {
        const { error } = await sb.from('atleti').insert([payload]);
        if (error) throw error;

        alert("Iscrizione completata con successo!");
        const form = document.getElementById('registrationForm') || document.getElementById('registerForm');
        if (form) form.reset();
        await scaricaListaAtletiIscritti(payload.event_id);
    } catch (err) { alert("Errore di salvataggio: " + err.message); }
}

async function inviaIscrizioneSquadra() {
    if (!window.currentSocietyId) {
        alert("Impossibile procedere: Nessuna società agganciata.");
        return;
    }

    const payload = {
        event_id: sessionStorage.getItem('selectedEventId'),
        society_id: window.currentSocietyId,
        nome_squadra: document.getElementById('teamName')?.value.trim() || '',
        classe: document.getElementById('teamClasse')?.value || '',
        gender: document.getElementById('teamGender')?.value || '',
        specialty: document.getElementById('teamSpecialty')?.value || 'Squadre',
        belt: document.getElementById('teamBelt')?.value || 'Open',
        peso: document.getElementById('teamWeight')?.value || 'Open'
    };

    try {
        const { error } = await sb.from('squadre').insert([payload]);
        if (error) throw error;

        alert("Squadra registrata con successo!");
        document.getElementById('teamRegistrationForm').reset();
        await scaricaListaSquadreIscritte(payload.event_id);
    } catch (err) { alert("Errore iscrizione squadra: " + err.message); }
}

// ==========================================
// 7. RENDERING TABELLE DINAMICHE DEI PARTECIPANTI
// ==========================================
async function scaricaListaAtletiIscritti(eventId) {
    const tbody = document.getElementById('athleteList') || document.getElementById('iscrittiGaraList');
    if (!tbody) return;

    try {
        const { data, error } = await sb.from('atleti').select('*').eq('event_id', eventId).order('created_at', { ascending: false });
        if (error) throw error;

        let countTot = 0, countKata = 0, countKumite = 0, countKids = 0;

        if (!data || data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="10" class="text-center text-muted py-3">Nessun atleta iscritto a questa gara.</td></tr>`;
            aggiornaBadgeContatori(0, 0, 0, 0);
            return;
        }

        tbody.innerHTML = "";
        data.forEach(a => {
            countTot++;
            const spec = (a.specialty || "").toLowerCase();
            const cls = (a.classe || "").toLowerCase();

            if (spec.includes("kata")) countKata++;
            if (spec.includes("kumite") || spec.includes("shiai")) countKumite++;
            if (cls.includes("bambini") || cls.includes("ragazzi")) countKids++;

            // Struttura dinamica: adatta le colonne se siamo in Fitarco o Judo/Karate
            if (window.location.pathname.includes("fitarco")) {
                tbody.innerHTML += `
                    <tr>
                        <td><strong>${a.last_name} ${a.first_name}</strong></td>
                        <td>${a.specialty || '-'}</td>
                        <td>${a.classe || '-'}</td>
                        <td><span class="badge bg-light text-dark border">${a.gender || '-'}</span></td>
                        <td>${a.weight_category || 'Standard'}</td>
                    </tr>`;
            } else {
                tbody.innerHTML += `
                    <tr>
                        <td><strong>${a.last_name} ${a.first_name}</strong></td>
                        <td>${a.classe || '-'}</td>
                        <td><span class="badge bg-light text-dark border">${a.gender || '-'}</span></td>
                        <td>${a.specialty || '-'}</td>
                        <td>${a.belt || '-'}</td>
                        <td><span class="badge bg-secondary">${a.weight_category || 'Open'}</span></td>
                    </tr>`;
            }
        });

        aggiornaBadgeContatori(countTot, countKata, countKumite, countKids);

    } catch (err) { console.error("Errore tabelle atleti:", err); }
}

function aggiornaBadgeContatori(tot, kata, kumite, kids) {
    const elTot = document.getElementById('totalAthleteCountDisplay') || document.getElementById('totaleAtleti');
    const elKata = document.getElementById('KATAAtletaCountDisplay');
    const elKumite = document.getElementById('KUMITEAtletaCountDisplay');
    const elKids = document.getElementById('KIDSAthleteCountDisplay');

    if (elTot) elTot.innerText = tot;
    if (elKata) elKata.innerText = kata;
    if (elKumite) elKumite.innerText = kumite;
    if (elKids) elKids.innerText = kids;
}

async function scaricaListaSquadreIscritte(eventId) {
    const tbody = document.getElementById('teamList');
    if (!tbody) return;

    try {
        const { data, error } = await sb.from('squadre').select('*').eq('event_id', eventId);
        if (error) throw error;

        if (!data || data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="10" class="text-center text-muted py-3">Nessuna squadra iscritta.</td></tr>`;
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
    } catch (err) { console.error("Errore tabella squadre:", err); }
}

// ==========================================
// 8. INITIALIZER DISPATCHER GENERALIZZATO
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    const pathname = window.location.pathname.toLowerCase();

    if (pathname === '/' || pathname === '/index.html' || pathname.endsWith('/')) {
        try {
            const { data: { session } } = await sb.auth.getSession();
            window.location.href = session ? 'scelta-evento.html' : 'login.html';
        } catch (e) { window.location.href = 'login.html'; }
        return;
    }

    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            signIn(document.getElementById('email').value, document.getElementById('password').value);
        });
    }

    const regForm = document.getElementById('registrazioneForm');
    if (regForm) {
        regForm.addEventListener('submit', (e) => {
            e.preventDefault();
            if (document.getElementById('email').value !== document.getElementById('emailConfirm').value) return alert("Le email non coincidono.");
            if (document.getElementById('password').value !== document.getElementById('passwordConfirm').value) return alert("Le password non coincidono.");
            signUp(document.getElementById('email').value, document.getElementById('password').value, document.getElementById('nomeSocieta').value, document.getElementById('cfs').value, document.getElementById('cell').value);
        });
    }

    if (document.getElementById('eventListContainer') || document.getElementById('listaGare')) {
        await caricaEventiScelta();
        return;
    }

    if (document.getElementById('athleteList') || document.getElementById('iscrittiGaraList') || document.getElementById('registrationForm') || document.getElementById('registerForm')) {
        await inizializzaDashboardGara();
    }
});
