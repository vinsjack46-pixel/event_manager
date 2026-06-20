// =========================================================================
// 1. CONFIGURAZIONI GLOBALI, CONNESSIONE E STATI DI APPLICAZIONE
// =========================================================================
const { createClient } = window.supabase;
const supabaseUrl = 'https://nhsvadkqagsqgirvoibg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5oc3ZhZGtxYWdzcWdpcnZvaWJnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5NzQ1MjQsImV4cCI6MjA4NzU1MDUyNH0.v0PPOfmX1p_sHkV2ZwzaH8gxr7VwN9MMRB1AclEOhvQ';

// Inizializzazione sicura e globale del client Supabase
if (!window.supabaseClient) {
    window.supabaseClient = createClient(supabaseUrl, supabaseKey);
}
const sb = window.supabaseClient;

// Stati globali ereditati da script2.js
window.currentSocietyId = null;
let editingAthleteId = null; 
let editingTeamId = null;
let currentSportConfig = null;

// =========================================================================
// 2. HELPER UTILITY
// =========================================================================
function estraiAnnoDaData(dateVal) {
    if (!dateVal) return null;
    dateVal = dateVal.trim();
    
    if (dateVal.includes('-')) {
        const parts = dateVal.split('-');
        if (parts[0].length === 4) return parseInt(parts[0]);
        if (parts[2].length === 4) return parseInt(parts[2]);
    }
    
    if (dateVal.includes('/')) {
        const parts = dateVal.split('/');
        if (parts[2].length === 4) return parseInt(parts[2]);
        if (parts[0].length === 4) return parseInt(parts[0]);
    }
    
    const year = new Date(dateVal).getFullYear();
    return isNaN(year) ? null : year;
}

