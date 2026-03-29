const sb = window.supabaseClient;

async function initAdmin() {
    console.log("Admin Initializing...");
    await loadFilterEvents();
    await fetchGlobalData();

    // Rimuoviamo eventuali vecchi listener per evitare duplicati
    const eventForm = document.getElementById('eventForm');
    eventForm.removeEventListener('submit', createEvent);
    eventForm.addEventListener('submit', createEvent);

    document.getElementById('filterEvent').addEventListener('change', fetchGlobalData);
    document.getElementById('globalSearch').addEventListener('input', filterTables);
}

// --- CARICAMENTO DATI ---
async function fetchGlobalData() {
    const filterEventId = document.getElementById('filterEvent').value;

    // 1. Recupero mapping Società ed Eventi
    const { data: societa } = await sb.from('societa').select('id, nome');
    const { data: eventi } = await sb.from('eventi').select('id, nome');
    
    const socMap = Object.fromEntries(societa?.map(s => [s.id, s.nome]) || []);
    const evMap = Object.fromEntries(eventi?.map(e => [e.id, e.nome]) || []);

    // 2. Query Atleti Individuali
    let qA = sb.from('atleti').select('*').order('last_name');
    if (filterEventId) qA = qA.eq('event_id', filterEventId);
    const { data: atleti, error: errA } = await qA;

    // 3. Query Team
    let qT = sb.from('teams').select('*').order('team_name');
    if (filterEventId) qT = qT.eq('event_id', filterEventId);
    const { data: teams, error: errT } = await qT;

    if (errA || errT) {
        console.error("Errore caricamento dati:", errA || errT);
        return;
    }

    renderTables(atleti, teams, socMap, evMap);
}

function renderTables(atleti, teams, socMap, evMap) {
    const listInd = document.getElementById('adminAthleteList');
    const listTeam = document.getElementById('adminTeamList');
    
    listInd.innerHTML = "";
    listTeam.innerHTML = "";

    // Popolamento Atleti
    atleti?.forEach(a => {
        listInd.innerHTML += `
            <tr>
                <td><strong>${a.last_name} ${a.first_name}</strong></td>
                <td>${socMap[a.society_id] || '-'}</td>
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

    // Popolamento Team
    teams?.forEach(t => {
        listTeam.innerHTML += `
            <tr class="table-success-light">
                <td>
                    <div class="fw-bold text-success">${t.team_name}</div>
                    <div class="small text-muted">${t.members?.join(" • ")}</div>
                </td>
                <td>${socMap[t.society_id] || '-'}</td>
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

    // Aggiorna Contatori
    document.getElementById('countInd').innerText = atleti?.length || 0;
    document.getElementById('countTeam').innerText = teams?.length || 0;
    document.getElementById('totalCounter').innerText = `${(atleti?.length || 0) + (teams?.length || 0)} Iscrizioni Totali`;
}

// --- GESTIONE CANCELLAZIONE RECORD (ATLETI/TEAM) ---
async function deleteRecord(table, id) {
    if (confirm("Sei sicuro di voler eliminare questa iscrizione?")) {
        const { error } = await sb.from(table).delete().eq('id', id);
        if (error) alert("Errore: " + error.message);
        else fetchGlobalData();
    }
}

// --- GESTIONE EVENTI ---
async function loadFilterEvents() {
    const { data: eventi, error } = await sb.from('eventi').select('*').order('data', { ascending: false });
    if (error) return;

    const select = document.getElementById('filterEvent');
    const scrollList = document.getElementById('eventList');
    
    const currentFilter = select.value;
    select.innerHTML = '<option value="">Tutti gli Eventi</option>';
    scrollList.innerHTML = "";

    eventi?.forEach(e => {
        select.innerHTML += `<option value="${e.id}">${e.nome}</option>`;
        scrollList.innerHTML += `
            <div class="p-3 border-bottom d-flex justify-content-between align-items-center bg-white">
                <div>
                    <div class="fw-bold" style="font-size:0.85rem">${e.nome}</div>
                    <small class="text-muted">${new Date(e.data).toLocaleDateString()}</small>
                </div>
                <button onclick="deleteEvent('${e.id}')" class="btn btn-sm text-danger p-0"><i class="fas fa-trash-alt"></i></button>
            </div>`;
    });
    select.value = currentFilter;
}

async function createEvent(e) {
    e.preventDefault();
    const nome = document.getElementById('eventName').value;
    const data = document.getElementById('eventDate').value;
    const luogo = document.getElementById('eventLocation').value;

    const { error } = await sb.from('eventi').insert([{ nome, data, luogo }]);
    
    if (error) {
        alert("Errore creazione evento: " + error.message);
    } else {
        document.getElementById('eventForm').reset();
        await loadFilterEvents();
        alert("Evento creato con successo!");
    }
}

async function deleteEvent(id) {
    if (confirm("ELIMINAZIONE EVENTO: Questo cancellerà l'evento e tutti gli iscritti associati. Confermi?")) {
        const { error } = await sb.from('eventi').delete().eq('id', id);
        if (error) alert(error.message);
        else {
            await loadFilterEvents();
            await fetchGlobalData();
        }
    }
}

function filterTables() {
    const val = document.getElementById('globalSearch').value.toLowerCase();
    document.querySelectorAll('tbody tr').forEach(tr => {
        tr.style.display = tr.innerText.toLowerCase().includes(val) ? '' : 'none';
    });
}

document.addEventListener('DOMContentLoaded', initAdmin);
