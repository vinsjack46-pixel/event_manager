// ==========================================================================
// SCRIPT.JS - MOTORE BASE, GESTIONE COMPLETA DI JUDO E FITARCO (VERSIONE TOTALE)
// ==========================================================================

const { createClient } = window.supabase;
const supabaseUrl = 'https://nhsvadkqagsqgirvoibg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5oc3ZhZGtxYWdzcWdpcnZvaWJnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5NzQ1MjQsImV4cCI6MjA4NzU1MDUyNH0.v0PPOfmX1p_sHkV2ZwzaH8gxr7VwN9MMRB1AclEOhvQ';

// Inizializzazione sicura condivisa con script2
if (!window.sb) {
    window.sb = createClient(supabaseUrl, supabaseKey);
}
const sb = window.sb;

let idGaraCorrente = null;
let idSocietaCorrente = null;
let configurazioneSportCorrente = null;
let contatoreComponentiTeam = 0;

// --- AUTENTICAZIONE ---
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

// --- INIZIALIZZAZIONE DASHBOARD (JUDO / FITARCO) ---
async function initDashboardSemplice() {
    idGaraCorrente = sessionStorage.getItem('selectedEventId');
    const nomeGara = sessionStorage.getItem('selectedEventName');
    const sportId = sessionStorage.getItem('selectedSportId') || 'judo';

    if (!idGaraCorrente) return window.location.href = "scelta-evento.html";

    const targetGaraIDs = ['nomeGaraTitolo', 'eventNameDisplay', 'nomeGara', 'titoloGara'];
    targetGaraIDs.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerText = nomeGara;
    });

    // Reset automatico e forzatura dei menu Gender Individuali
    const selGender = document.getElementById('regGender') || document.getElementById('gender');
    if (selGender) {
        selGender.innerHTML = `
            <option value="" disabled selected>-- Seleziona Sesso --</option>
            <option value="Maschio">Maschio</option>
            <option value="Femmina">Femmina</option>
        `;
    }

    // Reset automatico e forzatura dei menu Gender Squadre
    const selTeamGender = document.getElementById('teamGender') || document.getElementById('team_gender');
    if (selTeamGender) {
        selTeamGender.innerHTML = `
            <option value="" disabled selected>-- Seleziona Sesso Squadra --</option>
            <option value="Maschile">Maschile</option>
            <option value="Femminile">Femminile</option>
            <option value="Mista (Mix)">Mista (Mix)</option>
        `;
    }

    // Recupero Dati Società connessa
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

    // Caricamento Regole e Strutturazione Tabelle/Form Dinamici
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
    inizializzaGestioneComponentiTeam();
    popolaTabellaIscritti();
}

// --- CONTROLLO DINAMICO COMPONENTI SQUADRA (MODELLO KARATE CON TASTO +) ---
function inizializzaGestioneComponentiTeam() {
    const container = document.getElementById('teamMembersContainer');
    const btnAdd = document.getElementById('btnAddTeamMember');
    if (!container || !btnAdd) return;

    container.innerHTML = "";
    contatoreComponentiTeam = 0;

    // Gestione click sul tasto + per aggiungere componenti dinamicamente
    btnAdd.onclick = function(e) {
        e.preventDefault();
        if (contatoreComponentiTeam >= 7) {
            alert("Puoi aggiungere un massimo di 7 componenti per squadra.");
            return;
        }
        contatoreComponentiTeam++;
        
        const row = document.createElement('div');
        row.className = "row g-2 mb-2 align-items-center team-member-row";
        row.id = `teamMemberRow_${contatoreComponentiTeam}`;
        row.innerHTML = `
            <div class="col-md-5">
                <input type="text" class="form-control form-control-sm member-lastname" placeholder="Cognome Atleta ${contatoreComponentiTeam}" required>
            </div>
            <div class="col-md-5">
                <input type="text" class="form-control form-control-sm member-firstname" placeholder="Nome Atleta ${contatoreComponentiTeam}" required>
            </div>
            <div class="col-md-2 text-end">
                <button type="button" class="btn btn-danger btn-sm" onclick="rimuoviComponenteTeam(${contatoreComponentiTeam})">✕</button>
            </div>
        `;
        container.appendChild(row);
    };
}

window.rimuoviComponenteTeam = function(idId) {
    const row = document.getElementById(`teamMemberRow_${idId}`);
    if (row) {
        row.remove();
        contatoreComponentiTeam--;
    }
};