// =========================================================================
// 3. GESTIONE AUTENTICAZIONE E UTENTI
// =========================================================================
async function signIn(email, password) {
    try {
        const { data, error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw error;
        window.location.href = 'scelta-evento.html';
    } catch (error) {
        alert('Credenziali non valide.');
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

        alert('Registrazione completata! Controlla la tua email per confermare l\'account.');
        window.location.href = 'login.html';
    } catch (error) {
        console.error("Dettaglio errore:", error);
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

// =========================================================================
// 4. INIZIALIZZAZIONE AVANZATA E CARICAMENTO GARA/SOCIETÀ (initPage)
// =========================================================================
async function initPage() {
    const eventId = sessionStorage.getItem('selectedEventId');
    const eventName = sessionStorage.getItem('selectedEventName');
    
    let sportId = sessionStorage.getItem('selectedSportId');
    const pathname = window.location.pathname.toLowerCase();
    if (pathname.includes("judo")) sportId = "judo";
    else if (pathname.includes("fitarco")) sportId = "fitarco";
    else if (pathname.includes("karate")) sportId = "karate";
    if (!sportId) sportId = 'karate';

    if (!eventId) {
        window.location.href = "scelta-evento.html";
        return;
    }

    // Caricamento visivo dei dati della gara corrente
    if(document.getElementById('selectedEventId')) document.getElementById('selectedEventId').value = eventId;
    if(document.getElementById('eventNameDisplay')) document.getElementById('eventNameDisplay').innerText = eventName || "Gara Selezionata";
    if(document.getElementById('nomeGaraTitolo')) document.getElementById('nomeGaraTitolo').innerText = eventName || "";

    try {
        // Recupero configurazioni e regole dello sport specifico
        const { data: config, error: configErr } = await sb
            .from('configurazioni_sport')
            .select('*')
            .eq('sport_id', sportId)
            .single();

        if (configErr || !config) {
            throw new Error(configErr ? configErr.message : "Nessuna riga trovata per lo sport: " + sportId);
        }
        
        currentSportConfig = config;
        console.log(`Regole caricate con successo da Supabase per lo sport [${sportId.toUpperCase()}]:`, currentSportConfig);
    } catch (err) {
        console.error("ERRORE CRITICO DATABASE:", err);
        alert("ATTENZIONE: Impossibile caricare le regole da Supabase! Il sistema è bloccato. Controlla la tabella 'configurazioni_sport'. Errore: " + err.message);
        return;
    }

    adattaInterfacciaAlloSport();
    setupBirthdateListeners(); 

    // Caricamento ed esposizione dati Società Sportiva autenticata
    try {
        const { data: { user } } = await sb.auth.getUser();
        if (user) {
            const { data: soc, error: socErr } = await sb.from('societa').select('*').eq('user_id', user.id).single();
            if (!socErr && soc) {
                window.currentSocietyId = soc.id;
                
                // Popolamento di tutti i potenziali container del nome società
                if(document.getElementById('societyNameDisplay')) document.getElementById('societyNameDisplay').innerText = soc.nome;
                if(document.getElementById('nomeSocietaIscritta')) document.getElementById('nomeSocietaIscritta').innerText = soc.nome;
                if(document.getElementById('nomeSocietaHeader')) document.getElementById('nomeSocietaHeader').innerText = soc.nome;
                
                // Scarica le liste legate alla società e all'evento
                await fetchAthletes();
                await fetchTeams();
            } else {
                console.warn("Profilo societario non associato all'account.");
            }
        }
    } catch (authErr) {
        console.error("Errore nel recupero dei dati utente/società:", authErr);
    }
}

// =========================================================================
// 5. DINAMICHE DI INTERFACCIA E REGOLE SPORTIVE CASCATA
// =========================================================================
function adattaInterfacciaAlloSport() {
    if (!currentSportConfig) return;

    const labelsGrado = document.querySelectorAll('label[for="belt"]');
    labelsGrado.forEach(lbl => lbl.innerText = currentSportConfig.etichetta_livello || 'Cintura');
    
    const optBeltDefault = document.querySelector('#belt option[value=""]');
    if(optBeltDefault) optBeltDefault.innerText = `-- ${currentSportConfig.etichetta_livello || 'Grado'} --`;

    const weightBox = document.getElementById('weight_category')?.closest('.col-md-4') || document.getElementById('weight_category')?.parentElement;
    if (weightBox) {
        const richiedePeso = currentSportConfig.richiega_peso || currentSportConfig.richiede_peso;
        weightBox.style.display = richiedePeso ? 'block' : 'none';
    }
}

function toggleRegMode() {
    const regTypeEl = document.querySelector('input[name="regType"]:checked');
    if (!regTypeEl) return;
    const isTeam = regTypeEl.value === 'team';
    const indFields = document.getElementById('individualFields');
    const teamFields = document.getElementById('teamFields');

    if (isTeam) {
        if (indFields) indFields.style.display = 'none';
        if (teamFields) teamFields.style.display = 'block';
        
        if (indFields) {
            indFields.querySelectorAll('input, select').forEach(i => { i.required = false; i.value = ""; });
        }
        if (document.getElementById('team_name')) document.getElementById('team_name').required = true;
        if (document.getElementById('team_year')) document.getElementById('team_year').required = true;
        
        if (document.getElementById('membersContainer') && document.getElementById('membersContainer').children.length === 0) {
            for(let i=0; i<3; i++) addMemberField();
        }
        document.querySelectorAll('.member-input').forEach(i => i.required = true);
    } else {
        if (indFields) indFields.style.display = 'block';
        if (teamFields) teamFields.style.display = 'none';
        
        if (teamFields) {
            teamFields.querySelectorAll('input, select').forEach(i => { i.required = false; i.value = ""; });
        }
        document.querySelectorAll('.member-input').forEach(i => { i.required = false; });
        if (document.getElementById('first_name')) document.getElementById('first_name').required = true;
        if (document.getElementById('last_name')) document.getElementById('last_name').required = true;
        
        const dateInput = document.getElementById('birthdate');
        if (dateInput) dateInput.required = true;
    }
}

function addMemberField(value = "") {
    const container = document.getElementById('membersContainer');
    if (!container) return;
    const count = container.querySelectorAll('.member-input').length;
    if (count >= 6) return alert("Massimo 6 componenti.");
    const div = document.createElement('div');
    div.className = "col-md-4 mb-2";
    div.innerHTML = `
        <div class="input-group input-group-sm">
            <span class="input-group-text">${count + 1}</span>
            <input type="text" class="form-control member-input" placeholder="Nome Cognome" value="${value}" required>
            ${count >= 3 ? '<button type="button" class="btn btn-outline-danger" onclick="this.parentElement.parentElement.remove()">×</button>' : ''}
        </div>`;
    container.appendChild(div);
}

function handleBirthdateChange() {
    const dateInput = document.getElementById('birthdate');
    if (!dateInput) return;
    
    const year = estraiAnnoDaData(dateInput.value);
    if (year && year >= 1900 && year <= 2026) {
        updateClassSpecsAndBelts(year);
    }
}

function handleTeamYearChange() {
    const yearInput = document.getElementById('team_year');
    if (!yearInput) return;
    const year = parseInt(yearInput.value);
    if (year) updateClassSpecsAndBelts(year);
}

function updateClassSpecsAndBelts(year) {
    if (!currentSportConfig || !currentSportConfig.regole) return;
    const clSel = document.getElementById('classe');
    const spSel = document.getElementById('specialty');
    const beltSel = document.getElementById('belt');

    if (!clSel) return;

    const classi = currentSportConfig.regole.classi_eta || [];
    const classeTrovata = classi.find(c => year >= c.anno_min && year <= c.anno_max);
    let classe = classeTrovata ? classeTrovata.nome : "Fuori Quota";
    
    if (clSel.tagName === 'SELECT') {
        clSel.innerHTML = `<option value="${classe}">${classe}</option>`;
    } else {
        clSel.value = classe;
    }
    
    let belts = classeTrovata ? classeTrovata.cinture : ["Generica"];
    let specs = classeTrovata ? classeTrovata.specialita : [];

    if (beltSel) {
        beltSel.innerHTML = belts.map(b => `<option value="${b}">${b}</option>`).join('');
    }

    if (spSel) {
        spSel.innerHTML = '<option value="">-- Specialità / Divisione --</option>';
        specs.forEach(s => spSel.innerHTML += `<option value="${s}">${s}</option>`);
    }
    
    handleSpecialtyChange();
}

function handleSpecialtyChange() {
    if (!currentSportConfig || !currentSportConfig.regole) return;
    const spec = document.getElementById('specialty')?.value || "";
    const clSel = document.getElementById('classe');
    const classe = clSel ? (clSel.value || clSel.options?.[clSel.selectedIndex]?.value || "") : "";
    
    const regTypeEl = document.querySelector('input[name="regType"]:checked');
    const isTeam = regTypeEl ? regTypeEl.value === 'team' : false;
    
    let gender = isTeam ? document.getElementById('team_gender')?.value : document.getElementById('gender')?.value;
    const wInput = document.getElementById('weight_category');
    if (!wInput) return;

    wInput.innerHTML = '';
    wInput.disabled = true;

    if (!currentSportConfig.richiede_peso && !currentSportConfig.richiega_peso) {
        wInput.innerHTML = '<option value="-">-</option>';
        return;
    }

    const sportId = currentSportConfig.sport_id;
    const richiedePesoOggi = (sportId === 'karate' && spec === "Kumite") || (sportId === 'judo') || spec.toLowerCase().includes("combattimento");
    
    if (richiedePesoOggi) {
        wInput.disabled = false;
        let weights = [];
        const pesiConfig = currentSportConfig.regole.pesi || {};

        if (pesiConfig[classe]) {
            if (pesiConfig[classe][gender]) weights = pesiConfig[classe][gender];
            else if (Array.isArray(pesiConfig[classe])) weights = pesiConfig[classe];
            else weights = pesiConfig.Default || ["Open"];
        } else {
            weights = pesiConfig.Default || ["Open"];
        }
        weights.forEach(w => wInput.innerHTML += `<option value="${w}">${w} kg</option>`);
    } else if (spec === "ParaKarate") {
        wInput.disabled = false;
        const paraCats = currentSportConfig.regole.parakarate_categorie || [];
        paraCats.forEach(k => wInput.innerHTML += `<option value="${k}">${k}</option>`);
    } else {
        wInput.innerHTML = '<option value="-">-</option>';
    }
}

// =========================================================================
// 6. RICHIESTE DATI, TABELLE E CONTEGGI (READ)
// =========================================================================
async function fetchAthletes() {
    const eventId = sessionStorage.getItem('selectedEventId');
    if (!window.currentSocietyId) return;
    
    const { data: athletes } = await sb.from('atleti').select('*').eq('society_id', window.currentSocietyId).eq('event_id', eventId);
    const list = document.getElementById('athleteList') || document.getElementById('iscrittiGaraList');
    if (list) {
        list.innerHTML = "";
        athletes?.sort((a,b) => a.last_name.localeCompare(b.last_name)).forEach(a => {
            list.innerHTML += `<tr>
                <td><strong>${a.last_name} ${a.first_name}</strong></td>
                <td>${a.classe}</td>
                <td>${a.gender}</td>
                <td>${a.specialty}</td>
                <td>${a.belt}</td>
                <td>${a.weight_category}</td>
                <td class="text-end">
                    <button type="button" class="btn btn-sm btn-outline-warning border-0 me-1" onclick="editAthlete('${a.id}')" title="Modifica"><i class="fas fa-edit"></i></button>
                    <button type="button" class="btn btn-sm btn-outline-danger border-0" onclick="deleteAthlete('${a.id}')" title="Elimina"><i class="fas fa-trash"></i></button>
                </td>
            </tr>`;
        });
    }
    updateGlobalCounters(eventId);
}

async function fetchTeams() {
    const eventId = sessionStorage.getItem('selectedEventId');
    if (!window.currentSocietyId) return;
    
    // Tabella corretta su Supabase impostata su 'teams'
    const { data: teams } = await sb.from('teams').select('*').eq('society_id', window.currentSocietyId).eq('event_id', eventId);
    const list = document.getElementById('teamList');
    if (list) {
        list.innerHTML = "";
        teams?.forEach(t => {
            list.innerHTML += `<tr>
                <td><strong>${t.team_name}</strong><br><small class="text-muted">${t.members ? t.members.join(", ") : ""}</small></td>
                <td>${t.classe}</td>
                <td>${t.gender}</td>
                <td>${t.specialty}</td>
                <td>${t.belt || '-'}</td>
                <td>${t.weight_category || '-'}</td>
                <td class="text-end">
                    <button type="button" class="btn btn-sm btn-outline-warning border-0 me-1" onclick="editTeam('${t.id}')" title="Modifica"><i class="fas fa-edit"></i></button>
                    <button type="button" class="btn btn-sm btn-outline-danger border-0" onclick="deleteTeam('${t.id}')" title="Elimina"><i class="fas fa-trash"></i></button>
                </td>
            </tr>`;
        });
    }
}

async function updateGlobalCounters(eventId) {
    const { data: allA } = await sb.from('atleti').select('specialty').eq('event_id', eventId);
    const { data: allT } = await sb.from('teams').select('specialty').eq('event_id', eventId);
    const globalTotal = [...(allA || []), ...(allT || [])];
    
    const { data: myA } = await sb.from('atleti').select('specialty').eq('event_id', eventId).eq('society_id', window.currentSocietyId);
    const { data: myT } = await sb.from('teams').select('specialty').eq('event_id', eventId).eq('society_id', window.currentSocietyId);
    const myTotal = [...(myA || []), ...(myT || [])];

    const gCount = { Kumite: 0, Kata: 0, Para: 0, Kids: 0 };
    globalTotal.forEach(item => {
        if (item.specialty === "Kumite" || item.specialty === "Shiai") gCount.Kumite++;
        else if (item.specialty === "Kata") gCount.Kata++;
        else if (item.specialty === "ParaKarate") gCount.Para++;
        else if (["Combinata", "Percorso-Kata", "Percorso-Palloncino"].includes(item.specialty)) gCount.Kids++;
    });

    const sCount = { Kumite: 0, Kata: 0, Para: 0, Kids: 0 };
    myTotal.forEach(item => {
        if (item.specialty === "Kumite" || item.specialty === "Shiai") sCount.Kumite++;
        else if (item.specialty === "Kata") sCount.Kata++;
        else if (item.specialty === "ParaKarate") sCount.Para++;
        else if (["Combinata", "Percorso-Kata", "Percorso-Palloncino"].includes(item.specialty)) sCount.Kids++;
    });

    if(document.getElementById('kumiteAthleteCountDisplay')) document.getElementById('kumiteAthleteCountDisplay').innerText = sCount.Kumite;
    if(document.getElementById('kataAthleteCountDisplay')) document.getElementById('kataAthleteCountDisplay').innerText = sCount.Kata;
    if(document.getElementById('ParaKarateAthleteCountDisplay')) document.getElementById('ParaKarateAthleteCountDisplay').innerText = sCount.Para;
    if(document.getElementById('KIDSAthleteCountDisplay')) document.getElementById('KIDSAthleteCountDisplay').innerText = sCount.Kids;
    
    // Supporto per i display generali alternativi
    if(document.getElementById('totaleAtleti')) document.getElementById('totaleAtleti').innerText = myTotal.length;
    if(document.getElementById('totalAthleteCountDisplay')) document.getElementById('totalAthleteCountDisplay').innerText = myTotal.length;
    
    return gCount;
}

// =========================================================================
// 7. OPERAZIONI DI SALVATAGGIO ED EDITING (WRITE/CUD)
// =========================================================================
async function addAthlete(e) {
    e.preventDefault();
    if (!currentSportConfig) return alert("Impossibile procedere: Regole non caricate da Supabase.");
    const eventId = sessionStorage.getItem('selectedEventId');
    if (!window.currentSocietyId) return alert("Errore: Società non identificata.");

    const spec = document.getElementById('specialty').value;
    const regTypeEl = document.querySelector('input[name="regType"]:checked');
    const isTeam = regTypeEl ? regTypeEl.value === 'team' : false;

    const dateInput = document.getElementById('birthdate');
    let birthYear = isTeam ? parseInt(document.getElementById('team_year').value) : estraiAnnoDaData(dateInput ? dateInput.value : "");

    if (!birthYear) return alert("Inserisci una data di nascita valida.");

    // Controllo rigido dei tetti massimi di iscrizione previsti nel JSON
    if (!editingAthleteId && !editingTeamId) {
        const globalCounts = await updateGlobalCounters(eventId);
        const currentSum = globalCounts.Kata + globalCounts.Kumite;
        
        const limitiConfig = currentSportConfig.regole?.limiti || {};
        const maxPosti = limitiConfig.KataKumiteSum || limitiConfig.katakumitesum || limitiConfig.katakumiteSum || 300;

        if ((spec === "Kumite" || spec === "Kata" || spec === "Shiai") && currentSum >= maxPosti) {
            return alert(`BLOCCO ISCRIZIONI: Posti esauriti nel database! Limite di ${maxPosti} iscritti raggiunto.`);
        }
    }

    const clSel = document.getElementById('classe');
    const classeSalva = clSel ? (clSel.value || clSel.options?.[clSel.selectedIndex]?.value || "Fuori Quota") : "Fuori Quota";

    const commonData = {
        event_id: eventId,
        society_id: window.currentSocietyId,
        classe: classeSalva,
        specialty: spec,
        belt: document.getElementById('belt').value,
        weight_category: document.getElementById('weight_category')?.value || '-'
    };

    if (isTeam) {
        const members = Array.from(document.querySelectorAll('.member-input')).map(i => i.value.trim()).filter(v => v !== "");
        if (members.length < 3) return alert("Inserisci almeno 3 componenti.");
        
        const teamData = {
            ...commonData, 
            team_name: document.getElementById('team_name').value,
            gender: document.getElementById('team_gender').value,
            members: members,
            team_year: birthYear
        };

        if (editingTeamId) {
            const { error } = await sb.from('teams').update([teamData]).eq('id', editingTeamId);
            if (error) alert("Errore: " + error.message);
            else { alert("Squadra modificata su database!"); completeReset(); }
        } else {
            const { error } = await sb.from('teams').insert([teamData]);
            if (error) alert(error.message);
            else { alert("Squadra registrata su database!"); completeReset(); }
        }
    } else {
        const athleteData = {
            ...commonData, 
            first_name: document.getElementById('first_name').value,
            last_name: document.getElementById('last_name').value,
            birthdate: dateInput ? dateInput.value : '',
            gender: document.getElementById('gender').value
        };

        if (editingAthleteId) {
            const { error } = await sb.from('atleti').update([athleteData]).eq('id', editingAthleteId);
            if (error) alert("Errore: " + error.message);
            else { alert("Atleta modificato su database!"); completeReset(); }
        } else {
            const { error } = await sb.from('atleti').insert([athleteData]);
            if (error) alert(error.message);
            else { alert("Atleta registrato su database!"); completeReset(); }
        }
    }
}

async function editAthlete(id) {
    if (editingTeamId) completeReset();

    const { data: a, error } = await sb.from('atleti').select('*').eq('id', id).single();
    if (error) return alert("Errore nel recupero dati dell'atleta: " + error.message);

    const radioInd = document.querySelector('input[name="regType"][value="individual"]');
    if (radioInd) radioInd.checked = true;
    toggleRegMode();

    if (document.getElementById('first_name')) document.getElementById('first_name').value = a.first_name;
    if (document.getElementById('last_name')) document.getElementById('last_name').value = a.last_name;
    if (document.getElementById('birthdate')) document.getElementById('birthdate').value = a.birthdate;
    if (document.getElementById('gender')) document.getElementById('gender').value = a.gender;

    const birthYear = estraiAnnoDaData(a.birthdate);
    if (birthYear) updateClassSpecsAndBelts(birthYear);
    if (document.getElementById('specialty')) document.getElementById('specialty').value = a.specialty;
    handleSpecialtyChange(); 
    
    if (document.getElementById('belt')) document.getElementById('belt').value = a.belt;
    if (document.getElementById('weight_category')) document.getElementById('weight_category').value = a.weight_category;

    editingAthleteId = id;
    const submitBtn = document.querySelector('#athleteForm button[type="submit"]');
    if (submitBtn) {
        submitBtn.innerHTML = '<i class="fas fa-save me-2"></i>SALVA MODIFICHE ATLETA';
        submitBtn.className = "btn btn-warning w-100 fw-bold py-3 shadow-sm rounded-3";
    }

    if (document.getElementById('athleteForm')) {
        document.getElementById('athleteForm').scrollIntoView({ behavior: 'smooth' });
    }
}

async function editTeam(id) {
    if (editingAthleteId) completeReset();

    const { data: t, error } = await sb.from('teams').select('*').eq('id', id).single();
    if (error) return alert("Errore nel recupero dati della squadra: " + error.message);

    const radioTeam = document.querySelector('input[name="regType"][value="team"]');
    if (radioTeam) radioTeam.checked = true;
    toggleRegMode();

    if (document.getElementById('team_name')) document.getElementById('team_name').value = t.team_name;
    if (document.getElementById('team_year')) document.getElementById('team_year').value = t.team_year;
    if (document.getElementById('team_gender')) document.getElementById('team_gender').value = t.gender;

    updateClassSpecsAndBelts(t.team_year);

    if (document.getElementById('specialty')) document.getElementById('specialty').value = t.specialty;
    handleSpecialtyChange();
    if (t.belt && document.getElementById('belt')) document.getElementById('belt').value = t.belt;
    if (t.weight_category && document.getElementById('weight_category')) document.getElementById('weight_category').value = t.weight_category;

    const container = document.getElementById('membersContainer');
    if (container) {
        container.innerHTML = "";
        t.members.forEach(member => { addMemberField(member); });
    }

    editingTeamId = id;
    const submitBtn = document.querySelector('#athleteForm button[type="submit"]');
    if (submitBtn) {
        submitBtn.innerHTML = '<i class="fas fa-save me-2"></i>SALVA MODIFICHE SQUADRA';
        submitBtn.className = "btn btn-warning w-100 fw-bold py-3 shadow-sm rounded-3";
    }

    if (document.getElementById('athleteForm')) {
        document.getElementById('athleteForm').scrollIntoView({ behavior: 'smooth' });
    }
}

async function deleteAthlete(id) { 
    if (confirm("Eliminare l'atleta selezionato dal database?")) { 
        await sb.from('atleti').delete().eq('id', id); 
        fetchAthletes();
    } 
}

async function deleteTeam(id) { 
    if (confirm("Eliminare la squadra selezionata dal database?")) { 
        await sb.from('teams').delete().eq('id', id); 
        fetchTeams();
    } 
}

function completeReset() {
    const form = document.getElementById('athleteForm');
    if(form) form.reset();

    const container = document.getElementById('membersContainer');
    if (container) container.innerHTML = "";

    const clSel = document.getElementById('classe');
    if(clSel) {
        if(clSel.tagName === 'SELECT') clSel.innerHTML = '<option value="">-- Seleziona Anno --</option>';
        else clSel.value = "";
    }
    if(document.getElementById('specialty')) document.getElementById('specialty').innerHTML = '<option value="">-- Specialità --</option>';
    if(document.getElementById('belt')) document.getElementById('belt').innerHTML = '<option value="">-- Cintura --</option>';
    
    const wInput = document.getElementById('weight_category');
    if(wInput) {
        wInput.innerHTML = '<option value="-">-</option>';
        wInput.disabled = true;
    }

    editingAthleteId = null;
    editingTeamId = null;
    const submitBtn = document.querySelector('#athleteForm button[type="submit"]');
    if (submitBtn) {
        submitBtn.innerHTML = '<i class="fas fa-save me-2"></i>CONFERMA E REGISTRA';
        submitBtn.className = "btn btn-primary w-100 fw-bold py-3 shadow-sm rounded-3";
    }

    fetchAthletes();
    fetchTeams();
    toggleRegMode();
    adattaInterfacciaAlloSport();
}

function setupBirthdateListeners() {
    const el = document.getElementById('birthdate');
    if (el) {
        el.removeEventListener('change', handleBirthdateChange);
        el.removeEventListener('input', handleBirthdateChange);
        el.addEventListener('change', handleBirthdateChange);
        el.addEventListener('input', handleBirthdateChange);
    }
}

// =========================================================================
// 8. ESPORTAZIONE DATI IN FORMATO CSV/EXCEL
// =========================================================================
async function exportToExcel() {
    const eventId = sessionStorage.getItem('selectedEventId');
    if (!window.currentSocietyId || !eventId) return alert("Errore sessione.");
    try {
        const { data: athletes, error: errA } = await sb.from('atleti').select('*').eq('society_id', window.currentSocietyId).eq('event_id', eventId);
        const { data: teams, error: errT } = await sb.from('teams').select('*').eq('society_id', window.currentSocietyId).eq('event_id', eventId);
        if (errA || errT) throw new Error("Errore nel recupero dati");
        if ((!athletes || athletes.length === 0) && (!teams || teams.length === 0)) return alert("Nessun dato presente.");

        let csv = ["TIPO;NOME/TEAM;MEMBRI;CLASSE;SPECIALITA;CINTURA;SESSO;PESO"];
        athletes.forEach(a => csv.push(`"Individuale";"${a.last_name} ${a.first_name}";"-";"${a.classe}";"${a.specialty}";"${a.belt}";"${a.gender}";"${a.weight_category}"`));
        teams.forEach(t => {
            const membri = t.members ? t.members.join(' - ') : "-";
            csv.push(`"Team";"${t.team_name}";"${membri}";"${t.classe}";"${t.specialty}";"${t.belt || '-'}";"${t.gender}";"${t.weight_category || '-'}"`);
        });
        const blob = new Blob(["\uFEFF" + csv.join("\n")], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const evName = sessionStorage.getItem('selectedEventName') || "Evento";
        link.href = URL.createObjectURL(blob);
        link.download = `Iscritti_${evName}.csv`;
        link.click();
    } catch (error) { alert("Errore durante l'esportazione."); }
}

// Esposizione globale per i pulsanti HTML inline (es: onclick="exportToExcel()")
window.exportToExcel = exportToExcel;

// =========================================================================
// 9. DISPATCHER E REGISTRAZIONE EVENTI DOM
// =========================================================================
document.addEventListener('DOMContentLoaded', () => {
    // Inizializza la pagina corrente (caricamento sport, regole, gara e società)
    initPage();

    // Listeners del Form di Registrazione / Login (Ereditati da script.js)
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
            const email = document.getElementById('email').value;
            const emailConfirm = document.getElementById('emailConfirm').value;
            const password = document.getElementById('password').value;
            const passwordConfirm = document.getElementById('passwordConfirm').value;
            const nomeSocieta = document.getElementById('nomeSocieta').value;
            const cfs = document.getElementById('cfs').value; 
            const cell = document.getElementById('cell').value;

            if (email !== emailConfirm) return alert("Le email inserite non corrispondono!");
            if (password !== passwordConfirm) return alert("Le password inserite non corrispondono!");
            if (password.length < 6) return alert("La password deve essere di almeno 6 caratteri.");

            signUp(email, password, nomeSocieta, cfs, cell);
        });
    }

    // Listeners dei moduli di Iscrizione Atleti / Squadre (Ereditati da script2.js)
    if(document.getElementById('athleteForm')) document.getElementById('athleteForm').addEventListener('submit', addAthlete);
    if(document.getElementById('gender')) document.getElementById('gender').addEventListener('change', handleSpecialtyChange); 
    if(document.getElementById('team_gender')) document.getElementById('team_gender').addEventListener('change', handleSpecialtyChange); 
    if(document.getElementById('team_year')) document.getElementById('team_year').addEventListener('change', handleTeamYearChange);
    if(document.getElementById('specialty')) document.getElementById('specialty').addEventListener('change', handleSpecialtyChange);
    
    document.querySelectorAll('input[name="regType"]').forEach(r => r.addEventListener('change', toggleRegMode));
});
