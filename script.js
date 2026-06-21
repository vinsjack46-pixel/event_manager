// ==========================================================================
// SCRIPT.JS - MOTORE COMPLETO CON RIPRISTINO SELEZIONE EVENTI, JUDO E FITARCO
// ==========================================================================

const { createClient } = window.supabase;
const supabaseUrl = 'https://nhsvadkqagsqgirvoibg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5oc3ZhZGtxYWdzcWdpcnZvaWJnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5NzQ1MjQsImV4cCI6MjA4NzU1MDUyNH0.v0PPOfmX1p_sHkV2ZwzaH8gxr7VwN9MMRB1AclEOhvQ';

// Configurazione della variabile globale sicura condivisa con script2.js
if (!window.sb) {
    window.sb = createClient(supabaseUrl, supabaseKey);
}
const sb = window.sb;

let idGaraCorrente = null;
let idSocietaCorrente = null;
let configurazioneSportCorrente = null;
let contatoreComponentiTeam = 0;

// ==========================================================================
// 1. FUNZIONE RIPRISTINATA: CARICAMENTO EVENTI (Per scelta-evento.html)
// ==========================================================================
async function caricaListaEventi() {
    const container = document.getElementById('eventsContainer') || document.getElementById('listaEventi');
    if (!container) return; // Non siamo nella pagina di scelta evento

    container.innerHTML = '<div class="text-center text-muted py-3">Caricamento eventi in corso...</div>';

    try {
        const { data: eventi, error } = await sb.from('eventi')
            .select('*')
            .order('data_evento', { ascending: true });

        if (error) throw error;

        container.innerHTML = "";
        if (!eventi || eventi.length === 0) {
            container.innerHTML = '<div class="alert alert-info">Nessun evento disponibile al momento.</div>';
            return;
        }

        eventi.forEach(ev => {
            // Formattazione data leggibile
            const dataOpzioni = { year: 'numeric', month: 'long', day: 'numeric' };
            const dataGara = new Date(ev.data_evento).toLocaleDateString('it-IT', dataOpzioni);
            
            // Determina il badge dello sport
            let badgeColor = "bg-primary";
            if (ev.sport_id === "karate") badgeColor = "bg-danger";
            if (ev.sport_id === "fitarco") badgeColor = "bg-warning text-dark";

            const card = document.createElement('div');
            card.className = "col-md-6 col-lg-4 mb-4";
            card.innerHTML = `
                <div class="card h-100 shadow-sm border-0">
                    <div class="card-body d-flex flex-column">
                        <div class="d-flex justify-content-between align-items-start mb-2">
                            <span class="badge ${badgeColor} text-uppercase fw-bold">${ev.sport_id}</span>
                            <small class="text-muted"><i class="fas fa-calendar-alt me-1"></i> ${dataGara}</small>
                        </div>
                        <h5 class="card-title fw-bold text-dark mb-1">${ev.titolo}</h5>
                        <p class="card-text text-muted small flex-grow-1"><i class="fas fa-map-marker-alt me-1"></i> ${ev.luogo || 'Sede da definire'}</p>
                        <button onclick="selezionaEvento('${ev.id}', '${ev.titolo.replace(/'/g, "\\'")}', '${ev.sport_id}')" class="btn btn-outline-primary btn-sm w-100 fw-bold mt-3">
                            Gestisci Iscrizioni <i class="fas fa-arrow-right ms-1"></i>
                        </button>
                    </div>
                </div>
            `;
            container.appendChild(card);
        });

    } catch (e) {
        console.error("Errore caricamento eventi:", e);
        container.innerHTML = '<div class="alert alert-danger">Errore durante il recupero degli eventi. Ricarica la pagina.</div>';
    }
}

// Funzione globale al click sulla card dell'evento
window.selezionaEvento = function(id, titolo, sportId) {
    sessionStorage.setItem('selectedEventId', id);
    sessionStorage.setItem('selectedEventName', titolo);
    sessionStorage.setItem('selectedSportId', sportId);

    // Reindirizzamento dinamico alla pagina dello sport corretto
    if (sportId === 'karate') {
        window.location.href = "index-karate.html";
    } else if (sportId === 'fitarco') {
        window.location.href = "index-fitarco.html";
    } else {
        window.location.href = "index-judo.html"; // Default Judo
    }
};

