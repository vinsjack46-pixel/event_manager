const sb = window.supabaseClient;
let activeEvents = [];

// Definiamo i "Layout" dei form per ogni sport direttamente in oggetti HTML riutilizzabili
const sportFormTemplates = {
    karate: `
        <h6 class="fw-bold text-primary border-bottom pb-1 mb-3"><i class="fas fa-user-ninja me-2"></i>Specifiche Karate</h6>
        <div class="mb-2">
            <label class="form-label">Specialità</label>
            <select id="regSpecialty" class="form-control" required>
                <option value="Kata">Kata (Forma)</option>
                <option value="Kumite">Kumite (Combattimento)</option>
            </select>
        </div>
        <div class="mb-2">
            <label class="form-label">Grado / Cintura</label>
            <select id="regBelt" class="form-control" required>
                <option value="Bianca">Bianca</option>
                <option value="Gialla">Gialla</option>
                <option value="Verde">Verde</option>
                <option value="Nera">Nera</option>
            </select>
        </div>
        <div class="mb-2">
            <label class="form-label">Classe d'età</label>
            <select id="regClasse" class="form-control" required>
                <option value="Speranze">Speranze (KIDS)</option>
                <option value="Cadetti">Cadetti</option>
                <option value="Seniores">Seniores</option>
            </select>
        </div>
        <div class="mb-2 id-peso-wrapper">
            <label class="form-label">Categoria di Peso</label>
            <input type="text" id="regWeightCategory" class="form-control" placeholder="Es. -60kg o Open">
        </div>
    `,
    judo: `
        <h6 class="fw-bold text-success border-bottom pb-1 mb-3"><i class="fas fa-hand-fist me-2"></i>Specifiche Judo</h6>
        <div class="mb-2">
            <label class="form-label">Grado / Kyu</label>
            <select id="regBelt" class="form-control" required>
                <option value="Cintura Bianca">Cintura Bianca</option>
                <option value="Cintura Marrone">Cintura Marrone</option>
                <option value="Cintura Nera">Cintura Nera</option>
            </select>
        </div>
        <div class="mb-2">
            <label class="form-label">Classe (Es. Esordienti/Cadetti)</label>
            <input type="text" id="regClasse" class="form-control" placeholder="Es. U15" required>
        </div>
        <div class="mb-2">
            <label class="form-label">Peso Effettivo (Kg)</label>
            <input type="number" id="regWeightCategory" class="form-control" placeholder="Es. 73" required>
        </div>
        <input type="hidden" id="regSpecialty" value="Shiai">
    `,
    default: `
        <h6 class="fw-bold text-secondary border-bottom pb-1 mb-3">Specifiche Atleta</h6>
        <div class="mb-2">
            <label class="form-label">Classe / Categoria</label>
            <input type="text" id="regClasse" class="form-control" required>
        </div>
        <input type="hidden" id="regSpecialty" value="Default">
        <input type="hidden" id="regBelt" value="Open">
        <input type="hidden" id="regWeightCategory" value="Open">
    `
};

// All'avvio carichiamo gli eventi disponibili
document.addEventListener('DOMContentLoaded', async () => {
    await loadEventsDropdown();
    document.getElementById('registrationForm').addEventListener('submit', submitRegistration);
});

// Carica gli eventi da Supabase e memorizza le info sul loro sport_id
async function loadEventsDropdown() {
    const { data: eventi, error } = await sb.from('eventi').select('*').order('data_evento', { ascending: true });
    if (error) return console.error(error);

    activeEvents = eventi || [];
    const select = document.getElementById('regEventId');
    
    activeEvents.forEach(e => {
        select.innerHTML += `<option value="${e.id}">${e.nome} (${e.sport_id ? e.sport_id.toUpperCase() : 'KARATE'})</option>`;
    });
}

// Rileva il cambio evento e disegna il form specifico
function handleEventChange() {
    const eventId = document.getElementById('regEventId').value;
    const container = document.getElementById('dynamicFormFields');

    if (!eventId) {
        container.style.display = "none";
        container.innerHTML = "";
        return;
    }

    // Trova l'evento selezionato per capire che sport usa
    const selectedEvent = activeEvents.find(e => e.id == eventId);
    const sport = selectedEvent?.sport_id ? selectedEvent.sport_id.toLowerCase() : 'karate';

    // Recupera il template HTML corrispondente allo sport (o usa quello di default)
    const htmlTemplate = sportFormTemplates[sport] || sportFormTemplates['default'];

    // Inietta i campi e mostra il box
    container.innerHTML = htmlTemplate;
    container.style.display = "block";
    
    // Logica opzionale extra: personalizzazione dinamica basata sul DB
    applyDatabaseMetaRules(sport);
}

// Controlla dinamicamente le regole (es. nascondere il peso se richiede_peso è false)
async function applyDatabaseMetaRules(sportId) {
    try {
        const { data: config } = await sb.from('configurazioni_sport').select('*').eq('sport_id', sportId).single();
        if (!config) return;

        // Se lo sport sul database ha "richiede_peso = false", nascondi il campo peso se presente nel template
        if (config.richiede_peso === false || config.richiega_peso === false) {
            const weightWrapper = document.querySelector('.id-peso-wrapper');
            if (weightWrapper) {
                weightWrapper.style.display = "none";
                const weightInput = document.getElementById('regWeightCategory');
                if (weightInput) {
                    weightInput.value = "Open"; // Imposta valore neutro automatico
                    weightInput.required = false;
                }
            }
        }
    } catch (err) {
        console.log("Nessun vincolo meta trovato nel DB per questo sport.");
    }
}

// Raccoglie i dati (sia fissi che dinamici) e salva l'iscrizione
async function submitRegistration(e) {
    e.preventDefault();

    // Dati base costanti
    const eventId = document.getElementById('regEventId').value;
    const firstName = document.getElementById('regFirstName').value.trim();
    const lastName = document.getElementById('regLastName').value.trim();
    const gender = document.getElementById('regGender').value;

    // Dati dinamici (estratti dal template iniettato al volo)
    const classe = document.getElementById('regClasse')?.value || 'Default';
    const specialty = document.getElementById('regSpecialty')?.value || 'Default';
    const belt = document.getElementById('regBelt')?.value || 'Open';
    const weightCategory = document.getElementById('regWeightCategory')?.value || 'Open';

    try {
        const { error } = await sb.from('atleti').insert([{
            event_id: eventId,
            first_name: firstName,
            last_name: lastName,
            gender: gender,
            classe: classe,
            specialty: specialty,
            belt: belt,
            weight_category: weightCategory
        }]);

        if (error) throw error;

        alert("Iscrizione avvenuta con successo!");
        document.getElementById('registrationForm').reset();
        document.getElementById('dynamicFormFields').style.display = "none";

    } catch (err) {
        alert("Errore durante l'iscrizione: " + err.message);
    }
}
