// ==========================================
// 1. INDIRIZZI E CHIAVI DI CONNESSIONE SUPABASE
// ==========================================
const { createClient } = window.supabase;
const supabaseUrl = 'https://nhsvadkqagsqgirvoibg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5oc3ZhZGtxYWdzcWdpcnZvaWJnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5NzQ1MjQsImV4cCI6MjA4NzU1MDUyNH0.v0PPOfmX1p_sHkV2ZwzaH8gxr7VwN9MMRB1AclEOhvQ';

if (!window.supabaseClient) {
    window.supabaseClient = createClient(supabaseUrl, supabaseKey);
}
const supabaseClient = window.supabaseClient;

// Dichiarazione sicura globale di sb che evita l'errore "already been declared"
if (typeof window.sb === 'undefined') {
    window.sb = supabaseClient;
}
var sb = window.supabaseClient;

let idGaraCorrente = null;
let configurazioneSportCorrente = null;

// --- FUNZIONE DI LOGIN ---
async function signIn(email, password) {
    try {
        const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (error) throw error;
        window.location.href = 'scelta-evento.html'; 
    } catch (error) {
        alert('Credenziali non valide.');
    }
}

// --- FUNZIONE DI REGISTRAZIONE ---
async function signUp(email, password, nomeSocieta, cfs, cell) {
    try {
        const { data, error } = await supabaseClient.auth.signUp({ email, password });
        if (error) throw error;

        if (data.user) {
            const { error: societaError } = await supabaseClient.from('societa').insert([{ 
                nome: nomeSocieta, 
                email: email, 
                cfs: cfs, 
                cell: cell,
                user_id: data.user.id 
            }]);
            if (societaError) throw societaError;
        }

        alert('Registrazione completata! Controlla la tua email per confermare l\'account.');
        window.location.href = 'login.html';
    } catch (error) {
        console.error("Dettaglio errore:", error);
        alert("Errore registrazione: " + error.message);
    }
}

// --- FUNZIONE DI LOGOUT ---
async function logout() {
    try {
        await supabaseClient.auth.signOut();
        window.location.href = "login.html";
    } catch (error) {
        console.error("Errore logout:", error.message);
    }
}

function ottieniIdDallUrl() {
    const params = new URLSearchParams(window.location.search);
    let id = params.get('id');
    if (!id) id = sessionStorage.getItem('selectedEventId');
    return id;
}

function determinaSportDaPagina() {
    const pathname = window.location.pathname.toLowerCase();
    if (pathname.includes("judo")) return "judo";
    if (pathname.includes("fitarco")) return "fitarco";
    if (pathname.includes("karate")) return "karate";
    return sessionStorage.getItem('selectedSportId') || "judo";
}

// ==========================================
// 2. FUNZIONI PER CARICAMENTO EVENTI ATTIVI (scelta-evento.html)
// ==========================================
async function caricaEventiScelta() {
    const listaContenitore = document.getElementById('eventListContainer') || document.getElementById('listaGare');
    if (!listaContenitore) return; 

    try {
        // Legge tutti gli eventi dal database ordinandoli per data
        const { data: eventi, error } = await sb.from('eventi').select('*').order('data_evento', { ascending: false });
        if (error) throw error;

        if (!eventi || eventi.length === 0) {
            listaContenitore.innerHTML = '<div class="alert alert-info text-center py-4">Nessuna competizione programmata al momento.</div>';
            return;
        }

        listaContenitore.innerHTML = "";
        eventi.forEach(e => {
            const sportId = e.sport_id ? e.sport_id.toLowerCase() : 'karate';
            
            let destinazioneHtml = 'index-karate.html'; 
            if (sportId === 'judo') destinazioneHtml = 'index-judo.html';
            if (sportId === 'fitarco') destinazioneHtml = 'index-fitarco.html';
            if (sportId === 'karate') destinazioneHtml = 'index-karate.html';

            // Normalizzazione data per il rendering dell'interfaccia grafico di scelta-evento
            let visualizzaData = e.data_evento;
            if (e.data_evento && e.data_evento.includes('-')) {
                const parti = e.data_evento.split('-');
                if(parti[0].length === 4) visualizzaData = `${parti[2]}/${parti[1]}/${parti[0]}`;
            }

            listaContenitore.innerHTML += `
                <div class="event-item" onclick="selezionaGaraEInvia('${e.id}', '${destinazioneHtml}', '${sportId}', '${e.nome.replace(/'/g, "\\'")}')">
                    <div class="event-info">
                        <h5>${e.nome}</h5>
                        <small>
                            <i class="far fa-calendar-alt me-1"></i> ${visualizzaData} • 
                            <i class="fas fa-map-marker-alt me-1"></i> ${e.luogo || 'Sede da definire'}
                        </small>
                        <span class="badge bg-secondary text-uppercase ms-2" style="font-size: 0.65rem; vertical-align: middle;">${sportId}</span>
                    </div>
                    <div class="btn-select">
                        <i class="fas fa-chevron-right"></i>
                    </div>
                </div>`;
        });
    } catch (err) {
        console.error("Errore recupero eventi:", err.message);
        listaContenitore.innerHTML = '<div class="alert alert-danger text-center">Impossibile connettersi al servizio eventi.</div>';
    }
}

