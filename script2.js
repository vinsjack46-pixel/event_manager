const sb = window.supabaseClient;
window.currentSocietyId = null;

// STATI GLOBALI DI EDITING
let editingAthleteId = null; 
let editingTeamId = null; // NUOVO: Stato di editing per le squadre

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
    // Se stiamo modificando qualcosa, impediamo il cambio manuale radio per evitare di perdere lo stato
    const isTeam = document.querySelector('input[name="regType"]:checked').value === 'team';
    const indFields = document.getElementById('individualFields');
    const teamFields = document.getElementById('teamFields');

    if (isTeam) {
        indFields.style.display = 'none';
        teamFields.style.display = 'block';
        
        indFields.querySelectorAll('input, select').forEach(i => { i.required = false; i.value = ""; });
        document.getElementById('team_name').required = true;
        document.getElementById('team_year').required = true;
        
        if (document.getElementById('membersContainer').children.length === 0) {
            for(let i=0; i<3; i++) addMemberField();
        }
        document.querySelectorAll('.member-input').forEach(i => i.required = true);
    } else {
        indFields.style.display = 'block';
        teamFields.style.display = 'none';

        teamFields.querySelectorAll('input, select').forEach(i => { i.required = false; i.value = ""; });
        document.querySelectorAll('.member-input').forEach(i => { i.required = false; });

        document.getElementById('first_name').required = true;
        document.getElementById('last_name').required = true;
        document.getElementById('birthdate').required = true;
    }
}

function addMemberField(value = "") {
    const container = document.getElementById('membersContainer');
    const count = container.querySelectorAll('.member-input').length;
    if (count >= 6) return alert("Massimo 6 componenti.");
    const div = document.createElement('div');
    div.className = "col-md-4 mb-2";
    div.innerHTML = `
        <div class="input-group input-group-sm">
            <span class="input-group-text">${count + 1}</span>
            <input type="text" class="form-control member-input" placeholder="Nome Cognome" value="${value}" required>
            ${count >= 3 ? '<button type="button" class="btn btn-outline-danger" onclick="this.parentElement.parentElement.remove()">×</button>' : ''}
        </div>`;
    container.appendChild(div);
}

function handleBirthdateChange() {
    const dateVal = document.getElementById('birthdate').value;
    if (!dateVal) return;
    updateClassSpecsAndBelts(new Date(dateVal).getFullYear());
}

function handleGenderChange() {
    const spec = document.getElementById('specialty').value;
    if (spec === "Kumite") {
        handleSpecialtyChange(); 
    }
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
    else if (year >= 2013 && year <= 2014) classe = "Esordienti";
    else if (year >= 2011 && year <= 2012) classe = "Cadetti";
    else if (year >= 2009 && year <= 2010) classe = "Juniores";
    else if (year >= 1991 && year <= 2008) classe = "Seniores";
    else if (year >= 1960 && year <= 1990) classe = "Master";
    else classe = "Fuori Quota";

    clSel.innerHTML = `<option value="${classe}">${classe}</option>`;
    
    let belts = [];
    switch (classe) {
        case "U10":
        case "U12":
            belts = ["Bianca/Gialla", "Arancio/Verde", "Blu/Marrone"];
            break;
        case "Esordienti":
            belts = ["Bianca/Gialla", "Arancio/Verde", "Blu/Marrone/Nera"];
            break;
        case "Cadetti":
        case "Juniores":
        case "Seniores":
        case "Master":
            belts = ["Bianca/Gialla/Arancio", "Verde/Blu", "Marrone/Nera"];
            break;
        default:
            belts = ["Bianca/Gialla/Arancio", "Verde/Blu", "Marrone/Nera"];
    }
    beltSel.innerHTML = belts.map(b => `<option value="${b}">${b}</option>`).join('');

    let specs = ["Kata", "Kumite", "ParaKarate"];
    if (classe === "U10" || classe === "U12") {
        specs.push("Combinata");
    }

    spSel.innerHTML = '<option value="">-- Specialità --</option>';
    specs.forEach(s => spSel.innerHTML += `<option value="${s}">${s}</option>`);
    
    handleSpecialtyChange();
}

