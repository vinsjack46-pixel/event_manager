// ==========================================================================
// SCRIPT.JS - ARCHITETTURA SEPARATA (atleti / teams)
// ==========================================================================

// Controllo di sicurezza per evitare il blocco se Supabase non è ancora pronto
if (!window.supabase) {
    console.error("Supabase CDN non caricato! Verifica l'ordine degli script nell'HTML.");
}

const { createClient } = window.supabase || {};
const supabaseUrl = 'https://nhsvadkqagsqgirvoibg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5oc3ZhZGtxYWdzcWdpcnZvaWJnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5NzQ1MjQsImV4cCI6MjA4NzU1MDUyNH0.v0PPOfmX1p_sHkV2ZwzaH8gxr7VwN9MMRB1AclEOhvQ';

if (createClient) {
    window.sb = createClient(supabaseUrl, supabaseKey);
}
const sb = window.sb;

let idGaraCorrente = null;
let idSocietaCorrente = null;
let configurazioneSportCorrente = null;
let contatoreComponentiTeam = 0;

// --- 1. AUTHENTICATION ---
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

// --- 2. CARICAMENTO EVENTI ---
async function caricaListaEventi() {
    const container = document.getElementById('eventsContainer') || document.getElementById('listaEventi') || document.getElementById('eventListContainer') || document.getElementById('listaGare');
    if (!container) return; 

    container.innerHTML = '<div class="col-12 text-center text-muted py-3"><i class="fas fa-spinner fa-spin me-2"></i>Caricamento eventi...</div>';

    try {
        const { data: eventi, error } = await sb.from('eventi').select('*').eq('attivo', true).order('data_evento', { ascending: true });
        if (error) throw error;

        container.innerHTML = "";
        if (!eventi || eventi.length === 0) {
            container.innerHTML = '<div class="col-12 alert alert-info">Nessuna competizione attiva in programma.</div>';
            return;
        }

        eventi.forEach(ev => {
            const dataGara = new Date(ev.data_evento).toLocaleDateString('it-IT', { year: 'numeric', month: 'long', day: 'numeric' });
            const sportId = ev.sport_id ? ev.sport_id.toLowerCase() : 'judo';
            
            let badgeColor = "bg-primary";
            let htmlDest = "index-judo.html";
            if (sportId === "karate") { badgeColor = "bg-danger"; htmlDest = "index-karate.html"; }
            if (sportId === "fitarco") { badgeColor = "bg-warning text-dark"; htmlDest = "index-fitarco.html"; }

            const card = document.createElement('div');
            card.className = "col-md-6 col-lg-4 mb-4";
            card.innerHTML = `
                <div class="card h-100 shadow-sm border-0" style="cursor:pointer;" onclick="selezionaEvento('${ev.id}', '${htmlDest}', '${sportId}', '${ev.titolo || ev.nome}')">
                    <div class="card-body d-flex flex-column">
                        <div class="d-flex justify-content-between align-items-start mb-2">
                            <span class="badge ${badgeColor} text-uppercase fw-bold">${sportId}</span>
                            <small class="text-muted"><i class="fas fa-calendar-alt me-1"></i> ${dataGara}</small>
                        </div>
                        <h5 class="card-title fw-bold text-dark mb-1">${ev.titolo || ev.nome}</h5>
                        <p class="card-text text-muted small flex-grow-1"><i class="fas fa-map-marker-alt me-1"></i> ${ev.luogo || 'Sede da definire'}</p>
                        <button class="btn btn-outline-primary btn-sm w-100 fw-bold mt-3">Gestisci Iscrizioni <i class="fas fa-arrow-right ms-1"></i></button>
                    </div>
                </div>
            `;
            container.appendChild(card);
        });
    } catch (e) {
        container.innerHTML = '<div class="col-12 alert alert-danger">Errore durante il recupero degli eventi.</div>';
    }
}

