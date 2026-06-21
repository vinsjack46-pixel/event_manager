// ==========================================================================
// SCRIPT2.JS - MOTORE KARATE COMPLETO (CON COMPONENTI DEFAULT E STILE UNIFORMATO)
// ==========================================================================
const { createClient } = window.supabase;
const supabaseUrl = 'https://nhsvadkqagsqgirvoibg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5oc3ZhZGtxYWdzcWdpcnZvaWJnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5NzQ1MjQsImV4cCI6MjA4NzU1MDUyNH0.v0PPOfmX1p_sHkV2ZwzaH8gxr7VwN9MMRB1AclEOhvQ';

const sb = createClient(supabaseUrl, supabaseKey);

window.currentSocietyId = null;
let currentSportConfig = null;
let editingAthleteId = null; 
let editingTeamId = null;

// Helper per estrarre l'anno in modo dinamico
function estraiAnnoDaData(dateVal) {
    if (!dateVal) return null;
    dateVal = dateVal.trim();
    if (dateVal.includes('-')) {
        const parts = dateVal.split('-');
        if (parts[0].length === 4) return parseInt(parts[0]);
        if (parts[2].length === 4) return parseInt(parts[2]);
    }
    const year = new Date(dateVal).getFullYear();
    return isNaN(year) ? null : year;
}

window.logout = async function() {
    await sb.auth.signOut();
    window.location.href = "login.html";
};

// Inizializzazione Dashboard Karate
async function initKarateDashboard() {
    const eventId = sessionStorage.getItem('selectedEventId');
    if (!eventId) return window.location.href = "scelta-evento.html";

    if (document.getElementById('eventNameDisplay')) document.getElementById('eventNameDisplay').innerText = sessionStorage.getItem('selectedEventName') || "";
    if (document.getElementById('nomeGaraTitolo')) document.getElementById('nomeGaraTitolo').innerText = sessionStorage.getItem('selectedEventName') || "";

    // Carica regole Karate
    try {
        const { data: config } = await sb.from('configurazioni_sport').select('*').eq('sport_id', 'karate').single();
        if (config) {
            currentSportConfig = config.regole;
        }
    } catch(e) { console.error(e); }

    // Rileva sessione utente e popola dati Società
    const { data: { user } } = await sb.auth.getUser();
    if (user) {
        const { data: soc } = await sb.from('societa').select('*').eq('user_id', user.id).single();
        if (soc) {
            window.currentSocietyId = soc.id;
            if (document.getElementById('societyNameDisplay')) document.getElementById('societyNameDisplay').innerText = soc.nome;
            if (document.getElementById('nomeSocietaHeader')) document.getElementById('nomeSocietaHeader').innerText = soc.nome;
            fetchAthletes();
            fetchTeams();
        }
    }

    // Bind degli eventi UI
    document.querySelectorAll('input[name="regType"]').forEach(r => r.addEventListener('change', toggleRegMode));
    document.getElementById('birthdate')?.addEventListener('change', handleBirthdateChange);
    document.getElementById('team_year')?.addEventListener('change', handleTeamYearChange);
    document.getElementById('gender')?.addEventListener('change', handleSpecialtyChange);
    document.getElementById('team_gender')?.addEventListener('change', handleSpecialtyChange);
    document.getElementById('specialty')?.addEventListener('change', handleSpecialtyChange);
    document.getElementById('athleteForm')?.addEventListener('submit', addEntity);
}

function toggleRegMode() {
    const isTeam = document.querySelector('input[name="regType"]:checked').value === 'team';
    document.getElementById('individualFields').style.display = isTeam ? 'none' : 'block';
    document.getElementById('teamFields').style.display = isTeam ? 'block' : 'none';
    
    document.getElementById('first_name').required = !isTeam;
    document.getElementById('last_name').required = !isTeam;
    document.getElementById('birthdate').required = !isTeam;
    document.getElementById('team_name').required = isTeam;
    document.getElementById('team_year').required = isTeam;

    // Genera 3 campi di default se la lista componenti è vuota e siamo in inserimento squadra
    if (isTeam && !editingTeamId) {
        const cont = document.getElementById('membersContainer');
        if (cont && cont.children.length === 0) {
            for (let i = 0; i < 3; i++) {
                window.addMemberField("");
            }
        }
    }
}

