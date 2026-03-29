const sb = window.supabaseClient;

// Cache per filtri istantanei
let allAthletes = [];
let allTeams = [];

async function initAdmin() {
    console.log("Admin Dashboard Initializing...");
    await loadFilterEvents();
    await fetchGlobalData();

    // Event Listeners
    document.getElementById('eventForm').addEventListener('submit', createEvent);
    document.getElementById('filterEvent').addEventListener('change', filterAll);
    document.getElementById('globalSearch').addEventListener('input', filterAll);
}

// --- RECUPERO DATI (CON JOIN) ---
async function fetchGlobalData() {
    // Carichiamo atleti e team includendo i nomi di società ed eventi tramite foreign keys
    const { data: atleti, error: errA } = await sb
        .from('atleti')
        .select('*, societa(nome), eventi(nome)');

    const { data: teams, error: errT } = await sb
        .from('teams')
        .select('*, societa(nome), eventi(nome)');

    if (errA || errT) {
        console.error("Errore caricamento dati:", errA || errT);
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

    // Rendering Individuali
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

    document.getElementById('countInd').innerText = atleti.length;
    document.getElementById('countTeam').innerText = teams.length;
    document.getElementById('totalCounter').innerText = `${atleti.length + teams.length} Totali`;
}

// --- FILTRI ---
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

// --- EXPORT UNIFICATO ---
function exportAllToCSV() {
    let csv = [];
    csv.push("TIPO;NOME/TEAM;MEMBRI;EVENTO;SOCIETA;CLASSE;SPECIALITA;CINTURA;SESSO;PESO");

    // Atleti
    document.querySelectorAll("#adminAthleteList tr").forEach(tr => {
        const cols = tr.querySelectorAll("td");
        if (cols.length > 0) {
            let riga = [
                "Individuale",
                cols[0].querySelector('strong').innerText,
                "-",
                cols[0].querySelector('small').innerText,
                cols[1].innerText,
                cols[2].innerText.split('\n')[0],
                cols[2].querySelector('small')?.innerText || "",
                cols[3].innerText,
                cols[4].innerText,
                cols[5].innerText
            ];
            csv.push(riga.map(v => `"${v.trim()}"`).join(";"));
        }
    });

    // Team
    document.querySelectorAll("#adminTeamList tr").forEach(tr => {
        const cols = tr.querySelectorAll("td");
        if (cols.length > 0) {
            let riga = [
                "Team",
                cols[0].querySelector('.fw-bold').innerText,
                cols[0].querySelector('.small').innerText.replace(/ • /g, " - "),
                cols[0].querySelector('small').innerText,
                cols[1].innerText,
                cols[2].innerText.split('\n')[0],
                cols[2].querySelector('small')?.innerText || "",
                cols[4].innerText.split(' / ')[0],
                cols[3].innerText,
                cols[4].innerText.split(' / ')[1] || "-"
            ];
            csv.push(riga.map(v => `"${v.trim()}"`).join(";"));
        }
    });

    const csvContent = "\uFEFF" + csv.join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", `ISCRITTI_GARE_${new Date().toISOString().slice(0, 10)}.csv`);
    link.click();
}

// --- GESTIONE CANCELLAZIONI ---
async function deleteRecord(table, id) {
    if (confirm("Eliminare definitivamente questa iscrizione?")) {
        await sb.from(table).delete().eq('id', id);
        await fetchGlobalData();
    }
}

async function loadFilterEvents() {
    const { data: eventi } = await sb.from('eventi').select('*').order('data_evento', { ascending: false });
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
    if (error) alert(error.message);
    else {
        document.getElementById('eventForm').reset();
        await loadFilterEvents();
        alert("Evento creato!");
    }
}

async function deleteEvent(id) {
    if (confirm("Eliminando l'evento cancellerai TUTTI gli iscritti associati. Confermi?")) {
        await sb.from('eventi').delete().eq('id', id);
        await loadFilterEvents();
        await fetchGlobalData();
    }
}

document.addEventListener('DOMContentLoaded', initAdmin);
