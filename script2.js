const sb = window.supabaseClient;
window.currentSocietyId = null;

// STATI GLOBALI DI EDITING
let editingAthleteId = null; 
let editingTeamId = null; 

// CONFIGURAZIONE INIZIALE VUOTA: Senza paracadute. Le regole DEVONO arrivare da Supabase.
let currentSportConfig = null;

// Funzione Helper per estrarre l'anno da qualsiasi formato di data
function estraiAnnoDaData(dateVal) {
    if (!dateVal) return null;
    dateVal = dateVal.trim();
    
    if (dateVal.includes('-')) {
        const parts = dateVal.split('-');
        if (parts[0].length === 4) return parseInt(parts[0]);
        if (parts[2].length === 4) return parseInt(parts[2]);
    }
    
    if (dateVal.includes('/')) {
        const parts = dateVal.split('/');
        if (parts[2].length === 4) return parseInt(parts[2]);
        if (parts[0].length === 4) return parseInt(parts[0]);
    }
    
    const year = new Date(dateVal).getFullYear();
    return isNaN(year) ? null : year;
}

async function initPage() {
    const eventId = sessionStorage.getItem('selectedEventId');
    const eventName = sessionStorage.getItem('selectedEventName');
    const sportId = sessionStorage.getItem('selectedSportId') || 'karate'; 
    
    if (!eventId) {
        window.location.href = "scelta-evento.html";
        return;
    }

    if(document.getElementById('selectedEventId')) document.getElementById('selectedEventId').value = eventId;
    if(document.getElementById('eventNameDisplay')) document.getElementById('eventNameDisplay').innerText = eventName;

    try {
        // Forza la lettura della tabella configurazioni_sport dal database
        const { data: config, error: configErr } = await sb
            .from('configurazioni_sport')
            .select('*')
            .eq('sport_id', sportId)
            .single();
        
        if (configErr || !config) {
            throw new Error(configErr ? configErr.message : "Nessuna riga trovata per lo sport: " + sportId);
        }
        
        // Salva le regole del database nello stato dell'applicazione
        currentSportConfig = config;
        console.log("Regole caricate con successo da Supabase:", currentSportConfig);

    } catch (err) {
        console.error("ERRORE CRITICO DATABASE:", err);
        alert("ATTENZIONE: Impossibile caricare le regole da Supabase! Il sistema è bloccato. Controlla la tabella 'configurazioni_sport'. Errore: " + err.message);
        return; // Blocca l'esecuzione della pagina
    }

    adattaInterfacciaAlloSport();
    setupBirthdateListeners(); 

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

function adattaInterfacciaAlloSport() {
    if (!currentSportConfig) return;
    const labelsGrado = document.querySelectorAll('label[for="belt"]');
    labelsGrado.forEach(lbl => lbl.innerText = currentSportConfig.etichetta_livello);
    
    const optBeltDefault = document.querySelector('#belt option[value=""]');
    if(optBeltDefault) optBeltDefault.innerText = `-- ${currentSportConfig.etichetta_livello} --`;

    const weightBox = document.getElementById('weight_category')?.closest('.col-md-4') || document.getElementById('weight_category')?.parentElement;
    if (weightBox) {
        weightBox.style.display = currentSportConfig.richiega_peso || currentSportConfig.richiede_peso ? 'block' : 'none';
    }
}

function toggleRegMode() {
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
        
        const dateInput = document.getElementById('birthdate');
        if (dateInput) dateInput.required = true;
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
    const dateInput = document.getElementById('birthdate');
    if (!dateInput) return;
    
    const year = estraiAnnoDaData(dateInput.value);
    if (year && year >= 1900 && year <= 2026) {
        updateClassSpecsAndBelts(year);
    }
}

function handleTeamYearChange() {
    const year = parseInt(document.getElementById('team_year').value);
    if (year) updateClassSpecsAndBelts(year);
}

function updateClassSpecsAndBelts(year) {
    if (!currentSportConfig || !currentSportConfig.regole) return;
    
    const clSel = document.getElementById('classe');
    const spSel = document.getElementById('specialty');
    const beltSel = document.getElementById('belt');

    if (!clSel) return;

    const classi = currentSportConfig.regole.classi_eta || [];
    const classeTrovata = classi.find(c => year >= c.anno_min && year <= c.anno_max);

    let classe = classeTrovata ? classeTrovata.nome : "Fuori Quota";
    
    if (clSel.tagName === 'SELECT') {
        clSel.innerHTML = `<option value="${classe}">${classe}</option>`;
    } else {
        clSel.value = classe;
    }
    
    let belts = classeTrovata ? classeTrovata.cinture : ["Generica"];
    let specs = classeTrovata ? classeTrovata.specialita : [];

    if (beltSel) {
        beltSel.innerHTML = belts.map(b => `<option value="${b}">${b}</option>`).join('');
    }

    if (spSel) {
        spSel.innerHTML = '<option value="">-- Specialità --</option>';
        specs.forEach(s => spSel.innerHTML += `<option value="${s}">${s}</option>`);
    }
    
    handleSpecialtyChange();
}

function handleSpecialtyChange() {
    if (!currentSportConfig || !currentSportConfig.regole) return;

    const spec = document.getElementById('specialty')?.value || "";
    const clSel = document.getElementById('classe');
    const classe = clSel ? (clSel.value || clSel.options?.[clSel.selectedIndex]?.value || "") : "";
    const isTeam = document.querySelector('input[name="regType"]:checked')?.value === 'team';
    
    let gender = isTeam ? document.getElementById('team_gender')?.value : document.getElementById('gender')?.value;
    const wInput = document.getElementById('weight_category');
    if (!wInput) return;

    wInput.innerHTML = '';
    wInput.disabled = true;

    if (!currentSportConfig.richiede_peso && !currentSportConfig.richiega_peso) {
        wInput.innerHTML = '<option value="-">-</option>';
        return;
    }

    if (spec === "Kumite") {
        wInput.disabled = false;
        let weights = [];
        const pesiConfig = currentSportConfig.regole.pesi || {};

        if (pesiConfig[classe]) {
            if (pesiConfig[classe][gender]) weights = pesiConfig[classe][gender];
            else if (Array.isArray(pesiConfig[classe])) weights = pesiConfig[classe];
            else weights = pesiConfig.Default || ["Open"];
        } else {
            weights = pesiConfig.Default || ["Open"];
        }
        weights.forEach(w => wInput.innerHTML += `<option value="${w}">${w} kg</option>`);
    } else if (spec === "ParaKarate") {
        wInput.disabled = false;
        const paraCats = currentSportConfig.regole.parakarate_categorie || [];
        paraCats.forEach(k => wInput.innerHTML += `<option value="${k}">${k}</option>`);
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
                    <button type="button" class="btn btn-sm btn-outline-warning border-0 me-1" onclick="editAthlete('${a.id}')" title="Modifica"><i class="fas fa-edit"></i></button>
                    <button type="button" class="btn btn-sm btn-outline-danger border-0" onclick="deleteAthlete('${a.id}')" title="Elimina"><i class="fas fa-trash"></i></button>
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
            list.innerHTML += `<tr>
                <td><strong>${t.team_name}</strong><br><small class="text-muted">${t.members.join(", ")}</small></td>
                <td>${t.classe}</td>
                <td>${t.gender}</td>
                <td>${t.specialty}</td>
                <td>${t.belt || '-'}</td>
                <td>${t.weight_category || '-'}</td>
                <td class="text-end">
                    <button type="button" class="btn btn-sm btn-outline-warning border-0 me-1" onclick="editTeam('${t.id}')" title="Modifica"><i class="fas fa-edit"></i></button>
                    <button type="button" class="btn btn-sm btn-outline-danger border-0" onclick="deleteTeam('${t.id}')" title="Elimina"><i class="fas fa-trash"></i></button>
                </td>
            </tr>`;
        });
    }
}

