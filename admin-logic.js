const sb = window.supabaseClient;
let allAthletes = [], allTeams = [];
let isCreatingNewSport = false;

async function checkAdminAccess() {
    const { data: { user }, error } = await sb.auth.getUser();
    const authorizedAdmins = ["vinsjack46@gmail.com", "19vincenzo89@gmail.com"]; 

    if (error || !user || !authorizedAdmins.includes(user.email)) {
        alert("Accesso negato: Non sei autorizzato a vedere questa pagina.");
        window.location.href = "login.html";
        return false;
    }
    return true;
}

async function initAdmin() {
    console.log("Verifica autorizzazione in corso...");
    const isAuthorized = await checkAdminAccess();
    if (!isAuthorized) return; 

    await refreshSportDropdowns();
    await loadFilterEvents();
    await fetchGlobalData();
    
    document.getElementById('eventForm').addEventListener('submit', createEvent);
    document.getElementById('sportConfigForm').addEventListener('submit', saveSportConfigToDB);
    document.getElementById('filterEvent').addEventListener('change', filterAll);
    document.getElementById('globalSearch').addEventListener('input', filterAll);
}

async function refreshSportDropdowns() {
    try {
        const { data: sports, error } = await sb.from('configurazioni_sport').select('sport_id');
        if (error) throw error;

        const configSelect = document.getElementById('configSportId');
        const eventSelect = document.getElementById('eventSportId');
        
        configSelect.innerHTML = "";
        eventSelect.innerHTML = '<option value="">-- Seleziona Sport --</option>';

        sports?.forEach(s => {
            const opt = `<option value="${s.sport_id}">${s.sport_id.toUpperCase()}</option>`;
            configSelect.innerHTML += opt;
            eventSelect.innerHTML += opt;
        });

        if (!isCreatingNewSport) {
            await loadSportConfigFromDB();
        }
    } catch (err) {
        console.error("Errore nel caricamento degli elenchi sport:", err);
    }
}

function toggleNewSportInput() {
    const select = document.getElementById('configSportId');
    const input = document.getElementById('newSportId');
    const metaFields = document.getElementById('sportMetaFields');
    const btn = document.getElementById('toggleNewSportBtn');

    if (!isCreatingNewSport) {
        select.style.display = "none";
        input.style.display = "block";
        metaFields.style.display = "block";
        input.value = "";
        btn.innerText = "×";
        isCreatingNewSport = true;
    } else {
        select.style.display = "block";
        input.style.display = "none";
        metaFields.style.display = "none";
        btn.innerText = "+";
        isCreatingNewSport = false;
        loadSportConfigFromDB();
    }
}

async function loadSportConfigFromDB() {
    if (isCreatingNewSport) return;
    const sportId = document.getElementById('configSportId').value;
    if (!sportId) return;

    try {
        const { data: config, error } = await sb
            .from('configurazioni_sport')
            .select('*')
            .eq('sport_id', sportId)
            .single();

        if (error || !config) return;

        const regole = config.regole || {};
        const limiti = regole.limiti || {};

        document.getElementById('limitKataKumite').value = limiti.KataKumiteSum || 300;
        document.getElementById('limitKids').value = limiti.KIDS || 250;
        document.getElementById('limitPara').value = limiti.ParaKarate || 50;
        document.getElementById('configRichiedePeso').value = config.richiede_peso === false ? "false" : "true";

    } catch (err) {
        console.error(err);
    }
}

