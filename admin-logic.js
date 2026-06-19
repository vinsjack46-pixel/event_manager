const sb = window.supabaseClient;
let allAthletes = [], allTeams = [];

// Controlla se l'utente ha i permessi di amministratore
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

// Avvia tutto il pannello di controllo
async function initAdmin() {
    console.log("Verifica autorizzazione in corso...");
    const isAuthorized = await checkAdminAccess();
    if (!isAuthorized) return; 

    // Carica configurazione iniziale dello sport nel modulo
    await loadSportConfigFromDB();

    await loadFilterEvents();
    await fetchGlobalData();
    
    // Assegnazione degli ascoltatori degli eventi ai form
    document.getElementById('eventForm').addEventListener('submit', createEvent);
    document.getElementById('sportConfigForm').addEventListener('submit', saveSportConfigToDB);
    document.getElementById('filterEvent').addEventListener('change', filterAll);
    document.getElementById('globalSearch').addEventListener('input', filterAll);
}

// LEGGE LE REGOLE ATTUALI DAL DB E RIEMPIE I CAMPI INTERFACCIA
async function loadSportConfigFromDB() {
    const sportId = document.getElementById('configSportId').value;
    try {
        const { data: config, error } = await sb
            .from('configurazioni_sport')
            .select('*')
            .eq('sport_id', sportId)
            .single();

        if (error || !config) {
            console.log("Nessuna configurazione trovata. Uso valori predefiniti.");
            return;
        }

        // Estrae le informazioni e popola gli input dell'admin.html
        const regole = config.regole || {};
        const limiti = regole.limiti || {};

        document.getElementById('limitKataKumite').value = limiti.KataKumiteSum || 300;
        document.getElementById('limitKids').value = limiti.KIDS || 250;
        document.getElementById('limitPara').value = limiti.ParaKarate || 50;
        document.getElementById('configRichiedePeso').value = config.richiede_peso === false ? "false" : "true";

    } catch (err) {
        console.error("Errore nel caricamento delle regole sport:", err);
    }
}

// LEGGE I CAMPI INTERFACCIA, IMPACCHETTA IN JSON E SALVA SU SUPABASE
async function saveSportConfigToDB(e) {
    e.preventDefault();
    const sportId = document.getElementById('configSportId').value;
    const requiresWeight = document.getElementById('configRichiedePeso').value === "true";
    
    const limitKataKumite = parseInt(document.getElementById('limitKataKumite').value);
    const limitKids = parseInt(document.getElementById('limitKids').value);
    const limitPara = parseInt(document.getElementById('limitPara').value);

    try {
        // Prima scarichiamo la riga per non sovrascrivere le classi d'età e i pesi esistenti
        const { data: currentConfig } = await sb.from('configurazioni_sport').select('*').eq('sport_id', sportId).single();
        
        let baseRegole = currentConfig ? currentConfig.regole : {};
        
        // Aggiorniamo o inseriamo solo la sezione dei limiti lasciando intatto il resto
        baseRegole.limiti = {
            KataKumiteSum: limitKataKumite,
            KIDS: limitKids,
            ParaKarate: limitPara
        };

        // Aggiorna il record sul database Supabase
        const { error } = await sb
            .from('configurazioni_sport')
            .update({
                richiede_peso: requiresWeight,
                richiega_peso: requiresWeight, // Doppia chiave di compatibilità salvataggio
                regole: baseRegole
            })
            .eq('sport_id', sportId);

        if (error) throw error;
        alert("Configurazione limiti modificata con successo sul database!");

    } catch (err) {
        alert("Errore durante il salvataggio: " + err.message);
    }
}

// Carica l'elenco globale degli iscritti
async function fetchGlobalData() {
    const { data: atleti } = await sb.from('atleti').select('*, societa(nome), eventi(nome)');
    const { data: teams } = await sb.from('teams').select('*, societa(nome), eventi(nome)');
    allAthletes = atleti || [];
    allTeams = teams || [];
    renderTables(allAthletes, allTeams);
}

// Mostra a schermo i dati nelle tabelle
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
            <small><strong>${e.nome}</strong><br>${e.data_evento}</small>
            <button onclick="deleteEvent('${e.id}')" class="btn btn-sm text-danger p-0"><i class="fas fa-times"></i></button>
        </div>`;
    });
}

async function createEvent(e) {
    e.preventDefault();
    const { error } = await sb.from('eventi').insert([{ 
        nome: document.getElementById('eventName').value, 
        data_evento: document.getElementById('eventDate').value, 
        luogo: document.getElementById('eventLocation').value 
    }]);
    if(!error) { 
        document.getElementById('eventForm').reset(); 
        loadFilterEvents(); 
    } else {
        alert("Errore creazione evento: " + error.message);
    }
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
    link.download = `Export_Gare_v5.csv`;
    link.click();
}

document.addEventListener('DOMContentLoaded', initAdmin);
