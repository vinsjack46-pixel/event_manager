// ==========================================
// SCRIPT.JS - MOTORE BASE, JUDO E FITARCO (COMPLETO E CORRETTO)
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

    if (!idGaraCorrente) {
        console.warn("Nessuna gara in sessione, torno alla selezione eventi.");
        return window.location.href = "scelta-evento.html";
    }

    // 1. Scrittura del nome della Gara
    const targetGaraIDs = ['nomeGaraTitolo', 'eventNameDisplay', 'nomeGara', 'titoloGara'];
    targetGaraIDs.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerText = nomeGara;
    });

    // 2. Recupero utente loggato e Società
    try {
        const { data: { user } } = await sb.auth.getUser();
        if (user) {
            const { data: soc } = await sb.from('societa').select('*').eq('user_id', user.id).single();
            if (soc) {
                idSocietaCorrente = soc.id;
                const targetSocietaIDs = ['societyNameDisplay', 'nomeSocietaHeader', 'nomeSocieta', 'societyName'];
                targetSocietaIDs.forEach(id => {
                    const el = document.getElementById(id);
                    if (el) el.innerText = soc.nome;
                });
            }
        } else {
            window.location.href = "login.html";
            return;
        }
    } catch (e) {
        console.error("Errore nel caricamento del profilo società:", e);
    }

    // 3. Lettura configurazione sportiva e regole
    try {
        const { data: config } = await sb.from('configurazioni_sport').select('*').eq('sport_id', sportId).single();
        if (config) {
            configurazioneSportCorrente = config;
            
            if (sportId === 'fitarco' && document.getElementById('regSpecialty')) {
                const sel = document.getElementById('regSpecialty');
                sel.innerHTML = '<option value="">-- Seleziona Divisione --</option>';
                config.regole?.divisioni?.forEach(d => sel.innerHTML += `<option value="${d}">${d}</option>`);
            }
            
            const labelsGrado = document.querySelectorAll('label[for="regBelt"], label[for="belt"]');
            labelsGrado.forEach(lbl => lbl.innerText = config.etichetta_livello || 'Cintura');
        }
    } catch (e) {
        console.error("Errore nel caricamento delle configurazioni sport:", e);
    }

    setupCascateSemplici(sportId);
    popolaTabellaIscritti();
}

// --- GESTIONE MENU A CASCATA ---
function setupCascateSemplici(sportId) {
    const selGender = document.getElementById('regGender');
    const selClasse = document.getElementById('regClasse');
    const selSpecialty = document.getElementById('regSpecialty');
    const selPeso = document.getElementById('regWeightCategory');

    if (sportId === 'judo' && selGender && selClasse) {
        selGender.addEventListener('change', () => {
            if(!configurazioneSportCorrente || !configurazioneSportCorrente.regole) return;
            selClasse.innerHTML = '<option value="">-- Scegli Classe --</option>';
            const classi = configurazioneSportCorrente.regole.classi || [];
            classi.forEach(c => selClasse.innerHTML += `<option value="${c}">${c}</option>`);
            selClasse.disabled = false;
            if(selPeso) { selPeso.innerHTML = '<option value="">-- Scegli Peso --</option>'; selPeso.disabled = true; }
        });
        selClasse.addEventListener('change', () => {
            if(!configurazioneSportCorrente || !configurazioneSportCorrente.regole || !selPeso) return;
            selPeso.innerHTML = '<option value="">-- Scegli Peso --</option>';
            const list = configurazioneSportCorrente.regole.pesi?.[selGender.value]?.[selClasse.value];
            if (list) {
                list.forEach(p => selPeso.innerHTML += `<option value="${p}">${p} kg</option>`);
                selPeso.disabled = false;
            } else {
                selPeso.innerHTML = '<option value="Open">Open</option>';
                selPeso.disabled = false;
            }
        });
    }

    if (sportId === 'fitarco' && selSpecialty && selClasse) {
        selSpecialty.addEventListener('change', () => {
            if(!configurazioneSportCorrente || !configurazioneSportCorrente.regole) return;
            selClasse.innerHTML = '<option value="">-- Scegli Classe --</option>';
            const classi = configurazioneSportCorrente.regole.classi?.[selSpecialty.value] || [];
            classi.forEach(c => selClasse.innerHTML += `<option value="${c}">${c}</option>`);
            selClasse.disabled = false;
        });
    }
}

// --- SALVATAGGIO ISCRITTI ---
async function salvaIscrizione(e) {
    e.preventDefault();
    if (!idSocietaCorrente) return alert("Errore: Impossibile associare l'iscrizione alla tua società.");

    const payload = {
        event_id: idGaraCorrente,
        society_id: idSocietaCorrente,
        first_name: document.getElementById('regFirstName').value.trim(),
        last_name: document.getElementById('regLastName').value.trim(),
        gender: document.getElementById('regGender').value,
        classe: document.getElementById('regClasse').value,
        specialty: document.getElementById('regSpecialty')?.value || 'Individuale',
        belt: document.getElementById('regBelt')?.value || 'Base',
        weight_category: document.getElementById('regWeightCategory')?.value || 'Open'
    };
    
    const { error } = await sb.from('atleti').insert([payload]);
    if (error) {
        alert("Errore nell'inserimento: " + error.message);
    } else {
        const form = document.getElementById('registrationForm') || document.getElementById('registerForm');
        if (form) form.reset();
        alert("Atleta registrato correttamente!");
        popolaTabellaIscritti();
    }
}

// --- POPOLAMENTO TABELLA ---
async function popolaTabellaIscritti() {
    const tbody = document.getElementById('iscrittiGaraList');
    if (!tbody) return;
    
    const { data, error } = await sb.from('atleti')
        .select('*')
        .eq('event_id', idGaraCorrente)
        .eq('society_id', idSocietaCorrente)
        .order('created_at', { ascending: false });
    
    tbody.innerHTML = "";
    if (error || !data || !data.length) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-3">Nessun iscritto trovato per la tua società.</td></tr>`;
        return;
    }

    data.forEach(a => {
        tbody.innerHTML += `<tr>
            <td><strong>${a.last_name} ${a.first_name}</strong></td>
            <td>${a.classe}</td>
            <td>${a.gender}</td>
            <td>${a.specialty || '-'}</td>
            <td>${a.belt || '-'}</td>
            <td>${a.weight_category || '-'}</td>
        </tr>`;
    });
}

// --- DISPATCHER AUTOMATICO ---
document.addEventListener('DOMContentLoaded', () => {
    const path = window.location.pathname.toLowerCase();
    
    if (path.includes("login") || path.includes("registrazione")) {
        document.getElementById('loginForm')?.addEventListener('submit', (e) => { e.preventDefault(); signIn(document.getElementById('email').value, document.getElementById('password').value); });
        document.getElementById('registrazioneForm')?.addEventListener('submit', (e) => { e.preventDefault(); signUp(document.getElementById('email').value, document.getElementById('password').value, document.getElementById('nomeSocieta').value, document.getElementById('cfs').value, document.getElementById('cell').value); });
    } else if (path.includes("scelta-evento")) {
        caricaEventiScelta();
    } else if (path.includes("judo") || path.includes("fitarco")) {
        // Aggancia l'evento di submit al form dinamicamente, qualunque sia l'ID usato
        const form = document.getElementById('registrationForm') || document.getElementById('registerForm');
        if (form) form.addEventListener('submit', salvaIscrizione);
        
        initDashboardSemplice();
    }
});