window.selezionaEvento = function(id, htmlDest, sportId, nome) {
    sessionStorage.setItem('selectedEventId', id);
    sessionStorage.setItem('selectedSportId', sportId);
    sessionStorage.setItem('selectedEventName', nome);
    window.location.href = htmlDest;
};

// --- 3. LOGICA DASHBOARD (Judo / Fitarco) ---
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
    } catch (e) { console.error(e); }

    try {
        const { data: config } = await sb.from('configurazioni_sport').select('*').eq('sport_id', sportId).single();
        if (config) { 
            configurazioneSportCorrente = config; 
            if (sportId === 'fitarco' && document.getElementById('regSpecialty')) {
                const sel = document.getElementById('regSpecialty');
                sel.innerHTML = '<option value="" disabled selected>-- Seleziona Divisione --</option>';
                config.regole?.divisioni?.forEach(d => sel.innerHTML += `<option value="${d}">${d}</option>`);
            }
        }
    } catch (e) { console.error(e); }

    setupCascateSemplici(sportId);
    inizializzaGestioneComponentiTeam();
    aggiornaTabelleEStatistiche();
}

function setupCascateSemplici(sportId) {
    const selGender = document.getElementById('regGender');
    const selClasse = document.getElementById('regClasse');
    const selPeso = document.getElementById('regWeightCategory');
    const selSpecialty = document.getElementById('regSpecialty');

    if (sportId === 'judo' && selGender && selClasse) {
        selGender.addEventListener('change', () => {
            if (!selGender.value || !configurazioneSportCorrente?.regole) return;
            selClasse.innerHTML = '<option value="" disabled selected>-- Scegli Classe --</option>';
            const classi = configurazioneSportCorrente.regole.classi || [];
            classi.forEach(c => selClasse.innerHTML += `<option value="${c}">${c}</option>`);
            selClasse.disabled = false;
            if (selPeso) { selPeso.innerHTML = '<option value="" disabled selected>-- Scegli prima la classe --</option>'; selPeso.disabled = true; }
        });

        selClasse.addEventListener('change', () => {
            if (!configurazioneSportCorrente?.regole || !selPeso) return;
            selPeso.innerHTML = '<option value="" disabled selected>-- Scegli Peso --</option>';
            let jsonGender = selGender.value === "Maschio" ? "M" : "F";
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
            if (!configurazioneSportCorrente?.regole) return;
            selClasse.innerHTML = '<option value="" disabled selected>-- Scegli Classe --</option>';
            const classi = configurazioneSportCorrente.regole.classi?.[selSpecialty.value] || [];
            classi.forEach(c => selClasse.innerHTML += `<option value="${c}">${c}</option>`);
            selClasse.disabled = false;
        });
    }
}

// --- 4. SALVATAGGIO INDIVIDUALI ---
async function salvaIscrizione(e) {
    e.preventDefault();
    if (!idSocietaCorrente) return alert("Errore: Sessione società non valida.");

    const sportId = sessionStorage.getItem('selectedSportId') || 'judo';
    const lastName = document.getElementById('regLastName').value.trim();
    const firstName = document.getElementById('regFirstName').value.trim();
    const genderInput = document.getElementById('regGender').value;
    const birthYear = document.getElementById('regBirthYear').value.trim();
    const classe = document.getElementById('regClasse').value;
    const belt = document.getElementById('regBelt').value;
    
    const weightCategoryEl = document.getElementById('regWeightCategory');
    const specialtyEl = document.getElementById('regSpecialty');

    const dbGender = (genderInput === "Maschio") ? "M" : "F";

    const payload = {
        event_id: idGaraCorrente,
        society_id: idSocietaCorrente,
        first_name: firstName,
        last_name: lastName,
        gender: dbGender,
        classe: classe,
        specialty: specialtyEl ? specialtyEl.value : 'Shiai',
        belt: belt,
        weight_category: (weightCategoryEl && !weightCategoryEl.disabled) ? weightCategoryEl.value : 'Open',
        birthdate: `${birthYear}-01-01`
    };
    
    const { error } = await sb.from('atleti').insert([payload]);
    if (error) {
        alert("Errore inserimento: " + error.message);
    } else {
        alert("Atleta registered!");
        document.getElementById('registrationForm').reset();
        if(document.getElementById('regClasse')) document.getElementById('regClasse').disabled = true;
        if(document.getElementById('regWeightCategory')) document.getElementById('regWeightCategory').disabled = true;
        aggiornaTabelleEStatistiche();
    }
}