function handleSpecialtyChange() {
    const spec = document.getElementById('specialty').value;
    const classe = document.getElementById('classe').value;
    const isTeam = document.querySelector('input[name="regType"]:checked').value === 'team';
    
    let gender = isTeam ? document.getElementById('team_gender').value : document.getElementById('gender').value;
    const wInput = document.getElementById('weight_category');
    wInput.innerHTML = '';
    wInput.disabled = true;

    if (spec === "Kumite") {
        wInput.disabled = false;
        let weights = [];
        if (classe === "Esordienti") {
            weights = (gender === "Maschio") ? ["-40", "-45", "-50", "-55", "55+"] : ["-42", "-47", "-52", "52+"];
        } else if (classe === "U12") {
            weights = ["-32", "-37", "-42","-47", "47+"];
        } else if (classe === "U10") {
            weights = ["-22", "-27", "-32","-37", "37+"];
        } else { 
            weights = ["Open"]; 
        }
        weights.forEach(w => wInput.innerHTML += `<option value="${w}">${w} kg</option>`);
    } else if (spec === "ParaKarate") {
        wInput.disabled = false;
        ["F10","F20","F21", "F22", "F30", "F31", "F32", "F33", "F34", "F35", "F36", "F40"].forEach(k => wInput.innerHTML += `<option value="${k}">${k}</option>`);
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
            list.innerHTML += `<tr>
                <td><strong>${a.last_name} ${a.first_name}</strong></td>
                <td>${a.classe}</td>
                <td>${a.gender}</td>
                <td>${a.specialty}</td>
                <td>${a.belt}</td>
                <td>${a.weight_category}</td>
                <td class="text-end">
                    <button class="btn btn-sm btn-outline-warning border-0 me-1" onclick="editAthlete('${a.id}')" title="Modifica"><i class="fas fa-edit"></i></button>
                    <button class="btn btn-sm btn-outline-danger border-0" onclick="deleteAthlete('${a.id}')" title="Elimina"><i class="fas fa-trash"></i></button>
                </td>
            </tr>`;
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
            // AGGIORNATO: Aggiunto anche qui il pulsante modifica per la squadra (giallo con matita)
            list.innerHTML += `<tr>
                <td><strong>${t.team_name}</strong><br><small class="text-muted">${t.members.join(", ")}</small></td>
                <td>${t.classe}</td>
                <td>${t.gender}</td>
                <td>${t.specialty}</td>
                <td>${t.belt || '-'}</td>
                <td>${t.weight_category || '-'}</td>
                <td class="text-end">
                    <button class="btn btn-sm btn-outline-warning border-0 me-1" onclick="editTeam('${t.id}')" title="Modifica"><i class="fas fa-edit"></i></button>
                    <button class="btn btn-sm btn-outline-danger border-0" onclick="deleteTeam('${t.id}')" title="Elimina"><i class="fas fa-trash"></i></button>
                </td>
            </tr>`;
        });
    }
}

async function editAthlete(id) {
    // Se stiamo modificando una squadra, resettiamo prima per pulire lo stato delle squadre
    if (editingTeamId) completeReset();

    const { data: a, error } = await sb.from('atleti').select('*').eq('id', id).single();
    if (error) return alert("Errore nel recupero dati dell'atleta: " + error.message);

    const radioInd = document.querySelector('input[name="regType"][value="individual"]');
    if (radioInd) radioInd.checked = true;
    toggleRegMode();

    document.getElementById('first_name').value = a.first_name;
    document.getElementById('last_name').value = a.last_name;
    document.getElementById('birthdate').value = a.birthdate;
    document.getElementById('gender').value = a.gender;

    const birthYear = new Date(a.birthdate).getFullYear();
    updateClassSpecsAndBelts(birthYear);

    document.getElementById('specialty').value = a.specialty;
    handleSpecialtyChange(); 
    
    document.getElementById('belt').value = a.belt;
    if (document.getElementById('weight_category')) {
        document.getElementById('weight_category').value = a.weight_category;
    }

    editingAthleteId = id;
    const submitBtn = document.querySelector('#athleteForm button[type="submit"]');
    if (submitBtn) {
        submitBtn.innerText = "Salva Modifiche Atleta";
        submitBtn.classList.remove('btn-primary');
        submitBtn.classList.add('btn-warning');
    }

    document.getElementById('athleteForm').scrollIntoView({ behavior: 'smooth' });
}

