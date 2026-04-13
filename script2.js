const sb = window.supabaseClient;
window.currentSocietyId = null;

// --- 1. CONFIGURAZIONE LIMITI RIGIDI (Sistema 2) ---
const LIMITI = {
    "Kumite": 400,
    "Kata": 300,
    "ParaKarate": 50,
    "KIDS": 250 // Include Combinata e specialità propedeutiche
};

// --- 2. INIZIALIZZAZIONE ---
async function initPage() {
    const eventId = sessionStorage.getItem('selectedEventId');
    const eventName = sessionStorage.getItem('selectedEventName');
    
    if (!eventId) {
        window.location.href = "scelta-evento.html";
        return;
    }

    if(document.getElementById('selectedEventId')) document.getElementById('selectedEventId').value = eventId;
    if(document.getElementById('eventNameDisplay')) document.getElementById('eventNameDisplay').innerText = eventName;

    const { data: { user } } = await sb.auth.getUser();
    if (user) {
        const { data: soc } = await sb.from('societa').select('*').eq('user_id', user.id).single();
        if (soc) {
            window.currentSocietyId = soc.id;
            if(document.getElementById('societyNameDisplay')) document.getElementById('societyNameDisplay').innerText = soc.nome;
            
            await fetchAthletes();
            await fetchTeams();
        }
    }
}

// --- 3. LOGICA UI (SWITCH TEAM/SINGOLO) ---
function toggleRegMode() {
    const isTeam = document.querySelector('input[name="regType"]:checked').value === 'team';
    const indFields = document.getElementById('individualFields');
    const teamFields = document.getElementById('teamFields');

    if (isTeam) {
        indFields.style.display = 'none';
        teamFields.style.display = 'block';
        
        document.getElementById('team_name').required = true;
        document.getElementById('team_year').required = true;
        document.getElementById('first_name').required = false;
        document.getElementById('last_name').required = false;
        document.getElementById('birthdate').required = false;

        document.querySelectorAll('.member-input').forEach(input => input.required = true);

        if (document.getElementById('membersContainer').children.length === 0) {
            for(let i=0; i<3; i++) addMemberField();
        }
    } else {
        indFields.style.display = 'block';
        teamFields.style.display = 'none';

        document.getElementById('team_name').required = false;
        document.getElementById('team_year').required = false;
        document.getElementById('first_name').required = true;
        document.getElementById('last_name').required = true;
        document.getElementById('birthdate').required = true;

        document.querySelectorAll('.member-input').forEach(input => input.required = false);
    }
}

function addMemberField() {
    const container = document.getElementById('membersContainer');
    const count = container.querySelectorAll('.member-input').length;
    if (count >= 6) return alert("Massimo 6 componenti.");
    const isTeam = document.querySelector('input[name="regType"]:checked').value === 'team';

    const div = document.createElement('div');
    div.className = "col-md-4 mb-2";
    div.innerHTML = `
        <div class="input-group input-group-sm">
            <span class="input-group-text">${count + 1}</span>
            <input type="text" class="form-control member-input" placeholder="Nome Cognome" ${isTeam ? 'required' : ''}>
            ${count >= 3 ? '<button type="button" class="btn btn-outline-danger" onclick="this.parentElement.parentElement.remove()">×</button>' : ''}
        </div>`;
    container.appendChild(div);
}

// --- 4. LOGICA DINAMICA (CLASSI, CINTURE E PESI) ---
function handleBirthdateChange() {
    const dateVal = document.getElementById('birthdate').value;
    if (!dateVal) return;
    updateClassSpecsAndBelts(new Date(dateVal).getFullYear());
}

function handleTeamYearChange() {
    const year = parseInt(document.getElementById('team_year').value);
    if (year) updateClassSpecsAndBelts(year);
}

