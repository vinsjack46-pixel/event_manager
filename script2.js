// ==========================================
// SCRIPT2.JS - VERSIONE 6.0 (MOTORE MULTI-SPORT)
// ==========================================
const sb = window.supabaseClient;
window.currentSocietyId = null;

// Fallback Storico e Sicuro della versione 5.9 (Karate Consolidato)
const CONFIGURAZIONE_FALLBACK_KARATE = {
    richiede_peso: true,
    etichetta_livello: "Cintura",
    regole: {
        limiti: { "KataKumiteSum": 300, "ParaKarate": 50, "KIDS": 250 },
        classi_eta: [
            {"nome": "U10", "anno_min": 2017, "anno_max": 2018, "cinture": ["Bianca/Gialla", "Arancio/Verde", "Blu/Marrone"], "specialita": ["Kata", "Kumite", "ParaKarate", "Combinata"]},
            {"nome": "U12", "anno_min": 2015, "anno_max": 2016, "cinture": ["Bianca/Gialla", "Arancio/Verde", "Blu/Marrone"], "specialita": ["Kata", "Kumite", "ParaKarate", "Combinata"]},
            {"nome": "Esordienti", "anno_min": 2013, "anno_max": 2014, "cinture": ["Bianca/Gialla", "Arancio/Verde", "Blu/Marrone/Nera"], "specialita": ["Kata", "Kumite", "ParaKarate"]},
            {"nome": "Cadetti", "anno_min": 2011, "anno_max": 2012, "cinture": ["Bianca/Gialla/Arancio", "Verde/Blu", "Marrone/Nera"], "specialita": ["Kata", "Kumite", "ParaKarate"]},
            {"nome": "Juniores", "anno_min": 2009, "anno_max": 2010, "cinture": ["Bianca/Gialla/Arancio", "Verde/Blu", "Marrone/Nera"], "specialita": ["Kata", "Kumite", "ParaKarate"]},
            {"nome": "Seniores", "anno_min": 1991, "anno_max": 2008, "cinture": ["Bianca/Gialla/Arancio", "Verde/Blu", "Marrone/Nera"], "specialita": ["Kata", "Kumite", "ParaKarate"]},
            {"nome": "Master", "anno_min": 1960, "anno_max": 1990, "cinture": ["Bianca/Gialla/Arancio", "Verde/Blu", "Marrone/Nera"], "specialita": ["Kata", "Kumite", "ParaKarate"]}
        ],
        pesi: {
            "Esordienti": {
                "Maschio": ["-40", "-45", "-50", "-55", "55+"],
                "Femmina": ["-42", "-47", "-52", "52+"]
            },
            "U12": {
                "Maschio": ["-32", "-37", "-42", "-47", "47+"],
                "Femmina": ["-32", "-37", "-42", "-47", "47+"]
            },
            "U10": {
                "Maschio": ["-22", "-27", "-32", "-37", "37+"],
                "Femmina": ["-22", "-27", "-32", "-37", "37+"]
            },
            "Default": ["Open"]
        }
    }
};

// Contenitore Globale della configurazione attiva dell'evento corrente
window.sportConfig = CONFIGURAZIONE_FALLBACK_KARATE;

// --- INIZIALIZZAZIONE PAGINA ---
async function initPage() {
    const eventId = sessionStorage.getItem('selectedEventId');
    const eventName = sessionStorage.getItem('selectedEventName');
    
    if (!eventId) {
        window.location.href = "scelta-evento.html";
        return;
    }

    if(document.getElementById('selectedEventId')) document.getElementById('selectedEventId').value = eventId;
    if(document.getElementById('eventNameDisplay')) document.getElementById('eventNameDisplay').innerText = eventName;

    // 1. CARICA IL CERVELLO DELLO SPORT DINAMICO DA SUPABASE V6.0
    await caricaConfigurazioneSport();

    // 2. RECUPERA DATI UTENTE LOGGATO
    const { data: { user } } = await sb.auth.getUser();
    if (user) {
        const { data: soc } = await sb.from('societa').select('*').eq('user_id', user.id).single();
        if (soc) {
            window.currentSocietyId = soc.id;
            if(document.getElementById('societyNameDisplay')) document.getElementById('societyNameDisplay').innerText = soc.nome;
            
            // 3. ASSEGNA GLI EVENTI DI CAMBIO INPUT PER IL FORM DINAMICO
            configuraListenersForm();

            // 4. SCARICA GLI ISCRITTI
            await fetchAthletes();
            await fetchTeams();
        }
    }
}

