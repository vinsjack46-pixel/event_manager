const sb = window.supabaseClient;

async function initAdmin() {
    await loadFilterEvents();
    await fetchGlobalData();

    document.getElementById('filterEvent').addEventListener('change', fetchGlobalData);
    document.getElementById('globalSearch').addEventListener('input', filterTables);
    document.getElementById('eventForm').addEventListener('submit', createEvent);
}

async function fetchGlobalData() {
    const filterEventId = document.getElementById('filterEvent').value;

    // Recupero mapping Società ed Eventi
    const { data: societa } = await sb.from('societa').select('id, nome');
    const { data: eventi } = await sb.from('eventi').select('id, nome');
    const socMap = Object.fromEntries(societa.map(s => [s.id, s.nome]));
    const evMap = Object.fromEntries(eventi.map(e => [e.id, e.nome]));

    // Query Atleti Individuali
    let qA = sb.from('atleti').select('*').order('last_name');
    if (filterEventId) qA = qA.eq('event_id', filterEventId);
    const { data: atleti } = await qA;

    // Query Team
    let qT = sb.from('teams').select('*').order('team_name');
    if (filterEventId) qT = qT.eq('event_id', filterEventId);
    const { data: teams } = await qT;

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
                <td><small>${evMap[a.event_id] || '-'}</small></td>
                <td>${socMap[a.society_id] || '-'}</td>
                <td>${a.classe}<br><small class="text-primary">${a.specialty}</small></td>
                <td><span class="badge bg-light text-dark border">${a.belt}</span></td>
                <td>${a.gender}</td>
                <td>${a.weight_category}</td>
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
                <td><small>${evMap[t.event_id] || '-'}</small></td>
                <td>${socMap[t.society_id] || '-'}</td>
                <td>${t.classe}<br><small class="text-primary">${t.specialty}</small></td>
                <td>${t.gender}</td>
                <td><small>${t.belt || '-'} / ${t.weight_category || '-'}</small></td>
            </tr>`;
    });

    // Aggiorna Contatori
    document.getElementById('countInd').innerText = atleti?.length || 0;
    document.getElementById('countTeam').innerText = teams?.length || 0;
    document.getElementById('totalCounter').innerText = `${(atleti?.length || 0) + (teams?.length || 0)} Totali`;
}

// Filtro di ricerca che agisce su ENTRAMBE le tabelle
function filterTables() {
    const val = document.getElementById('globalSearch').value.toLowerCase();
    document.querySelectorAll('tbody tr').forEach(tr => {
        tr.style.display = tr.innerText.toLowerCase().includes(val) ? '' : 'none';
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
