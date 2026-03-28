 // script.js
const { createClient } = window.supabase;
const supabaseUrl = 'https://nhsvadkqagsqgirvoibg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5oc3ZhZGtxYWdzcWdpcnZvaWJnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5NzQ1MjQsImV4cCI6MjA4NzU1MDUyNH0.v0PPOfmX1p_sHkV2ZwzaH8gxr7VwN9MMRB1AclEOhvQ';

// Inizializzazione del client Supabase
const supabaseClient = createClient(supabaseUrl, supabaseKey);

// Rendiamo il client globale per poterlo usare in altri piccoli script inline se necessario
window.supabaseClient = supabaseClient;

// --- FUNZIONE DI LOGIN ---
async function signIn(email, password) {
    try {
        const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (error) throw error;
        
        // REINDIRIZZAMENTO ALLA SCELTA EVENTO
        window.location.href = 'scelta-evento.html'; 
    } catch (error) {
        alert('Credenziali non valide.');
    }
}

// --- FUNZIONE DI REGISTRAZIONE ---
async function signUp(email, password, nomeSocieta, cfs, cell) {
    try {
        // 1. Registrazione dell'utente nel sistema di autenticazione di Supabase
        const { data, error } = await supabaseClient.auth.signUp({ email, password });
        if (error) throw error;

        // 2. Se l'utente è stato creato, inseriamo i dati aggiuntivi nella tabella 'societa'
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

// --- GESTIONE DEGLI EVENTI (LISTENER) ---
document.addEventListener('DOMContentLoaded', () => {
    
    // Gestione Form Login
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            signIn(email, password);
        });
    }

    // Gestione Form Registrazione
    const regForm = document.getElementById('registrazioneForm');
    if (regForm) {
        regForm.addEventListener('submit', (e) => {
            e.preventDefault();

            // Recupero di tutti i valori dai campi input
            const email = document.getElementById('email').value;
            const emailConfirm = document.getElementById('emailConfirm').value;
            const password = document.getElementById('password').value;
            const passwordConfirm = document.getElementById('passwordConfirm').value;
            const nomeSocieta = document.getElementById('nomeSocieta').value;
            const cfs = document.getElementById('cfs').value; // Codice Fiscale
            const cell = document.getElementById('cell').value; // Cellulare

            // --- VALIDAZIONE: Confronto Email ---
            if (email !== emailConfirm) {
                alert("Le email inserite non corrispondono!");
                return; // Interrompe l'invio
            }

            // --- VALIDAZIONE: Confronto Password ---
            if (password !== passwordConfirm) {
                alert("Le password inserite non corrispondono!");
                return; // Interrompe l'invio
            }

            // --- VALIDAZIONE: Lunghezza minima password ---
            if (password.length < 6) {
                alert("La password deve essere di almeno 6 caratteri.");
                return;
            }

            // Se i controlli sopra sono superati, invia i dati a Supabase
            signUp(email, password, nomeSocieta, cfs, cell);
        });
    }
});
