const sb = window.supabaseClient;
let currentSocietyId = null;

// --- 1. LIMITI RIGIDI ---
const LIMITI = {
    "Kumite": 400,
    "Kata": 300,
    "ParaKarate": 50,
    "KIDS": 250 // Somma di tutte le specialità KIDS
};
function updateSpecialtyOptionsBasedOnBirthdate() {
    const birthInput = document.getElementById("birthdate");
    const errorDisplay = document.getElementById("dateError");
    const submitBtn = document.querySelector('button[type="submit"]');
    
    if (!birthInput || !birthInput.value) return;

    const year = new Date(birthInput.value).getFullYear();
    
    // Controlliamo se l'anno è completo (4 cifre) e fuori range
    if (year > 999) { // Evita il check finché l'utente sta scrivendo le prime cifre
        if (year < 2013 || year > 2022) {
            errorDisplay.style.display = "block"; // Mostra errore
            submitBtn.disabled = true;           // Blocca il tasto invio
            return; 
        } else {
            errorDisplay.style.display = "none";  // Nasconde errore
            submitBtn.disabled = false;          // Riabilita tasto invio
        }
    }

    const clSel = document.getElementById("classe");
    const spSel = document.getElementById("specialty");
    const beltSel = document.getElementById("belt");
    let classe = "";

    // Logica Classi Completa
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
    
    // Gestione Cinture con Accorpamenti (Nessuna opzione vuota)
    let belts = [];
    if (classe.includes("KIDS")) {
        belts = ["Bianca/Gialla", "Arancio/Verde"];
    } else {
        belts = ["Bianca/Gialla", "Arancio/Verde", "Blu/Marrone"];
    }
    beltSel.innerHTML = belts.map(b => `<option value="${b}">${b}</option>`).join('');

    // Logica Specialità per Classe
    if (classe.includes("KIDS")) {
        spSel.innerHTML = `
            <option value="Percorso-Kata">Percorso-Kata</option>
            <option value="Percorso-Palloncino">Percorso-Palloncino</option>
            <option value="ParaKarate">ParaKarate</option>`;
    } else if (classe === "U6") {
        spSel.innerHTML = `
            <option value="Combinata">Combinata</option>
            <option value="Kata">Kata</option>
            <option value="Kumite">Kumite</option>
            <option value="ParaKarate">ParaKarate</option>`;
         } else if (classe === "U8") {
        spSel.innerHTML = `
            <option value="Combinata">Combinata</option>
            <option value="Kata">Kata</option>
            <option value="Kumite">Kumite</option>
            <option value="ParaKarate">ParaKarate</option>`
            ;
    } else {
        spSel.innerHTML = `
            <option value="Kata">Kata</option>
            <option value="Kumite">Kumite</option>
            <option value="ParaKarate">ParaKarate</option>`;
    }
    toggleWeightCategory();
}

// --- 3. GESTIONE PESI (Obbligatori per Kumite/Para) ---
function toggleWeightCategory() {
    const specialty = document.getElementById("specialty").value;
    const classe = document.getElementById("classe")?.value;
    const gender = document.querySelector('input[name="gender"]:checked')?.value;
    const weightField = document.getElementById("weightCategory");

    weightField.innerHTML = ''; 
    weightField.disabled = true;

    if (specialty === "Kumite") {
        weightField.disabled = false;
        let weights = [];
        if (classe === "U14") {
            weights = (gender === "Maschio") ? ["-40", "-45", "-50", "-55", "55+"] : ["-42", "-47", "-52", "52+"];
        } else if (classe === "U12") {
            weights = (gender === "Maschio") ? ["-30", "-35", "-40", "40+",] : ["-30", "-35", "35+"];
             } else if (classe === "U10") {
            weights = (gender === "Maschio") ? ["-30", "-35", "-40", "40+",] : ["-30", "-35", "35+"];
             } else if (classe === "U8") {
            weights = (gender === "Maschio") ? ["-30", "-35", "-40", "40+",] : ["-30", "-35", "35+"];
             } else if (classe === "U6") {
            weights = (gender === "Maschio") ? ["-30", "-35", "-40", "40+",] : ["-30", "-35", "35+"];
        } else {
            weights = ["Open"];
        }
        weights.forEach(w => weightField.innerHTML += `<option value="${w}">${w} kg</option>`);
    } else if (specialty === "ParaKarate") {
        weightField.disabled = false;
        ["K10","K20", "K21", "K22", "K30", "K31", "K32", "K33", "K34", "K35", "K36", "K40"].forEach(k => weightField.innerHTML += `<option value="${k}">${k}</option>`);
    } else {
        // Valore di default "N/A" per specialità senza peso
        weightField.innerHTML = `<option value="-">-</option>`;
    }
}

