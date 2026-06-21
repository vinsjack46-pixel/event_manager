// ==========================================
// SCRIPT.JS - INIZIO FILE
// ==========================================
const { createClient } = window.supabase;
const supabaseUrl = 'https://nhsvadkqagsqgirvoibg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5oc3ZhZGtxYWdzcWdpcnZvaWJnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5NzQ1MjQsImV4cCI6MjA4NzU1MDUyNH0.v0PPOfmX1p_sHkV2ZwzaH8gxr7VwN9MMRB1AclEOhvQ';

// Creiamo l'istanza e la attacchiamo a window in modo che TUTTI gli script la vedano
window.sb = createClient(supabaseUrl, supabaseKey);
const sb = window.sb; // Consente l'uso locale di 'sb' dentro questo file

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

    // 1. Scrittura Nomi Evento
    const targetGaraIDs = ['nomeGaraTitolo', 'eventNameDisplay', 'nomeGara', 'titoloGara'];
    targetGaraIDs.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerText = nomeGara;
    });

    // 2. FORZATURA MENU SESSO (RISOLUZIONE BUG)
    // Svuotiamo forzatamente i menu in modo che l'utente debba per forza scegliere
    const selGender = document.getElementById('regGender') || document.getElementById('gender');
    if (selGender) {
        selGender.innerHTML = `
            <option value="" disabled selected>-- Seleziona Sesso --</option>
            <option value="Maschio">Maschio</option>
            <option value="Femmina">Femmina</option>
        `;
    }

    const selTeamGender = document.getElementById('teamGender') || document.getElementById('team_gender');
    if (selTeamGender) {
        selTeamGender.innerHTML = `
            <option value="" disabled selected>-- Seleziona Sesso Squadra --</option>
            <option value="Maschile">Maschile</option>
            <option value="Femminile">Femminile</option>
            <option value="Mista (Mix)">Mista (Mix)</option>
        `;
    }

    // 3. Recupero Società
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
            return window.location.href = "login.html";
        }
    } catch (e) { console.error(e); }

    // 4. Lettura regole DB
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
    } catch (e) { console.error(e); }

    setupCascateSemplici(sportId);
    popolaTabellaIscritti();
}

// --- GESTIONE MENU A CASCATA ---
function setupCascateSemplici(sportId) {
    const selGender = document.getElementById('regGender') || document.getElementById('gender');
    const selClasse = document.getElementById('regClasse') || document.getElementById('classe');
    const selSpecialty = document.getElementById('regSpecialty') || document.getElementById('specialty');
    const selPeso = document.getElementById('regWeightCategory') || document.getElementById('weight_category');

    if (sportId === 'judo' && selGender && selClasse) {
        selGender.addEventListener('change', () => {
            const val = selGender.value;
            if (!val) return; // Se vuoto blocca tutto
            
            if(!configurazioneSportCorrente || !configurazioneSportCorrente.regole) return;
            selClasse.innerHTML = '<option value="" disabled selected>-- Scegli Classe --</option>';
            const classi = configurazioneSportCorrente.regole.classi || [];
            classi.forEach(c => selClasse.innerHTML += `<option value="${c}">${c}</option>`);
            selClasse.disabled = false;
            
            if(selPeso) { 
                selPeso.innerHTML = '<option value="" disabled selected>-- Scegli Peso --</option>'; 
                selPeso.disabled = true; 
            }
        });

        selClasse.addEventListener('change', () => {
            if(!configurazioneSportCorrente || !configurazioneSportCorrente.regole || !selPeso) return;
            selPeso.innerHTML = '<option value="" disabled selected>-- Scegli Peso --</option>';
            
            // Per il Judo mappa il genere ai valori del JSON se usi M/F nel DB
            let jsonGender = selGender.value; 
            if (jsonGender === "Maschio") jsonGender = "M";
            if (jsonGender === "Femmina") jsonGender = "F";

            const list = configurazioneSportCorrente.regole.pesi?.[jsonGender]?.[selClasse.value] || configurazioneSportCorrente.regole.pesi?.[selGender.value]?.[selClasse.value];
            
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
            selClasse.innerHTML = '<option value="" disabled selected>-- Scegli Classe --</option>';
            const classi = configurazioneSportCorrente.regole.classi?.[selSpecialty.value] || [];
            classi.forEach(c => selClasse.innerHTML += `<option value="${c}">${c}</option>`);
            selClasse.disabled = false;
        });
    }
}

