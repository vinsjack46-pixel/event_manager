const sb = window.supabaseClient;
window.currentSocietyId = null;

const LIMITI = { 
    "KataKumiteSum": 300, 
    "ParaKarate": 50, 
    "KIDS": 250 
};

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

    let specs = ["Kata", "Kumite", "ParaKarate", "Combinata"];
    spSel.innerHTML = '<option value="">-- Specialità --</option>';
    specs.forEach(s => spSel.innerHTML += `<option value="${s}">${s}</option>`);
    
    handleSpecialtyChange();
}

function handleSpecialtyChange() {
    const spec = document.getElementById('specialty').value;
    const classe = document.getElementById('classe').value;
    const isTeam = document.querySelector('input[name="regType"]:checked').value === 'team';
    
    // Recupero Sesso Corretto (Fix v6.0)
    let gender = isTeam ? document.getElementById('team_gender').value : document.getElementById('gender').value;

    const wInput = document.getElementById('weight_category');
    wInput.innerHTML = '';
    wInput.disabled = true;

    if (spec === "Kumite") {
        wInput.disabled = false;
        let weights = [];
        if (classe === "U14") {
            weights = (gender === "Maschio") ? ["-40", "-45", "-50", "-55", "55+"] : ["-42", "-47", "-52", "52+"];
        } else if (classe === "U12") {
            weights = ["-32", "-37", "-42","-47", "47+"];
        } else if (classe === "U10") {
            weights = ["-22", "-27", "-32","-37", "37+"];
        } else { weights = ["Open"]; }
        weights.forEach(w => wInput.innerHTML += `<option value="${w}">${w} kg</option>`);
    } else if (spec === "ParaKarate") {
        wInput.disabled = false;
        ["K10","K21", "K22", "K30"].forEach(k => wInput.innerHTML += `<option value="${k}">${k}</option>`);
    } else {
        wInput.innerHTML = '<option value="-">-</option>';
    }
}

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
    // 1. Prendi TUTTI gli iscritti per controllare i limiti globali
    const { data: allA } = await sb.from('atleti').select('specialty').eq('event_id', eventId);
    const { data: allT } = await sb.from('teams').select('specialty').eq('event_id', eventId);
    const globalTotal = [...(allA || []), ...(allT || [])];

    // 2. Prendi solo quelli della MIA SOCIETÀ per i box in basso
    const socA = (allA || []).filter(() => true); // In un'app reale filtreremmo qui, ma usiamo la query successiva per sicurezza
    const { data: myA } = await sb.from('atleti').select('specialty').eq('event_id', eventId).eq('society_id', window.currentSocietyId);
    const { data: myT } = await sb.from('teams').select('specialty').eq('event_id', eventId).eq('society_id', window.currentSocietyId);
    const myTotal = [...(myA || []), ...(myT || [])];

    const gCount = { Kumite: 0, Kata: 0, Para: 0, Kids: 0 };
    globalTotal.forEach(item => {
        if (item.specialty === "Kumite") gCount.Kumite++; 
        else if (item.specialty === "Kata") gCount.Kata++; 
        else if (item.specialty === "ParaKarate") gCount.Para++; 
        else if (["Combinata", "Percorso-Kata", "Percorso-Palloncino"].includes(item.specialty)) gCount.Kids++;
    });

    const sCount = { Kumite: 0, Kata: 0, Para: 0, Kids: 0 };
    myTotal.forEach(item => {
        if (item.specialty === "Kumite") sCount.Kumite++; 
        else if (item.specialty === "Kata") sCount.Kata++; 
        else if (item.specialty === "ParaKarate") sCount.Para++; 
        else if (["Combinata", "Percorso-Kata", "Percorso-Palloncino"].includes(item.specialty)) sCount.Kids++;
    });

    // AGGIORNAMENTO BOX (Iscritti della Società)
    if(document.getElementById('kumiteAthleteCountDisplay')) document.getElementById('kumiteAthleteCountDisplay').innerText = sCount.Kumite;
    if(document.getElementById('kataAthleteCountDisplay')) document.getElementById('kataAthleteCountDisplay').innerText = sCount.Kata;
    if(document.getElementById('ParaKarateAthleteCountDisplay')) document.getElementById('ParaKarateAthleteCountDisplay').innerText = sCount.Para;
    if(document.getElementById('KIDSAthleteCountDisplay')) document.getElementById('KIDSAthleteCountDisplay').innerText = sCount.Kids;
    
    return gCount;
}

async function addAthlete(e) {
    e.preventDefault();
    const eventId = sessionStorage.getItem('selectedEventId');
    if (!window.currentSocietyId) return alert("Errore: Società non identificata.");

    const spec = document.getElementById('specialty').value;
    const isTeam = document.querySelector('input[name="regType"]:checked').value === 'team';

    // CONTROLLO FASCIA ETÀ (2013 - 2018)
    let birthYear;
    if (isTeam) {
        birthYear = parseInt(document.getElementById('team_year').value);
    } else {
        birthYear = new Date(document.getElementById('birthdate').value).getFullYear();
    }

    if (birthYear < 2013 || birthYear > 2018) {
        return alert("ATTENZIONE: Iscrizione riservata ai nati tra il 2013 e il 2018.");
    }

    const globalCounts = await updateGlobalCounters(eventId);
    const currentSum = globalCounts.Kata + globalCounts.Kumite;

    if ((spec === "Kumite" || spec === "Kata") && currentSum >= LIMITI.KataKumiteSum) {
        return alert(`Posti esauriti! Limite di ${LIMITI.KataKumiteSum} raggiunto.`);
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
        if (error) alert(error.message);
        else { alert("Squadra registrata!"); completeReset(); }
    } else {
        // RECUPERO SESSO DAL SELECT (Fix v6.0)
        const sessoSelezionato = document.getElementById('gender').value;

        const { error } = await sb.from('atleti').insert([{
            ...commonData, 
            first_name: document.getElementById('first_name').value, 
            last_name: document.getElementById('last_name').value, 
            birthdate: document.getElementById('birthdate').value, 
            gender: sessoSelezionato
        }]);
        if (error) alert(error.message);
        else { alert("Atleta registrato!"); completeReset(); }
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

async function logout() { await sb.auth.signOut(); window.location.href = "login.html"; }

document.addEventListener('DOMContentLoaded', () => {
    initPage();
    document.getElementById('athleteForm').addEventListener('submit', addAthlete);
    document.getElementById('birthdate').addEventListener('change', handleBirthdateChange);
    document.getElementById('team_year').addEventListener('change', handleTeamYearChange);
    document.getElementById('specialty').addEventListener('change', handleSpecialtyChange);
    document.querySelectorAll('input[name="regType"]').forEach(r => r.addEventListener('change', toggleRegMode));
});