// --- CARICAMENTO CONFIGURAZIONE SPORTIVA DA SUPABASE ---
async function caricaConfigurazioneSport() {
    const sportId = sessionStorage.getItem('selectedSportId') || 'karate';
    
    try {
        const { data, error } = await sb
            .from('configurazioni_sport')
            .select('*')
            .eq('sport_id', sportId)
            .single();

        if (data && !error) {
            // Decodifica se memorizzato come stringa o prendi l'oggetto JSONB direttamente
            const regoleDecodificate = typeof data.regole === 'string' ? JSON.parse(data.regole) : data.regole;
            
            window.sportConfig = {
                richiede_peso: data.richiede_peso,
                etichetta_livello: data.etichetta_livello || 'Cintura',
                regole: regoleDecodificate
            };
            console.log(`✅ Configurazione Multi-Sport V6.0 per [${sportId.toUpperCase()}] caricata.`);
        } else {
            console.warn("⚠️ Configurazione non trovata. Attivazione Fallback Karate V5.9 standard.");
            window.sportConfig = CONFIGURAZIONE_FALLBACK_KARATE;
        }
    } catch (err) {
        console.error("❌ Errore critico download configurazione sport, uso Fallback:", err);
        window.sportConfig = CONFIGURAZIONE_FALLBACK_KARATE;
    }

    // Trasforma graficamente l'HTML dell'interfaccia utente in base allo sport
    adattaInterfacciaAlloSport();
}

// --- ADATTAMENTO INTERFACCIA GRAFICA (LABEL E PESO) ---
function adattaInterfacciaAlloSport() {
    const etichetta = window.sportConfig.etichetta_livello;
    const richiedePeso = window.sportConfig.richiede_peso;

    // Modifica dinamicamente i testi delle label dei Form (Individuale e Team)
    const labelsGrado = document.querySelectorAll('label[for="belt"], label[for="teamBelt"], .lbl-cintura-dinamica');
    labelsGrado.forEach(lbl => lbl.innerText = etichetta);

    // Modifica i Placeholder o le intestazioni delle colonne tabelle
    document.querySelectorAll('th').forEach(th => {
        if (th.innerText.trim() === 'Cintura') th.innerText = etichetta;
    });

    // Mostra o nasconde i campi del peso in tutto il documento
    const bloccoPesoAtleta = document.getElementById('weight')?.closest('.col-md-3, .col-md-4, .mb-3');
    const bloccoPesoTeam = document.getElementById('teamWeight')?.closest('.col-md-3, .col-md-4, .mb-3');
    
    if (bloccoPesoAtleta) bloccoPesoAtleta.style.display = richiedePeso ? 'block' : 'none';
    if (bloccoPesoTeam) bloccoPesoTeam.style.display = richiedePeso ? 'block' : 'none';

    // Nasconde la colonna peso dalle tabelle riepilogative se lo sport non lo prevede
    if (!richiedePeso) {
        document.querySelectorAll('th').forEach(th => {
            if (th.innerText.trim() === 'Peso') th.style.display = 'none';
        });
    }
}

// --- CONFIGURAZIONE LISTENERS DINAMICI SUL FORM ---
function configuraListenersForm() {
    // Agganciamento eventi Atleti Individuali
    const inputAnno = document.getElementById('birthYear') || document.getElementById('annoNascita');
    const selectSesso = document.getElementById('gender');
    
    if (inputAnno) {
        inputAnno.addEventListener('input', () => elaboraCambioRegole(false));
    }
    if (selectSesso) {
        selectSesso.addEventListener('change', () => aggiornaSezionePesi(false));
    }

    // Agganciamento eventi Squadre / Team (se gestito tramite anno o selezione diretta)
    // Se il tuo HTML per i team ha una selezione della classe, popoliamola preventivamente
    popolaClassiPerTeam();
    
    const selectTeamClasse = document.getElementById('teamClasse');
    const selectTeamSesso = document.getElementById('teamGender');
    if (selectTeamClasse) {
        selectTeamClasse.addEventListener('change', () => {
            elaboraCambioRegoleTeam();
            aggiornaSezionePesi(true);
        });
    }
    if (selectTeamSesso) {
        selectTeamSesso.addEventListener('change', () => aggiornaSezionePesi(true));
    }
}