// ==========================================================================
// 2. GESTIONE DASHBOARD DI GARA (JUDO / FITARCO)
// ==========================================================================
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

    const selGender = document.getElementById('regGender');
    if (selGender) {
        selGender.innerHTML = `
            <option value="" disabled selected>-- Seleziona Sesso --</option>
            <option value="Maschio">Maschio</option>
            <option value="Femmina">Femmina</option>
        `;
    }

    const selTeamGender = document.getElementById('teamGender');
    if (selTeamGender) {
        selTeamGender.innerHTML = `
            <option value="" disabled selected>-- Seleziona Sesso Squadra --</option>
            <option value="Maschile">Maschile</option>
            <option value="Femminile">Femminile</option>
            <option value="Mista (Mix)">Mista (Mix)</option>
        `;
    }

    try {
        const { data: { user } } = await sb.auth.getUser();
        if (user) {
            const { data: soc } = await sb.from('societa').select('*').eq('user_id', user.id).single();
            if (soc) {
                idSocietaCorrente = soc.id;
                const targetSocietaIDs = ['societyNameDisplay', 'nomeSocietaHeader', 'nomeSocieta', 'societyName'];
                targetSocietaIDs.forEach(id => {
                    const el = document.getElementById(id);
                    if (el) el.innerText = "Società: " + soc.nome;
                });
            }
        } else {
            return window.location.href = "login.html";
        }
    } catch (e) { console.error("Errore autenticazione utente:", e); }

    try {
        const { data: config } = await sb.from('configurazioni_sport').select('*').eq('sport_id', sportId).single();
        if (config) { configurazioneSportCorrente = config; }
    } catch (e) { console.error("Errore configurazione sport:", e); }

    setupCascateSemplici(sportId);
    inizializzaGestioneComponentiTeam();
    popolaTabellaIscritti();
}

