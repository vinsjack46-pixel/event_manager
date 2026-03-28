const sb = window.supabaseClient;

// Funzione principale di inizializzazione
async function initPage() {
    const eventId = sessionStorage.getItem('selectedEventId');
    const eventName = sessionStorage.getItem('selectedEventName');
    
    if (!eventId) {
        window.location.href = "scelta-evento.html";
        return;
    }

    document.getElementById('selectedEventId').value = eventId;
    document.getElementById('eventNameDisplay').innerText = eventName;

    // Recupera Società
    const { data: { user } } = await sb.auth.getUser();
    if (user) {
        const { data: soc } = await sb.from('societa').select('*').eq('user_id', user.id).single();
        if (soc) {
            window.currentSocietyId = soc.id;
            document.getElementById('societyNameDisplay').innerText = soc.nome;
            fetchAthletes();
        }
    }
}

// Calcolo automatico Classe e Specialità in base alla data
function handleBirthdateChange() {
    const dateVal = document.getElementById('birthdate').value;
    if (!dateVal) return;

    const year = new Date(dateVal).getFullYear();
    const clSel = document.getElementById('classe');
    const spSel = document.getElementById('specialty');
    const beltSel = document.getElementById('belt');

    // Svuota selezioni
    clSel.innerHTML = "";
    spSel.innerHTML = "";
    beltSel.innerHTML = "";

    let classe = "";
    let specs = [];
    let belts = ["Bianca", "Bianca/Gialla", "Gialla", "Arancione", "Verde", "Blu", "Marrone", "Nera"];

    if (year >= 2017 && year <= 2022) {
        classe = "Bambini / Fanciulli";
        specs = ["Percorso", "Palloncino", "Prova Tecnica", "Kata"];
    } else if (year >= 2013 && year <= 2014) {
        classe = "Esordienti";
        specs = ["Kata", "Kumite", "ParaKarate"];
    } else {
        classe = "Altra Categoria";
        specs = ["Kata", "Kumite"];
    }

    clSel.innerHTML = `<option value="${classe}">${classe}</option>`;
    specs.forEach(s => spSel.innerHTML += `<option value="${s}">${s}</option>`);
    belts.forEach(b => beltSel.innerHTML += `<option value="${b}">${b}</option>`);
}

// Gestione abilitazione peso
function handleSpecialtyChange() {
    const spec = document.getElementById('specialty').value;
    const wInput = document.getElementById('weight_category');
    if (spec === "Kumite") {
        wInput.disabled = false;
        wInput.innerHTML = '<option value="-40kg">-40kg</option><option value="-50kg">-50kg</option><option value="+50kg">+50kg</option>';
    } else {
        wInput.disabled = true;
        wInput.innerHTML = '<option value="-">-</option>';
    }
}

// Carica Lista Atleti
async function fetchAthletes() {
    const eventId = sessionStorage.getItem('selectedEventId');
    const { data: athletes } = await sb.from('atleti')
        .select('*')
        .eq('society_id', window.currentSocietyId)
        .eq('event_id', eventId);

    const list = document.getElementById('athleteList');
    list.innerHTML = "";
    athletes?.forEach(a => {
        list.innerHTML += `
            <tr>
                <td>${a.last_name} ${a.first_name}</td>
                <td>${a.classe}</td>
                <td>${a.specialty}</td>
                <td>${a.belt}</td>
                <td>${a.weight_category}</td>
                <td class="text-end"><button class="btn btn-sm btn-outline-danger" onclick="deleteAthlete('${a.id}')"><i class="fas fa-trash"></i></button></td>
            </tr>`;
    });
    updateCounters(athletes);
}