// --- POPOLA LE CLASSI NEL DROP-DOWN DEI TEAM ALL'AVVIO ---
function popolaClassiPerTeam() {
    const selectTeamClasse = document.getElementById('teamClasse');
    if (!selectTeamClasse || selectTeamClasse.tagName !== 'SELECT') return;

    const classi = window.sportConfig.regole.classi_eta || [];
    selectTeamClasse.innerHTML = '<option value="">Seleziona Classe...</option>';
    classi.forEach(c => {
        selectTeamClasse.innerHTML += `<option value="${c.nome}">${c.nome}</option>`;
    });
}

// --- CALCOLO CLASSE ED ELABORAZIONE OPZIONI OPZIONALI (ATLETI INDIVIDUALI) ---
function elaboraCambioRegole(isTeam = false) {
    const inputAnno = document.getElementById('birthYear') || document.getElementById('annoNascita');
    if (!inputAnno) return;

    const anno = parseInt(inputAnno.value);
    const campoClasse = document.getElementById('classe');
    const selectSpecialita = document.getElementById('specialty');
    const selectGrado = document.getElementById('belt');

    if (isNaN(anno) || inputAnno.value.length < 4) {
        if(campoClasse) campoClasse.value = "";
        return;
    }

    // Cerca la classe d'età corrispondente nel JSON dello sport attivo
    const classi = window.sportConfig.regole.classi_eta || [];
    const classeTrovata = classi.find(c => anno >= c.anno_min && anno <= c.anno_max);

    if (!classeTrovata) {
        if(campoClasse) campoClasse.value = "Non Ammesso";
        if(selectSpecialita) selectSpecialita.innerHTML = '<option value="">--</option>';
        if(selectGrado) selectGrado.innerHTML = '<option value="">--</option>';
        return;
    }

    if(campoClasse) campoClasse.value = classeTrovata.nome;

    // Popola tendina Specialità dello sport corrente
    if (selectSpecialita) {
        selectSpecialita.innerHTML = '<option value="">Seleziona...</option>';
        classeTrovata.specialita.forEach(sp => {
            selectSpecialita.innerHTML += `<option value="${sp}">${sp}</option>`;
        });
    }

    // Popola tendina Cinture / Gradi dello sport corrente
    if (selectGrado) {
        selectGrado.innerHTML = '<option value="">Seleziona...</option>';
        classeTrovata.cinture.forEach(cin => {
            selectGrado.innerHTML += `<option value="${cin}">${cin}</option>`;
        });
    }

    // Rigenera i pesi in base alla classe trovata
    aggiornaSezionePesi(false);
}

// --- ELABORAZIONE REGOLE PER SQUADRE (QUANDO CAMBIA LA CLASSE) ---
function elaboraCambioRegoleTeam() {
    const selectTeamClasse = document.getElementById('teamClasse');
    const selectTeamSpec = document.getElementById('teamSpecialty');
    const selectTeamBelt = document.getElementById('teamBelt');

    if (!selectTeamClasse || !selectTeamClasse.value) return;

    const classeNome = selectTeamClasse.value;
    const classi = window.sportConfig.regole.classi_eta || [];
    const classeTrovata = classi.find(c => c.nome === classeNome);

    if (classeTrovata) {
        if (selectTeamSpec) {
            selectTeamSpec.innerHTML = '<option value="">Seleziona...</option>';
            classeTrovata.specialita.forEach(sp => selectTeamSpec.innerHTML += `<option value="${sp}">${sp}</option>`);
        }
        if (selectTeamBelt) {
            selectTeamBelt.innerHTML = '<option value="">Seleziona...</option>';
            classeTrovata.cinture.forEach(b => selectTeamBelt.innerHTML += `<option value="${b}">${b}</option>`);
        }
    }
}

// --- AGGIORNAMENTO SEZIONE PESI DINAMICA ---
function aggiornaSezionePesi(isTeam = false) {
    if (!window.sportConfig.richiede_peso) return;

    const classeNome = document.getElementById(isTeam ? 'teamClasse' : 'classe')?.value;
    const sesso = document.getElementById(isTeam ? 'teamGender' : 'gender')?.value;
    const selectPeso = document.getElementById(isTeam ? 'teamWeight' : 'weight');

    if (!selectPeso) return;

    if (!classeNome || !sesso || classeNome === "Non Ammesso") {
        selectPeso.innerHTML = '<option value="">Scegli classe e sesso...</option>';
        return;
    }

    const pesiConfig = window.sportConfig.regole.pesi || {};
    let opzioniPeso = [];

    // Cerca se ci sono pesi specifici per Classe -> Sesso, altrimenti va in Open
    if (pesiConfig[classeNome] && pesiConfig[classeNome][sesso]) {
        opzioniPeso = pesiConfig[classeNome][sesso];
    } else {
        opzioniPeso = pesiConfig["Default"] || ["Open"];
    }

    selectPeso.innerHTML = '<option value="">Seleziona Peso...</option>';
    opzioniPeso.forEach(p => {
        selectPeso.innerHTML += `<option value="${p}">${p}</option>`;
    });
}