// NUOVA FUNZIONE: Carica i dati della squadra nel modulo per la modifica
async function editTeam(id) {
    // Se stiamo modificando un atleta individuale, puliamo prima il modulo
    if (editingAthleteId) completeReset();

    const { data: t, error } = await sb.from('teams').select('*').eq('id', id).single();
    if (error) return alert("Errore nel recupero dati della squadra: " + error.message);

    // 1. Forza la modalità squadra (Team) nel form e aggiorna i campi visibili
    const radioTeam = document.querySelector('input[name="regType"][value="team"]');
    if (radioTeam) radioTeam.checked = true;
    toggleRegMode();

    // 2. Compila i campi della squadra
    document.getElementById('team_name').value = t.team_name;
    document.getElementById('team_year').value = t.team_year;
    document.getElementById('team_gender').value = t.gender;

    // 3. Esegui il calcolo a cascata di Classe, Specialità e Cinture basandoti sull'anno della squadra
    updateClassSpecsAndBelts(t.team_year);

    // 4. Riporta la specialità, la cintura e l'eventuale peso salvati
    document.getElementById('specialty').value = t.specialty;
    handleSpecialtyChange(); // Rigenera le tendine specifiche
    
    if(t.belt) document.getElementById('belt').value = t.belt;
    if(t.weight_category && document.getElementById('weight_category')) {
        document.getElementById('weight_category').value = t.weight_category;
    }

    // 5. Rigenera i campi dei componenti (svuota il container e inserisci quelli salvati nel DB)
    const container = document.getElementById('membersContainer');
    container.innerHTML = "";
    t.members.forEach(member => {
        addMemberField(member);
    });

    // 6. Imposta lo stato globale su editing team e cambia grafica al tasto d'invio
    editingTeamId = id;
    const submitBtn = document.querySelector('#athleteForm button[type="submit"]');
    if (submitBtn) {
        submitBtn.innerText = "Salva Modifiche Squadra";
        submitBtn.classList.remove('btn-primary');
        submitBtn.classList.add('btn-warning');
    }

    // 7. Sposta l'utente fluidamente sul modulo
    document.getElementById('athleteForm').scrollIntoView({ behavior: 'smooth' });
}

async function updateGlobalCounters(eventId) {
    const { data: allA } = await sb.from('atleti').select('specialty').eq('event_id', eventId);
    const { data: allT } = await sb.from('teams').select('specialty').eq('event_id', eventId);
    const globalTotal = [...(allA || []), ...(allT || [])];

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

    let birthYear = isTeam ? parseInt(document.getElementById('team_year').value) : new Date(document.getElementById('birthdate').value).getFullYear();

    if (birthYear < 1960 || birthYear > 2018) {
        return alert("ATTENZIONE: Iscrizione riservata ai nati tra il 1960 e il 2018.");
    }

    // Se NON siamo in modifica, effettuiamo il controllo dei tetti dei posti totali
    if (!editingAthleteId && !editingTeamId) {
        const globalCounts = await updateGlobalCounters(eventId);
        const currentSum = globalCounts.Kata + globalCounts.Kumite;
        if ((spec === "Kumite" || spec === "Kata") && currentSum >= LIMITI.KataKumiteSum) {
            return alert(`Posti esauriti! Limite di ${LIMITI.KataKumiteSum} raggiunto.`);
        }
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
        
        const teamData = {
            ...commonData, 
            team_name: document.getElementById('team_name').value, 
            gender: document.getElementById('team_gender').value, 
            members: members,
            team_year: birthYear 
        };

        // AGGIORNATO: Logica di Update o Insert per le Squadre
        if (editingTeamId) {
            const { error } = await sb.from('teams').update([teamData]).eq('id', editingTeamId);
            if (error) alert("Errore durante l'aggiornamento della squadra: " + error.message);
            else { 
                alert("Dati della squadra aggiornati con successo!"); 
                completeReset(); 
            }
        } else {
            const { error } = await sb.from('teams').insert([teamData]);
            if (error) alert(error.message);
            else { alert("Squadra registrata!"); completeReset(); }
        }
    } else {
        const sessoSelezionato = document.getElementById('gender').value;
        const athleteData = {
            ...commonData, 
            first_name: document.getElementById('first_name').value, 
            last_name: document.getElementById('last_name').value, 
            birthdate: document.getElementById('birthdate').value, 
            gender: sessoSelezionato
        };

        if (editingAthleteId) {
            const { error } = await sb.from('atleti').update([athleteData]).eq('id', editingAthleteId);
            if (error) alert("Errore durante l'aggiornamento: " + error.message);
            else { 
                alert("Dati atleta aggiornati con successo!"); 
                completeReset(); 
            }
        } else {
            const { error } = await sb.from('atleti').insert([athleteData]);
            if (error) alert(error.message);
            else { alert("Atleta registrato!"); completeReset(); }
        }
    }
}