function updateClassSpecsAndBelts(year) {
    const clSel = document.getElementById('classe');
    const spSel = document.getElementById('specialty');
    const beltSel = document.getElementById('belt');

    let classe = "";
    if (year >= 2021 && year <= 2022) classe = "U6";
    else if (year >= 2019 && year <= 2020) classe = "U8";
    else if (year >= 2017 && year <= 2018) classe = "U10";
    else if (year >= 2015 && year <= 2016) classe = "U12";
    else if (year >= 2013 && year <= 2014) classe = "U14";
    else if (year >= 2011 && year <= 2012) classe = "Cadetti";
    else if (year >= 2009 && year <= 2010) classe = "Juniores";
    else if (year >= 1991 && year <= 2008) classe = "Seniores";
    else if (year >= 1960 && year <= 1990) classe = "Master";

    clSel.innerHTML = `<option value="${classe}">${classe}</option>`;
    
    // Logica Cinture Richiesta
    let belts = [];
    if (["U6", "U8"].includes(classe)) {
        belts = ["Bianca/Gialla", "Arancio/Verde"];
    } else if (["U10", "U12"].includes(classe)) {
        belts = ["Bianca/Gialla", "Arancio/Verde", "Blu/Marrone"];
    } else {
        belts = ["Bianca/Gialla", "Arancio/Verde", "Blu/Marrone", "Nera"];
    }
    beltSel.innerHTML = belts.map(b => `<option value="${b}">${b}</option>`).join('');

    // Logica Specialità Richiesta
    let specs = [];
    if (["U6", "U8"].includes(classe)) {
        specs = ["Combinata", "Kata", "Kumite", "ParaKarate"];
    } else {
        specs = ["Kata", "Kumite", "ParaKarate"];
    }

    spSel.innerHTML = '<option value="">-- Specialità --</option>';
    specs.forEach(s => spSel.innerHTML += `<option value="${s}">${s}</option>`);
    
    handleSpecialtyChange();
}

function handleSpecialtyChange() {
    const spec = document.getElementById('specialty').value;
    const classe = document.getElementById('classe').value;
    const isTeam = document.querySelector('input[name="regType"]:checked').value === 'team';
    
    let gender = "Maschio";
    if (isTeam) {
        gender = document.getElementById('team_gender')?.value || "Maschio";
    } else {
        const checkedGender = document.querySelector('input[name="gender"]:checked');
        gender = checkedGender ? checkedGender.value : "Maschio";
    }

    const wInput = document.getElementById('weight_category');
    wInput.innerHTML = '';
    wInput.disabled = true;

    if (spec === "Kumite") {
        wInput.disabled = false;
        let weights = [];
        if (classe === "U14") {
            weights = (gender === "Maschio") ? ["-40", "-45", "-50", "-55", "55+"] : ["-42", "-47", "-52", "52+"];
        } else if (["U12", "U10", "U8", "U6"].includes(classe)) {
            weights = (gender === "Maschio") ? ["-30", "-35", "-40", "40+"] : ["-30", "-35", "35+"];
        } else {
            weights = ["Open"];
        }
        weights.forEach(w => wInput.innerHTML += `<option value="${w}">${w} kg</option>`);
    } else if (spec === "ParaKarate") {
        wInput.disabled = false;
        ["K10","K21", "K22", "K30"].forEach(k => wInput.innerHTML += `<option value="${k}">${k}</option>`);
    } else {
        wInput.innerHTML = '<option value="-">-</option>';
    }
}

// --- 5. CARICAMENTO E CONTEGGI (VISUALIZZAZIONE PRIVATA) ---
async function fetchAthletes() {
    const eventId = sessionStorage.getItem('selectedEventId');
    if (!window.currentSocietyId) return;

    const { data: athletes } = await sb.from('atleti').select('*').eq('society_id', window.currentSocietyId).eq('event_id', eventId);

    const list = document.getElementById('athleteList');
    if (list) {
        list.innerHTML = "";
        athletes?.sort((a,b) => a.last_name.localeCompare(b.last_name)).forEach(a => {
            list.innerHTML += `<tr><td><strong>${a.last_name} ${a.first_name}</strong></td><td>${a.classe}</td><td>${a.gender}</td><td>${a.specialty}</td><td>${a.belt}</td><td>${a.weight_category}</td><td class="text-end"><button class="btn btn-sm btn-outline-danger border-0" onclick="deleteAthlete('${a.id}')"><i class="fas fa-trash"></i></button></td></tr>`;
        });
    }
    updateGlobalCounters(eventId);
}

