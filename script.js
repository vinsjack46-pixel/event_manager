// ==========================================
// 1. INDIRIZZI E CHIAVI DI CONNESSIONE SUPABASE
// ==========================================
const SUPABASE_URL = "https://nhsvadkqagsqgirvoibg.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5oc3ZhZGtxYWdzcWdpcnZvaWJnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5NzQ1MjQsImV4cCI6MjA4NzU1MDUyNH0.v0PPOfmX1p_sHkV2ZwzaH8gxr7VwN9MMRB1AclEOhvQ";

// Inizializzazione sicura del client
if (!window.supabaseClient) {
    window.supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}
const sb = window.supabaseClient;

// Stati globali per la pagina d'iscrizione pubblica
let idGaraCorrente = null;
let configurazioneSportCorrente = null;

// Estrae l'ID della gara dai parametri dell'URL (?id=...) o dal sessionStorage come paracadute
function ottieniIdDallUrl() {
    const params = new URLSearchParams(window.location.search);
    let id = params.get('id');
    if (!id) {
        id = sessionStorage.getItem('selectedEventId');
    }
    return id;
}

// Determina lo sport basandosi sul nome del file HTML corrente
function determinaSportDaPagina() {
    const pathname = window.location.pathname.toLowerCase();
    if (pathname.includes("judo")) return "judo";
    if (pathname.includes("fitarco")) return "fitarco";
    if (pathname.includes("karate")) return "karate";
    
    // Tentativo di recupero da sessione se il file non contiene il nome dello sport
    return sessionStorage.getItem('selectedSportId') || "judo";
}

// ==========================================
// 2. INIZIALIZZAZIONE DELLA PAGINA PUBBLICA
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    // Verifica l'esistenza del form. Se non c'è, significa che siamo in un'altra pagina (es: login)
    const formIscrizione = document.getElementById('registrationForm') || document.getElementById('registerForm');
    if (!formIscrizione) {
        console.log("Modulo d'iscrizione non presente in questa pagina. Salto inizializzazione pubblica.");
        return;
    }

    // Forza l'ID del form se era stato chiamato in modo diverso, per non rompere i listener successivi
    if (!document.getElementById('registrationForm')) {
        formIscrizione.id = 'registrationForm';
    }

    idGaraCorrente = ottieniIdDallUrl();
    if (!idGaraCorrente) {
        alert("Errore di configurazione: Nessuna gara selezionata o rilevata nell'indirizzo.");
        const titoloGara = document.getElementById('nomeGaraTitolo');
        if (titoloGara) titoloGara.innerText = "Gara non specificata";
        return;
    }

    const sportIdentificato = determinaSportDaPagina();
    console.log(`Inizializzazione iscrizione per lo Sport: ${sportIdentificato}, ID Gara: ${idGaraCorrente}`);
    
    // Esecuzione dei caricamenti in parallelo controllato
    await caricaInformazioniGara();
    await scaricaRegoleSport(sportIdentificato);
    await popolaTabellaIscritti();

    // Attivazione delle funzioni a cascata in base alla disciplina rilevata
    const selectGender = document.getElementById('regGender');
    const selectClasse = document.getElementById('regClasse');
    const selectSpecialty = document.getElementById('regSpecialty');

    if (sportIdentificato === 'judo') {
        if (selectGender) selectGender.addEventListener('change', cascataJudoClassi);
        if (selectClasse) selectClasse.addEventListener('change', cascataJudoPesi);
    } else if (sportIdentificato === 'fitarco') {
        if (selectSpecialty) selectSpecialty.addEventListener('change', cascataFitarcoClassi);
    }

    // Listener per il salvataggio dei dati inviati dagli atleti
    document.getElementById('registrationForm').addEventListener('submit', salvaIscrizione);
});

// Carica il titolo dell'evento nel tag h1/h2 della pagina
async function caricaInformazioniGara() {
    try {
        const { data, error } = await sb.from('eventi').select('*').eq('id', idGaraCorrente).single();
        if (error) throw error;
        
        const titoloElemento = document.getElementById('nomeGaraTitolo');
        if (titoloElemento && data) {
            titoloElemento.innerText = data.nome;
        }
    } catch (err) {
        console.error("Errore nel caricamento dei dettagli del torneo:", err.message);
        const titoloElemento = document.getElementById('nomeGaraTitolo');
        if (titoloElemento) titoloElemento.innerText = "Errore Caricamento Competizione";
    }
}

// Scarica le configurazioni JSON dei pesi e delle classi dal DB
async function scaricaRegoleSport(sportId) {
    try {
        const { data, error } = await sb.from('configurazioni_sport').select('*').eq('sport_id', sportId).single();
        if (error) throw error;
        
        if (data && data.regole) {
            configurazioneSportCorrente = data.regole;
            
            // Se lo sport è il tiro con l'arco, popola subito il primo campo delle divisioni
            if (sportId === 'fitarco' && document.getElementById('regSpecialty')) {
                const selectDiv = document.getElementById('regSpecialty');
                selectDiv.innerHTML = '<option value="">-- Seleziona Divisione --</option>';
                configurazioneSportCorrente.divisioni?.forEach(d => {
                    selectDiv.innerHTML += `<option value="${d}">${d}</option>`;
                });
            }
        }
    } catch (err) {
        console.error("Impossibile scaricare l'albero delle regole per lo sport:", err.message);
    }
}