// --- GESTIONE CONTATORI E LIMITI SULLA DASHBOARD V6.0 ---
function ricalcolaLimitiEContatori(atleti, squadre) {
    const limiti = window.sportConfig.regole.limiti || { "KataKumiteSum": 999, "ParaKarate": 999, "KIDS": 999 };
    
    let contatoreGenericoGare = 0;
    let contatorePara = 0;
    let contatoreKids = 0;

    // Conteggio Atleti Individuali
    atleti.forEach(a => {
        if (a.specialty === 'ParaKarate' || a.classe === 'ParaKarate') contatorePara++;
        else if (['U10', 'U12', 'KIDS'].includes(a.classe)) contatoreKids++;
        else contatoreGenericoGare++;
    });

    // Conteggio Squadre
    squadre.forEach(t => {
        if (['U10', 'U12', 'KIDS'].includes(t.classe)) contatoreKids++;
        else contatoreGenericoGare++;
    });

    // Aggiornamento Box Statistiche se presenti nell'HTML
    const boxKataKumite = document.getElementById('KataKumiteCountDisplay');
    if (boxKataKumite) boxKataKumite.innerText = `${contatoreGenericoGare} / ${limiti.KataKumiteSum || '∞'}`;

    const boxPara = document.getElementById('ParaCountDisplay') || document.getElementById('ParaKarateCountDisplay');
    if (boxPara) boxPara.innerText = `${contatorePara} / ${limiti.ParaKarate || '∞'}`;

    const boxKids = document.getElementById('KIDSAthleteCountDisplay');
    if (boxKids) boxKids.innerText = `${contatoreKids} / ${limiti.KIDS || '∞'}`;

    // Aggiornamento Badge riepilogativi generali delle tabelle
    if(document.getElementById('totalAthletesDisplay')) document.getElementById('totalAthletesDisplay').innerText = atleti.length;
    if(document.getElementById('totalTeamsDisplay')) document.getElementById('totalTeamsDisplay').innerText = squadre.length;
}

// --- RECUPERO ATLETI DA SUPABASE ---
async function fetchAthletes() {
    const eventId = sessionStorage.getItem('selectedEventId');
    const { data: atleti, error } = await sb
        .from('atleti')
        .select('*')
        .eq('society_id', window.currentSocietyId)
        .eq('event_id', eventId);

    if (error) return console.error("Errore fetch atleti:", error.message);

    const tbody = document.getElementById('athleteList');
    if(!tbody) return;
    tbody.innerHTML = "";

    atleti.forEach(a => {
        tbody.innerHTML += `
            <tr>
                <td><strong>${a.last_name}</strong> ${a.first_name}<br><small class="text-muted">Anno: ${a.birth_year}</small></td>
                <td><span class="badge bg-secondary">${a.classe}</span></td>
                <td>${a.gender}</td>
                <td><span class="badge bg-info text-dark">${a.specialty}</span></td>
                <td>${a.belt}</td>
                <td style="${window.sportConfig.richiede_peso ? '' : 'display:none;'}">${a.weight_category || '-'}</td>
                <td class="text-end">
                    <button class="btn btn-sm btn-outline-danger" onclick="deleteAthlete('${a.id}')">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </td>
            </tr>
        `;
    });

    // Avvia ricalcolo contatori incrociato
    triggerAggiornamentoGlobaleContatori();
}