// --- 5. GESTIONE E SALVATAGGIO SQUADRE (Tabella 'teams') ---
function inizializzaGestioneComponentiTeam() {
    const container = document.getElementById('teamMembersContainer');
    const btnAdd = document.getElementById('btnAddTeamMember');
    if (!container || !btnAdd) return;

    container.innerHTML = "";
    contatoreComponentiTeam = 0;

    btnAdd.onclick = function(e) {
        e.preventDefault();
        if (contatoreComponentiTeam >= 10) return alert("Massimo componenti raggiunto.");
        contatoreComponentiTeam++;
        
        const row = document.createElement('div');
        row.className = "row g-2 mb-2 align-items-center team-member-row";
        row.id = `teamMemberRow_${contatoreComponentiTeam}`;
        row.innerHTML = `
            <div class="col-5"><input type="text" class="form-control form-control-sm member-lastname" placeholder="Cognome" required></div>
            <div class="col-5"><input type="text" class="form-control form-control-sm member-firstname" placeholder="Nome" required></div>
            <div class="col-2 text-end"><button type="button" class="btn btn-danger btn-sm" onclick="rimuoviComponenteTeam(${contatoreComponentiTeam})">✕</button></div>
        `;
        container.appendChild(row);
    };
}

window.rimuoviComponenteTeam = function(rowId) {
    const row = document.getElementById(`teamMemberRow_${rowId}`);
    if (row) { row.remove(); }
};

async function salvaSquadraSemplice(e) {
    e.preventDefault();
    if (!idSocietaCorrente) return alert("Errore di sessione.");

    const teamName = document.getElementById('teamName').value.trim();
    const teamGender = document.getElementById('teamGender').value;
    const teamAnno = document.getElementById('teamAnno').value.trim();
    const teamClasse = document.getElementById('teamClasse').value.trim();
    const teamBelt = document.getElementById('teamBelt').value;

    const rows = document.querySelectorAll('.team-member-row');
    if (rows.length === 0) return alert("Inserisci almeno un atleta nel team.");

    let componenti = [];
    rows.forEach(r => {
        const cog = r.querySelector('.member-lastname').value.trim();
        const nom = r.querySelector('.member-firstname').value.trim();
        if (cog && nom) componenti.push(`${cog} ${nom}`);
    });

    const payload = {
        event_id: idGaraCorrente,
        society_id: idSocietaCorrente,
        name: teamName,
        gender: teamGender,
        classe: teamClasse,
        belt: teamBelt,
        weight_category: 'Open',
        members: componenti.
    };

    const { error } = await sb.from('teams').insert([payload]);
    if (error) {
        alert("Errore registrazione Squadra: " + error.message);
    } else {
        alert("Squadra registrata correttamente!");
        document.getElementById('teamForm').reset();
        inizializzaGestioneComponentiTeam();
        aggiornaTabelleEStatistiche();
    }
}

