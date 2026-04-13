const sb = window.supabaseClient;

// --- 1. LIMITI RIGIDI (Dalla Logica 2) ---
const LIMITI = {
    "Kumite": 400,
    "Kata": 300,
    "ParaKarate": 50,
    "KIDS": 250 // Somma specialità propedeutiche
};

// --- 2. INIZIALIZZAZIONE ---
async function initPage() {
    const eventId = sessionStorage.getItem('selectedEventId');
    const eventName = sessionStorage.getItem('selectedEventName');
    
    if (!eventId) {
        window.location.href = "scelta-evento.html";
        return;
    }

    document.getElementById('selectedEventId').value = eventId;
    document.getElementById('eventNameDisplay').innerText = eventName;

    const { data: { user } } = await sb.auth.getUser();
    if (user) {
        const { data: soc } = await sb.from('societa').select('*').eq('user_id', user.id).single();
        if (soc) {
            window.currentSocietyId = soc.id;
            document.getElementById('societyNameDisplay').innerText = soc.nome;
            await fetchAthletes();
            await fetchTeams();
        }
    }
}

// --- 3. LOGICA DINAMICA AVANZATA (Classi, Cinture, Specialità) ---
function handleBirthdateChange() {
    const dateVal = document.getElementById('birthdate').value;
    if (!dateVal) return;
    const year = new Date(dateVal).getFullYear();
    if (year > 999) updateClassSpecsAndBelts(year);
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
    // Suddivisione precisa Logica 2
    if (year >= 2021 && year <= 2022) classe = "U6";
    else if (year >= 2019 && year <= 2020) classe = "U8";
    else if (year >= 2017 && year <= 2018) classe = "U10";
    else if (year >= 2015 && year <= 2016) classe = "U12";
    else if (year >= 2013 && year <= 2014) classe = "U14";
    else if (year >= 2011 && year <= 2012) classe = "Cadetti";
    else if (year >= 2009 && year <= 2010) classe = "Juniores";
    else if (year >= 1991 && year <= 2008) classe = "Seniores";
    else if (year >= 1960 && year <= 1990) classe = "Master";
    else classe = "Fuori Quota";

    clSel.innerHTML = `<option value="${classe}">${classe}</option>`;

    // Gestione Cinture Accorpate
    const isKids = ["U6", "U8", "U10", "U12"].includes(classe);
    let belts = isKids ? ["Bianca/Gialla", "Arancio/Verde"] : ["Bianca/Gialla", "Arancio/Verde", "Blu/Marrone", "Nera"];
    beltSel.innerHTML = belts.map(b => `<option value="${b}">${b}</option>`).join('');

    // Logica Specialità per Classe
    let specs = [];
    if (isKids) {
        specs = ["Percorso-Kata", "Percorso-Palloncino", "Combinata", "ParaKarate"];
    } else {
        specs = ["Kata", "Kumite", "ParaKarate"];
    }
    
    spSel.innerHTML = '<option value="">-- Specialità --</option>';
    specs.forEach(s => spSel.innerHTML += `<option value="${s}">${s}</option>`);
    
    handleSpecialtyChange(); // Reset pesi
}

function handleSpecialtyChange() {
    const spec = document.getElementById('specialty').value;
    const classe = document.getElementById('classe').value;
    const gender = document.querySelector('input[name="gender"]:checked')?.value || 
                   document.getElementById('team_gender')?.value;
    const wInput = document.getElementById('weight_category');

    wInput.innerHTML = '';
    wInput.disabled = true;

    if (spec === "Kumite") {
        wInput.disabled = false;
        let weights = [];
        // Logica pesi granulare Logica 2
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

// --- 4. CONTEGGI E VALIDAZIONE LIMITI ---
async function checkAvailability(specialty) {
    const eventId = sessionStorage.getItem('selectedEventId');
    // Conta tutti gli atleti iscritti a questo evento per quella specialità
    const { data: allAthletes } = await sb.from('atleti').select('specialty').eq('event_id', eventId);
    
    const counts = {
        Kumite: allAthletes.filter(a => a.specialty === 'Kumite').length,
        Kata: allAthletes.filter(a => a.specialty === 'Kata').length,
        ParaKarate: allAthletes.filter(a => a.specialty === 'ParaKarate').length,
        KIDS: allAthletes.filter(a => ["Percorso-Palloncino", "Percorso-Kata", "Combinata"].includes(a.specialty)).length
    };

    let limit = 999;
    let current = 0;

    if (specialty === "Kumite") { limit = LIMITI.Kumite; current = counts.Kumite; }
    else if (specialty === "Kata") { limit = LIMITI.Kata; current = counts.Kata; }
    else if (specialty === "ParaKarate") { limit = LIMITI.ParaKarate; current = counts.ParaKarate; }
    else if (["Percorso-Palloncino", "Percorso-Kata", "Combinata"].includes(specialty)) { limit = LIMITI.KIDS; current = counts.KIDS; }

    return current < limit;
}

// --- 5. AGGIUNTA (Con controllo disponibilità) ---
async function addAthlete(e) {
    e.preventDefault();
    const isTeam = document.querySelector('input[name="regType"]:checked').value === 'team';
    const spec = document.getElementById('specialty').value;

    // Controllo posti disponibili
    const isAvailable = await checkAvailability(spec);
    if (!isAvailable) {
        alert("Spiacenti, i posti per la specialità " + spec + " sono esauriti!");
        return;
    }

    const commonData = {
        event_id: document.getElementById('selectedEventId').value,
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
            members: members
        }]);
        if (error) alert("Errore Team: " + error.message);
        else { alert("Squadra registrata!"); completeReset(); }
    } else {
        const { error } = await sb.from('atleti').insert([{
            ...commonData,
            first_name: document.getElementById('first_name').value,
            last_name: document.getElementById('last_name').value,
            birthdate: document.getElementById('birthdate').value,
            gender: document.querySelector('input[name="gender"]:checked').value
        }]);
        if (error) alert("Errore Atleta: " + error.message);
        else { alert("Atleta registrato!"); completeReset(); }
    }
}

// --- 6. AGGIORNAMENTO COUNTER UI ---
function updateCounters(athletes) {
    const c = { Kumite: 0, Kata: 0, Para: 0, Kids: 0 };
    athletes?.forEach(a => {
        if (a.specialty === "Kumite") c.Kumite++; 
        else if (a.specialty === "Kata") c.Kata++; 
        else if (a.specialty === "ParaKarate") c.Para++; 
        else if (["Percorso-Palloncino", "Percorso-Kata", "Combinata"].includes(a.specialty)) c.Kids++;
    });

    // Visualizzazione "Disponibili / Totale" come in Logica 2
    document.getElementById('kumiteAthleteCountDisplay').innerText = `${LIMITI.Kumite - c.Kumite} / ${LIMITI.Kumite}`;
    document.getElementById('kataAthleteCountDisplay').innerText = `${LIMITI.Kata - c.Kata} / ${LIMITI.Kata}`;
    document.getElementById('ParaKarateAthleteCountDisplay').innerText = `${LIMITI.ParaKarate - c.Para} / ${LIMITI.ParaKarate}`;
    document.getElementById('KIDSAthleteCountDisplay').innerText = `${LIMITI.KIDS - c.Kids} / ${LIMITI.KIDS}`;
}

// Restanti funzioni (toggleRegMode, fetchAthletes, fetchTeams, exportToExcel, delete, ecc.) 
// rimangono identiche alla Versione 1 per non rompere la UI esistente.
