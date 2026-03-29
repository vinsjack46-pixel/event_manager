const sb = window.supabaseClient;

async function initAdmin() {
    await loadFilterEvents();
    await fetchGlobalData();

    // Event Listeners per i filtri
    document.getElementById('filterEvent').addEventListener('change', fetchGlobalData);
    document.getElementById('globalSearch').addEventListener('input', filterTable);
    document.getElementById('eventForm').addEventListener('submit', createEvent);
}

// --- CARICAMENTO DATI ---
async function fetchGlobalData() {
    const filterEventId = document.getElementById('filterEvent').value;

    // 1. Recupera Società ed Eventi per il mapping dei nomi
    const { data: societa } = await sb.from('societa').select('id, nome');
    const { data: eventi } = await sb.from('eventi').select('id, nome');
    
    const socMap = Object.fromEntries(societa.map(s => [s.id, s.nome]));
    const evMap = Object.fromEntries(eventi.map(e => [e.id, e.nome]));

    // 2. Query Atleti
    let queryAtleti = sb.from('atleti').select('*');
    if (filterEventId) queryAtleti = queryAtleti.eq('event_id', filterEventId);
    const { data: atleti } = await queryAtleti;

    // 3. Query Team
    let queryTeams = sb.from('teams').select('*');
    if (filterEventId) queryTeams = queryTeams.eq('event_id', filterEventId);
    const { data: teams } = await queryTeams;

    renderAdminTable(atleti, teams, socMap, evMap);
}

// --- RENDERING TABELLA ---
function renderAdminTable(atleti, teams, socMap, evMap) {
    const tbody = document.getElementById('adminAthleteList');
    tbody.innerHTML = "";
    let totalCount = 0;

    // Render Atleti Individuali
    atleti?.forEach(a => {
        totalCount++;
        tbody.innerHTML += `
            <tr class="athlete-row">
                <td>
                    <div class="fw-bold text-dark">${a.last_name} ${a.first_name}</div>
                    <small class="badge bg-info-subtle text-info px-2" style="font-size:0.65rem">INDIVIDUALE</small>
                </td>
                <td><small>${evMap[a.event_id] || 'N/D'}</small></td>
                <td><span class="text-muted">${socMap[a.society_id] || 'N/D'}</span></td>
                <td>${a.classe} <br> <small class="text-primary">${a.specialty}</small></td>
                <td>${a.weight_category}</td>
                <td class="text-center"><span class="badge bg-light text-dark border">${a.gender}</span></td>
            </tr>`;
    });

    // Render Team
    teams?.forEach(t => {
        totalCount++;
        tbody.innerHTML += `
            <tr class="team-row table-success-light">
                <td>
                    <div class="fw-bold text-success">${t.team_name}</div>
                    <small class="text-muted" style="font-size:0.75rem">${t.members?.join(", ")}</small><br>
                    <small class="badge bg-success-subtle text-success px-2" style="font-size:0.65rem">SQUADRA</small>
                </td>
                <td><small>${evMap[t.event_id] || 'N/D'}</small></td>
                <td><span class="text-muted">${socMap[t.society_id] || 'N/D'}</span></td>
                <td>${t.classe} <br> <small class="text-primary">${t.specialty}</small></td>
                <td>${t.weight_category || '-'}</td>
                <td class="text-center"><span class="badge bg-light text-dark border">${t.gender}</span></td>
            </tr>`;
    });

    document.getElementById('totalCounter').innerText = `${totalCount} Iscrizioni Totali`;
}

// --- FILTRO RICERCA RAPIDA ---
function filterTable() {
    const searchText = document.getElementById('globalSearch').value.toLowerCase();
    const rows = document.querySelectorAll('#adminAthleteList tr');

    rows.forEach(row => {
        const text = row.innerText.toLowerCase();
        row.style.display = text.includes(searchText) ? '' : 'none';
    });
}

// --- GESTIONE EVENTI (LISTA A SINISTRA) ---
async function loadFilterEvents() {
    const { data: eventi } = await sb.from('eventi').select('*').order('data', { ascending: false });
    const select = document.getElementById('filterEvent');
    const scrollList = document.getElementById('eventList');
    
    select.innerHTML = '<option value="">Tutti gli Eventi</option>';
    scrollList.innerHTML = "";

    eventi?.forEach(e => {
        select.innerHTML += `<option value="${e.id}">${e.nome}</option>`;
        scrollList.innerHTML += `
            <div class="p-3 border-bottom d-flex justify-content-between align-items-center">
                <div>
                    <div class="fw-bold" style="font-size:0.9rem">${e.nome}</div>
                    <small class="text-muted">${new Date(e.data).toLocaleDateString()}</small>
                </div>
                <button onclick="deleteEvent('${e.id}')" class="btn btn-sm text-danger"><i class="fas fa-trash-alt"></i></button>
            </div>`;
    });
}

async function createEvent(e) {
    e.preventDefault();
    const nome = document.getElementById('eventName').value;
    const data = document.getElementById('eventDate').value;
    const luogo = document.getElementById('eventLocation').value;

    const { error } = await sb.from('eventi').insert([{ nome, data, luogo }]);
    if (error) alert(error.message);
    else {
        alert("Evento creato!");
        document.getElementById('eventForm').reset();
        initAdmin();
    }
}

async function deleteEvent(id) {
    if (confirm("Attenzione: eliminando l'evento eliminerai anche tutti gli iscritti collegati. Procedere?")) {
        await sb.from('eventi').delete().eq('id', id);
        initAdmin();
    }
}

// --- EXPORT ADMIN ---
function exportAdminToExcel() {
    let csv = ["Tipo,Nome/Team,Membri,Evento,Società,Classe,Specialità,Sesso,Peso"];
    document.querySelectorAll("#adminAthleteList tr").forEach(tr => {
        const cells = tr.querySelectorAll("td");
        if (cells.length > 0) {
            const tipo = cells[0].querySelector(".badge").innerText;
            const nome = cells[0].querySelector(".fw-bold").innerText;
            const membri = tipo === "SQUADRA" ? cells[0].querySelector(".text-muted").innerText.replace(/,/g, " - ") : "";
            const rowData = [
                tipo,
                nome,
                membri,
                cells[1].innerText,
                cells[2].innerText,
                cells[3].querySelector("div")?.innerText || cells[3].innerText.split('\n')[0],
                cells[3].querySelector("small")?.innerText || "",
                cells[5].innerText,
                cells[4].innerText
            ];
            csv.push(rowData.map(v => `"${v}"`).join(","));
        }
    });
    
    const blob = new Blob([csv.join("\n")], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `REPORT_TOTALE_GARE.csv`;
    link.click();
}

document.addEventListener('DOMContentLoaded', initAdmin);