window.addMemberField = function(val = "") {
    const cont = document.getElementById('membersContainer');
    if (!cont) return;
    const c = cont.children.length;
    if (c >= 6) return alert("Massimo 6 componenti per squadra.");
    const d = document.createElement('div');
    d.className = "col-md-4 mb-2";
    d.innerHTML = `<div class="input-group input-group-sm"><span class="input-group-text">${c+1}</span><input type="text" class="form-control member-input" value="${val}" required><button type="button" class="btn btn-outline-danger" onclick="this.parentElement.parentElement.remove()">×</button></div>`;
    cont.appendChild(d);
};

function handleBirthdateChange() { updateSpecs(estraiAnnoDaData(document.getElementById('birthdate').value)); }
function handleTeamYearChange() { updateSpecs(parseInt(document.getElementById('team_year').value)); }

function updateSpecs(year) {
    if (!currentSportConfig || !year) return;
    const classe = currentSportConfig.classi_eta?.find(c => year >= c.anno_min && year <= c.anno_max);
    
    const clSel = document.getElementById('classe');
    clSel.innerHTML = `<option value="${classe ? classe.nome : 'Fuori Quota'}">${classe ? classe.nome : 'Fuori Quota'}</option>`;

    const spSel = document.getElementById('specialty');
    spSel.innerHTML = '<option value="">-- Specialità --</option>';
    if (classe) classe.specialita.forEach(s => spSel.innerHTML += `<option value="${s}">${s}</option>`);
    
    const beltSel = document.getElementById('belt');
    if (beltSel) {
        beltSel.innerHTML = '<option value="">-- Cintura --</option>';
        if (classe && classe.cinture) {
            classe.cinture.forEach(c => beltSel.innerHTML += `<option value="${c}">${c}</option>`);
        } else {
            ["Bianca/Gialla", "Arancio/Verde", "Blu/Marrone/Nera"].forEach(c => beltSel.innerHTML += `<option value="${c}">${c}</option>`);
        }
    }
    
    handleSpecialtyChange();
}

function handleSpecialtyChange() {
    if (!currentSportConfig) return;
    const spec = document.getElementById('specialty').value;
    const isTeam = document.querySelector('input[name="regType"]:checked').value === 'team';
    const gender = document.getElementById(isTeam ? 'team_gender' : 'gender').value;
    const classe = document.getElementById('classe').value;
    
    const wInput = document.getElementById('weight_category');
    if (!wInput) return;
    wInput.innerHTML = '';
    
    if (spec === "Kumite") {
        wInput.disabled = false;
        const pList = currentSportConfig.pesi?.[classe]?.[gender] || currentSportConfig.pesi?.Default || ["Open"];
        pList.forEach(w => wInput.innerHTML += `<option value="${w}">${w} kg</option>`);
    } else if (spec === "ParaKarate") {
        wInput.disabled = false;
        currentSportConfig.parakarate_categorie?.forEach(p => wInput.innerHTML += `<option value="${p}">${p}</option>`);
    } else {
        wInput.disabled = true;
        wInput.innerHTML = '<option value="-">-</option>';
    }
}

// TABELLE E CONTEGGI ATLETI IN TEMPO REALE
async function fetchAthletes() {
    const ev = sessionStorage.getItem('selectedEventId');
    const { data } = await sb.from('atleti').select('*').eq('society_id', window.currentSocietyId).eq('event_id', ev);
    
    const tbody = document.getElementById('athleteList');
    if (!tbody) return;
    tbody.innerHTML = "";
    let counts = { kumite:0, kata:0, para:0, kids:0 };

    data?.sort((a,b) => a.last_name.localeCompare(b.last_name)).forEach(a => {
        if(a.specialty==="Kumite") counts.kumite++; else if(a.specialty==="Kata") counts.kata++; else if(a.specialty==="ParaKarate") counts.para++; else counts.kids++;
        tbody.innerHTML += `<tr>
            <td><strong>${a.last_name} ${a.first_name}</strong></td>
            <td>${a.classe}</td>
            <td>${a.gender}</td>
            <td>${a.specialty}</td>
            <td>${a.belt}</td>
            <td>${a.weight_category}</td>
            <td class="text-end">
                <button type="button" class="btn btn-sm btn-outline-warning border-0 me-1" onclick="editAthlete('${a.id}')"><i class="fas fa-edit"></i></button>
                <button type="button" class="btn btn-sm btn-outline-danger border-0" onclick="delA('${a.id}')"><i class="fas fa-trash"></i></button>
            </td>
        </tr>`;
    });
    
    if(document.getElementById('kumiteAthleteCountDisplay')) document.getElementById('kumiteAthleteCountDisplay').innerText = counts.kumite;
    if(document.getElementById('kataAthleteCountDisplay')) document.getElementById('kataAthleteCountDisplay').innerText = counts.kata;
    if(document.getElementById('ParaKarateAthleteCountDisplay')) document.getElementById('ParaKarateAthleteCountDisplay').innerText = counts.para;
    if(document.getElementById('KIDSAthleteCountDisplay')) document.getElementById('KIDSAthleteCountDisplay').innerText = counts.kids;
}