// --- MENU A CASCATA INDIVIDUALI ---
function setupCascateSemplici(sportId) {
    const selGender = document.getElementById('regGender') || document.getElementById('gender');
    const selClasse = document.getElementById('regClasse') || document.getElementById('classe');
    const selSpecialty = document.getElementById('regSpecialty') || document.getElementById('specialty');
    const selPeso = document.getElementById('regWeightCategory') || document.getElementById('weight_category');

    if (sportId === 'judo' && selGender && selClasse) {
        selGender.addEventListener('change', () => {
            const val = selGender.value;
            if (!val) return;
            
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

    let genderVal = getValoreCampo('gender');
    if (!genderVal) {
        return alert("ATTENZIONE: Devi selezionare obbligatoriamente il sesso dell'atleta.");
    }

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
        gender: genderVal, // "Maschio" o "Femmina"
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
        
        if(selGender) selGender.value = "";
        const selClasse = document.getElementById('regClasse') || document.getElementById('classe');
        if(selClasse) { selClasse.innerHTML = '<option value="" disabled selected>-- Seleziona --</option>'; selClasse.disabled = true; }
        
        alert("Atleta registrato correttamente!");
        popolaTabellaIscritti();
    }
}

// --- GESTIONE E SALVATAGGIO SQUADRE (JUDO E FITARCO) ---
async function salvaSquadraSemplice(e) {
    e.preventDefault();
    if (!idSocietaCorrente) return alert("Errore Società mancante.");

    const teamName = document.getElementById('teamName')?.value.trim();
    const teamGender = document.getElementById('teamGender')?.value;
    const teamClasse = document.getElementById('teamClasse')?.value || 'Squadra';
    const teamAnno = document.getElementById('teamAnno')?.value.trim(); // Anno obbligatorio per classe d'età

    if (!teamName || !teamGender || !teamAnno) {
        return alert("Inserisci Nome Squadra, Sesso e Anno di Riferimento.");
    }

    // Ricostruiamo i nomi dall'interfaccia a tasti +
    const rows = document.querySelectorAll('.team-member-row');
    if (rows.length === 0) {
        return alert("Devi inserire almeno un componente nella squadra.");
    }

    let arrayNomi = [];
    rows.forEach(r => {
        const cognome = r.querySelector('.member-lastname').value.trim();
        const nome = r.querySelector('.member-firstname').value.trim();
        if (cognome && nome) {
            arrayNomi.push(`${cognome} ${nome}`);
        }
    });

    let stringaAtleti = arrayNomi.join(', ');
    let dataFormattataTeam = `${teamAnno}-01-01`;

    const payload = {
        event_id: idGaraCorrente,
        society_id: idSocietaCorrente,
        first_name: stringaAtleti, 
        last_name: teamName,
        gender: teamGender, // "Maschile", "Femminile", "Mista (Mix)"
        classe: teamClasse,
        specialty: 'Squadre',
        belt: 'Squadra',
        weight_category: 'Open',
        birthdate: dataFormattataTeam
    };

    const { error } = await sb.from('atleti').insert([payload]);
    if (error) {
        alert("Errore inserimento Squadra: " + error.message);
    } else {
        alert("Squadra registrata correttamente!");
        document.getElementById('teamRegistrationForm')?.reset();
        inizializzaGestioneComponentiTeam();
        popolaTabellaIscritti();
    }
}

// --- POPOLAMENTO TABELLA E CONTEGGIO TOTALE ---
async function popolaTabellaIscritti() {
    const tbody = document.getElementById('iscrittiGaraList') || document.getElementById('athleteList');
    const txtConteggio = document.getElementById('totalRegistrationCount') || document.getElementById('conteggioTotale');
    if (!tbody) return;
    
    const { data, error } = await sb.from('atleti')
        .select('*')
        .eq('event_id', idGaraCorrente)
        .eq('society_id', idSocietaCorrente)
        .order('created_at', { ascending: false });
    
    tbody.innerHTML = "";
    if (error || !data || !data.length) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-3">Nessun iscritto trovato per la tua società.</td></tr>`;
        if (txtConteggio) txtConteggio.innerText = "0";
        return;
    }

    // Popolamento righe tabella
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

    // SISTEMA DI CONTEGGIO TOTALE EFFETTIVO
    if (txtConteggio) {
        txtConteggio.innerText = data.length.toString();
    }
}

// --- DISPATCHER EVENTI AUTOMATICO ---
document.addEventListener('DOMContentLoaded', () => {
    const path = window.location.pathname.toLowerCase();
    
    if (path.includes("login") || path.includes("registrazione")) {
        document.getElementById('loginForm')?.addEventListener('submit', (e) => { e.preventDefault(); signIn(document.getElementById('email').value, document.getElementById('password').value); });
        document.getElementById('registrazioneForm')?.addEventListener('submit', (e) => { e.preventDefault(); signUp(document.getElementById('email').value, document.getElementById('password').value, document.getElementById('nomeSocieta').value, document.getElementById('cfs').value, document.getElementById('cell').value); });
    } else if (path.includes("scelta-evento")) {
        caricaEventiScelta();
    } else if (path.includes("judo") || path.includes("fitarco")) {
        const formInd = document.getElementById('registrationForm') || document.getElementById('registerForm');
        if (formInd) formInd.addEventListener('submit', salvaIscrizione);

        const formTeam = document.getElementById('teamRegistrationForm') || document.getElementById('teamForm');
        if (formTeam) formTeam.addEventListener('submit', salvaSquadraSemplice);
        
        initDashboardSemplice();
    }
});