async function saveSportConfigToDB(e) {
    e.preventDefault();
    
    let sportId = "";
    const requiresWeight = document.getElementById('configRichiedePeso').value === "true";
    const labelLivello = document.getElementById('configEtichetta').value || "Cintura";
    
    const limitKataKumite = parseInt(document.getElementById('limitKataKumite').value);
    const limitKids = parseInt(document.getElementById('limitKids').value);
    const limitPara = parseInt(document.getElementById('limitPara').value);

    if (isCreatingNewSport) {
        sportId = document.getElementById('newSportId').value.trim().toLowerCase();
        if (!sportId) return alert("Inserisci un ID valido per il nuovo sport!");
    } else {
        sportId = document.getElementById('configSportId').value;
    }

    try {
        let baseRegole = { classi_eta: [], pesi: { Default: ["Open"] } };

        if (!isCreatingNewSport) {
            const { data: currentConfig } = await sb.from('configurazioni_sport').select('*').eq('sport_id', sportId).single();
            if (currentConfig && currentConfig.regole) baseRegole = currentConfig.regole;
        }

        baseRegole.limiti = {
            KataKumiteSum: limitKataKumite,
            KIDS: limitKids,
            ParaKarate: limitPara
        };

        // Identifica il valore predefinito speculare per evitare errori di vincolo NOT NULL
        const sportValueFormatted = sportId.toUpperCase();

        const payload = {
            richiede_peso: requiresWeight,
            regole: baseRegole,
            etichetta_livello: labelLivello,
            // Assegna in modo sicuro sia a 'nome' che a 'nome_sport' (qualunque sia presente sulla tabella)
            sport_id: sportValueFormatted,
            nome_sport: sportValueFormatted
        };

        let resultError = null;

        if (isCreatingNewSport) {
            const { error } = await sb.from('configurazioni_sport').insert([{ sport_id: sportId, ...payload }]);
            resultError = error;
        } else {
            const { error } = await sb.from('configurazioni_sport').update(payload).eq('sport_id', sportId);
            resultError = error;
        }

        if (resultError) throw resultError;

        alert(isCreatingNewSport ? "Nuovo sport creato con successo!" : "Limiti sport aggiornati!");
        
        if (isCreatingNewSport) {
            toggleNewSportInput();
        }
        await refreshSportDropdowns();

    } catch (err) {
        alert("Errore durante il salvataggio dello sport: " + err.message);
    }
}

async function createEvent(e) {
    e.preventDefault();
    const sId = document.getElementById('eventSportId').value;
    if (!sId) return alert("Seleziona uno sport da associare a questo evento!");

    const { error } = await sb.from('eventi').insert([{ 
        nome: document.getElementById('eventName').value, 
        data_evento: document.getElementById('eventDate').value, 
        luogo: document.getElementById('eventLocation').value,
        sport_id: sId 
    }]);

    if (!error) { 
        document.getElementById('eventForm').reset(); 
        loadFilterEvents(); 
        alert("Evento associato allo sport '" + sId.toUpperCase() + "' creato con successo!");
    } else {
        alert("Errore creazione evento: " + error.message);
    }
}

async function fetchGlobalData() {
    const { data: atleti } = await sb.from('atleti').select('*, societa(nome), eventi(nome)');
    const { data: teams } = await sb.from('teams').select('*, societa(nome), eventi(nome)');
    allAthletes = atleti || [];
    allTeams = teams || [];
    renderTables(allAthletes, allTeams);
}

function renderTables(atleti, teams) {
    const listInd = document.getElementById('adminAthleteList');
    const listTeam = document.getElementById('adminTeamList');
    if(!listInd || !listTeam) return;

    listInd.innerHTML = ""; listTeam.innerHTML = "";

    atleti.forEach(a => {
        listInd.innerHTML += `<tr>
            <td><strong>${a.last_name} ${a.first_name}</strong><br><small class="text-muted">${a.eventi?.nome || '-'}</small></td>
            <td>${a.societa?.nome || '-'}</td>
            <td>${a.classe}<br><small class="text-primary">${a.specialty}</small></td>
            <td><span class="badge bg-light text-dark border">${a.belt}</span></td>
            <td>${a.gender} / ${a.weight_category}</td>
            <td class="text-end"><button onclick="deleteRecord('atleti','${a.id}')" class="btn btn-sm text-danger"><i class="fas fa-trash"></i></button></td>
        </tr>`;
    });

    teams.forEach(t => {
        listTeam.innerHTML += `<tr class="table-success-light">
            <td><div class="fw-bold text-success">${t.team_name}</div><small class="text-muted">${t.members?.join(" • ")}</small><br><small class="text-muted">${t.eventi?.nome || '-'}</small></td>
            <td>${t.societa?.nome || '-'}</td>
            <td>${t.classe}<br><small class="text-primary">${t.specialty}</small></td>
            <td>${t.gender}</td>
            <td><small>${t.belt || '-'} / ${t.weight_category || '-'}</small></td>
            <td class="text-end"><button onclick="deleteRecord('teams','${t.id}')" class="btn btn-sm text-danger"><i class="fas fa-trash"></i></button></td>
        </tr>`;
    });

    document.getElementById('countInd').innerText = atleti.length;
    document.getElementById('countTeam').innerText = teams.length;
    document.getElementById('totalCounter').innerText = `${atleti.length + teams.length} Totali`;
}