async function fetchTeams() {
    const { data } = await sb.from('teams').select('*').eq('society_id', window.currentSocietyId).eq('event_id', sessionStorage.getItem('selectedEventId'));
    const tbody = document.getElementById('teamList');
    if (!tbody) return;
    tbody.innerHTML = "";
    data?.forEach(t => {
        tbody.innerHTML += `<tr>
            <td><strong>${t.team_name}</strong><br><small class="text-muted">${t.members.join(", ")}</small></td>
            <td>${t.classe}</td>
            <td>${t.gender}</td>
            <td>${t.specialty}</td>
            <td>${t.belt}</td>
            <td>${t.weight_category||'-'}</td>
            <td class="text-end">
                <button type="button" class="btn btn-sm btn-outline-warning border-0 me-1" onclick="editTeam('${t.id}')"><i class="fas fa-edit"></i></button>
                <button type="button" class="btn btn-sm btn-outline-danger border-0" onclick="delT('${t.id}')"><i class="fas fa-trash"></i></button>
            </td>
        </tr>`;
    });
}

// COMPILAZIONE DEL FORM IN MODALITÀ MODIFICA
window.editAthlete = async function(id) {
    editingTeamId = null;
    const { data: a } = await sb.from('atleti').select('*').eq('id', id).single();
    if (!a) return;

    document.querySelector('input[name="regType"][value="individual"]').checked = true;
    toggleRegMode();

    document.getElementById('first_name').value = a.first_name;
    document.getElementById('last_name').value = a.last_name;
    document.getElementById('birthdate').value = a.birthdate;
    document.getElementById('gender').value = a.gender;

    updateSpecs(estraiAnnoDaData(a.birthdate));
    document.getElementById('specialty').value = a.specialty;
    handleSpecialtyChange();

    const beltSel = document.getElementById('belt');
    if (beltSel) {
        beltSel.value = a.belt;
        if (!beltSel.value && a.belt) {
            const opzioneValida = Array.from(beltSel.options).find(opt => 
                opt.value.toLowerCase().includes(a.belt.toLowerCase())
            );
            if (opzioneValida) beltSel.value = opzioneValida.value;
        }
    }
    
    document.getElementById('weight_category').value = a.weight_category;

    editingAthleteId = id;
    
    // --- CAMBIO COLORE IN GIALLO (btn-warning) ---
    const btn = document.querySelector('#athleteForm button[type="submit"]');
    if(btn) {
        btn.innerHTML = '<i class="fas fa-save me-2"></i>SALVA MODIFICHE ATLETA';
        btn.className = "btn btn-warning w-100 fw-bold py-3 shadow-sm rounded-3"; 
    }
};

window.editTeam = async function(id) {
    editingAthleteId = null;
    const { data: t } = await sb.from('teams').select('*').eq('id', id).single();
    if (!t) return;

    document.querySelector('input[name="regType"][value="team"]').checked = true;
    toggleRegMode();

    document.getElementById('team_name').value = t.team_name;
    document.getElementById('team_year').value = t.team_year;
    document.getElementById('team_gender').value = t.gender;

    updateSpecs(t.team_year);
    document.getElementById('specialty').value = t.specialty;
    handleSpecialtyChange();

    const beltSel = document.getElementById('belt');
    if (beltSel) {
        beltSel.value = t.belt;
        if (!beltSel.value && t.belt) {
            const opzioneValida = Array.from(beltSel.options).find(opt => 
                opt.value.toLowerCase().includes(t.belt.toLowerCase())
            );
            if (opzioneValida) beltSel.value = opzioneValida.value;
        }
    }
    
    document.getElementById('weight_category').value = t.weight_category;

    const cont = document.getElementById('membersContainer');
    cont.innerHTML = "";
    t.members.forEach(m => window.addMemberField(m));

    editingTeamId = id;
    
    // --- CAMBIO COLORE IN GIALLO (btn-warning) ---
    const btn = document.querySelector('#athleteForm button[type="submit"]');
    if(btn) {
        btn.innerHTML = '<i class="fas fa-save me-2"></i>SALVA MODIFICHE SQUADRA';
        btn.className = "btn btn-warning w-100 fw-bold py-3 shadow-sm rounded-3";
    }
};

