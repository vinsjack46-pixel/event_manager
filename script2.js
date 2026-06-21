// ==========================================================================
// SCRIPT2.JS GESTIONE COMPLETA KARATE (VERSIONE TOTALMENTE RIGIDA SENZA TAGLI)
// ==========================================================================

// Utilizza l'istanza Supabase globale già creata in script.js per evitare conflitti
const sbKarate = window.sb;

let idGaraKarate = null;
let idSocietaKarate = null;
let contatoreComponentiKarate = 0;

// --- INIZIALIZZAZIONE SPECIFICA KARATE ---
async function initDashboardKarate() {
    idGaraKarate = sessionStorage.getItem('selectedEventId');
    const nomeGara = sessionStorage.getItem('selectedEventName');

    if (!idGaraKarate) return; // Non siamo nella pagina corretta o sessione scaduta

    // Allineamento Titoli e Nomi Gara
    const targetGaraIDs = ['nomeGaraTitolo', 'eventNameDisplay', 'nomeGara', 'titoloGara'];
    targetGaraIDs.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerText = nomeGara;
    });

    // Iniezione controllata dei valori testuali per il Sesso Singolo
    const selGender = document.getElementById('regGender');
    if (selGender) {
        selGender.innerHTML = `
            <option value="" disabled selected>-- Seleziona Sesso --</option>
            <option value="Maschio">Maschio</option>
            <option value="Femmina">Femmina</option>
        `;
    }

    // Iniezione controllata dei valori testuali per il Sesso Squadra
    const selTeamGender = document.getElementById('teamGender');
    if (selTeamGender) {
        selTeamGender.innerHTML = `
            <option value="" disabled selected>-- Seleziona Sesso Squadra --</option>
            <option value="Maschile">Maschile</option>
            <option value="Femminile">Femminile</option>
            <option value="Mista (Mix)">Mista (Mix)</option>
        `;
    }

    // Recupero Società Connessa
    try {
        const { data: { user } } = await sbKarate.auth.getUser();
        if (user) {
            const { data: soc } = await sbKarate.from('societa').select('*').eq('user_id', user.id).single();
            if (soc) {
                idSocietaKarate = soc.id;
                const targetSocietaIDs = ['societyNameDisplay', 'nomeSocietaHeader', 'nomeSocieta', 'societyName'];
                targetSocietaIDs.forEach(id => {
                    const el = document.getElementById(id);
                    if (el) el.innerText = "Società: " + soc.nome;
                });
            }
        }
    } catch (e) { console.error("Errore Karate Auth:", e); }

    // Avvio dei componenti Karate obbligatori (Primi 3 bloccati)
    configuraInizialeSquadraKarate();
    popolaTabellaKarate();
}

// --- CONFIGURAZIONE SQUADRA KARATE: PRIMI 3 OBBLIGATORI + FINO A 7 ---
function configuraInizialeSquadraKarate() {
    const container = document.getElementById('teamMembersContainer');
    const btnAdd = document.getElementById('btnAddTeamMember');
    if (!container || !btnAdd) return;

    container.innerHTML = "";
    contatoreComponentiKarate = 0;

    // Generazione automatica dei primi 3 atleti fissi e obbligatori
    for (let i = 1; i <= 3; i++) {
        contatoreComponentiKarate++;
        const row = document.createElement('div');
        row.className = "row g-2 mb-2 align-items-center";
        row.innerHTML = `
            <div class="col-5">
                <input type="text" class="form-control form-control-sm member-lastname" placeholder="Cognome Atleta Obbligatorio ${i}" required>
            </div>
            <div class="col-5">
                <input type="text" class="form-control form-control-sm member-firstname" placeholder="Nome Atleta Obbligatorio ${i}" required>
            </div>
            <div class="col-2 text-center text-muted small fw-bold">
                Fisso
            </div>
        `;
        container.appendChild(row);
    }

    // Gestione del tasto + per i successivi atleti opzionali (Fino a 7 totali)
    btnAdd.onclick = function(e) {
        e.preventDefault();
        if (contatoreComponentiKarate >= 7) {
            alert("Raggiunto il limite massimo di 7 componenti complessivi per la squadra di Karate.");
            return;
        }
        contatoreComponentiKarate++;
        
        const row = document.createElement('div');
        row.className = "row g-2 mb-2 align-items-center team-member-row-extra";
        row.id = `karateMemberRow_${contatoreComponentiKarate}`;
        row.innerHTML = `
            <div class="col-5">
                <input type="text" class="form-control form-control-sm member-lastname" placeholder="Cognome Atleta Opzionale ${contatoreComponentiKarate}" required>
            </div>
            <div class="col-5">
                <input type="text" class="form-control form-control-sm member-firstname" placeholder="Nome Atleta Opzionale ${contatoreComponentiKarate}" required>
            </div>
            <div class="col-2 text-end">
                <button type="button" class="btn btn-danger btn-sm" onclick="rimuoviAtletaExtraKarate(${contatoreComponentiKarate})">✕</button>
            </div>
        `;
        container.appendChild(row);
    };
}

