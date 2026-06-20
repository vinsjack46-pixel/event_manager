// ==========================================
// SCRIPT2.JS - MOTORE AVANZATO (KARATE)
// ==========================================
const { createClient } = window.supabase;
const supabaseUrl = 'https://nhsvadkqagsqgirvoibg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5oc3ZhZGtxYWdzcWdpcnZvaWJnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5NzQ1MjQsImV4cCI6MjA4NzU1MDUyNH0.v0PPOfmX1p_sHkV2ZwzaH8gxr7VwN9MMRB1AclEOhvQ';

const sb = createClient(supabaseUrl, supabaseKey);

window.currentSocietyId = null;
let currentSportConfig = null;
let editingAthleteId = null; 
let editingTeamId = null;

// Helpers
function estraiAnnoDaData(dateVal) {
    if (!dateVal) return null;
    const year = new Date(dateVal).getFullYear();
    return isNaN(year) ? null : year;
}

window.logout = async function() {
    await sb.auth.signOut();
    window.location.href = "login.html";
};

// Init
async function initKarateDashboard() {
    const eventId = sessionStorage.getItem('selectedEventId');
    if (!eventId) return window.location.href = "scelta-evento.html";

    document.getElementById('eventNameDisplay').innerText = sessionStorage.getItem('selectedEventName') || "";

    try {
        const { data: config } = await sb.from('configurazioni_sport').select('*').eq('sport_id', 'karate').single();
        if (config) {
            currentSportConfig = config.regole;
            const beltSel = document.getElementById('belt');
            if (beltSel) {
                beltSel.innerHTML = '<option value="">-- Cintura --</option>';
                currentSportConfig.cinture?.forEach(c => beltSel.innerHTML += `<option value="${c}">${c}</option>`);
            }
        }
    } catch(e) {}

    // Auth & Society
    const { data: { user } } = await sb.auth.getUser();
    if (user) {
        const { data: soc } = await sb.from('societa').select('*').eq('user_id', user.id).single();
        if (soc) {
            window.currentSocietyId = soc.id;
            document.getElementById('societyNameDisplay').innerText = soc.nome;
            fetchAthletes();
            fetchTeams();
        }
    }

    // Listeners
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
}

window.addMemberField = function(val = "") {
    const cont = document.getElementById('membersContainer');
    const c = cont.children.length;
    if (c >= 6) return alert("Max 6");
    const d = document.createElement('div');
    d.className = "col-md-4 mb-2";
    d.innerHTML = `<div class="input-group input-group-sm"><span class="input-group-text">${c+1}</span><input type="text" class="form-control member-input" value="${val}" required><button type="button" class="btn btn-outline-danger" onclick="this.parentElement.parentElement.remove()">×</button></div>`;
    cont.appendChild(d);
};

function handleBirthdateChange() { updateSpecs(estraiAnnoDaData(document.getElementById('birthdate').value)); }
function handleTeamYearChange() { updateSpecs(parseInt(document.getElementById('team_year').value)); }

function updateSpecs(year) {
    if (!currentSportConfig) return;
    const classe = currentSportConfig.classi_eta?.find(c => year >= c.anno_min && year <= c.anno_max);
    
    const clSel = document.getElementById('classe');
    clSel.innerHTML = `<option value="${classe ? classe.nome : 'Fuori Quota'}">${classe ? classe.nome : 'Fuori Quota'}</option>`;

    const spSel = document.getElementById('specialty');
    spSel.innerHTML = '<option value="">-- Specialità --</option>';
    if (classe) classe.specialita.forEach(s => spSel.innerHTML += `<option value="${s}">${s}</option>`);
    
    handleSpecialtyChange();
}

function handleSpecialtyChange() {
    if (!currentSportConfig) return;
    const spec = document.getElementById('specialty').value;
    const isTeam = document.querySelector('input[name="regType"]:checked').value === 'team';
    const gender = document.getElementById(isTeam ? 'team_gender' : 'gender').value;
    const classe = document.getElementById('classe').value;
    
    const wInput = document.getElementById('weight_category');
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

async function fetchAthletes() {
    const ev = sessionStorage.getItem('selectedEventId');
    const { data } = await sb.from('atleti').select('*').eq('society_id', window.currentSocietyId).eq('event_id', ev);
    
    const tbody = document.getElementById('athleteList');
    tbody.innerHTML = "";
    let counts = { kumite:0, kata:0, para:0, kids:0 };

    data?.forEach(a => {
        if(a.specialty==="Kumite") counts.kumite++; else if(a.specialty==="Kata") counts.kata++; else if(a.specialty==="ParaKarate") counts.para++; else counts.kids++;
        tbody.innerHTML += `<tr><td><strong>${a.last_name} ${a.first_name}</strong></td><td>${a.classe}</td><td>${a.gender}</td><td>${a.specialty}</td><td>${a.belt}</td><td>${a.weight_category}</td><td class="text-end"><button class="btn btn-sm btn-outline-danger border-0" onclick="delA('${a.id}')"><i class="fas fa-trash"></i></button></td></tr>`;
    });
    
    document.getElementById('kumiteAthleteCountDisplay').innerText = counts.kumite;
    document.getElementById('kataAthleteCountDisplay').innerText = counts.kata;
    document.getElementById('ParaKarateAthleteCountDisplay').innerText = counts.para;
    document.getElementById('KIDSAthleteCountDisplay').innerText = counts.kids;
}

async function fetchTeams() {
    const { data } = await sb.from('teams').select('*').eq('society_id', window.currentSocietyId).eq('event_id', sessionStorage.getItem('selectedEventId'));
    const tbody = document.getElementById('teamList');
    tbody.innerHTML = "";
    data?.forEach(t => {
        tbody.innerHTML += `<tr><td><strong>${t.team_name}</strong><br><small>${t.members.join(", ")}</small></td><td>${t.classe}</td><td>${t.gender}</td><td>${t.specialty}</td><td>${t.belt}</td><td>${t.weight_category||'-'}</td><td class="text-end"><button class="btn btn-sm btn-outline-danger border-0" onclick="delT('${t.id}')"><i class="fas fa-trash"></i></button></td></tr>`;
    });
}

window.delA = async (id) => { if(confirm("Eliminare?")) { await sb.from('atleti').delete().eq('id',id); fetchAthletes(); }};
window.delT = async (id) => { if(confirm("Eliminare?")) { await sb.from('teams').delete().eq('id',id); fetchTeams(); }};

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
        const payload = { ...common, team_name: document.getElementById('team_name').value, gender: document.getElementById('team_gender').value, team_year: parseInt(document.getElementById('team_year').value), members: Array.from(document.querySelectorAll('.member-input')).map(i=>i.value) };
        await sb.from('teams').insert([payload]);
    } else {
        const payload = { ...common, first_name: document.getElementById('first_name').value, last_name: document.getElementById('last_name').value, gender: document.getElementById('gender').value, birthdate: document.getElementById('birthdate').value };
        await sb.from('atleti').insert([payload]);
    }
    
    document.getElementById('athleteForm').reset();
    document.getElementById('membersContainer').innerHTML = "";
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