// --- RECUPERO SQUADRE DA SUPABASE ---
async function fetchTeams() {
    const eventId = sessionStorage.getItem('selectedEventId');
    const { data: squadre, error } = await sb
        .from('squadre')
        .select('*')
        .eq('society_id', window.currentSocietyId)
        .eq('event_id', eventId);

    if (error) return console.error("Errore fetch team:", error.message);

    const tbody = document.getElementById('teamList');
    if(!tbody) return;
    tbody.innerHTML = "";

    squadre.forEach(t => {
        const membriStringa = t.members ? t.members.join(', ') : '-';
        tbody.innerHTML += `
            <tr>
                <td><strong>${t.team_name}</strong><br><small class="text-muted">Membri: ${membriStringa}</small></td>
                <td><span class="badge bg-secondary">${t.classe}</span></td>
                <td>${t.gender}</td>
                <td><span class="badge bg-info text-dark">${t.specialty}</span></td>
                <td>${t.belt || '-'}</td>
                <td style="${window.sportConfig.richiede_peso ? '' : 'display:none;'}">${t.weight_category || '-'}</td>
                <td class="text-end">
                    <button class="btn btn-sm btn-outline-danger" onclick="deleteTeam('${t.id}')">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </td>
            </tr>
        `;
    });

    triggerAggiornamentoGlobaleContatori();
}

// --- TRIGGER AGGIORNAMENTO GLOBALE DEI LIMITI ---
async function triggerAggiornamentoGlobaleContatori() {
    const eventId = sessionStorage.getItem('selectedEventId');
    const { data: atleti } = await sb.from('atleti').select('*').eq('society_id', window.currentSocietyId).eq('event_id', eventId);
    const { data: squadre } = await sb.from('squadre').select('*').eq('society_id', window.currentSocietyId).eq('event_id', eventId);
    if(atleti && squadre) {
        ricalcolaLimitiEContatori(atleti, squadre);
    }
}

// --- ELIMINAZIONE ATLETA ---
async function deleteAthlete(id) {
    if(confirm("Sei sicuro di voler cancellare questo atleta?")) {
        const { error } = await sb.from('atleti').delete().eq('id', id);
        if(!error) {
            await fetchAthletes();
        } else {
            alert("Errore durante l'eliminazione: " + error.message);
        }
    }
}

// --- ELIMINAZIONE SQUADRA ---
async function deleteTeam(id) {
    if(confirm("Sei sicuro di voler cancellare questa squadra?")) {
        const { error } = await sb.from('squadre').delete().eq('id', id);
        if(!error) {
            await fetchTeams();
        } else {
            alert("Errore durante l'eliminazione: " + error.message);
        }
    }
}

// --- TOGGLE INTERFACCIA INDIVIDUALE / TEAM ---
function toggleRegMode() {
    const isTeam = document.querySelector('input[name="regType"]:checked').value === 'team';
    const indFields = document.getElementById('individualFields');
    const teamFields = document.getElementById('teamFields');

    if (isTeam) {
        if(indFields) indFields.style.display = 'none';
        if(teamFields) teamFields.style.display = 'block';
    } else {
        if(indFields) indFields.style.display = 'block';
        if(teamFields) teamFields.style.display = 'none';
    }
}

// --- ESPORTAZIONE DATI IN FORMATO CSV ---
async function exportToCSV() {
    const eventId = sessionStorage.getItem('selectedEventId');
    
    const { data: athletes } = await sb.from('atleti').select('*').eq('society_id', window.currentSocietyId).eq('event_id', eventId);
    const { data: teams } = await sb.from('squadre').select('*').eq('society_id', window.currentSocietyId).eq('event_id', eventId);

    if ((!athletes || athletes.length === 0) && (!teams || teams.length === 0)) {
        return alert("Nessun dato presente da esportare.");
    }

    const etichettaGrado = window.sportConfig.etichetta_livello;
    let csv = [`TIPO;NOME/TEAM;MEMBRI;CLASSE;SPECIALITA;${etichettaGrado.toUpperCase()};SESSO;PESO`];

    if(athletes) {
        athletes.forEach(a => {
            csv.push(`"Individuale";"${a.last_name} ${a.first_name}";"-";"${a.classe}";"${a.specialty}";"${a.belt}";"${a.gender}";"${a.weight_category || '-'}"`);
        });
    }

    if(teams) {
        teams.forEach(t => {
            const membri = t.members ? t.members.join(' - ') : "-";
            csv.push(`"Team";"${t.team_name}";"${membri}";"${t.classe}";"${t.specialty}";"${t.belt || '-'}";"${t.gender}";"${t.weight_category || '-'}"`);
        });
    }

    const blob = new Blob(["\uFEFF" + csv.join("\n")], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const nomeEvento = sessionStorage.getItem('selectedEventName') || "Evento";
    
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", `Iscritti_${nomeEvento.replace(/[^a-z0-9]/gi, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Avvia tutto all'apertura del documento
document.addEventListener('DOMContentLoaded', initPage);
