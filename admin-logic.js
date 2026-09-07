// =========================================================================
// INIZIALIZZAZIONE SICURA: Utilizzo diretto dell'istanza globale supabaseClient
// =========================================================================

let allAthletes = [], allTeams = [];
let isCreatingNewSport = false;
let istanzaModale = null; // Memorizza l'oggetto della modale a comparsa

// Funzione di utilità per sanificare gli input ed evitare vulnerabilità XSS
function escapeHTML(str) {
    if (typeof str !== 'string') return str || '';
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Funzione di utilità per recuperare in modo sicuro il client Supabase globale
function getSupabaseClient() {
    const client = window.supabaseClient || window.sb || window.supabase;
    if (!client) {
        throw new Error("Il client di Supabase non è ancora pronto o non è stato inizializzato in script.js");
    }
    return client;
}

async function checkAdminAccess() {
    try {
        const client = getSupabaseClient();
        const { data: { user }, error } = await client.auth.getUser();
        const authorizedAdmins = ["vinsjack46@gmail.com", "19vincenzo89@gmail.com"]; 

        if (error || !user || !authorizedAdmins.includes(user.email)) {
            alert("Accesso negato: Non sei autorizzato a vedere questa pagina.");
            window.location.href = "login.html";
            return false;
        }
        return true;
    } catch (err) {
        console.error("Errore di autenticazione critica:", err.message);
        window.location.href = "login.html";
        return false;
    }
}

async function initAdmin() {
    console.log("Verifica autorizzazione in corso...");
    
    if (!window.supabaseClient && !window.sb && !window.supabase) {
        console.warn("Supabase non pronto. Attesa modulo di inizializzazione...");
        setTimeout(initAdmin, 200);
        return;
    }

    const isAuthorized = await checkAdminAccess();
    if (!isAuthorized) return;
    
    if (document.getElementById('modalEditor')) {
        istanzaModale = new bootstrap.Modal(document.getElementById('modalEditor'));
    }
    
    await refreshSportDropdowns();
    await loadFilterEvents();
    await fetchGlobalData();
    
    if (document.getElementById('eventForm')) document.getElementById('eventForm').addEventListener('submit', createEvent);
    if (document.getElementById('sportConfigForm')) document.getElementById('sportConfigForm').addEventListener('submit', saveSportConfigToDB);
    if (document.getElementById('filterEvent')) document.getElementById('filterEvent').addEventListener('change', filterAll);
    if (document.getElementById('globalSearch')) document.getElementById('globalSearch').addEventListener('input', filterAll);
}

async function refreshSportDropdowns() {
    try {
        const client = getSupabaseClient();
        const { data: sports, error } = await client.from('configurazioni_sport').select('sport_id');
        if (error) throw error;

        const configSelect = document.getElementById('configSportId');
        const eventSelect = document.getElementById('eventSportId');
        const selettoreJson = document.getElementById('selettoreSportJson');
        
        if (configSelect) configSelect.innerHTML = "";
        if (eventSelect) eventSelect.innerHTML = '<option value="">-- Seleziona Sport --</option>';
        if (selettoreJson) selettoreJson.innerHTML = "";

        sports?.forEach(s => {
            const safeSportId = escapeHTML(s.sport_id);
            const opt = `<option value="${safeSportId}">${safeSportId.toUpperCase()}</option>`;
            if (configSelect) configSelect.innerHTML += opt;
            if (eventSelect) eventSelect.innerHTML += opt;
            if (selettoreJson) selettoreJson.innerHTML += opt;
        });

        if (!isCreatingNewSport) {
            await loadSportConfigFromDB();
        }
    } catch (err) {
        console.error("Errore nel caricamento degli elenchi sport:", err);
    }
}

function toggleNewSportInput() {
    const select = document.getElementById('configSportId');
    const input = document.getElementById('newSportId');
    const metaFields = document.getElementById('sportMetaFields');
    const btn = document.getElementById('toggleNewSportBtn');

    if (!isCreatingNewSport) {
        if (select) select.style.display = "none";
        if (input) { input.style.display = "block"; input.value = ""; }
        if (metaFields) metaFields.style.display = "block";
        if (btn) btn.innerText = "×";
        isCreatingNewSport = true;
    } else {
        if (select) select.style.display = "block";
        if (input) input.style.display = "none";
        if (metaFields) metaFields.style.display = "none";
        if (btn) btn.innerText = "+";
        isCreatingNewSport = false;
        loadSportConfigFromDB();
    }
}

async function loadSportConfigFromDB() {
    if (isCreatingNewSport) return;
    const selectEl = document.getElementById('configSportId');
    if (!selectEl) return;
    const sportId = selectEl.value;
    if (!sportId) return;

    try {
        const client = getSupabaseClient();
        const { data: config, error } = await client
            .from('configurazioni_sport')
            .select('*')
            .eq('sport_id', sportId)
            .single();
        if (error || !config) return;

        const regole = config.regole || {};
        const limiti = regole.limiti || {};
        
        if (document.getElementById('limitKataKumite')) document.getElementById('limitKataKumite').value = limiti.KataKumiteSum || 300;
        if (document.getElementById('limitKids')) document.getElementById('limitKids').value = limiti.KIDS || 250;
        if (document.getElementById('limitPara')) document.getElementById('limitPara').value = limiti.ParaKarate || 50;
        if (document.getElementById('configRichiedePeso')) document.getElementById('configRichiedePeso').value = config.richiede_peso === false ? "false" : "true";

    } catch (err) {
        console.error(err);
    }
}

async function saveSportConfigToDB(e) {
    e.preventDefault();
    
    let sportId = "";
    const requiresWeight = document.getElementById('configRichiedePeso')?.value === "true";
    const labelLivello = document.getElementById('configEtichetta')?.value || "Cintura";
    
    const limitKataKumite = parseInt(document.getElementById('limitKataKumite')?.value || 300);
    const limitKids = parseInt(document.getElementById('limitKids')?.value || 250);
    const limitPara = parseInt(document.getElementById('limitPara')?.value || 50);

    if (isCreatingNewSport) {
        sportId = document.getElementById('newSportId')?.value.trim().toLowerCase() || "";
        if (!sportId) return alert("Inserisci un ID valido per il nuovo sport!");
    } else {
        sportId = document.getElementById('configSportId')?.value || "";
    }

    try {
        const client = getSupabaseClient();
        let baseRegole = { classi_eta: [], pesi: { Default: ["Open"] } };
        if (!isCreatingNewSport) {
            const { data: currentConfig } = await client.from('configurazioni_sport').select('*').eq('sport_id', sportId).single();
            if (currentConfig && currentConfig.regole) baseRegole = currentConfig.regole;
        }

        baseRegole.limiti = {
            KataKumiteSum: limitKataKumite,
            KIDS: limitKids,
            ParaKarate: limitPara
        };

        const sportValueFormatted = sportId.toUpperCase();
        const payload = {
            richiede_peso: requiresWeight,
            regole: baseRegole,
            etichetta_livello: labelLivello,
            sport_id: sportId,
            nome_sport: sportValueFormatted
        };

        let resultError = null;

        if (isCreatingNewSport) {
            const { error } = await client.from('configurazioni_sport').insert([payload]);
            resultError = error;
        } else {
            const { error } = await client.from('configurazioni_sport').update(payload).eq('sport_id', sportId);
            resultError = error;
        }

        if (resultError) throw resultError;
        alert(isCreatingNewSport ? "Nuovo sport creato con successo!" : "Limiti sport aggiornati!");
        if (isCreatingNewSport) {
            toggleNewSportInput();
        }
        await refreshSportDropdowns();
    } catch (err) {
        alert("Errore durante il salvataggio dello sport: " + err.message);
    }
}

async function createEvent(e) {
    e.preventDefault();
    const sId = document.getElementById('eventSportId').value;
    if (!sId) return alert("Seleziona uno sport da associare a questo evento!");
    
    try {
        const client = getSupabaseClient();
        const { error } = await client.from('eventi').insert([{ 
            nome: document.getElementById('eventName').value, 
            data_evento: document.getElementById('eventDate').value, 
            luogo: document.getElementById('eventLocation').value,
            sport_id: sId 
        }]);
        if (!error) { 
            document.getElementById('eventForm').reset(); 
            loadFilterEvents();
            alert("Evento associato allo sport '" + sId.toUpperCase() + "' creato con successo!");
        } else {
            alert("Errore creazione evento: " + error.message);
        }
    } catch (err) {
        alert("Errore di sistema: " + err.message);
    }
}

async function fetchGlobalData() {
    try {
        const client = getSupabaseClient();
        const { data: atleti } = await client.from('atleti').select('*, societa(nome), eventi(nome)');
        const { data: teams } = await client.from('teams').select('*, societa(nome), eventi(nome)');
        allAthletes = atleti || [];
        allTeams = teams || [];
        renderTables(allAthletes, allTeams);
    } catch (err) {
        console.error("Errore nel recupero dati globali:", err);
    }
}

// RENDER TABELLE SANIFICATO (Protezione XSS)
function renderTables(atleti, teams) {
    const listInd = document.getElementById('adminAthleteList');
    const listTeam = document.getElementById('adminTeamList');
    if(!listInd || !listTeam) return;

    listInd.innerHTML = ""; listTeam.innerHTML = "";
    
    atleti.forEach(a => {
        const lastName = escapeHTML(a.last_name);
        const firstName = escapeHTML(a.first_name);
        const eventName = escapeHTML(a.eventi?.nome || '-');
        const societaNome = escapeHTML(a.societa?.nome || '-');
        const classe = escapeHTML(a.classe);
        const specialty = escapeHTML(a.specialty);
        const belt = escapeHTML(a.belt);
        const gender = escapeHTML(a.gender);
        const weightCategory = escapeHTML(a.weight_category);

        listInd.innerHTML += `<tr>
            <td><strong>${lastName} ${firstName}</strong><br><small class="text-muted">${eventName}</small></td>
            <td>${societaNome}</td>
            <td>${classe}<br><small class="text-primary">${specialty}</small></td>
            <td><span class="badge bg-light text-dark border">${belt}</span></td>
            <td>${gender} / ${weightCategory}</td>
            <td class="text-end"><button onclick="deleteRecord('atleti','${escapeHTML(a.id)}')" class="btn btn-sm text-danger"><i class="fas fa-trash"></i></button></td>
        </tr>`;
    });

    teams.forEach(t => {
        const teamName = escapeHTML(t.team_name);
        const membersFormatted = (t.members || []).map(m => escapeHTML(m)).join(" • ");
        const eventName = escapeHTML(t.eventi?.nome || '-');
        const societaNome = escapeHTML(t.societa?.nome || '-');
        const classe = escapeHTML(t.classe);
        const specialty = escapeHTML(t.specialty);
        const gender = escapeHTML(t.gender);
        const belt = escapeHTML(t.belt || '-');
        const weightCategory = escapeHTML(t.weight_category || '-');

        listTeam.innerHTML += `<tr class="table-success-light">
            <td><div class="fw-bold text-success">${teamName}</div><small class="text-muted">${membersFormatted}</small><br><small class="text-muted">${eventName}</small></td>
            <td>${societaNome}</td>
            <td>${classe}<br><small class="text-primary">${specialty}</small></td>
            <td>${gender}</td>
            <td><small>${belt} / ${weightCategory}</small></td>
            <td class="text-end"><button onclick="deleteRecord('teams','${escapeHTML(t.id)}')" class="btn btn-sm text-danger"><i class="fas fa-trash"></i></button></td>
        </tr>`;
    });

    if (document.getElementById('countInd')) document.getElementById('countInd').innerText = atleti.length;
    if (document.getElementById('countTeam')) document.getElementById('countTeam').innerText = teams.length;
    if (document.getElementById('totalCounter')) document.getElementById('totalCounter').innerText = `${atleti.length + teams.length} Totali`;
}

function filterAll() {
    const term = document.getElementById('globalSearch')?.value.toLowerCase() || "";
    const evId = document.getElementById('filterEvent')?.value || "";
    const fA = allAthletes.filter(a => (a.first_name+a.last_name+(a.societa?.nome||"")).toLowerCase().includes(term) && (!evId || a.event_id == evId));
    const fT = allTeams.filter(t => (t.team_name+(t.societa?.nome||"")).toLowerCase().includes(term) && (!evId || t.event_id == evId));
    renderTables(fA, fT);
}

async function deleteRecord(table, id) {
    if(confirm("Sei sicuro di voler eliminare questo record?")) { 
        try {
            const client = getSupabaseClient();
            await client.from(table).delete().eq('id', id);
            fetchGlobalData(); 
        } catch (err) {
            alert(err.message);
        }
    }
}

async function loadFilterEvents() {
    try {
        const client = getSupabaseClient();
        const { data: eventi } = await client.from('eventi').select('*').order('data_evento', { ascending: false });
        const select = document.getElementById('filterEvent');
        const scroll = document.getElementById('eventList');
        
        if(select) select.innerHTML = '<option value="">Tutti gli Eventi</option>';
        if(scroll) scroll.innerHTML = "";

        eventi?.forEach(e => {
            const safeName = escapeHTML(e.nome);
            const safeSportId = escapeHTML(e.sport_id ? e.sport_id.toUpperCase() : 'KARATE');
            const safeDate = escapeHTML(e.data_evento);
            const safeId = escapeHTML(e.id);

            if(select) select.innerHTML += `<option value="${safeId}">${safeName}</option>`;
            if(scroll) scroll.innerHTML += `<div class="p-2 border-bottom d-flex justify-content-between align-items-center bg-white">
                <small><strong>${safeName}</strong> (${safeSportId})<br>${safeDate}</small>
                <button onclick="deleteEvent('${safeId}')" class="btn btn-sm text-danger p-0"><i class="fas fa-times"></i></button>
            </div>`;
        });
    } catch (err) {
        console.error(err);
    }
}

async function deleteEvent(id) {
    if(confirm("Eliminando l'evento cancellerai anche tutti gli iscritti associati. Procedere?")) { 
        try {
            const client = getSupabaseClient();
            await client.from('eventi').delete().eq('id', id);
            loadFilterEvents(); 
            fetchGlobalData(); 
        } catch (err) {
            alert(err.message);
        }
    }
}

async function handleLogout() {
    try {
        const client = getSupabaseClient();
        await client.auth.signOut();
        window.location.href = 'login.html';
    } catch (err) {
        window.location.href = 'login.html';
    }
}

function exportAllToCSV() {
    let csv = ["TIPO;NOME/TEAM;MEMBRI;EVENTO;SOCIETA;CLASSE;SPECIALITA;CINTURA;SESSO;PESO"];
    allAthletes.forEach(a => csv.push(`"Individuale";"${a.first_name} ${a.last_name}";"-";"${a.eventi?.nome || ''}";"${a.societa?.nome || ''}";"${a.classe}";"${a.specialty}";"${a.belt}";"${a.gender}";"${a.weight_category}"`));
    allTeams.forEach(t => csv.push(`"Team";"${t.team_name}";"${t.members?.join(' - ') || ''}";"${t.eventi?.nome || ''}";"${t.societa?.nome || ''}";"${t.classe}";"${t.specialty}";"${t.belt || '-'}";"${t.gender}";"${t.weight_category || '-'}"`));
    
    const blob = new Blob(["\uFEFF" + csv.join("\n")], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Export_Gare_v6.csv`;
    link.click();
}

function apriEditorModale() {
    if (!istanzaModale) return;
    istanzaModale.show();
    leggiJsonDaDb();
}

async function leggiJsonDaDb() {
    const selectEl = document.getElementById('selettoreSportJson');
    if (!selectEl) return;
    const spId = selectEl.value;
    if (!spId) return;
    try {
        const client = getSupabaseClient();
        const { data, error } = await client.from('configurazioni_sport').select('regole').eq('sport_id', spId).single();
        if (error) throw error;
        
        if (data && data.regole) {
            document.getElementById('testoJson').value = JSON.stringify(data.regole, null, 4);
        } else {
            document.getElementById('testoJson').value = "{\n  \"classi\": [],\n  \"pesi\": {}\n}";
        }
    } catch (err) {
        console.error("Errore lettura JSON regolamento:", err);
    }
}

function formattaTestoJson() {
    try {
        const parsed = JSON.parse(document.getElementById('testoJson').value);
        document.getElementById('testoJson').value = JSON.stringify(parsed, null, 4);
        alert("Sintassi JSON corretta e formattata con successo!");
    } catch (err) {
        alert("Errore di Sintassi JSON: Verifica virgole, virgolette e parentesi quadre/graffe.");
    }
}

async function inviaJsonAggiustato() {
    const selectEl = document.getElementById('selettoreSportJson');
    if (!selectEl) return;
    const spId = selectEl.value;
    if (!spId) return;
    try {
        const jsonDefinitivo = JSON.parse(document.getElementById('testoJson').value);
        const client = getSupabaseClient();
        const { error } = await client.from('configurazioni_sport').update({ regole: jsonDefinitivo }).eq('sport_id', spId);
        if (error) throw error;
        
        alert("Regole a cascata aggiornate con successo nel database per: " + spId.toUpperCase());
        if (istanzaModale) istanzaModale.hide();
        await loadSportConfigFromDB();
    } catch (err) {
        alert("Impossibile salvare il JSON: " + err.message);
    }
}

document.addEventListener('DOMContentLoaded', initAdmin);