async function editAthlete(id) {
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

    const birthYear = estraiAnnoDaData(a.birthdate);
    if (birthYear) updateClassSpecsAndBelts(birthYear);

    if(document.getElementById('specialty')) document.getElementById('specialty').value = a.specialty;
    handleSpecialtyChange(); 
    
    if(document.getElementById('belt')) document.getElementById('belt').value = a.belt;
    if (document.getElementById('weight_category')) document.getElementById('weight_category').value = a.weight_category;

    editingAthleteId = id;
    const submitBtn = document.querySelector('#athleteForm button[type="submit"]');
    if (submitBtn) {
        submitBtn.innerHTML = '<i class="fas fa-save me-2"></i>SALVA MODIFICHE ATLETA';
        submitBtn.className = "btn btn-warning w-100 fw-bold py-3 shadow-sm rounded-3";
    }

    document.getElementById('athleteForm').scrollIntoView({ behavior: 'smooth' });
}

async function editTeam(id) {
    if (editingAthleteId) completeReset();

    const { data: t, error } = await sb.from('teams').select('*').eq('id', id).single();
    if (error) return alert("Errore nel recupero dati della squadra: " + error.message);

    const radioTeam = document.querySelector('input[name="regType"][value="team"]');
    if (radioTeam) radioTeam.checked = true;
    toggleRegMode();

    document.getElementById('team_name').value = t.team_name;
    document.getElementById('team_year').value = t.team_year;
    document.getElementById('team_gender').value = t.gender;

    updateClassSpecsAndBelts(t.team_year);

    document.getElementById('specialty').value = t.specialty;
    handleSpecialtyChange(); 
    
    if(t.belt && document.getElementById('belt')) document.getElementById('belt').value = t.belt;
    if(t.weight_category && document.getElementById('weight_category')) document.getElementById('weight_category').value = t.weight_category;

    const container = document.getElementById('membersContainer');
    container.innerHTML = "";
    t.members.forEach(member => { addMemberField(member); });

    editingTeamId = id;
    const submitBtn = document.querySelector('#athleteForm button[type="submit"]');
    if (submitBtn) {
        submitBtn.innerHTML = '<i class="fas fa-save me-2"></i>SALVA MODIFICHE SQUADRA';
        submitBtn.className = "btn btn-warning w-100 fw-bold py-3 shadow-sm rounded-3";
    }

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
    if (!currentSportConfig) return alert("Impossibile procedere: Regole non caricate da Supabase.");
    
    const eventId = sessionStorage.getItem('selectedEventId');
    if (!window.currentSocietyId) return alert("Errore: Società non identificata.");

    const spec = document.getElementById('specialty').value;
    const isTeam = document.querySelector('input[name="regType"]:checked').value === 'team';

    const dateInput = document.getElementById('birthdate');
    let birthYear = isTeam ? parseInt(document.getElementById('team_year').value) : estraiAnnoDaData(dateInput ? dateInput.value : "");

    if (!birthYear) return alert("Inserisci una data di nascita valida.");

    // VERIFICA DEI LIMITI RIGIDA DA JSON
    if (!editingAthleteId && !editingTeamId) {
        const globalCounts = await updateGlobalCounters(eventId);
        const currentSum = globalCounts.Kata + globalCounts.Kumite;
        
        const limitiConfig = currentSportConfig.regole?.limiti || {};
        const maxPosti = limitiConfig.KataKumiteSum || limitiConfig.katakumitesum || limitiConfig.katakumiteSum || 300;

        if ((spec === "Kumite" || spec === "Kata") && currentSum >= maxPosti) {
            return alert(`BLOCCO ISCRIZIONI: Posti esauriti nel database! Limite di ${maxPosti} iscritti raggiunto.`);
        }
    }

    const clSel = document.getElementById('classe');
    const classeSalva = clSel ? (clSel.value || clSel.options?.[clSel.selectedIndex]?.value || "Fuori Quota") : "Fuori Quota";

    const commonData = {
        event_id: eventId,
        society_id: window.currentSocietyId,
        classe: classeSalva,
        specialty: spec,
        belt: document.getElementById('belt').value,
        weight_category: document.getElementById('weight_category')?.value || '-'
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

        if (editingTeamId) {
            const { error } = await sb.from('teams').update([teamData]).eq('id', editingTeamId);
            if (error) alert("Errore: " + error.message);
            else { alert("Squadra modificata su database!"); completeReset(); }
        } else {
            const { error } = await sb.from('teams').insert([teamData]);
            if (error) alert(error.message);
            else { alert("Squadra registrata su database!"); completeReset(); }
        }
    } else {
        const athleteData = {
            ...commonData, 
            first_name: document.getElementById('first_name').value,
            last_name: document.getElementById('last_name').value,
            birthdate: dateInput ? dateInput.value : '',
            gender: document.getElementById('gender').value
        };

        if (editingAthleteId) {
            const { error } = await sb.from('atleti').update([athleteData]).eq('id', editingAthleteId);
            if (error) alert("Errore: " + error.message);
            else { alert("Atleta modificato su database!"); completeReset(); }
        } else {
            const { error } = await sb.from('atleti').insert([athleteData]);
            if (error) alert(error.message);
            else { alert("Atleta registrato su database!"); completeReset(); }
        }
    }
}