// --- 4. CONTEGGI E BLOCCO ISCRIZIONI ---
async function updateAllCounters() {
    const { data: atleti } = await sb.from('atleti').select('specialty');
    
    const counts = {
        kumite: atleti.filter(a => a.specialty === 'Kumite').length,
        kata: atleti.filter(a => a.specialty === 'Kata').length,
        para: atleti.filter(a => a.specialty === 'ParaKarate').length,
        kids: atleti.filter(a => ["Percorso-Palloncino", "Percorso-Kata", "Palloncino","Combinata"].includes(a.specialty)).length
    };

    document.getElementById('kumiteAthleteCountDisplay').textContent = `${LIMITI.Kumite - counts.kumite} / ${LIMITI.Kumite}`;
    document.getElementById('kataAthleteCountDisplay').textContent = `${LIMITI.Kata - counts.kata} / ${LIMITI.Kata}`;
    document.getElementById('ParaKarateAthleteCountDisplay').textContent = `${LIMITI.ParaKarate - counts.para} / ${LIMITI.ParaKarate}`;
    document.getElementById('KIDSAthleteCountDisplay').textContent = `${LIMITI.KIDS - counts.kids} / ${LIMITI.KIDS}`;
    
    return counts;
}
async function addAthlete(e) {
    e.preventDefault();
    
    // Recuperiamo l'ID dell'evento dal campo nascosto
    const eventId = document.getElementById('selectedEventId').value;
    if (!eventId) {
        alert("Errore: Nessun evento selezionato!");
        return;
    }

    const firstName = document.getElementById('firstName').value;
    const lastName = document.getElementById('lastName').value;
    const birthdate = document.getElementById('birthdate').value;
    const classe = document.getElementById('classe').value;
    const specialty = document.getElementById('specialty').value;
    const belt = document.getElementById('belt').value;
    const gender = document.querySelector('input[name="gender"]:checked')?.value;
    const weight = document.getElementById('weight_category')?.value || '-';

    // Inserimento nel database con event_id
    const { data, error } = await sb.from('atleti').insert([{
        society_id: currentSocietyId,
        event_id: eventId, // <-- Fondamentale
        first_name: firstName,
        last_name: lastName,
        gender: gender,
        birthdate: birthdate,
        classe: classe,
        specialty: specialty,
        belt: belt,
        weight_category: weight
    }]);

    if (error) {
        alert("Errore durante l'inserimento: " + error.message);
    } else {
        alert("Atleta iscritto con successo!");
        document.getElementById('athleteForm').reset();
        fetchAthletes(); // Ricarica la lista filtrata
    }
}
// --- 6. VISUALIZZAZIONE TABELLA COMPLETA ---
async function fetchAthletes() {
    const eventId = sessionStorage.getItem('selectedEventId');
    const eventName = sessionStorage.getItem('selectedEventName');
    
    if (!eventId) {
        window.location.href = "scelta-evento.html";
        return;
    }

    // Aggiorna l'interfaccia con i dati dell'evento
    document.getElementById('selectedEventId').value = eventId;
    document.getElementById('eventNameDisplay').innerText = eventName;

    const { data: { user } } = await sb.auth.getUser();
    const { data: society } = await sb.from('societa').select('*').eq('user_id', user.id).single();

    if (society) {
        currentSocietyId = society.id;
        document.getElementById('societyNameDisplay').innerText = society.nome;

        // FILTRO: prendi solo atleti della società PER questo evento
        const { data: athletes } = await sb.from('atleti')
            .select('*')
            .eq('society_id', society.id)
            .eq('event_id', eventId);

        const list = document.getElementById('athleteList');
        if (list) {
            list.innerHTML = '';
            athletes?.forEach(a => {
                const row = list.insertRow();
                row.innerHTML = `
                    <td><strong>${a.last_name} ${a.first_name}</strong></td>
                    <td>${a.classe}</td>
                    <td>${a.specialty}</td>
                    <td>${a.belt}</td>
                    <td>${a.gender}</td>
                    <td>${a.weight_category || '-'}</td>
                    <td class="text-end"><button class="btn btn-danger btn-sm" onclick="removeAthlete('${a.id}')"><i class="fas fa-trash"></i></button></td>
                `;
            });
        }
    }
    await updateAllCounters();
}

async function updateAllCounters() {
    const eventId = sessionStorage.getItem('selectedEventId');
    
    // Conteggia tutti gli atleti iscritti a QUESTO evento (di tutte le società)
    const { data: allEventAthletes } = await sb.from('atleti')
        .select('specialty')
        .eq('event_id', eventId);

    const counts = { Kumite: 0, Kata: 0, ParaKarate: 0, KIDS: 0 };

    allEventAthletes?.forEach(a => {
        if (a.specialty === 'Kumite') counts.Kumite++;
        else if (a.specialty === 'Kata') counts.Kata++;
        else if (a.specialty === 'ParaKarate') counts.ParaKarate++;
        else counts.KIDS++; // Altre specialità kids
    });

    // Aggiorna i display
    document.getElementById('kumiteAthleteCountDisplay').innerText = counts.Kumite;
    document.getElementById('kataAthleteCountDisplay').innerText = counts.Kata;
    document.getElementById('ParaKarateAthleteCountDisplay').innerText = counts.ParaKarate;
    document.getElementById('KIDSAthleteCountDisplay').innerText = counts.KIDS;

    // Logica di blocco se superano i LIMITI
    const spSel = document.getElementById("specialty");
    if (spSel) {
        if (counts.Kumite >= LIMITI.Kumite) /* disabilita opzione Kumite ... */
        if (counts.Kata >= LIMITI.Kata) /* disabilita opzione Kata ... */
    }

async function removeAthlete(id) {
    if (confirm("Eliminare definitivamente questo atleta?")) {
        await sb.from('atleti').delete().eq('id', id);
        fetchAthletes();
    }
}

// --- 7. EVENTI ---
document.addEventListener('DOMContentLoaded', () => {
    fetchAthletes();
    document.getElementById('athleteForm')?.addEventListener('submit', addAthlete);
    document.getElementById('birthdate')?.addEventListener('change', updateSpecialtyOptionsBasedOnBirthdate);
    document.getElementById('specialty')?.addEventListener('change', toggleWeightCategory);
    document.querySelectorAll('input[name="gender"]').forEach(r => r.addEventListener('change', toggleWeightCategory));
});
