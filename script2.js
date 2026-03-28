const sb = window.supabaseClient;
let currentSocietyId = null;

// --- 1. LIMITI ---
const LIMITI = {
    "Kumite": 400,
    "Kata": 300,
    "ParaKarate": 50,
    "KIDS": 250
};

// --- 2. CARICAMENTO DATI E ATLETI ---
async function fetchAthletes() {
    const eventId = sessionStorage.getItem('selectedEventId');
    if (!eventId) return;

    const { data: { user } } = await sb.auth.getUser();
    if (!user) return;

    // Recupera info società
    const { data: society } = await sb.from('societa').select('*').eq('user_id', user.id).single();

    if (society) {
        currentSocietyId = society.id;
        document.getElementById('societyNameDisplay').innerText = society.nome;

        // Recupera atleti filtrati per SOCIETÀ ed EVENTO
        const { data: athletes, error } = await sb.from('atleti')
            .select('*')
            .eq('society_id', society.id)
            .eq('event_id', eventId);

        if (error) {
            console.error("Errore recupero atleti:", error);
            return;
        }

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
                    <td class="text-end">
                        <button class="btn btn-danger btn-sm" onclick="removeAthlete('${a.id}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                `;
            });
        }
    }
    await updateAllCounters();
}

// --- 3. AGGIUNTA ATLETA ---
async function addAthlete(e) {
    e.preventDefault();
    
    const eventId = document.getElementById('selectedEventId').value;
    if (!eventId) {
        alert("Errore: ID Evento mancante. Ritorna alla selezione eventi.");
        return;
    }

    const athleteData = {
        society_id: currentSocietyId,
        event_id: eventId,
        first_name: document.getElementById('first_name').value,
        last_name: document.getElementById('last_name').value,
        birthdate: document.getElementById('birthdate').value,
        gender: document.getElementById('gender').value,
        classe: document.getElementById('classe').value,
        specialty: document.getElementById('specialty').value,
        belt: document.getElementById('belt').value,
        weight_category: document.getElementById('weight_category')?.value || '-'
    };

    const { error } = await sb.from('atleti').insert([athleteData]);

    if (error) {
        alert("Errore durante l'iscrizione: " + error.message);
    } else {
        alert("Atleta registrato con successo!");
        document.getElementById('athleteForm').reset();
        // Reset manuale dei campi disabilitati o calcolati
        document.getElementById('classe').innerHTML = "";
        document.getElementById('weight_category').disabled = true;
        await fetchAthletes();
    }
}

// --- 4. CONTEGGI GLOBALI (PER EVENTO) ---
async function updateAllCounters() {
    const eventId = sessionStorage.getItem('selectedEventId');
    const { data: allEventAthletes } = await sb.from('atleti')
        .select('specialty')
        .eq('event_id', eventId);

    const counts = { Kumite: 0, Kata: 0, ParaKarate: 0, KIDS: 0 };

    allEventAthletes?.forEach(a => {
        if (counts.hasOwnProperty(a.specialty)) {
            counts[a.specialty]++;
        } else {
            counts.KIDS++; // Specialità dei bambini (Percorso, Palloncino, ecc.)
        }
    });

    document.getElementById('kumiteAthleteCountDisplay').innerText = counts.Kumite;
    document.getElementById('kataAthleteCountDisplay').innerText = counts.Kata;
    document.getElementById('ParaKarateAthleteCountDisplay').innerText = counts.ParaKarate;
    document.getElementById('KIDSAthleteCountDisplay').innerText = counts.KIDS;
}

// --- 5. LOGICA DINAMICA (CLASSI E PESI) ---
// Qui riutilizziamo le tue funzioni originali ma con gli ID corretti
function updateSpecialtyOptionsBasedOnBirthdate() {
    const birthInput = document.getElementById("birthdate");
    if (!birthInput.value) return;

    const year = new Date(birthInput.value).getFullYear();
    const clSel = document.getElementById("classe");
    const spSel = document.getElementById("specialty");
    const beltSel = document.getElementById("belt");
    
    // Svuota e ricalcola (Inserisci qui la tua logica dei cicli if/else per le classi)
    // Esempio rapido:
    let classe = "";
    if (year >= 2013 && year <= 2014) classe = "Esordienti";
    // ... (continua con la tua logica esistente)
    
    clSel.innerHTML = `<option value="${classe}">${classe}</option>`;
    
    // IMPORTANTE: Chiama la funzione per aggiornare le cinture/specialità se l'avevi
}

function toggleWeightCategory() {
    const specialty = document.getElementById("specialty").value;
    const weightSel = document.getElementById("weight_category");
    if (specialty === "Kumite") {
        weightSel.disabled = false;
        // Carica opzioni pesi...
    } else {
        weightSel.disabled = true;
        weightSel.value = "-";
    }
}

async function removeAthlete(id) {
    if (confirm("Vuoi davvero eliminare questo iscritto?")) {
        await sb.from('atleti').delete().eq('id', id);
        fetchAthletes();
    }
}

// --- 6. INIZIALIZZAZIONE ---
document.addEventListener('DOMContentLoaded', () => {
    fetchAthletes();
    const form = document.getElementById('athleteForm');
    if (form) form.addEventListener('submit', addAthlete);
});
