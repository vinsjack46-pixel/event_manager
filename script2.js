const sb = window.supabaseClient;
window.currentSocietyId = null;

// --- 1. CONFIGURAZIONE LIMITI (Verso v6.0: questi diventeranno dinamici) ---
const LIMITI = { 
    "KataKumiteSum": 300, 
    "ParaKarate": 50,
    "KIDS": 250 
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
    }
}

function addMemberField() {
    const container = document.getElementById('membersContainer');
    const count = container.querySelectorAll('.member-input').length;
    if (count >= 6) return alert("Massimo 6 componenti.");
    
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

// --- 4. LOGICA DINAMICA (CLASSI E PESI) ---
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
    if (year >= 2017 && year <= 2018) classe = "U10";
    else if (year >= 2015 && year <= 2016) classe = "U12";
    else if (year >= 2013 && year <= 2014) classe = "U14";
    else classe = "Fuori Quota";

    clSel.innerHTML = `<option value="${classe}">${classe}</option>`;
    
    let belts = ["Bianca/Gialla", "Arancio/Verde", "Blu/Marrone"];
    beltSel.innerHTML = belts.map(b => `<option value="${b}">${b}</option>`).join('');

    let specs = (year >= 2017) ? ["Combinata", "Kata", "Kumite", "ParaKarate"] : ["Kata", "Kumite", "ParaKarate"];
    spSel.innerHTML = '<option value="">-- Specialità --</option>';
    specs.forEach(s => spSel.innerHTML += `<option value="${s}">${s}</option>`);
    
    handleSpecialtyChange();
}

function handleSpecialtyChange() {
    const spec = document.getElementById('specialty').value;
    const classe = document.getElementById('classe').value;
    const isTeam = document.querySelector('input[name="regType"]:checked').value === 'team';
    
    // CORREZIONE v6.0: Legge correttamente dal SELECT o dal TEAM_GENDER
    let gender = isTeam ? document.getElementById('team_gender').value : document.getElementById('gender').value;

    const wInput = document.getElementById('weight_category');
    wInput.innerHTML = '';
    wInput.disabled = true;

    if (spec === "Kumite") {
        wInput.disabled = false;
        let weights = [];
        if (classe === "U14") {
            weights = (gender === "Maschio" || gender === "Maschile") ? ["-40", "-45", "-50", "-55", "55+"] : ["-42", "-47", "-52", "52+"];
        } else if (classe === "U12") {
            weights = ["-32", "-37", "-42", "-47", "47+"];
        } else if (classe === "U10") {
            weights = ["-22", "-27", "-32", "-37", "37+"];
        } else { weights = ["Open"]; }
        weights.forEach(w => wInput.innerHTML += `<option value="${w}">${w} kg</option>`);
    } else if (spec === "ParaKarate") {
        wInput.disabled = false;
        ["K10","K21", "K22", "K30"].forEach(k => wInput.innerHTML += `<option value="${k}">${k}</option>`);
    } else {
        wInput.innerHTML = '<option value="-">-</option>';
    }
}

// --- 5. AGGIUNTA (CON CORREZIONE SESSO E LIMITI) ---
async function addAthlete(e) {
    e.preventDefault();
    const eventId = sessionStorage.getItem('selectedEventId');
    if (!window.currentSocietyId) return alert("Errore: Società non identificata.");

    const spec = document.getElementById('specialty').value;
    const isTeam = document.querySelector('input[name="regType"]:checked').value === 'team';

    // 1. Controllo Età (2013-2018)
    let birthYear;
    if (isTeam) {
        birthYear = parseInt(document.getElementById('team_year').value);
    } else {
        const birthdate = document.getElementById('birthdate').value;
        birthYear = new Date(birthdate).getFullYear();
    }

    if (birthYear < 2013 || birthYear > 2018) {
        return alert("Iscrizione riservata ai nati tra il 2013 e il 2018.");
    }

    // 2. Controllo Limiti Sommati
    const globalCounts = await updateGlobalCounters(eventId);
    const currentSum = globalCounts.Kata + globalCounts.Kumite;

    if ((spec === "Kumite" || spec === "Kata") && currentSum >= LIMITI.KataKumiteSum) {
        return alert(`Posti esauriti per Kata/Kumite (Limite: ${LIMITI.KataKumiteSum})`);
    }

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
        
        const { error } = await sb.from('teams').insert([{
            ...commonData, 
            team_name: document.getElementById('team_name').value, 
            gender: document.getElementById('team_gender').value, 
            members: members,
            team_year: birthYear
        }]);
        if (error) alert(error.message); else completeReset();
    } else {
        // CORREZIONE FINALE: Legge dal SELECT id="gender"
        const sessoSelezionato = document.getElementById('gender').value;

        const { error } = await sb.from('atleti').insert([{
            ...commonData, 
            first_name: document.getElementById('first_name').value, 
            last_name: document.getElementById('last_name').value, 
            birthdate: document.getElementById('birthdate').value, 
            gender: sessoSelezionato // <--- RISOLTO
        }]);
        if (error) alert(error.message); else { alert("Iscrizione completata!"); completeReset(); }
    }
}

