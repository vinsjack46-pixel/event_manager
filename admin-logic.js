const sb = window.supabaseClient;
let allAthletes = [], allTeams = [];

// --- PROTEZIONE VERSION 5.0 ---
// Questa funzione decide chi può restare in questa pagina
async function checkAdminAccess() {
    const { data: { user }, error } = await sb.auth.getUser();

    // MODIFICA QUI: Metti la tua email tra le virgolette
    const authorizedAdmins = ["vinsjack46@gmail.com", "19vincenzo89@gmail.com"]; 

    if (error || !user || !authorizedAdmins.includes(user.email)) {
        alert("Accesso negato: Non sei autorizzato a vedere questa pagina.");
        window.location.href = "login.html"; // Spedisce l'utente al login
        return false;
    }
    return true;
}

// Funzione che avvia tutto il pannello
async function initAdmin() {
    console.log("Verifica autorizzazione in corso...");
    
    // Controlliamo se l'utente è un admin prima di mostrare i dati
    const isAuthorized = await checkAdminAccess();
    if (!isAuthorized) return; 

    // Se arriviamo qui, l'utente è autorizzato
    await loadFilterEvents();
    await fetchGlobalData();
    
    // Listener per i moduli
    document.getElementById('eventForm').addEventListener('submit', createEvent);
    document.getElementById('filterEvent').addEventListener('change', filterAll);
    document.getElementById('globalSearch').addEventListener('input', filterAll);
}

// Carica i dati dal database
async function fetchGlobalData() {
    const { data: atleti } = await sb.from('atleti').select('*, societa(nome), eventi(nome)');
    const { data: teams } = await sb.from('teams').select('*, societa(nome), eventi(nome)');
    allAthletes = atleti || [];
    allTeams = teams || [];
    renderTables(allAthletes, allTeams);
}

// Disegna le tabelle sullo schermo
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

// Filtro di ricerca e filtro evento
function filterAll() {
    const term = document.getElementById('globalSearch').value.toLowerCase();
    const evId = document.getElementById('filterEvent').value;
    const fA = allAthletes.filter(a => (a.first_name+a.last_name+a.societa?.nome).toLowerCase().includes(term) && (!evId || a.event_id == evId));
    const fT = allTeams.filter(t => (t.team_name+t.societa?.nome).toLowerCase().includes(term) && (!evId || t.event_id == evId));
    renderTables(fA, fT);
}

// Cancella un iscritto
async function deleteRecord(table, id) {
    if(confirm("Sei sicuro di voler eliminare questo record?")) { 
        await sb.from(table).delete().eq('id', id); 
        fetchGlobalData(); 
    }
}

// Gestione Eventi (Lista a sinistra)
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

// Crea un nuovo evento
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

// Funzione Logout
async function handleLogout() {
    await sb.auth.signOut();
    window.location.href = 'login.html';
}

// Esporta i dati in CSV (Excel)
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

// Avvio automatico al caricamento della pagina
document.addEventListener('DOMContentLoaded', initAdmin);