// Inserimento
async function addAthlete(e) {
    e.preventDefault();
    
    // Recupero ID evento
    const eventId = document.getElementById('selectedEventId').value;
    if (!eventId) {
        alert("Errore: ID Evento mancante.");
        return;
    }

    const athleteData = {
        first_name: document.getElementById('first_name').value,
        last_name: document.getElementById('last_name').value,
        birthdate: document.getElementById('birthdate').value,
        gender: document.getElementById('gender').value,
        classe: document.getElementById('classe').value,
        specialty: document.getElementById('specialty').value,
        belt: document.getElementById('belt').value,
        weight_category: document.getElementById('weight_category').value,
        society_id: window.currentSocietyId,
        event_id: eventId
    };

    const { error } = await sb.from('atleti').insert([athleteData]);

    if (error) {
        alert("Errore durante l'iscrizione: " + error.message);
    } else {
        alert("Atleta registrato con successo!");
        
        // --- LOGICA DI RESET COMPLETO ---
        const form = document.getElementById('athleteForm');
        form.reset(); // Resetta i campi standard (Nome, Cognome, Data)

        // Reset manuale dei campi dinamici/speciali
        document.getElementById('classe').innerHTML = ""; // Svuota la classe calcolata
        document.getElementById('specialty').innerHTML = ""; // Svuota le specialità
        document.getElementById('belt').innerHTML = ""; // Svuota le cinture
        
        const weightField = document.getElementById('weight_category');
        weightField.innerHTML = '<option value="-">-</option>';
        weightField.value = "-";
        weightField.disabled = true; // Torna disabilitato come all'inizio

        // Nasconde eventuali messaggi di errore della data
        const errorDisplay = document.getElementById("dateError");
        if(errorDisplay) errorDisplay.style.display = "none";

        // Ricarica la tabella e i contatori
        await fetchAthletes();
    }
}

async function deleteAthlete(id) {
    if (confirm("Eliminare l'atleta?")) {
        await sb.from('atleti').delete().eq('id', id);
        fetchAthletes();
    }
}

function updateCounters(athletes) {
    const c = { Kumite: 0, Kata: 0, Para: 0, Kids: 0 };
    athletes?.forEach(a => {
        if (a.specialty === "Kumite") c.Kumite++;
        else if (a.specialty === "Kata") c.Kata++;
        else if (a.specialty === "ParaKarate") c.Para++;
        else c.Kids++;
    });
    document.getElementById('kumiteAthleteCountDisplay').innerText = c.Kumite;
    document.getElementById('kataAthleteCountDisplay').innerText = c.Kata;
    document.getElementById('ParaKarateAthleteCountDisplay').innerText = c.Para;
    document.getElementById('KIDSAthleteCountDisplay').innerText = c.Kids;
}

async function logout() {
    await sb.auth.signOut();
    window.location.href = "login.html";
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    initPage();
    document.getElementById('athleteForm').addEventListener('submit', addAthlete);
    document.getElementById('birthdate').addEventListener('change', handleBirthdateChange);
    document.getElementById('specialty').addEventListener('change', handleSpecialtyChange);
});
function exportToExcel() {
    // 1. Seleziona la tabella
    const table = document.querySelector("table");
    let csv = [];
    
    // 2. Estrai le righe
    const rows = table.querySelectorAll("tr");
    
    for (let i = 0; i < rows.length; i++) {
        let row = [], cols = rows[i].querySelectorAll("td, th");
        
        for (let j = 0; j < cols.length; j++) {
            // Pulizia del testo: rimuove spazi extra e virgole che rompono il CSV
            let data = cols[j].innerText.replace(/(\r\n|\n|\r)/gm, "").replace(/,/g, ";");
            // Non esportare la colonna "Azione" (quella del tasto elimina)
            if (cols[j].innerText.toLowerCase().includes("azione") || cols[j].querySelector("button")) {
                continue;
            }
            row.push(data);
        }
        csv.push(row.join(","));
    }

    // 3. Crea il file e scaricalo
    const csvFile = new Blob([csv.join("\n")], { type: "text/csv" });
    const downloadLink = document.createElement("a");
    
    // Nome file personalizzato con data
    const fileName = `esportazione_atleti_${new Date().toLocaleDateString()}.csv`;
    
    downloadLink.download = fileName;
    downloadLink.href = window.URL.createObjectURL(csvFile);
    downloadLink.style.display = "none";
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
}