function completeReset() {
    const form = document.getElementById('athleteForm');
    form.reset();

    const container = document.getElementById('membersContainer');
    if (container) container.innerHTML = "";

    document.getElementById('classe').innerHTML = '<option value="">-- Seleziona Anno --</option>';
    document.getElementById('specialty').innerHTML = '<option value="">-- Specialità --</option>';
    document.getElementById('belt').innerHTML = '<option value="">-- Cintura --</option>';
    
    const wInput = document.getElementById('weight_category');
    wInput.innerHTML = '<option value="-">-</option>';
    wInput.disabled = true;

    // AGGIORNATO: Resetta entrambi gli stati di editing e ripristina il pulsante blu primario
    editingAthleteId = null;
    editingTeamId = null;
    const submitBtn = document.querySelector('#athleteForm button[type="submit"]');
    if (submitBtn) {
        submitBtn.innerText = "Invia Iscrizione";
        submitBtn.classList.remove('btn-warning');
        submitBtn.classList.add('btn-primary');
    }

    fetchAthletes();
    fetchTeams();
    toggleRegMode();
    
    console.log("Modulo pulito e stati resettati.");
}

async function deleteAthlete(id) { if (confirm("Eliminare?")) { await sb.from('atleti').delete().eq('id', id); fetchAthletes(); } }
async function deleteTeam(id) { if (confirm("Eliminare?")) { await sb.from('teams').delete().eq('id', id); fetchTeams(); } }
async function logout() { await sb.auth.signOut(); window.location.href = "login.html"; }

document.addEventListener('DOMContentLoaded', () => {
    initPage();
    document.getElementById('athleteForm').addEventListener('submit', addAthlete);
    document.getElementById('birthdate').addEventListener('change', handleBirthdateChange);
    document.getElementById('gender').addEventListener('change', handleGenderChange); 
    document.getElementById('team_year').addEventListener('change', handleTeamYearChange);
    document.getElementById('specialty').addEventListener('change', handleSpecialtyChange);
    document.querySelectorAll('input[name="regType"]').forEach(r => r.addEventListener('change', toggleRegMode));
});

async function exportToExcel() {
    const eventId = sessionStorage.getItem('selectedEventId');
    if (!window.currentSocietyId || !eventId) {
        return alert("Errore: sessione non valida o società non identificata.");
    }
    try {
        const { data: athletes, error: errA } = await sb.from('atleti').select('*').eq('society_id', window.currentSocietyId).eq('event_id', eventId);
        const { data: teams, error: errT } = await sb.from('teams').select('*').eq('society_id', window.currentSocietyId).eq('event_id', eventId);
        if (errA || errT) throw new Error("Errore nel recupero dati");
        if ((!athletes || athletes.length === 0) && (!teams || teams.length === 0)) {
            return alert("Nessun dato presente da esportare.");
        }

        let csv = ["TIPO;NOME/TEAM;MEMBRI;CLASSE;SPECIALITA;CINTURA;SESSO;PESO"];
        athletes.forEach(a => {
            csv.push(`"Individuale";"${a.last_name} ${a.first_name}";"-";"${a.classe}";"${a.specialty}";"${a.belt}";"${a.gender}";"${a.weight_category}"`);
        });
        teams.forEach(t => {
            const membri = t.members ? t.members.join(' - ') : "-";
            csv.push(`"Team";"${t.team_name}";"${membri}";"${t.classe}";"${t.specialty}";"${t.belt || '-'}";"${t.gender}";"${t.weight_category || '-'}"`);
        });

        const blob = new Blob(["\uFEFF" + csv.join("\n")], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const nomeEvento = sessionStorage.getItem('selectedEventName') || "Evento";
        link.href = URL.createObjectURL(blob);
        link.download = `Iscritti_${nomeEvento}.csv`;
        link.click();
    } catch (error) {
        console.error(error);
        alert("Si è verificato un errore durante l'esportazione.");
    }
}
