const sb = window.supabaseClient;

// Cache locale per permettere la ricerca istantanea senza stressare il database
let allAthletes = [];
let allTeams = [];

async function initAdmin() {
    console.log("Admin Initializing...");
    
    // 1. Carichiamo gli eventi (per filtri e lista laterale)
    await loadFilterEvents();
    
    // 2. Carichiamo tutti i dati (Atleti e Team)
    await fetchGlobalData();

    // 3. Setup dei listener
    const eventForm = document.getElementById('eventForm');
    if (eventForm) {
        eventForm.addEventListener('submit', createEvent);
    }

    document.getElementById('filterEvent').addEventListener('change', filterAll);
    document.getElementById('globalSearch').addEventListener('input', filterAll);
}

// --- CARICAMENTO DATI (CON JOIN) ---
async function fetchGlobalData() {
    // Carichiamo Atleti + nomi Società ed Eventi in un colpo solo
    const { data: atleti, error: errA } = await sb
        .from('atleti')
        .select('*, societa(nome), eventi(nome)');

    // Carichiamo Team + nomi Società ed Eventi
    const { data: teams, error: errT } = await sb
        .from('teams')
        .select('*, societa(nome), eventi(nome)');

    if (errA || errT) {
        console.error("Errore Supabase:", errA || errT);
        return;
    }

    allAthletes = atleti || [];
    allTeams = teams || [];

    renderTables(allAthletes, allTeams);
}

// --- RENDERING TABELLE ---
function renderTables(atleti, teams) {
    const listInd = document.getElementById('adminAthleteList');
    const listTeam = document.getElementById('adminTeamList');
    
    listInd.innerHTML = "";
    listTeam.innerHTML = "";

    // Rendering Atleti Individuali
    atleti.forEach(a => {
        listInd.innerHTML += `
            <tr>
                <td><strong>${a.last_name} ${a.first_name}</strong><br><small class="text-muted">${a.eventi?.nome || '-'}</small></td>
                <td>${a.societa?.nome || '-'}</td>
                <td>${a.classe}<br><small class="text-primary">${a.specialty}</small></td>
                <td><span class="badge bg-light text-dark border">${a.belt}</span></td>
                <td>${a.gender}</td>
                <td>${a.weight_category}</td>
                <td class="text-end">
                    <button onclick="deleteRecord('atleti', '${a.id}')" class="btn btn-sm text-danger border-0">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>`;
    });

    // Rendering Team
    teams.forEach(t => {
        listTeam.innerHTML += `
            <tr class="table-success-light">
                <td>
                    <div class="fw-bold text-success">${t.team_name}</div>
                    <div class="small text-muted">${t.members?.join(" • ")}</div>
                    <small class="text-muted">${t.eventi?.nome || '-'}</small>
                </td>
                <td>${t.societa?.nome || '-'}</td>
                <td>${t.classe}<br><small class="text-primary">${t.specialty}</small></td>
                <td>${t.gender}</td>
                <td><small>${t.belt || '-'} / ${t.weight_category || '-'}</small></td>
                <td class="text-end">
                    <button onclick="deleteRecord('teams', '${t.id}')" class="btn btn-sm text-danger border-0">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>`;
    });

    // Aggiornamento Contatori
    document.getElementById('countInd').innerText = atleti.length;
    document.getElementById('countTeam').innerText = teams.length;
    document.getElementById('totalCounter').innerText = `${atleti.length + teams.length} Iscrizioni Totali`;
}

// --- FILTRI (RICERCA + EVENTO) ---
function filterAll() {
    const searchTerm = document.getElementById('globalSearch').value.toLowerCase();
    const eventId = document.getElementById('filterEvent').value;

    const filteredAthletes = allAthletes.filter(a => {
        const matchesSearch = (a.first_name + a.last_name + (a.societa?.nome || "") + a.classe).toLowerCase().includes(searchTerm);
        const matchesEvent = eventId === "" || a.event_id === eventId;
        return matchesSearch && matchesEvent;
    });

    const filteredTeams = allTeams.filter(t => {
        const matchesSearch = (t.team_name + (t.societa?.nome || "") + t.classe + t.members.join(" ")).toLowerCase().includes(searchTerm);
        const matchesEvent = eventId === "" || t.event_id === eventId;
        return matchesSearch && matchesEvent;
    });

    renderTables(filteredAthletes, filteredTeams);
}

// --- GESTIONE CANCELLAZIONE ---
async function deleteRecord(table, id) {
    if (confirm("Sei sicuro di voler eliminare questa iscrizione?")) {
        const { error } = await sb.from(table).delete().eq('id', id);
        if (error) alert("Errore: " + error.message);
        else await fetchGlobalData(); // Ricarica tutto
    }
}

// --- GESTIONE EVENTI (CORRETTO data_evento) ---
async function loadFilterEvents() {
    // CORREZIONE: Uso 'data_evento' invece di 'data'
    const { data: eventi, error } = await sb.from('eventi').select('*').order('data_evento', { ascending: false });
    
    if (error) {
        console.error("Errore caricamento eventi:", error);
        return;
    }

    const select = document.getElementById('filterEvent');
    const scrollList = document.getElementById('eventList');
    
    select.innerHTML = '<option value="">Tutti gli Eventi</option>';
    scrollList.innerHTML = "";

    eventi?.forEach(e => {
        select.innerHTML += `<option value="${e.id}">${e.nome}</option>`;
        scrollList.innerHTML += `
            <div class="p-3 border-bottom d-flex justify-content-between align-items-center bg-white">
                <div>
                    <div class="fw-bold" style="font-size:0.85rem">${e.nome}</div>
                    <small class="text-muted">${e.data_evento}</small>
                </div>
                <button onclick="deleteEvent('${e.id}')" class="btn btn-sm text-danger p-0"><i class="fas fa-trash-alt"></i></button>
            </div>`;
    });
}

async function createEvent(e) {
    e.preventDefault();
    const nome = document.getElementById('eventName').value;
    const data_evento = document.getElementById('eventDate').value;
    const luogo = document.getElementById('eventLocation').value;

    const { error } = await sb.from('eventi').insert([{ nome, data_evento, luogo }]);
    
    if (error) alert("Errore: " + error.message);
    else {
        document.getElementById('eventForm').reset();
        await loadFilterEvents();
        alert("Evento creato!");
    }
}

async function deleteEvent(id) {
    if (confirm("ATTENZIONE: Eliminando l'evento eliminerai TUTTI gli iscritti associati. Procedere?")) {
        await sb.from('eventi').delete().eq('id', id);
        await loadFilterEvents();
        await fetchGlobalData();
    }
}

// Avvio
document.addEventListener('DOMContentLoaded', initAdmin);