window.rimuoviAtletaExtraKarate = function(id) {
    const row = document.getElementById(`karateMemberRow_${id}`);
    if (row) {
        row.remove();
        contatoreComponentiKarate--;
    }
};

// --- SALVATAGGIO INDIVIDUALE KARATE ---
async function salvaIscrizioneKarate(e) {
    e.preventDefault();
    if (!idSocietaKarate) return alert("Società non identificata.");

    const lastName = document.getElementById('regLastName')?.value.trim();
    const firstName = document.getElementById('regFirstName')?.value.trim();
    const gender = document.getElementById('regGender')?.value;
    const birthYear = document.getElementById('regBirthYear')?.value.trim();
    const classe = document.getElementById('regClasse')?.value;
    const specialty = document.getElementById('regSpecialty')?.value; 
    const belt = document.getElementById('regBelt')?.value || 'Bianca';
    const weightCategory = document.getElementById('regWeightCategory')?.value || 'Open';

    if (!lastName || !firstName || !gender || !birthYear || !classe || !specialty) {
        return alert("Compila tutti i campi obbligatori per l'atleta.");
    }

    const dataFormattata = `${birthYear}-01-01`;

    const payload = {
        event_id: idGaraKarate,
        society_id: idSocietaKarate,
        first_name: firstName,
        last_name: lastName,
        gender: gender, // "Maschio" o "Femmina"
        classe: classe,
        specialty: specialty, // Kata o Kumite
        belt: belt,
        weight_category: weightCategory,
        birthdate: dataFormattata
    };

    const { error } = await sbKarate.from('atleti').insert([payload]);
    if (error) {
        alert("Errore nel salvataggio dell'atleta: " + error.message);
    } else {
        alert("Atleta registrato correttamente nel Karate!");
        document.getElementById('registrationForm')?.reset();
        popolaTabellaKarate();
    }
}

// --- SALVATAGGIO SQUADRA KARATE ---
async function salvaSquadraKarate(e) {
    e.preventDefault();
    if (!idSocietaKarate) return alert("Società non identificata.");

    const teamName = document.getElementById('teamName')?.value.trim();
    const teamGender = document.getElementById('teamGender')?.value;
    const teamClasse = document.getElementById('teamClasse')?.value.trim();
    const teamSpecialty = document.getElementById('teamSpecialty')?.value || 'Kata Squadra'; // Specialty esplicita per Karate
    const teamBelt = document.getElementById('teamBelt')?.value || 'Squadra';

    if (!teamName || !teamGender || !teamClasse) {
        return alert("Compila tutti i campi intestazione della squadra.");
    }

    // Raccoglie tutti i campi atleti (sia obbligatori che extra aggiunti col +)
    const inputsLastname = document.querySelectorAll('#teamMembersContainer .member-lastname');
    const inputsFirstname = document.querySelectorAll('#teamMembersContainer .member-firstname');

    let arrayNomi = [];
    for (let i = 0; i < inputsLastname.length; i++) {
        const cognome = inputsLastname[i].value.trim();
        const nome = inputsFirstname[i].value.trim();
        if (cognome && nome) {
            arrayNomi.push(`${cognome} ${nome}`);
        }
    }

    if (arrayNomi.length < 3) {
        return alert("Errore di convalida: Una squadra di Karate deve contenere almeno i 3 componenti iniziali obbligatori.");
    }

    let stringaAtleti = arrayNomi.join(', ');

    const payload = {
        event_id: idGaraKarate,
        society_id: idSocietaKarate,
        first_name: stringaAtleti,
        last_name: teamName,
        gender: teamGender, // "Maschile", "Femminile", "Mista (Mix)"
        classe: teamClasse,
        specialty: teamSpecialty, // Registrato con la specialità corretta per rientrare nel conteggio specialità
        belt: teamBelt,
        weight_category: 'Open',
        birthdate: '2026-01-01'
    };

    const { error } = await sbKarate.from('atleti').insert([payload]);
    if (error) {
        alert("Errore nell'inserimento della squadra: " + error.message);
    } else {
        alert("Squadra Karate inserita con successo!");
        document.getElementById('teamForm')?.reset();
        configuraInizialeSquadraKarate();
        popolaTabellaKarate();
    }
}

