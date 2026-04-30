const sb = window.supabaseClient;
window.currentSocietyId = null;

// --- 1. CONFIGURAZIONE ---
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

    // Recupero utente e società in modo sicuro
    const { data: { user }, error: userError } = await sb.auth.getUser();
    if (userError || !user) {
        window.location.href = "login.html";
        return;
    }

    const { data: soc, error: socError } = await sb.from('societa')
        .select('*')
        .eq('user_id', user.id)
        .single();

    if (soc) {
        window.currentSocietyId = soc.id;
        if(document.getElementById('societyNameDisplay')) document.getElementById('societyNameDisplay').innerText = soc.nome;
        
        await Promise.all([fetchAthletes(), fetchTeams()]);
    }
}

// --- 3. LOGICA UI ---
function toggleRegMode() {
    const regType = document.querySelector('input[name="regType"]:checked').value;
    const isTeam = regType === 'team';
    
    const indFields = document.getElementById('individualFields');
    const teamFields = document.getElementById('teamFields');

    indFields.style.display = isTeam ? 'none' : 'block';
    teamFields.style.display = isTeam ? 'block' : 'none';

    // Toggle required attributes per evitare invii sporchi
    document.getElementById('team_name').required = isTeam;
    document.getElementById('team_year').required = isTeam;
    document.getElementById('first_name').required = !isTeam;
    document.getElementById('last_name').required = !isTeam;
    document.getElementById('birthdate').required = !isTeam;

    if (isTeam && document.getElementById('membersContainer').children.length === 0) {
        for(let i=0; i<3; i++) addMemberField();
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

// --- 4. LOGICA DINAMICA (CLASSI E CATEGORIE) ---
function handleBirthdateChange() {
    const dateVal = document.getElementById('birthdate').value;
    if (dateVal) updateClassSpecsAndBelts(new Date(dateVal).getFullYear());
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
    
    // Cinture semplificate
    const belts = ["Bianca/Gialla", "Arancio/Verde", "Blu/Marrone"];
    beltSel.innerHTML = belts.map(b => `<option value="${b}">${b}</option>`).join('');

    // Specialità
    let specs = ["Kata", "Kumite", "ParaKarate"];
    if (["U6", "U8"].includes(classe)) specs.unshift("Combinata");

    spSel.innerHTML = '<option value="">-- Specialità --</option>';
    specs.forEach(s => spSel.innerHTML += `<option value="${s}">${s}</option>`);
    
    handleSpecialtyChange();
}

function handleSpecialtyChange() {
    const spec = document.getElementById('specialty').value;
    const classe = document.getElementById('classe').value;
    const isTeam = document.querySelector('input[name="regType"]:checked').value === 'team';
    
    // RECUPERO GENERE SICURO (Senza default arbitrari)
    let gender = null;
    if (isTeam) {
        gender = document.getElementById('team_gender').value;
    } else {
        const checkedRadio = document.querySelector('input[name="gender"]:checked');
        gender = checkedRadio ? checkedRadio.value : null;
    }

    const wInput = document.getElementById('weight_category');
    wInput.innerHTML = '';
    wInput.disabled = true;

    if (spec === "Kumite" && gender) {
        wInput.disabled = false;
        let weights = [];
        if (classe === "U14") {
            weights = (gender === "Maschio") ? ["-40", "-45", "-50", "-55", "55+"] : ["-42", "-47", "-52", "52+"];
        } else if (classe === "U12") {
            weights = ["-32", "-37", "-42", "-47", "47+"];
        } else if (classe === "U10") {
            weights = ["-22", "-27", "-32", "-37", "37+"];
        } else { weights = ["Open"]; }
        weights.forEach(w => wInput.innerHTML += `<option value="${w}">${w} kg</option>`);
    } else if (spec === "ParaKarate") {
        wInput.disabled = false;
        ["K10", "K21", "K22", "K30"].forEach(k => wInput.innerHTML += `<option value="${k}">${k}</option>`);
    } else {
        wInput.innerHTML = '<option value="-">-</option>';
    }
}

// --- 5. AGGIUNTA ATLETA (SOLUZIONE PRO) ---
async function addAthlete(e) {
    e.preventDefault();
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const eventId = sessionStorage.getItem('selectedEventId');

    if (!window.currentSocietyId) return alert("Errore sessione società.");

    // 1. Recupero dati e validazione genere
    const isTeam = document.querySelector('input[name="regType"]:checked').value === 'team';
    const spec = document.getElementById('specialty').value;
    const genderChecked = document.querySelector('input[name="gender"]:checked');
    
    const gender = isTeam ? document.getElementById('team_gender').value : (genderChecked ? genderChecked.value : null);

    if (!gender && !isTeam) return alert("Per favore, seleziona il genere.");
    if (!spec) return alert("Per favore, seleziona la specialità.");

    // 2. Controllo età (2013-2018)
    let birthYear;
    if (isTeam) {
        birthYear = parseInt(document.getElementById('team_year').value);
    } else {
        birthYear = new Date(document.getElementById('birthdate').value).getFullYear();
    }
    if (birthYear < 2013 || birthYear > 2018) return alert("Iscrizione riservata nati 2013-2018.");

    // 3. Controllo Limiti (Client-side per UX)
    submitBtn.disabled = true; // Previene doppi invii
    const counts = await updateGlobalCounters(eventId);
    let errorMsg = null;

    if ((spec === "Kumite" || spec === "Kata") && (counts.Kumite + counts.Kata) >= LIMITI.KataKumiteSum) {
        errorMsg = `Posti esauriti per Kata/Kumite (Max ${LIMITI.KataKumiteSum})`;
    } else if (spec === "ParaKarate" && counts.Para >= LIMITI.ParaKarate) {
        errorMsg = `Posti esauriti per Para-Karate (Max ${LIMITI.ParaKarate})`;
    }

    if (errorMsg) {
        alert(errorMsg);
        submitBtn.disabled = false;
        return;
    }

    // 4. Preparazione Dati
    const common = {
        event_id: eventId,
        society_id: window.currentSocietyId,
        classe: document.getElementById('classe').value,
        specialty: spec,
        belt: document.getElementById('belt').value,
        weight_category: document.getElementById('weight_category').value || '-',
        gender: gender
    };

    try {
        let result;
        if (isTeam) {
            const members = Array.from(document.querySelectorAll('.member-input')).map(i => i.value.trim()).filter(v => v);
            if (members.length < 3) throw new Error("Inserisci almeno 3 componenti.");
            result = await sb.from('teams').insert([{ ...common, team_name: document.getElementById('team_name').value, members, team_year: birthYear }]);
        } else {
            result = await sb.from('atleti').insert([{ 
                ...common, 
                first_name: document.getElementById('first_name').value, 
                last_name: document.getElementById('last_name').value, 
                birthdate: document.getElementById('birthdate').value 
            }]);
        }

        if (result.error) throw result.error;

        alert("Iscrizione completata con successo!");
        completeReset();
    } catch (err) {
        alert("Errore: " + err.message);
    } finally {
        submitBtn.disabled = false;
    }
}

// --- 6. UTILITY E CONTEGGI ---
async function updateGlobalCounters(eventId) {
    const { data: atleti } = await sb.from('atleti').select('specialty').eq('event_id', eventId);
    const { data: teams } = await sb.from('teams').select('specialty').eq('event_id', eventId);
    
    const all = [...(atleti || []), ...(teams || [])];
    const counts = { Kumite: 0, Kata: 0, Para: 0, Kids: 0 };

    all.forEach(x => {
        if (x.specialty === "Kumite") counts.Kumite++;
        else if (x.specialty === "Kata") counts.Kata++;
        else if (x.specialty === "ParaKarate") counts.Para++;
        else counts.Kids++;
    });

    // Update UI counters se presenti
    if(document.getElementById('kumiteAthleteCountDisplay')) document.getElementById('kumiteAthleteCountDisplay').innerText = counts.Kumite;
    // ... altri counter UI ...
    
    return counts;
}

function completeReset() {
    document.getElementById('athleteForm').reset();
    document.getElementById('membersContainer').innerHTML = "";
    toggleRegMode();
    fetchAthletes();
    fetchTeams();
}

// ... Resto delle funzioni (fetchAthletes, delete, etc.) come nel tuo originale ...
