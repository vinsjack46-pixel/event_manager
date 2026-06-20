const sb = window.supabaseClient;
let istanzaModale = null;

document.addEventListener('DOMContentLoaded', () => {
    istanzaModale = new bootstrap.Modal(document.getElementById('modalEditor'));
    document.getElementById('adminEventForm').addEventListener('submit', inviaNuovaGara);
    caricaElencoGare();
});
async function verificaSuperAdmin() {
    const { data: { user } } = await sb.auth.getUser();
    
    // Inserisci qui la tua email reale di Supabase
    const emailSuperAdmin = "vinsjack46@gmail.com"; 
    
    if (!user || user.email !== emailSuperAdmin) {
        alert("ACCESSO NEGATO: Questa sezione richiede un livello di autorizzazione Super Admin.");
        window.location.href = "scelta-evento.html"; // Kicca l'utente non autorizzato
    }
}

async function caricaElencoGare() {
    const { data, error } = await sb.from('eventi').select('*').order('data_evento', { ascending: false });
    const contenitore = document.getElementById('listaGareAdmin');
    if (!contenitore) return;
    contenitore.innerHTML = "";

    if (error || !data || data.length === 0) {
        contenitore.innerHTML = `<div class="text-center text-muted py-3">Nessuna gara registrata a sistema.</div>`;
        return;
    }

    data.forEach(e => {
        contenitore.innerHTML += `
            <div class="list-group-item d-flex justify-content-between align-items-center">
                <div>
                    <h6 class="mb-0 fw-bold">${e.nome}</h6>
                    <small class="text-muted">${e.data_evento} - ${e.luogo}</small>
                </div>
                <span class="badge bg-secondary text-uppercase">${e.sport_id}</span>
            </div>`;
    });
}

async function inviaNuovaGara(e) {
    e.preventDefault();
    const payload = {
        nome: document.getElementById('addNome').value.trim(),
        data_evento: document.getElementById('addData').value,
        luogo: document.getElementById('addLuogo').value.trim(),
        sport_id: document.getElementById('addSportId').value
    };

    const { error } = await sb.from('eventi').insert([payload]);
    if (!error) {
        alert("Competizione creata e collegata allo sport con successo!");
        document.getElementById('adminEventForm').reset();
        await caricaElencoGare();
    } else {
        alert("Errore salvataggio competizione: " + error.message);
    }
}

function apriEditorModale() {
    istanzaModale.show();
    leggiJsonDaDb();
}

async function leggiJsonDaDb() {
    const spId = document.getElementById('selettoreSportJson').value;
    const { data, error } = await sb.from('configurazioni_sport').select('regole').eq('sport_id', spId).single();
    if (!error && data) {
        document.getElementById('testoJson').value = JSON.stringify(data.regole, null, 4);
    }
}

function formattaTestoJson() {
    try {
        const parsed = JSON.parse(document.getElementById('testoJson').value);
        document.getElementById('testoJson').value = JSON.stringify(parsed, null, 4);
        alert("Sintassi JSON verificata e corretta.");
    } catch (err) {
        alert("Errore Sintassi: Mancano virgole, virgolette o parentesi di chiusura.");
    }
}

async function inviaJsonAggiustato() {
    const spId = document.getElementById('selettoreSportJson').value;
    try {
        const jsonDefinitivo = JSON.parse(document.getElementById('testoJson').value);
        const { error } = await sb.from('configurazioni_sport').update({ regole: jsonDefinitivo }).eq('sport_id', spId);
        if (error) throw error;
        alert("Regole a cascata caricate e configurate nel database per lo sport: " + spId.toUpperCase());
        istanzaModale.hide();
    } catch (err) {
        alert("Impossibile salvare: " + err.message);
    }
}