// --- 6. CONTEGGI E UTILITY ---
async function updateGlobalCounters(eventId) {
    const { data: allA } = await sb.from('atleti').select('specialty').eq('event_id', eventId);
    const { data: allT } = await sb.from('teams').select('specialty').eq('event_id', eventId);
    const globalTotal = [...(allA || []), ...(allT || [])];

    const gCount = { Kumite: 0, Kata: 0, Para: 0, Kids: 0 };
    globalTotal.forEach(item => {
        if (item.specialty === "Kumite") gCount.Kumite++; 
        else if (item.specialty === "Kata") gCount.Kata++; 
        else if (item.specialty === "ParaKarate") gCount.Para++; 
        else gCount.Kids++;
    });

    // Aggiorna la tua UI (i box in basso)
    const { data: socA } = await sb.from('atleti').select('specialty').eq('event_id', eventId).eq('society_id', window.currentSocietyId);
    const { data: socT } = await sb.from('teams').select('specialty').eq('event_id', eventId).eq('society_id', window.currentSocietyId);
    const sCount = (socA?.length || 0) + (socT?.length || 0);

    // Esempio: aggiorna solo i conteggi della società loggata per i box UI
    if(document.getElementById('kumiteAthleteCountDisplay')) document.getElementById('kumiteAthleteCountDisplay').innerText = gCount.Kumite; 
    // Nota: qui puoi decidere se mostrare il totale globale o quello della società
    
    return gCount;
}

async function fetchAthletes() {
    const eventId = sessionStorage.getItem('selectedEventId');
    const { data: athletes } = await sb.from('atleti').select('*').eq('society_id', window.currentSocietyId).eq('event_id', eventId);
    const list = document.getElementById('athleteList');
    if (list) {
        list.innerHTML = "";
        athletes?.forEach(a => {
            list.innerHTML += `<tr><td>${a.last_name} ${a.first_name}</td><td>${a.classe}</td><td>${a.gender}</td><td>${a.specialty}</td><td>${a.belt}</td><td>${a.weight_category}</td><td class="text-end"><button class="btn btn-sm text-danger" onclick="deleteAthlete('${a.id}')"><i class="fas fa-trash"></i></button></td></tr>`;
        });
    }
    updateGlobalCounters(eventId);
}

async function fetchTeams() {
    const eventId = sessionStorage.getItem('selectedEventId');
    const { data: teams } = await sb.from('teams').select('*').eq('society_id', window.currentSocietyId).eq('event_id', eventId);
    const list = document.getElementById('teamList');
    if (list) {
        list.innerHTML = "";
        teams?.forEach(t => {
            list.innerHTML += `<tr><td>${t.team_name}</td><td>${t.classe}</td><td>${t.gender}</td><td>${t.specialty}</td><td>${t.belt}</td><td>${t.weight_category}</td><td class="text-end"><button class="btn btn-sm text-danger" onclick="deleteTeam('${t.id}')"><i class="fas fa-trash"></i></button></td></tr>`;
        });
    }
}

function completeReset() {
    document.getElementById('athleteForm').reset();
    fetchAthletes();
    fetchTeams();
    toggleRegMode();
}

async function deleteAthlete(id) { if (confirm("Eliminare?")) { await sb.from('atleti').delete().eq('id', id); fetchAthletes(); } }
async function deleteTeam(id) { if (confirm("Eliminare?")) { await sb.from('teams').delete().eq('id', id); fetchTeams(); } }

document.addEventListener('DOMContentLoaded', () => {
    initPage();
    document.getElementById('athleteForm').addEventListener('submit', addAthlete);
    document.getElementById('gender').addEventListener('change', handleSpecialtyChange);
});