function filterAll() {
    const term = document.getElementById('globalSearch').value.toLowerCase();
    const evId = document.getElementById('filterEvent').value;
    const fA = allAthletes.filter(a => (a.first_name+a.last_name+a.societa?.nome).toLowerCase().includes(term) && (!evId || a.event_id == evId));
    const fT = allTeams.filter(t => (t.team_name+t.societa?.nome).toLowerCase().includes(term) && (!evId || t.event_id == evId));
    renderTables(fA, fT);
}

async function deleteRecord(table, id) {
    if(confirm("Sei sicuro di voler eliminare questo record?")) { 
        await sb.from(table).delete().eq('id', id); 
        fetchGlobalData(); 
    }
}

async function loadFilterEvents() {
    const { data: eventi } = await sb.from('eventi').select('*').order('data_evento', { ascending: false });
    const select = document.getElementById('filterEvent');
    const scroll = document.getElementById('eventList');
    
    if(select) select.innerHTML = '<option value="">Tutti gli Eventi</option>';
    if(scroll) scroll.innerHTML = "";

    eventi?.forEach(e => {
        if(select) select.innerHTML += `<option value="${e.id}">${e.nome}</option>`;
        if(scroll) scroll.innerHTML += `<div class="p-2 border-bottom d-flex justify-content-between align-items-center bg-white">
            <small><strong>${e.nome}</strong> (${e.sport_id ? e.sport_id.toUpperCase() : 'KARATE'})<br>${e.data_evento}</small>
            <button onclick="deleteEvent('${e.id}')" class="btn btn-sm text-danger p-0"><i class="fas fa-times"></i></button>
        </div>`;
    });
}

async function deleteEvent(id) {
    if(confirm("Eliminando l'evento cancellerai anche tutti gli iscritti associati. Procedere?")) { 
        await sb.from('eventi').delete().eq('id', id); 
        loadFilterEvents(); 
        fetchGlobalData(); 
    }
}

async function handleLogout() {
    await sb.auth.signOut();
    window.location.href = 'login.html';
}

function exportAllToCSV() {
    let csv = ["TIPO;NOME/TEAM;MEMBRI;EVENTO;SOCIETA;CLASSE;SPECIALITA;CINTURA;SESSO;PESO"];
    allAthletes.forEach(a => csv.push(`"Individuale";"${a.first_name} ${a.last_name}";"-";"${a.eventi?.nome}";"${a.societa?.nome}";"${a.classe}";"${a.specialty}";"${a.belt}";"${a.gender}";"${a.weight_category}"`));
    allTeams.forEach(t => csv.push(`"Team";"${t.team_name}";"${t.members?.join(' - ')}";"${t.eventi?.nome}";"${t.societa?.nome}";"${t.classe}";"${t.specialty}";"${t.belt || '-'}";"${t.gender}";"${t.weight_category || '-'}"`));
    
    const blob = new Blob(["\uFEFF" + csv.join("\n")], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Export_Gare_v6.csv`;
    link.click();
}

document.addEventListener('DOMContentLoaded', initAdmin);