window.delA = async (id) => { if(confirm("Eliminare l'atleta selezionato?")) { await sb.from('atleti').delete().eq('id',id); fetchAthletes(); }};
window.delT = async (id) => { if(confirm("Eliminare la squadra selezionata?")) { await sb.from('teams').delete().eq('id',id); fetchTeams(); }};

// GESTIONE SCRITTURA (INSERIMENTO O AGGIORNAMENTO)
async function addEntity(e) {
    e.preventDefault();
    const ev = sessionStorage.getItem('selectedEventId');
    const isTeam = document.querySelector('input[name="regType"]:checked').value === 'team';

    const common = {
        event_id: ev, society_id: window.currentSocietyId,
        classe: document.getElementById('classe').value,
        specialty: document.getElementById('specialty').value,
        belt: document.getElementById('belt').value,
        weight_category: document.getElementById('weight_category').value || '-'
    };

    if (isTeam) {
        const payload = { ...common, team_name: document.getElementById('team_name').value, gender: document.getElementById('team_gender').value, team_year: parseInt(document.getElementById('team_year').value), members: Array.from(document.querySelectorAll('.member-input')).map(i=>i.value.trim()) };
        
        if (editingTeamId) {
            await sb.from('teams').update([payload]).eq('id', editingTeamId);
            alert("Squadra aggiornata!");
        } else {
            await sb.from('teams').insert([payload]);
            alert("Squadra inserita!");
        }
    } else {
        const payload = { ...common, first_name: document.getElementById('first_name').value, last_name: document.getElementById('last_name').value, gender: document.getElementById('gender').value, birthdate: document.getElementById('birthdate').value };
        
        if (editingAthleteId) {
            await sb.from('atleti').update([payload]).eq('id', editingAthleteId);
            alert("Atleta aggiornato!");
        } else {
            await sb.from('atleti').insert([payload]);
            alert("Atleta inserito!");
        }
    }
    
    // Ripristino stato iniziale del form e del colore del pulsante
    editingAthleteId = null;
    editingTeamId = null;
    const btn = document.querySelector('#athleteForm button[type="submit"]');
    if(btn) {
        btn.innerHTML = '<i class="fas fa-save me-2"></i>CONFERMA E REGISTRA';
        btn.className = "btn btn-primary w-100 fw-bold py-3 shadow-sm rounded-3"; 
    }

    document.getElementById('athleteForm').reset();
    document.getElementById('membersContainer').innerHTML = "";
    
    // Rigenera i 3 campi di default per la squadra se l'utente si trovava già sul tab squadra
    if (document.querySelector('input[name="regType"]:checked').value === 'team') {
        for (let i = 0; i < 3; i++) {
            window.addMemberField("");
        }
    }
    
    fetchAthletes(); fetchTeams();
}

window.exportToExcel = async function() {
    const ev = sessionStorage.getItem('selectedEventId');
    const { data: a } = await sb.from('atleti').select('*').eq('society_id', window.currentSocietyId).eq('event_id', ev);
    const { data: t } = await sb.from('teams').select('*').eq('society_id', window.currentSocietyId).eq('event_id', ev);
    
    let csv = ["TIPO;NOME;MEMBRI;CLASSE;SPECIALITA;CINTURA;SESSO;PESO"];
    a?.forEach(x => csv.push(`"Indiv.";"${x.last_name} ${x.first_name}";"-";"${x.classe}";"${x.specialty}";"${x.belt}";"${x.gender}";"${x.weight_category}"`));
    t?.forEach(x => csv.push(`"Team";"${x.team_name}";"${x.members.join(', ')}";"${x.classe}";"${x.specialty}";"${x.belt}";"${x.gender}";"${x.weight_category}"`));
    
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob(["\uFEFF" + csv.join("\n")], { type: 'text/csv;charset=utf-8;' }));
    link.download = `Iscritti.csv`;
    link.click();
};

document.addEventListener('DOMContentLoaded', initKarateDashboard);
