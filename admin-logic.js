const sb = window.supabaseClient;

document.addEventListener('DOMContentLoaded', () => {
    loadEvents();
    loadAllAthletes();
    
    document.getElementById('eventForm').addEventListener('submit', createEvent);
    document.getElementById('globalSearch').addEventListener('input', filterAthletes);
    document.getElementById('filterEvent').addEventListener('change', filterAthletes);
});

// --- GESTIONE EVENTI ---
async function loadEvents() {
    const { data: eventi } = await sb.from('eventi').select('*').order('data_evento', { ascending: false });
    const list = document.getElementById('eventList');
    const select = document.getElementById('filterEvent');
    
    list.innerHTML = '';
    eventi?.forEach(e => {
        list.innerHTML += `<li class="list-group-item d-flex justify-content-between align-items-center">
            ${e.nome} <small>${e.data_evento}</small>
        </li>`;
        select.innerHTML += `<option value="${e.id}">${e.nome}</option>`;
    });
}

async function createEvent(e) {
    e.preventDefault();
    const nome = document.getElementById('eventName').value;
    const data_evento = document.getElementById('eventDate').value;
    const luogo = document.getElementById('eventLocation').value;

    const { error } = await sb.from('eventi').insert([{ nome, data_evento, luogo }]);
    if (error) alert(error.message);
    else {
        alert("Evento creato!");
        location.reload();
    }
}

// --- GESTIONE ATLETI (RICERCA GLOBALE) ---
let allAthletesData = []; // Cache locale per ricerca veloce

async function loadAllAthletes() {
    // Carichiamo atleti uniti a societa ed eventi (grazie alle foreign keys)
    const { data, error } = await sb
        .from('atleti')
        .select(`
            *,
            eventi (nome),
            societa (nome)
        `);

    if (error) return console.error(error);
    allAthletesData = data;
    renderTable(allAthletesData);
}

function renderTable(data) {
    const tbody = document.getElementById('adminAthleteList');
    const counter = document.getElementById('totalCounter');
    tbody.innerHTML = '';
    counter.innerText = data.length;

    data.forEach(a => {
        tbody.innerHTML += `
            <tr>
                <td><strong>${a.last_name} ${a.first_name}</strong></td>
                <td><small>${a.eventi?.nome || 'N/A'}</small></td>
                <td>${a.societa?.nome || 'N/A'}</td>
                <td>${a.classe} / ${a.specialty}</td>
                <td>${a.weight_category}</td>
                <td>${a.gender}</td>
            </tr>
        `;
    });
}

function filterAthletes() {
    const searchTerm = document.getElementById('globalSearch').value.toLowerCase();
    const eventId = document.getElementById('filterEvent').value;

    const filtered = allAthletesData.filter(a => {
        const matchesSearch = 
            a.first_name.toLowerCase().includes(searchTerm) ||
            a.last_name.toLowerCase().includes(searchTerm) ||
            (a.societa?.nome || "").toLowerCase().includes(searchTerm) ||
            a.classe.toLowerCase().includes(searchTerm) ||
            a.specialty.toLowerCase().includes(searchTerm);
        
        const matchesEvent = eventId === "" || a.event_id === eventId;

        return matchesSearch && matchesEvent;
    });

    renderTable(filtered);
}