async function fetchTeams() {
    const eventId = sessionStorage.getItem('selectedEventId');
    if (!window.currentSocietyId) return;
    const { data: teams } = await sb.from('teams').select('*').eq('society_id', window.currentSocietyId).eq('event_id', eventId);
    const list = document.getElementById('teamList');
    if (list) {
        list.innerHTML = "";
        teams?.forEach(t => {
            list.innerHTML += `<tr><td><strong>${t.team_name}</strong><br><small class="text-muted">${t.members.join(", ")}</small></td><td>${t.classe}</td><td>${t.gender}</td><td>${t.specialty}</td><td>${t.belt || '-'}</td><td>${t.weight_category || '-'}</td><td class="text-end"><button class="btn btn-sm btn-outline-danger border-0" onclick="deleteTeam('${t.id}')"><i class="fas fa-trash"></i></button></td></tr>`;
        });
    }
}

async function updateGlobalCounters(eventId) {
    // 1. Dati GLOBALI per i limiti (nascosti alla società)
    const { data: allA } = await sb.from('atleti').select('specialty').eq('event_id', eventId);
    const { data: allT } = await sb.from('teams').select('specialty').eq('event_id', eventId);
    const globalTotal = [...(allA || []), ...(allT || [])];

    // 2. Dati SOCIETÀ per la visualizzazione
    const { data: socA } = await sb.from('atleti').select('specialty').eq('event_id', eventId).eq('society_id', window.currentSocietyId);
    const { data: socT } = await sb.from('teams').select('specialty').eq('event_id', eventId).eq('society_id', window.currentSocietyId);
    const socTotal = [...(socA || []), ...(socT || [])];

    const gCount = { Kumite: 0, Kata: 0, Para: 0, Kids: 0 };
    globalTotal.forEach(item => {
        if (item.specialty === "Kumite") gCount.Kumite++; 
        else if (item.specialty === "Kata") gCount.Kata++; 
        else if (item.specialty === "ParaKarate") gCount.Para++; 
        else if (["Combinata", "Percorso-Kata", "Percorso-Palloncino"].includes(item.specialty)) gCount.Kids++;
    });

    const sCount = { Kumite: 0, Kata: 0, Para: 0, Kids: 0 };
    socTotal.forEach(item => {
        if (item.specialty === "Kumite") sCount.Kumite++; 
        else if (item.specialty === "Kata") sCount.Kata++; 
        else if (item.specialty === "ParaKarate") sCount.Para++; 
        else if (["Combinata", "Percorso-Kata", "Percorso-Palloncino"].includes(item.specialty)) sCount.Kids++;
    });

    // Aggiorniamo la UI solo con i numeri della società
    document.getElementById('kumiteAthleteCountDisplay').innerText = sCount.Kumite;
    document.getElementById('kataAthleteCountDisplay').innerText = sCount.Kata;
    document.getElementById('ParaKarateAthleteCountDisplay').innerText = sCount.Para;
    document.getElementById('KIDSAthleteCountDisplay').innerText = sCount.Kids;
    
    return gCount; // Restituisce il totale dell'evento per il blocco addAthlete
}