function completeReset() {
    const form = document.getElementById('athleteForm');
    if(form) form.reset();

    const container = document.getElementById('membersContainer');
    if (container) container.innerHTML = "";

    const clSel = document.getElementById('classe');
    if(clSel) {
        if(clSel.tagName === 'SELECT') clSel.innerHTML = '<option value="">-- Seleziona Anno --</option>';
        else clSel.value = "";
    }
    if(document.getElementById('specialty')) document.getElementById('specialty').innerHTML = '<option value="">-- Specialità --</option>';
    if(document.getElementById('belt')) document.getElementById('belt').innerHTML = '<option value="">-- Cintura --</option>';
    
    const wInput = document.getElementById('weight_category');
    if(wInput) {
        wInput.innerHTML = '<option value="-">-</option>';
        wInput.disabled = true;
    }

    editingAthleteId = null;
    editingTeamId = null;
    const submitBtn = document.querySelector('#athleteForm button[type="submit"]');
    if (submitBtn) {
        submitBtn.innerHTML = '<i class="fas fa-save me-2"></i>CONFERMA E REGISTRA';
        submitBtn.className = "btn btn-primary w-100 fw-bold py-3 shadow-sm rounded-3";
    }

    fetchAthletes();
    fetchTeams();
    toggleRegMode();
    adattaInterfacciaAlloSport();
}