window.selezionaGaraEInvia = function(idGara, paginaTarget, sportId, nomeGara) {
    sessionStorage.setItem('selectedEventId', idGara);
    sessionStorage.setItem('selectedSportId', sportId);
    sessionStorage.setItem('selectedEventName', nomeGara);
    window.location.href = `${paginaTarget}?id=${idGara}`;
};

// ==========================================
// 3. LOGICHE INTERFACCIA PUBBLICA E CASCATE
// ==========================================
async function caricaInformazioniGara() {
    try {
        const { data, error } = await sb.from('eventi').select('*').eq('id', idGaraCorrente).single();
        if (error) throw error;
        const titoloElemento = document.getElementById('nomeGaraTitolo');
        if (titoloElemento && data) titoloElemento.innerText = data.nome;
    } catch (err) {
        const t = document.getElementById('nomeGaraTitolo');
        if (t) t.innerText = "Errore Caricamento Competizione";
    }
}

async function scaricaRegoleSport(sportId) {
    try {
        const { data, error } = await sb.from('configurazioni_sport').select('*').eq('sport_id', sportId).single();
        if (error) throw error;
        if (data && data.regole) {
            configurazioneSportCorrente = data.regole;
            if (sportId === 'fitarco' && document.getElementById('regSpecialty')) {
                const selectDiv = document.getElementById('regSpecialty');
                selectDiv.innerHTML = '<option value="">-- Seleziona Divisione --</option>';
                configurazioneSportCorrente.divisioni?.forEach(d => {
                    selectDiv.innerHTML += `<option value="${d}">${d}</option>`;
                });
            }
        }
    } catch (err) { console.error(err.message); }
}

function cascataJudoClassi() {
    const sesso = document.getElementById('regGender').value;
    const selectClasse = document.getElementById('regClasse');
    const selectPeso = document.getElementById('regWeightCategory');
    if (!selectClasse) return;
    selectClasse.innerHTML = '<option value="">-- Scegli Classe d\'Età --</option>';
    if (selectPeso) { selectPeso.innerHTML = '<option value="">-- Seleziona la classe --</option>'; selectPeso.disabled = true; }
    if (!sesso) { selectClasse.disabled = true; return; }
    configurazioneSportCorrente?.classi?.forEach(c => { selectClasse.innerHTML += `<option value="${c}">${c}</option>`; });
    selectClasse.disabled = false;
}

