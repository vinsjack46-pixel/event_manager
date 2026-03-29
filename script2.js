const sb = window.supabaseClient;

// --- 1. INIZIALIZZAZIONE ---
async function initPage() {
    const eventId = sessionStorage.getItem('selectedEventId');
    const eventName = sessionStorage.getItem('selectedEventName');
    
    if (!eventId) {
        window.location.href = "scelta-evento.html";
        return;
    }

    document.getElementById('selectedEventId').value = eventId;
    document.getElementById('eventNameDisplay').innerText = eventName;

    // Recupera Dati Società
    const { data: { user } } = await sb.auth.getUser();
    if (user) {
        const { data: soc } = await sb.from('societa').select('*').eq('user_id', user.id).single();
        if (soc) {
            window.currentSocietyId = soc.id;
            document.getElementById('societyNameDisplay').innerText = soc.nome;
            // Carica entrambe le tabelle
            await fetchAthletes();
            await fetchTeams();
        }
    }
}

// --- 2. LOGICA UI (SWITCH TEAM/SINGOLO) ---
function toggleRegMode() {
    const isTeam = document.querySelector('input[name="regType"]:checked').value === 'team';
    const indFields = document.getElementById('individualFields');
    const teamFields = document.getElementById('teamFields');
    const titleIcon = document.querySelector('.main-form-card h3 i');

    if (isTeam) {
        indFields.style.display = 'none';
        teamFields.style.display = 'block';
        if (titleIcon) titleIcon.className = "fas fa-users text-success me-2";
        
        // Obbligatorietà Team
        document.getElementById('team_name').required = true;
        document.getElementById('team_year').required = true;
        document.getElementById('first_name').required = false;
        document.getElementById('last_name').required = false;
        document.getElementById('birthdate').required = false;

        if (document.getElementById('membersContainer').children.length === 0) {
            for(let i=0; i<3; i++) addMemberField();
        }
    } else {
        indFields.style.display = 'block';
        teamFields.style.display = 'none';
        if (titleIcon) titleIcon.className = "fas fa-edit text-primary me-2";

        // Obbligatorietà Singolo
        document.getElementById('team_name').required = false;
        document.getElementById('team_year').required = false;
        document.getElementById('first_name').required = true;
        document.getElementById('last_name').required = true;
        document.getElementById('birthdate').required = true;
    }
}

function addMemberField() {
    const container = document.getElementById('membersContainer');
    const count = container.querySelectorAll('.member-input').length;
    if (count >= 6) return alert("Massimo 6 componenti per squadra.");

    const div = document.createElement('div');
    div.className = "col-md-4 mb-2";
    div.innerHTML = `
        <div class="input-group input-group-sm">
            <span class="input-group-text">${count + 1}</span>
            <input type="text" class="form-control member-input" placeholder="Nome Cognome" required>
            ${count >= 3 ? '<button type="button" class="btn btn-outline-danger" onclick="this.parentElement.parentElement.remove()">×</button>' : ''}
        </div>`;
    container.appendChild(div);
}

// --- 3. LOGICA DINAMICA (CLASSE, CINTURA, SPECIALITÀ) ---

// Quando cambia la data del singolo
function handleBirthdateChange() {
    const dateVal = document.getElementById('birthdate').value;
    if (!dateVal) return;
    const year = new Date(dateVal).getFullYear();
    updateClassSpecsAndBelts(year);
}

// Quando cambia l'anno di riferimento del team
function handleTeamYearChange() {
    const year = parseInt(document.getElementById('team_year').value);
    if (!year) return;
    updateClassSpecsAndBelts(year);
}

// Funzione unificata per popolare i menu a tendina
function updateClassSpecsAndBelts(year) {
    const clSel = document.getElementById('classe');
    const spSel = document.getElementById('specialty');
    const beltSel = document.getElementById('belt');

    let classe = "";
    let specs = [];
    let belts = ["Bianca", "Bianca/Gialla", "Gialla", "Arancione", "Verde", "Blu", "Marrone", "Nera"];

    if (year >= 2017 && year <= 2022) {
        classe = "Bambini / Fanciulli";
        specs = ["Percorso", "Palloncino", "Prova Tecnica", "Kata"];
    } else if (year >= 2013 && year <= 2014) {
        classe = "Esordienti";
        specs = ["Kata", "Kumite", "ParaKarate"];
    } else {
        classe = "Altra Categoria";
        specs = ["Kata", "Kumite"];
    }

    clSel.innerHTML = `<option value="${classe}">${classe}</option>`;
    spSel.innerHTML = '<option value="">-- Seleziona --</option>';
    specs.forEach(s => spSel.innerHTML += `<option value="${s}">${s}</option>`);
    
    beltSel.innerHTML = '<option value="">-- Seleziona --</option>';
    belts.forEach(b => beltSel.innerHTML += `<option value="${b}">${b}</option>`);
}

function handleSpecialtyChange() {
    const spec = document.getElementById('specialty').value;
    const wInput = document.getElementById('weight_category');
    if (spec === "Kumite") {
        wInput.disabled = false;
        wInput.innerHTML = `
            <option value="-40kg">-40kg</option>
            <option value="-50kg">-50kg</option>
            <option value="+50kg">+50kg</option>`;
    } else {
        wInput.disabled = true;
        wInput.innerHTML = '<option value="-">-</option>';
    }
}

// --- 4. OPERAZIONI DATABASE (CRUD) ---