function setupBirthdateListeners() {
    const el = document.getElementById('birthdate');
    if (el) {
        el.removeEventListener('change', handleBirthdateChange);
        el.removeEventListener('input', handleBirthdateChange);
        el.addEventListener('change', handleBirthdateChange);
        el.addEventListener('input', handleBirthdateChange);
    }
}

async function deleteAthlete(id) { if (confirm("Eliminare l'atleta selezionato dal database?")) { await sb.from('atleti').delete().eq('id', id); fetchAthletes(); } }
async function deleteTeam(id) { if (confirm("Eliminare la squadra selezionata dal database?")) { await sb.from('teams').delete().eq('id', id); fetchTeams(); } }
async function logout() { await sb.auth.signOut(); window.location.href = "login.html"; }

document.addEventListener('DOMContentLoaded', () => {
    initPage();
    if(document.getElementById('athleteForm')) document.getElementById('athleteForm').addEventListener('submit', addAthlete);
    if(document.getElementById('gender')) document.getElementById('gender').addEventListener('change', handleSpecialtyChange); 
    if(document.getElementById('team_gender')) document.getElementById('team_gender').addEventListener('change', handleSpecialtyChange); 
    if(document.getElementById('team_year')) document.getElementById('team_year').addEventListener('change', handleTeamYearChange);
    if(document.getElementById('specialty')) document.getElementById('specialty').addEventListener('change', handleSpecialtyChange);
    document.querySelectorAll('input[name="regType"]').forEach(r => r.addEventListener('change', toggleRegMode));
});

async function exportToExcel() {
    const eventId = sessionStorage.getItem('selectedEventId');
    if (!window.currentSocietyId || !eventId) return alert("Errore sessione.");
    try {
        const { data: athletes, error: errA } = await sb.from('atleti').select('*').eq('society_id', window.currentSocietyId).eq('event_id', eventId);
        const { data: teams, error: errT } = await sb.from('teams').select('*').eq('society_id', window.currentSocietyId).eq('event_id', eventId);
        if (errA || errT) throw new Error("Errore nel recupero dati");
        if ((!athletes || athletes.length === 0) && (!teams || teams.length === 0)) return alert("Nessun dato presente.");

        let csv = ["TIPO;NOME/TEAM;MEMBRI;CLASSE;SPECIALITA;CINTURA;SESSO;PESO"];
        athletes.forEach(a => csv.push(`"Individuale";"${a.last_name} ${a.first_name}";"-";"${a.classe}";"${a.specialty}";"${a.belt}";"${a.gender}";"${a.weight_category}"`));
        teams.forEach(t => {
            const membri = t.members ? t.members.join(' - ') : "-";
            csv.push(`"Team";"${t.team_name}";"${membri}";"${t.classe}";"${t.specialty}";"${t.belt || '-'}";"${t.gender}";"${t.weight_category || '-'}"`);
        });

        const blob = new Blob(["\uFEFF" + csv.join("\n")], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `Iscritti_${sessionStorage.getItem('selectedEventName') || "Evento"}.csv`;
        link.click();
    } catch (error) { alert("Errore durante l'esportazione."); }
}