function inizializzaGestioneComponentiTeam() {
    const container = document.getElementById('teamMembersContainer');
    const btnAdd = document.getElementById('btnAddTeamMember');
    if (!container || !btnAdd) return;

    container.innerHTML = "";
    contatoreComponentiTeam = 0;

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
            <div class="col-5">
                <input type="text" class="form-control form-control-sm member-lastname" placeholder="Cognome ${contatoreComponentiTeam}" required>
            </div>
            <div class="col-5">
                <input type="text" class="form-control form-control-sm member-firstname" placeholder="Nome ${contatoreComponentiTeam}" required>
            </div>
            <div class="col-2 text-end">
                <button type="button" class="btn btn-danger btn-sm fw-bold" onclick="rimuoviComponenteTeam(${contatoreComponentiTeam})">✕</button>
            </div>
        `;
        container.appendChild(row);
    };
}

window.rimuoviComponenteTeam = function(rowId) {
    const row = document.getElementById(`teamMemberRow_${rowId}`);
    if (row) {
        row.remove();
        contatoreComponentiTeam--;
    }
};

function setupCascateSemplici(sportId) {
    const selGender = document.getElementById('regGender');
    const selClasse = document.getElementById('regClasse');
    const selSpecialty = document.getElementById('regSpecialty');
    const selPeso = document.getElementById('regWeightCategory');

    if (sportId === 'judo' && selGender && selClasse) {
        selGender.addEventListener('change', () => {
            if (!selGender.value || !configurazioneSportCorrente?.regole) return;
            selClasse.innerHTML = '<option value="" disabled selected>-- Scegli Classe --</option>';
            const classi = configurazioneSportCorrente.regole.classi || [];
            classi.forEach(c => selClasse.innerHTML += `<option value="${c}">${c}</option>`);
            selClasse.disabled = false;
            
            if (selPeso) { 
                selPeso.innerHTML = '<option value="" disabled selected>-- Scegli prima la classe --</option>'; 
                selPeso.disabled = true; 
            }
        });

        selClasse.addEventListener('change', () => {
            if (!configurazioneSportCorrente?.regole || !selPeso) return;
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
            if (!configurazioneSportCorrente?.regole) return;
            selClasse.innerHTML = '<option value="" disabled selected>-- Scegli Classe --</option>';
            const classi = configurazioneSportCorrente.regole.classi?.[selSpecialty.value] || [];
            classi.forEach(c => selClasse.innerHTML += `<option value="${c}">${c}</option>`);
            selClasse.disabled = false;
        });
    }
}

async function salvaIscrizione(e) {
    e.preventDefault();
    if (!idSocietaCorrente) return alert("Errore: Impossibile associare la tua società.");

    const lastName = document.getElementById('regLastName')?.value.trim();
    const firstName = document.getElementById('regFirstName')?.value.trim();
    const gender = document.getElementById('regGender')?.value;
    const birthYear = document.getElementById('regBirthYear')?.value.trim();
    const classe = document.getElementById('regClasse')?.value;
    const specialty = document.getElementById('regSpecialty')?.value || 'Individuale';
    const belt = document.getElementById('regBelt')?.value || 'Base';
    const weightCategory = document.getElementById('regWeightCategory')?.value || 'Open';

    if (!lastName || !firstName || !gender || !birthYear || !classe) {
        return alert("Tutti i campi obbligatori del singolo devono essere compilati.");
    }

    const payload = {
        event_id: idGaraCorrente,
        society_id: idSocietaCorrente,
        first_name: firstName,
        last_name: lastName,
        gender: gender,
        classe: classe,
        specialty: specialty,
        belt: belt,
        weight_category: weightCategory,
        birthdate: `${birthYear}-01-01`
    };
    
    const { error } = await sb.from('atleti').insert([payload]);
    if (error) {
        alert("Errore inserimento atleta: " + error.message);
    } else {
        alert("Atleta registrato correttamente!");
        document.getElementById('registrationForm')?.reset();
        popolaTabellaIscritti();
    }
}

async function salvaSquadraSemplice(e) {
    e.preventDefault();
    if (!idSocietaCorrente) return alert("Errore: Sessione società non valida.");

    const teamName = document.getElementById('teamName')?.value.trim();
    const teamGender = document.getElementById('teamGender')?.value;
    const teamAnno = document.getElementById('teamAnno')?.value.trim();
    const teamClasse = document.getElementById('teamClasse')?.value.trim();
    const teamSpecialty = document.getElementById('teamSpecialty')?.value || 'Squadre';
    const teamBelt = document.getElementById('teamBelt')?.value || 'Squadra';
    const teamWeightCategory = document.getElementById('teamWeightCategory')?.value || 'Open';

    if (!teamName || !teamGender || !teamAnno || !teamClasse) {
        return alert("Compila tutti i campi richiesti per la squadra.");
    }

    const rows = document.querySelectorAll('.team-member-row');
    if (rows.length === 0) return alert("Devi inserire almeno un componente col tasto +.");

    let arrayNomi = [];
    rows.forEach(r => {
        const cognome = r.querySelector('.member-lastname').value.trim();
        const nome = r.querySelector('.member-firstname').value.trim();
        if (cognome && nome) arrayNomi.push(`${cognome} ${nome}`);
    });

    const payload = {
        event_id: idGaraCorrente,
        society_id: idSocietaCorrente,
        first_name: arrayNomi.join(', '), 
        last_name: teamName,
        gender: teamGender,
        classe: teamClasse,
        specialty: teamSpecialty,
        belt: teamBelt,
        weight_category: teamWeightCategory,
        birthdate: `${teamAnno}-01-01`
    };

    const { error } = await sb.from('atleti').insert([payload]);
    if (error) {
        alert("Errore inserimento Squadra: " + error.message);
    } else {
        alert("Squadra registrata correttamente!");
        document.getElementById('teamForm')?.reset();
        inizializzaGestioneComponentiTeam();
        popolaTabellaIscritti();
    }
}

async function popolaTabellaIscritti() {
    const tbody = document.getElementById('iscrittiGaraList');
    if (!tbody) return;

    const elTotale = document.getElementById('totalAthleteCountDisplay');
    const elMaschi = document.getElementById('maleAthleteCountDisplay');
    const elFemmine = document.getElementById('femaleAthleteCountDisplay');
    const elSquadre = document.getElementById('teamAthleteCountDisplay');
    
    const { data, error } = await sb.from('atleti')
        .select('*')
        .eq('event_id', idGaraCorrente)
        .eq('society_id', idSocietaCorrente)
        .order('created_at', { ascending: false });
    
    tbody.innerHTML = "";
    if (error || !data || !data.length) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-3">Nessun iscritto trovato per la tua società.</td></tr>`;
        if (elTotale) elTotale.innerText = "0";
        if (elMaschi) elMaschi.innerText = "0";
        if (elFemmine) elFemmine.innerText = "0";
        if (elSquadre) elSquadre.innerText = "0";
        return;
    }

    let contatoreTotale = 0, contatoreMaschi = 0, contatoreFemmine = 0, contatoreSquadre = 0;

    data.forEach(a => {
        contatoreTotale++;
        if (a.specialty === 'Squadre' || a.belt === 'Squadra') {
            contatoreSquadre++;
        } else {
            if (a.gender === 'Maschio') contatoreMaschi++;
            if (a.gender === 'Femmina') contatoreFemmine++;
        }

        tbody.innerHTML += `<tr>
            <td><strong>${a.last_name}</strong> ${a.first_name}</td>
            <td>${a.classe}</td>
            <td><span class="badge bg-light text-dark border">${a.gender}</span></td>
            <td>${a.specialty || '-'}</td>
            <td>${a.belt || '-'}</td>
            <td>${a.weight_category || '-'}</td>
        </tr>`;
    });

    if (elTotale) elTotale.innerText = contatoreTotale.toString();
    if (elMaschi) elMaschi.innerText = contatoreMaschi.toString();
    if (elFemmine) elFemmine.innerText = contatoreFemmine.toString();
    if (elSquadre) elSquadre.innerText = contatoreSquadre.toString();
}

window.logout = async function() {
    await sb.auth.signOut();
    window.location.href = "login.html";
};

// ==========================================================================
// 3. EVENT DISPATCHER INTELLIGENTE (Rileva automaticamente la pagina)
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
    const path = window.location.pathname.toLowerCase();
    
    // Se siamo nella pagina di scelta dell'evento, esegui il caricamento
    if (path.includes("scelta-evento") || document.getElementById('eventsContainer') || document.getElementById('listaEventi')) {
        caricaListaEventi();
    } 
    // Se siamo in una pagina di gara Judo o Fitarco, esegui l'init della dashboard
    else if (path.includes("judo") || path.includes("fitarco")) {
        const formInd = document.getElementById('registrationForm');
        if (formInd) formInd.addEventListener('submit', salvaIscrizione);

        const formTeam = document.getElementById('teamForm');
        if (formTeam) formTeam.addEventListener('submit', salvaSquadraSemplice);
        
        initDashboardSemplice();
    }
});