function fflushJudoPesi() {
    const sesso = document.getElementById('regGender').value;
    const classe = document.getElementById('regClasse').value;
    const selectPeso = document.getElementById('regWeightCategory');
    if (!selectPeso) return;
    selectPeso.innerHTML = '<option value="">-- Seleziona Categoria Peso --</option>';
    if (!classe) { selectPeso.disabled = true; return; }
    try {
        if (configurazioneSportCorrente?.pesi?.[sesso]?.[classe]) {
            configurazioneSportCorrente.pesi[sesso][classe].forEach(p => { selectPeso.innerHTML += `<option value="${p}">${p}</option>`; });
            selectPeso.disabled = false;
        } else { throw new Error(); }
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
    configurazioneSportCorrente?.classi?.[divisione]?.forEach(c => { selectClasse.innerHTML += `<option value="${c}">${c}</option>`; });
    selectClasse.disabled = false;
}

async function salvaIscrizione(e) {
    e.preventDefault();
    let societyId = null;
    const { data: { user } } = await sb.auth.getUser();
    if (user) {
        const { data: soc } = await sb.from('societa').select('id').eq('user_id', user.id).single();
        if (soc) societyId = soc.id;
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
        alert("Iscrizione registrata con successo!");
        document.getElementById('registrationForm').reset();
        if (document.getElementById('regClasse')) document.getElementById('regClasse').disabled = true;
        if (document.getElementById('regWeightCategory')) document.getElementById('regWeightCategory').disabled = true;
        await popolaTabellaIscritti();
    } catch (err) { alert("Errore invio: " + err.message); }
}

async function popolaTabellaIscritti() {
    const tbody = document.getElementById('iscrittiGaraList');
    if (!tbody) return;
    try {
        const { data, error } = await sb.from('atleti').select('*').eq('event_id', idGaraCorrente).order('created_at', { ascending: false });
        if (error) throw error;
        if (!data || data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted py-3">Nessun atleta iscritto.</td></tr>`;
            return;
        }
        tbody.innerHTML = "";
        data.forEach(a => {
            tbody.innerHTML += `<tr>
                <td><strong>${a.last_name} ${a.first_name}</strong></td>
                <td>${a.classe}</td>
                <td><span class="badge bg-light text-dark border">${a.gender}</span></td>
                <td>${determinaSportDaPagina() === 'judo' ? (a.belt || '-') : (a.specialty || '-')}</td>
                <td><span class="badge bg-secondary">${a.weight_category || 'Open'}</span></td>
            </tr>`;
        });
    } catch (err) { tbody.innerHTML = `<tr><td colspan="5" class="text-center text-danger py-3">Errore caricamento.</td></tr>`; }
}

// ==========================================
// 4. INIZIALIZZATORE UNICO AL CARICAMENTO DOM
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            signIn(document.getElementById('email').value, document.getElementById('password').value);
        });
    }

    const regForm = document.getElementById('registrazioneForm');
    if (regForm) {
        regForm.addEventListener('submit', (e) => {
            e.preventDefault();
            if (document.getElementById('email').value !== document.getElementById('emailConfirm').value) return alert("Le email non corrispondono!");
            if (document.getElementById('password').value !== document.getElementById('passwordConfirm').value) return alert("Le password non corrispondono!");
            if (document.getElementById('password').value.length < 6) return alert("Password troppo corta.");
            signUp(document.getElementById('email').value, document.getElementById('password').value, document.getElementById('nomeSocieta').value, document.getElementById('cfs').value, document.getElementById('cell').value);
        });
    }

    // Caricamento eventi (scelta-evento.html)
    if (document.getElementById('eventListContainer') || document.getElementById('listaGare')) {
        await caricaEventiScelta();
        return; 
    }

    // Caricamento moduli d'iscrizione (index-judo.html, ecc.)
    const formIscrizione = document.getElementById('registrationForm') || document.getElementById('registerForm');
    if (formIscrizione) {
        if (!document.getElementById('registrationForm')) formIscrizione.id = 'registrationForm';
        
        idGaraCorrente = ottieniIdDallUrl();
        if (!idGaraCorrente) {
            const t = document.getElementById('nomeGaraTitolo');
            if (t) t.innerText = "Gara non specificata";
            return;
        }

        const sportIdentificato = determinaSportDaPagina();
        await caricaInformazioniGara();
        await scaricaRegoleSport(sportIdentificato);
        await popolaTabellaIscritti();

        const selectGender = document.getElementById('regGender');
        const selectClasse = document.getElementById('regClasse');

        if (sportIdentificato === 'judo') {
            if (selectGender) selectGender.addEventListener('change', cascataJudoClassi);
            if (selectClasse) selectClasse.addEventListener('change', fflushJudoPesi);
        } else if (sportIdentificato === 'fitarco') {
            const selectSpecialty = document.getElementById('regSpecialty');
            if (selectSpecialty) selectSpecialty.addEventListener('change', cascataFitarcoClassi);
        }

        document.getElementById('registrationForm').addEventListener('submit', salvaIscrizione);
    }
});