// --- SALVATAGGIO ISCRITTI INDIVIDUALI ---
async function salvaIscrizione(e) {
    e.preventDefault();
    if (!idSocietaCorrente) return alert("Errore: Impossibile associare l'iscrizione alla tua società.");

    const getValoreCampo = (idBase) => {
        const idConPrefisso = 'reg' + idBase.charAt(0).toUpperCase() + idBase.slice(1);
        const el = document.getElementById(idConPrefisso) || document.getElementById('reg' + idBase) || document.getElementById(idBase);
        return el ? el.value.trim() : '';
    };

    // CONTROLLO BLOCCANTE SUL SESSO VUOTO
    let genderVal = getValoreCampo('gender');
    if (!genderVal) {
        return alert("ATTENZIONE: Devi selezionare obbligatoriamente il sesso dell'atleta.");
    }
    
    // Per far contenta la tabella del database, convertiamo in M o F se il check constraint lo richiede
    // (Se il DB accetta "Maschio" per esteso, puoi rimuovere queste 2 righe, ma di solito è più sicuro M/F)
    if (genderVal === "Maschio") genderVal = "M";
    if (genderVal === "Femmina") genderVal = "F";

    // GENERAZIONE DATA DA ANNO
    let annoInserito = getValoreCampo('anno') || getValoreCampo('annoNascita') || getValoreCampo('birthdate') || getValoreCampo('birthYear');
    if (!annoInserito) {
        return alert("Errore: L'anno di nascita è obbligatorio.");
    }
    let dataFormattata = annoInserito;
    if (annoInserito.length === 4 && !isNaN(annoInserito)) {
        dataFormattata = `${annoInserito}-01-01`; 
    }

    const payload = {
        event_id: idGaraCorrente,
        society_id: idSocietaCorrente,
        first_name: getValoreCampo('firstName') || getValoreCampo('first_name'),
        last_name: getValoreCampo('lastName') || getValoreCampo('last_name'),
        gender: genderVal,
        classe: getValoreCampo('classe'),
        specialty: getValoreCampo('specialty') || 'Individuale',
        belt: getValoreCampo('belt') || 'Base',
        weight_category: getValoreCampo('weightCategory') || getValoreCampo('weight_category') || 'Open',
        birthdate: dataFormattata
    };
    
    const { error } = await sb.from('atleti').insert([payload]);
    if (error) {
        alert("Errore nell'inserimento: " + error.message);
    } else {
        const form = document.getElementById('registrationForm') || document.getElementById('registerForm') || document.getElementById('athleteForm');
        if (form) form.reset();
        
        // Forza il reset dei menu a tendina
        const selGender = document.getElementById('regGender') || document.getElementById('gender');
        if(selGender) selGender.value = "";
        
        const selClasse = document.getElementById('regClasse') || document.getElementById('classe');
        if(selClasse) { selClasse.innerHTML = '<option value="" disabled selected>-- Seleziona --</option>'; selClasse.disabled = true; }
        
        alert("Atleta registrato correttamente!");
        popolaTabellaIscritti();
    }
}

// --- POPOLAMENTO TABELLA ---
async function popolaTabellaIscritti() {
    const tbody = document.getElementById('iscrittiGaraList') || document.getElementById('athleteList');
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
        // Riconverte M/F in parole per la visualizzazione a schermo
        let stampaSesso = a.gender;
        if (stampaSesso === "M") stampaSesso = "Maschio";
        if (stampaSesso === "F") stampaSesso = "Femmina";

        tbody.innerHTML += `<tr>
            <td><strong>${a.last_name} ${a.first_name}</strong></td>
            <td>${a.classe}</td>
            <td>${stampaSesso}</td>
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
        const form = document.getElementById('registrationForm') || document.getElementById('registerForm');
        if (form) form.addEventListener('submit', salvaIscrizione);
        
        initDashboardSemplice();
    }
});
