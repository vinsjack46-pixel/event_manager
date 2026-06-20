// ==========================================
// SCRIPT.JS - MOTORE BASE, JUDO E FITARCO
// ==========================================
const { createClient } = window.supabase;
const supabaseUrl = 'https://nhsvadkqagsqgirvoibg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5oc3ZhZGtxYWdzcWdpcnZvaWJnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5NzQ1MjQsImV4cCI6MjA4NzU1MDUyNH0.v0PPOfmX1p_sHkV2ZwzaH8gxr7VwN9MMRB1AclEOhvQ';

const sb = createClient(supabaseUrl, supabaseKey);
window.sb = sb;

let idGaraCorrente = null;
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
    idGaraCorrente = sessionStorage.getItem('selectedEventId');
    const nomeGara = sessionStorage.getItem('selectedEventName');
    const sportId = sessionStorage.getItem('selectedSportId') || 'judo';

    if (!idGaraCorrente) return window.location.href = "scelta-evento.html";

    const titleEl = document.getElementById('nomeGaraTitolo');
    if (titleEl) titleEl.innerText = nomeGara;

    // Recupero Regole
    const { data: config } = await sb.from('configurazioni_sport').select('*').eq('sport_id', sportId).single();
    if (config) {
        configurazioneSportCorrente = config.regole;
        if (sportId === 'fitarco' && document.getElementById('regSpecialty')) {
            const sel = document.getElementById('regSpecialty');
            sel.innerHTML = '<option value="">-- Seleziona --</option>';
            config.regole.divisioni?.forEach(d => sel.innerHTML += `<option value="${d}">${d}</option>`);
        }
    }

    // Listener Cascate
    const selGender = document.getElementById('regGender');
    const selClasse = document.getElementById('regClasse');
    const selSpecialty = document.getElementById('regSpecialty');

    if (sportId === 'judo' && selGender && selClasse) {
        selGender.addEventListener('change', () => {
            selClasse.innerHTML = '<option value="">-- Scegli --</option>';
            configurazioneSportCorrente?.classi?.forEach(c => selClasse.innerHTML += `<option value="${c}">${c}</option>`);
            selClasse.disabled = false;
        });
        selClasse.addEventListener('change', () => {
            const selPeso = document.getElementById('regWeightCategory');
            selPeso.innerHTML = '<option value="">-- Scegli Peso --</option>';
            const list = configurazioneSportCorrente?.pesi?.[selGender.value]?.[selClasse.value];
            if (list) {
                list.forEach(p => selPeso.innerHTML += `<option value="${p}">${p}</option>`);
                selPeso.disabled = false;
            } else {
                selPeso.innerHTML = '<option value="Open">Open</option>';
                selPeso.disabled = false;
            }
        });
    }

    if (sportId === 'fitarco' && selSpecialty && selClasse) {
        selSpecialty.addEventListener('change', () => {
            selClasse.innerHTML = '<option value="">-- Scegli --</option>';
            configurazioneSportCorrente?.classi?.[selSpecialty.value]?.forEach(c => selClasse.innerHTML += `<option value="${c}">${c}</option>`);
            selClasse.disabled = false;
        });
    }

    popolaTabellaIscritti(sportId);
}

async function salvaIscrizione(e) {
    e.preventDefault();
    const { data: { user } } = await sb.auth.getUser();
    let socId = null;
    if (user) {
        const { data: soc } = await sb.from('societa').select('id').eq('user_id', user.id).single();
        if (soc) socId = soc.id;
    }

    const payload = {
        event_id: idGaraCorrente,
        society_id: socId,
        first_name: document.getElementById('regFirstName').value.trim(),
        last_name: document.getElementById('regLastName').value.trim(),
        gender: document.getElementById('regGender').value,
        classe: document.getElementById('regClasse').value,
        specialty: document.getElementById('regSpecialty')?.value || 'Indiv.',
        belt: document.getElementById('regBelt')?.value || 'Base',
        weight_category: document.getElementById('regWeightCategory')?.value || 'Open'
    };
    
    await sb.from('atleti').insert([payload]);
    document.getElementById('registrationForm').reset();
    alert("Iscrizione registrata!");
    popolaTabellaIscritti(sessionStorage.getItem('selectedSportId'));
}

async function popolaTabellaIscritti(sportId) {
    const tbody = document.getElementById('iscrittiGaraList');
    if (!tbody) return;
    const { data } = await sb.from('atleti').select('*').eq('event_id', idGaraCorrente).order('created_at', { ascending: false });
    
    tbody.innerHTML = "";
    if (!data || !data.length) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted py-3">Nessun iscritto.</td></tr>`;
        return;
    }

    data.forEach(a => {
        if (sportId === 'judo') {
            tbody.innerHTML += `<tr><td><strong>${a.last_name} ${a.first_name}</strong></td><td>${a.classe}</td><td>${a.gender}</td><td>${a.belt}</td><td>${a.weight_category}</td></tr>`;
        } else {
            tbody.innerHTML += `<tr><td><strong>${a.last_name} ${a.first_name}</strong></td><td>${a.specialty}</td><td>${a.classe}</td><td>${a.gender}</td><td>${a.weight_category}</td></tr>`;
        }
    });
}

// --- DISPATCHER ---
document.addEventListener('DOMContentLoaded', () => {
    const path = window.location.pathname.toLowerCase();
    
    if (path.includes("login") || path.includes("registrazione")) {
        document.getElementById('loginForm')?.addEventListener('submit', (e) => { e.preventDefault(); signIn(document.getElementById('email').value, document.getElementById('password').value); });
        document.getElementById('registrazioneForm')?.addEventListener('submit', (e) => { e.preventDefault(); signUp(document.getElementById('email').value, document.getElementById('password').value, document.getElementById('nomeSocieta').value, document.getElementById('cfs').value, document.getElementById('cell').value); });
    } else if (path.includes("scelta-evento")) {
        caricaEventiScelta();
    } else if (document.getElementById('registrationForm')) {
        document.getElementById('registrationForm').addEventListener('submit', salvaIscrizione);
        initDashboardSemplice();
    }
});