// ==========================================
// 3. LOGICHE DEI LIVELLI A CASCATA
// ==========================================
function cascataJudoClassi() {
    const sesso = document.getElementById('regGender').value;
    const selectClasse = document.getElementById('regClasse');
    const selectPeso = document.getElementById('regWeightCategory');
    
    if (!selectClasse) return;
    
    selectClasse.innerHTML = '<option value="">-- Scegli Classe d\'Età --</option>';
    if (selectPeso) {
        selectPeso.innerHTML = '<option value="">-- Seleziona la classe --</option>';
        selectPeso.disabled = true;
    }
    
    if (!sesso) { selectClasse.disabled = true; return; }
    
    if (configurazioneSportCorrente && configurazioneSportCorrente.classi) {
        configurazioneSportCorrente.classi.forEach(c => { 
            selectClasse.innerHTML += `<option value="${c}">${c}</option>`; 
        });
    }
    selectClasse.disabled = false;
}

function cascataJudoPesi() {
    const sesso = document.getElementById('regGender').value;
    const classe = document.getElementById('regClasse').value;
    const selectPeso = document.getElementById('regWeightCategory');
    
    if (!selectPeso) return;
    selectPeso.innerHTML = '<option value="">-- Seleziona Categoria Peso --</option>';
    
    if (!classe) { selectPeso.disabled = true; return; }
    
    try {
        if (configurazioneSportCorrente && configurazioneSportCorrente.pesi && configurazioneSportCorrente.pesi[sesso] && configurazioneSportCorrente.pesi[sesso][classe]) {
            configurazioneSportCorrente.pesi[sesso][classe].forEach(p => { 
                selectPeso.innerHTML += `<option value="${p}">${p}</option>`; 
            });
            selectPeso.disabled = false;
        } else {
            throw new Error("Mappa pesi non trovata per questa combinazione");
        }
    } catch (e) {
        selectPeso.innerHTML = '<option value="Open">Categoria Unica / Open</option>';
        selectPeso.disabled = false;
    }
}

function cascataFitarcoClassi() {
    const divisione = document.getElementById('regSpecialty').value;
    const selectClasse = document.getElementById('regClasse');
    
    if (!selectClasse) return;
    selectClasse.innerHTML = '<option value="">-- Seleziona Classe Atleta --</option>';
    
    if (!divisione) { selectClasse.disabled = true; return; }
    
    if (configurazioneSportCorrente && configurazioneSportCorrente.classi && configurazioneSportCorrente.classi[divisione]) {
        configurazioneSportCorrente.classi[divisione].forEach(c => { 
            selectClasse.innerHTML += `<option value="${c}">${c}</option>`; 
        });
        selectClasse.disabled = false;
    }
}

// ==========================================
// 4. SALVATAGGIO ED ELENCO DEGLI ISCRITTI
// ==========================================
async function salvaIscrizione(e) {
    e.preventDefault();
    
    // Recupera l'ID della società dell'utente connesso (se applicabile)
    let societyId = window.currentSocietyId || null;
    if (!societyId) {
        const { data: { user } } = await sb.auth.getUser();
        if (user) {
            const { data: soc } = await sb.from('societa').select('id').eq('user_id', user.id).single();
            if (soc) societyId = soc.id;
        }
    }

    const payload = {
        event_id: idGaraCorrente,
        society_id: societyId,
        first_name: document.getElementById('regFirstName').value.trim(),
        last_name: document.getElementById('regLastName').value.trim(),
        gender: document.getElementById('regGender').value,
        classe: document.getElementById('regClasse').value,
        specialty: document.getElementById('regSpecialty')?.value || 'Individuale',
        belt: document.getElementById('regBelt')?.value || 'Qualificati',
        weight_category: document.getElementById('regWeightCategory')?.value || 'Open'
    };
    
    try {
        const { error } = await sb.from('atleti').insert([payload]);
        if (error) throw error;
        
        alert("Iscrizione registrata con successo nel sistema!");
        document.getElementById('registrationForm').reset();
        
        if (document.getElementById('regClasse')) document.getElementById('regClasse').disabled = true;
        if (document.getElementById('regWeightCategory')) document.getElementById('regWeightCategory').disabled = true;
        
        await popolaTabellaIscritti();
    } catch (err) { 
        alert("Errore durante l'invio dell'iscrizione: " + err.message); 
    }
}

async function popolaTabellaIscritti() {
    const tbody = document.getElementById('iscrittiGaraList');
    if (!tbody) return;
    
    try {
        // Scarica tutti gli atleti registrati per questa specifica gara
        const { data, error } = await sb
            .from('atleti')
            .select('*')
            .eq('event_id', idGaraCorrente)
            .order('created_at', { ascending: false });
            
        if (error) throw error;
        
        if (!data || data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted py-3">Nessun atleta iscritto a questo evento.</td></tr>`;
            return;
        }
        
        tbody.innerHTML = "";
        const sportAttuale = determinaSportDaPagina();
        
        data.forEach(a => {
            tbody.innerHTML += `<tr>
                <td><strong>${a.last_name} ${a.first_name}</strong></td>
                <td>${a.classe}</td>
                <td><span class="badge bg-light text-dark border">${a.gender}</span></td>
                <td>${sportAttuale === 'judo' ? (a.belt || 'N.D.') : (a.specialty || 'N.D.')}</td>
                <td><span class="badge bg-secondary">${a.weight_category || 'Open'}</span></td>
            </tr>`;
        });
    } catch (err) {
        console.error("Errore nel rendering della tabella iscritti:", err.message);
        tbody.innerHTML = `<tr><td colspan="5" class="text-center text-danger py-3">Errore nel caricamento degli iscritti.</td></tr>`;
    }
}