async function fetchAthletes() {
    const eventId = sessionStorage.getItem('selectedEventId');
    const { data: athletes } = await sb.from('atleti')
        .select('*')
        .eq('society_id', window.currentSocietyId)
        .eq('event_id', eventId);

    const list = document.getElementById('athleteList');
    list.innerHTML = "";
    athletes?.forEach(a => {
        list.innerHTML += `
            <tr>
                <td>${a.last_name} ${a.first_name}</td>
                <td>${a.classe}</td>
                <td>${a.specialty}</td>
                <td>${a.belt}</td>
                <td>${a.weight_category}</td>
                <td class="text-end">
                    <button class="btn btn-sm btn-outline-danger" onclick="deleteAthlete('${a.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>`;
    });
    updateCounters(athletes);
}

async function fetchTeams() {
    const eventId = sessionStorage.getItem('selectedEventId');
    const { data: teams } = await sb.from('teams')
        .select('*')
        .eq('society_id', window.currentSocietyId)
        .eq('event_id', eventId);

    const list = document.getElementById('teamList');
    list.innerHTML = "";
    teams?.forEach(t => {
        list.innerHTML += `
            <tr>
                <td class="fw-bold text-success">${t.team_name} <br><small class="text-muted">${t.gender || ''}</small></td>
                <td>${t.classe}</td>
                <td>${t.specialty}</td>
                <td><small>${t.members.join(", ")}</small></td>
                <td class="text-end">
                    <button class="btn btn-sm btn-outline-danger" onclick="deleteTeam('${t.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>`;
    });
}

async function addAthlete(e) {
    e.preventDefault();
    const isTeam = document.querySelector('input[name="regType"]:checked').value === 'team';
    const eventId = document.getElementById('selectedEventId').value;

    if (isTeam) {
        const members = Array.from(document.querySelectorAll('.member-input')).map(i => i.value.trim()).filter(v => v !== "");
        if (members.length < 3) return alert("Minimo 3 componenti!");

        const teamData = {
            event_id: eventId,
            society_id: window.currentSocietyId,
            team_name: document.getElementById('team_name').value,
            gender: document.getElementById('team_gender').value,
            classe: document.getElementById('classe').value,
            specialty: document.getElementById('specialty').value,
            members: members
        };

        const { error } = await sb.from('teams').insert([teamData]);
        if (error) alert(error.message);
        else { alert("Team registrato!"); completeReset(); }
    } else {
        const athleteData = {
            event_id: eventId,
            society_id: window.currentSocietyId,
            first_name: document.getElementById('first_name').value,
            last_name: document.getElementById('last_name').value,
            birthdate: document.getElementById('birthdate').value,
            gender: document.getElementById('gender').value,
            classe: document.getElementById('classe').value,
            specialty: document.getElementById('specialty').value,
            belt: document.getElementById('belt').value,
            weight_category: document.getElementById('weight_category').value || '-'
        };

        const { error } = await sb.from('atleti').insert([athleteData]);
        if (error) alert(error.message);
        else { alert("Atleta registrato!"); completeReset(); }
    }
}

async function deleteAthlete(id) {
    if (confirm("Eliminare l'atleta?")) {
        await sb.from('atleti').delete().eq('id', id);
        fetchAthletes();
    }
}

async function deleteTeam(id) {
    if (confirm("Eliminare la squadra?")) {
        await sb.from('teams').delete().eq('id', id);
        fetchTeams();
    }
}

// --- 5. UTILITY ---

function completeReset() {
    document.getElementById('athleteForm').reset();
    document.getElementById('membersContainer').innerHTML = "";
    document.getElementById('classe').innerHTML = "";
    document.getElementById('specialty').innerHTML = "";
    document.getElementById('belt').innerHTML = "";
    document.getElementById('weight_category').disabled = true;
    
    // Default individuale
    document.getElementById('typeIndividual').checked = true;
    toggleRegMode();
    
    fetchAthletes();
    fetchTeams();
}

function updateCounters(athletes) {
    const c = { Kumite: 0, Kata: 0, Para: 0, Kids: 0 };
    athletes?.forEach(a => {
        if (a.specialty === "Kumite") c.Kumite++;
        else if (a.specialty === "Kata") c.Kata++;
        else if (a.specialty === "ParaKarate") c.Para++;
        else c.Kids++;
    });
    document.getElementById('kumiteAthleteCountDisplay').innerText = c.Kumite;
    document.getElementById('kataAthleteCountDisplay').innerText = c.Kata;
    document.getElementById('ParaKarateAthleteCountDisplay').innerText = c.Para;
    document.getElementById('KIDSAthleteCountDisplay').innerText = c.Kids;
}

function exportToExcel() {
    const table = document.querySelector("table");
    let csv = [];
    const rows = document.querySelectorAll("tr");
    for (const row of rows) {
        const cols = row.querySelectorAll("td, th");
        const rowData = [];
        for (let j = 0; j < cols.length - 1; j++) { // Esclude colonna Azione
            rowData.push(cols[j].innerText.replace(/,/g, ";"));
        }
        csv.push(rowData.join(","));
    }
    const csvFile = new Blob([csv.join("\n")], { type: "text/csv" });
    const link = document.createElement("a");
    link.download = `iscritti_${new Date().getTime()}.csv`;
    link.href = window.URL.createObjectURL(csvFile);
    link.click();
}

async function logout() {
    await sb.auth.signOut();
    window.location.href = "login.html";
}

// --- 6. EVENT LISTENERS ---
document.addEventListener('DOMContentLoaded', () => {
    initPage();
    document.getElementById('athleteForm').addEventListener('submit', addAthlete);
    document.getElementById('birthdate').addEventListener('change', handleBirthdateChange);
    document.getElementById('team_year').addEventListener('change', handleTeamYearChange);
    document.getElementById('specialty').addEventListener('change', handleSpecialtyChange);
});
