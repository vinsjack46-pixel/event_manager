const sb = window.supabaseClient;
let currentSocietyId = null;

const LIMITI = {
    "Kumite": 400,
    "Kata": 300,
    "ParaKarate": 50,
    "KIDS": 250
};

// --- 1. Caricamento Atleti e Inizializzazione ---
async function fetchAthletes() {
    const eventId = sessionStorage.getItem('selectedEventId');
    const eventName = sessionStorage.getItem('selectedEventName');
    
    if (!eventId) {
        window.location.href = "scelta-evento.html";
        return;
    }

    // Aggiorna UI
    const evInput = document.getElementById('selectedEventId');
    const evDisplay = document.getElementById('eventNameDisplay');
    if (evInput) evInput.value = eventId;
    if (evDisplay) evDisplay.innerText = eventName;

    const { data: { user } } = await sb.auth.getUser();
    if (!user) return;

    const { data: society } = await sb.from('societa').select('*').eq('user_id', user.id).single();

    if (society) {
        currentSocietyId = society.id;
        const socDisplay = document.getElementById('societyNameDisplay');
        if (socDisplay) socDisplay.innerText = society.nome;

        // Recupera solo atleti di questa società per questo evento
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

// --- 2. Aggiunta Atleta ---
async function addAthlete(e) {
    e.preventDefault();
    
    const eventId = document.getElementById('selectedEventId').value;
    if (!eventId) {
        alert("Seleziona un evento prima di continuare.");
        return;
    }

    const athleteData = {
        society_id: currentSocietyId,
        event_id: eventId,
        first_name: document.getElementById('firstName').value,
        last_name: document.getElementById('lastName').value,
        birthdate: document.getElementById('birthdate').value,
        classe: document.getElementById('classe').value,
        specialty: document.getElementById('specialty').value,
        belt: document.getElementById('belt').value,
        gender: document.querySelector('input[name="gender"]:checked')?.value,
        weight_category: document.getElementById('weight_category')?.value || '-'
    };

    const { error } = await sb.from('atleti').insert([athleteData]);

    if (error) {
        alert("Errore: " + error.message);
    } else {
        document.getElementById('athleteForm').reset();
        await fetchAthletes();
    }
}

// --- 3. Conteggi ---
async function updateAllCounters() {
    const eventId = sessionStorage.getItem('selectedEventId');
    const { data: allAthletes } = await sb.from('atleti').select('specialty').eq('event_id', eventId);

    const counts = { Kumite: 0, Kata: 0, ParaKarate: 0, KIDS: 0 };
    allAthletes?.forEach(a => {
        if (counts.hasOwnProperty(a.specialty)) counts[a.specialty]++;
        else counts.KIDS++; 
    });

    document.getElementById('kumiteAthleteCountDisplay').innerText = counts.Kumite;
    document.getElementById('kataAthleteCountDisplay').innerText = counts.Kata;
    document.getElementById('ParaKarateAthleteCountDisplay').innerText = counts.ParaKarate;
    document.getElementById('KIDSAthleteCountDisplay').innerText = counts.KIDS;
}

async function removeAthlete(id) {
    if (confirm("Eliminare l'atleta?")) {
        await sb.from('atleti').delete().eq('id', id);
        await fetchAthletes();
    }
}

// --- 4. Event Listeners ---
document.addEventListener('DOMContentLoaded', () => {
    fetchAthletes();
    document.getElementById('athleteForm')?.addEventListener('submit', addAthlete);
    // Aggiungi qui le tue funzioni di cambio data/classe se necessarie
});