// --- POPOLAMENTO ED ELABORAZIONE CONTEGGI SPECIALI PER IL KARATE ---
async function popolaTabellaKarate() {
    const tbody = document.getElementById('iscrittiGaraList');
    if (!tbody) return;

    const elTotale = document.getElementById('totalAthleteCountDisplay');
    const elMaschi = document.getElementById('maleAthleteCountDisplay');
    const elFemmine = document.getElementById('femaleAthleteCountDisplay');
    const elSquadre = document.getElementById('teamAthleteCountDisplay');

    const { data, error } = await sbKarate.from('atleti')
        .select('*')
        .eq('event_id', idGaraKarate)
        .eq('society_id', idSocietaKarate)
        .order('created_at', { ascending: false });

    tbody.innerHTML = "";
    if (error || !data || !data.length) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-3">Nessun iscritto trovato per il Karate.</td></tr>`;
        if (elTotale) elTotale.innerText = "0";
        if (elMaschi) elMaschi.innerText = "0";
        if (elFemmine) elFemmine.innerText = "0";
        if (elSquadre) elSquadre.innerText = "0";
        return;
    }

    let contatoreTotale = 0;
    let contatoreMaschi = 0;
    let contatoreFemmine = 0;
    let contatoreSquadre = 0;

    data.forEach(a => {
        contatoreTotale++;
        
        // Verifica se si tratta di una squadra (tramite specialità contenente 'Squadra' o attributo cintura)
        if (a.specialty.toLowerCase().includes('squadra') || a.belt === 'Squadra') {
            contatoreSquadre++;
        } else {
            if (a.gender === 'Maschio') contatoreMaschi++;
            if (a.gender === 'Femmina') contatoreFemmine++;
        }

        tbody.innerHTML += `<tr>
            <td><strong>${a.last_name}</strong> ${a.first_name}</td>
            <td>${a.classe}</td>
            <td><span class="badge bg-light text-dark border">${a.gender}</span></td>
            <td>${a.specialty || '-'}</td>
            <td>${a.belt || '-'}</td>
            <td>${a.weight_category || '-'}</td>
        </tr>`;
    });

    // Scrittura dei risultati aggiornati a video
    if (elTotale) elTotale.innerText = contatoreTotale.toString();
    if (elMaschi) elMaschi.innerText = contatoreMaschi.toString();
    if (elFemmine) elFemmine.innerText = contatoreFemmine.toString();
    if (elSquadre) elSquadre.innerText = contatoreSquadre.toString();
}

// --- DISPATCHER AUTOMATICO DEGLI EVENTI DI PAGINA ---
document.addEventListener('DOMContentLoaded', () => {
    const path = window.location.pathname.toLowerCase();
    
    if (path.includes("karate")) {
        const formInd = document.getElementById('registrationForm');
        if (formInd) formInd.addEventListener('submit', salvaIscrizioneKarate);

        const formTeam = document.getElementById('teamForm');
        if (formTeam) formTeam.addEventListener('submit', salvaSquadraKarate);
        
        initDashboardKarate();
    }
});