// --- 6. AGGIUNTA (CON BLOCCO LIMITI) ---
async function addAthlete(e) {
    e.preventDefault();
    const eventId = sessionStorage.getItem('selectedEventId');
    if (!window.currentSocietyId) return alert("Errore: Società non identificata.");

    const spec = document.getElementById('specialty').value;
    const isTeam = document.querySelector('input[name="regType"]:checked').value === 'team';

    const globalCounts = await updateGlobalCounters(eventId);
    let isFull = false;
    if (spec === "Kumite" && globalCounts.Kumite >= LIMITI.Kumite) isFull = true;
    else if (spec === "Kata" && globalCounts.Kata >= LIMITI.Kata) isFull = true;
    else if (spec === "ParaKarate" && globalCounts.Para >= LIMITI.ParaKarate) isFull = true;
    else if (["Combinata", "Percorso-Kata", "Percorso-Palloncino"].includes(spec) && globalCounts.Kids >= LIMITI.KIDS) isFull = true;

    if (isFull) return alert("ATTENZIONE: Posti esauriti per questa specialità nell'evento!");

    const commonData = {
        event_id: eventId,
        society_id: window.currentSocietyId,
        classe: document.getElementById('classe').value,
        specialty: spec,
        belt: document.getElementById('belt').value,
        weight_category: document.getElementById('weight_category').value || '-'
    };

    if (isTeam) {
        const members = Array.from(document.querySelectorAll('.member-input')).map(i => i.value.trim()).filter(v => v !== "");
        if (members.length < 3) return alert("Inserisci almeno 3 componenti.");
        const { error } = await sb.from('teams').insert([{...commonData, team_name: document.getElementById('team_name').value, gender: document.getElementById('team_gender').value, members: members}]);
        if (error) alert("Errore: " + error.message);
        else { alert("Squadra registrata!"); completeReset(); }
    } else {
        const { error } = await sb.from('atleti').insert([{...commonData, first_name: document.getElementById('first_name').value, last_name: document.getElementById('last_name').value, birthdate: document.getElementById('birthdate').value, gender: document.querySelector('input[name="gender"]:checked')?.value || "Maschio"}]);
        if (error) alert("Errore: " + error.message);
        else { alert("Atleta registrato!"); completeReset(); }
    }
}

// --- 7. UTILITY ---
function completeReset() {
    const currentMode = document.querySelector('input[name="regType"]:checked').id;
    document.getElementById('athleteForm').reset();
    if (currentMode === "typeTeam") {
        document.getElementById('membersContainer').innerHTML = "";
        for(let i=0; i<3; i++) addMemberField();
    }
    fetchAthletes();
    fetchTeams();
    toggleRegMode();
}

async function deleteAthlete(id) { if (confirm("Eliminare?")) { await sb.from('atleti').delete().eq('id', id); fetchAthletes(); } }
async function deleteTeam(id) { if (confirm("Eliminare?")) { await sb.from('teams').delete().eq('id', id); fetchTeams(); } }

function exportToExcel() {
    let csv = ["Tipo,Nome/Squadra,Classe,Sesso,Specialità,Cintura,Peso"];
    document.querySelectorAll("#athleteList tr").forEach(tr => {
        let data = Array.from(tr.querySelectorAll("td")).slice(0, 6).map(td => td.innerText.trim());
        csv.push("Atleta," + data.join(","));
    });
    document.querySelectorAll("#teamList tr").forEach(tr => {
        let data = Array.from(tr.querySelectorAll("td")).slice(0, 6).map(td => td.innerText.trim());
        csv.push("Team," + data.join(","));
    });
    const blob = new Blob([csv.join("\n")], { type: "text/csv" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `iscritti_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
}

async function logout() { await sb.auth.signOut(); window.location.href = "login.html"; }

document.addEventListener('DOMContentLoaded', () => {
    initPage();
    document.getElementById('athleteForm').addEventListener('submit', addAthlete);
    document.getElementById('birthdate').addEventListener('change', handleBirthdateChange);
    document.getElementById('team_year').addEventListener('change', handleTeamYearChange);
    document.getElementById('specialty').addEventListener('change', handleSpecialtyChange);
    document.querySelectorAll('input[name="gender"]').forEach(r => r.addEventListener('change', handleSpecialtyChange));
    document.querySelectorAll('input[name="regType"]').forEach(r => r.addEventListener('change', toggleRegMode));
});