// --- 6. AGGIORNAMENTO INCROCIATO TABELLE E CONTATORI ---
async function aggiornaTabelleEStatistiche() {
    if (!sb) return;
    const tbodyAtleti = document.getElementById('iscrittiGaraList');
    const tbodySquadre = document.getElementById('iscrittiSquadreList');
    
    const elTotale = document.getElementById('totalAthleteCountDisplay');
    const elMaschi = document.getElementById('maleAthleteCountDisplay');
    const elFemmine = document.getElementById('femaleAthleteCountDisplay');
    const elSquadre = document.getElementById('teamAthleteCountDisplay');

    let totali = 0, maschi = 0, femmine = 0, squadreCount = 0;

    if (tbodyAtleti) {
        const { data: atleti, error } = await sb.from('atleti').select('*').eq('event_id', idGaraCorrente).eq('society_id', idSocietaCorrente).order('created_at', { ascending: false });
        tbodyAtleti.innerHTML = "";
        
        if (!error && atleti && atleti.length > 0) {
            atleti.forEach(a => {
                totali++;
                let sessoVisualizzato = "Maschio";
                if (a.gender === 'F' || a.gender === 'Femmina') { femmine++; sessoVisualizzato = "Femmina"; } 
                else { maschi++; }

                tbodyAtleti.innerHTML += `<tr>
                    <td><strong>${a.last_name}</strong> ${a.first_name}</td>
                    <td>${a.classe}</td>
                    <td><span class="badge bg-light text-dark border">${sessoVisualizzato}</span></td>
                    <td>${a.specialty || 'Individuale'}</td>
                    <td>${a.belt || '-'}</td>
                    <td>${a.weight_category || '-'}</td>
                </tr>`;
            });
        } else {
            tbodyAtleti.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-3">Nessun atleta individuale iscritto.</td></tr>`;
        }
    }

    if (tbodySquadre) {
        const { data: teams, error: errTeams } = await sb.from('teams').select('*').eq('event_id', idGaraCorrente).eq('society_id', idSocietaCorrente).order('id', { ascending: false });
        tbodySquadre.innerHTML = "";

        if (!errTeams && teams && teams.length > 0) {
            teams.forEach(t => {
                squadreCount++;
                totali++;
                tbodySquadre.innerHTML += `<tr>
                    <td>
                        <strong class="text-success"><i class="fas fa-users me-1"></i> ${t.name}</strong>
                        <div class="small text-muted mt-1" style="font-size:0.8rem;"><strong>Componenti:</strong> ${t.members || 'Nessuno inserito'}</div>
                    </td>
                    <td>${t.classe || '-'}</td>
                    <td><span class="badge bg-light text-success border">${t.gender || '-'}</span></td>
                    <td>Squadre</td>
                    <td>${t.belt || 'Libera'}</td>
                    <td>${t.weight_category || 'Open'}</td>
                </tr>`;
            });
        } else {
            tbodySquadre.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-3">Nessuna squadra iscritta.</td></tr>`;
        }
    }

    if (elTotale) elTotale.innerText = totali;
    if (elMaschi) elMaschi.innerText = maschi;
    if (elFemmine) elFemmine.innerText = femmine;
    if (elSquadre) elSquadre.innerText = squadreCount;
}

// --- 7. DISPATCHER AUTOMATICO ---
document.addEventListener('DOMContentLoaded', () => {
    const formLogin = document.getElementById('loginForm');
    const formRegSoc = document.getElementById('registrazioneForm');
    const containerScelta = document.getElementById('eventListContainer');
    const formAtleta = document.getElementById('registrationForm');

    if (formLogin) {
        formLogin.addEventListener('submit', (e) => { e.preventDefault(); signIn(document.getElementById('email').value, document.getElementById('password').value); });
    }
    if (formRegSoc) {
        formRegSoc.addEventListener('submit', (e) => { e.preventDefault(); signUp(document.getElementById('email').value, document.getElementById('password').value, document.getElementById('nomeSocieta').value, document.getElementById('cfs').value, document.getElementById('cell').value); });
    }
    if (containerScelta) {
        caricaListaEventi();
    }
    if (formAtleta) {
        formAtleta.addEventListener('submit', salvaIscrizione);
        const formTeam = document.getElementById('teamForm');
        if (formTeam) formTeam.addEventListener('submit', salvaSquadraSemplice);
        initDashboardSemplice();
    }
});
