import { auth, db } from "./services/firebase.config.js";
import { addPlayersBulk, getPlayers } from "./services/firestore.service.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { collection, addDoc, getDocs, deleteDoc, doc, query, orderBy } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// 1. Candado de Seguridad y Arranque
onAuthStateChanged(auth, (user) => {
    if (!user || user.email !== "mecinfotec@gmail.com") {
        window.location.replace("login.html");
    } else {
        loadFixtures();
        loadPlayers();
    }
});

document.getElementById("logoutBtn").addEventListener("click", async () => {
    await signOut(auth);
    window.location.replace("index.html");
});

// ==========================================
// MÓDULO FIXTURES (EXISTENTE)
// ==========================================
document.getElementById("fixtureForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = document.getElementById("saveBtn");
    btn.textContent = "Guardando..."; btn.disabled = true;

    const fixtureData = {
        categoryId: document.getElementById("categoria").value,
        homeClubId: document.getElementById("condicion").value === "local" ? "Funebrero" : document.getElementById("rival").value.trim(),
        awayClubId: document.getElementById("condicion").value === "visita" ? "Funebrero" : document.getElementById("rival").value.trim(),
        date: document.getElementById("fecha").value,
        time: document.getElementById("hora").value || null,
        status: "scheduled",
        scoreLocal: null, scoreAway: null,
        createdAt: new Date().toISOString()
    };

    try {
        await addDoc(collection(db, "fixtures"), fixtureData);
        document.getElementById("fixtureForm").reset();
        await loadFixtures();
    } catch (error) { alert("Error al guardar el partido."); } 
    finally { btn.textContent = "Guardar Partido"; btn.disabled = false; }
});

async function loadFixtures() {
    const tbody = document.getElementById("fixturesList");
    try {
        const q = query(collection(db, "fixtures"), orderBy("date", "desc"));
        const snapshot = await getDocs(q);
        if (snapshot.empty) { tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#a3a3a3;">El fixture está vacío.</td></tr>'; return; }

        tbody.innerHTML = snapshot.docs.map(docSnap => {
            const f = docSnap.data();
            const homeStyle = f.homeClubId === 'Funebrero' ? 'color:#fff; font-weight:bold;' : 'color:#a3a3a3;';
            const awayStyle = f.awayClubId === 'Funebrero' ? 'color:#fff; font-weight:bold;' : 'color:#a3a3a3;';
            return `
                <tr>
                    <td><span style="background: rgba(220,38,38,0.2); color: #dc2626; padding: 4px 8px; border-radius: 4px; font-size: 0.8rem;">${f.categoryId}</span></td>
                    <td>${f.date} ${f.time ? '<br><span style="color:#a3a3a3; font-size:0.8rem;">'+f.time+'</span>' : ''}</td>
                    <td style="${homeStyle}">${f.homeClubId}</td>
                    <td style="${awayStyle}">${f.awayClubId}</td>
                    <td><button class="delete-btn" onclick="deleteFixture('${docSnap.id}')">Borrar</button></td>
                </tr>`;
        }).join("");
    } catch (error) { tbody.innerHTML = '<tr><td colspan="5">Error de lectura.</td></tr>'; }
}

window.deleteFixture = async (id) => {
    if (confirm("¿Eliminar este partido permanentemente?")) {
        await deleteDoc(doc(db, "fixtures", id));
        loadFixtures();
    }
};

// ==========================================
// MÓDULO CAJA MÁGICA: JUGADORES
// ==========================================
document.getElementById("playerForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = document.getElementById("savePlayersBtn");
    btn.textContent = "Procesando..."; btn.disabled = true;

    const category = document.getElementById("playerCategory").value;
    const text = document.getElementById("magicBox").value;
    const lines = text.split('\n');
    const playersToSave = [];

    lines.forEach(line => {
        const cleanLine = line.trim();
        if (!cleanLine) return;
        
        // Blindaje contra encabezados de Excel
        if (cleanLine.toLowerCase().includes("apellido") || cleanLine.toLowerCase().includes("fecha de nacimiento")) return;

        let parts = cleanLine.split('\t');
        if (parts.length < 2) parts = cleanLine.split(/ {2,}/);

        if (parts.length >= 2) {
            playersToSave.push({ name: parts[0].trim(), birthdate: parts[1].trim(), categoryId: category, clubId: "Funebrero", createdAt: new Date().toISOString() });
        } else {
            // Intento de rescate si copiaron con un solo espacio (busca el último espacio antes de la fecha)
            const lastSpace = cleanLine.lastIndexOf(' ');
            if (lastSpace > 0) {
                playersToSave.push({ name: cleanLine.substring(0, lastSpace).trim(), birthdate: cleanLine.substring(lastSpace + 1).trim(), categoryId: category, clubId: "Funebrero", createdAt: new Date().toISOString() });
            }
        }
    });

    if (playersToSave.length === 0) {
        alert("No se pudo detectar el formato. Copia Nombre y Fecha separados por un espacio o tabulación.");
        btn.textContent = "Procesar Plantel"; btn.disabled = false;
        return;
    }

    try {
        await addPlayersBulk(playersToSave);
        document.getElementById("magicBox").value = "";
        await loadPlayers();
        alert(`Se cargaron ${playersToSave.length} jugadores en ${category}.`);
    } catch(err) { alert("Error al guardar en la base de datos."); } 
    finally { btn.textContent = "Procesar Plantel"; btn.disabled = false; }
});

async function loadPlayers() {
    const container = document.getElementById("playersListContainer");
    try {
        const players = await getPlayers();
        if(players.length === 0) { container.innerHTML = "<p style='color:#a3a3a3;'>No hay jugadores registrados.</p>"; return; }

        // Apilar por categoría
        const grouped = {};
        players.forEach(p => {
            if(!grouped[p.categoryId]) grouped[p.categoryId] = [];
            grouped[p.categoryId].push(p);
        });

        let html = "";
        Object.keys(grouped).sort().forEach(cat => {
            html += `<h4 class="cat-header">Categoría ${cat} <span style="color:#a3a3a3; font-size:0.8rem;">(${grouped[cat].length} jugadores)</span></h4>`;
            html += `<table>
                        <thead><tr><th>Nombre Completo</th><th>Fecha Nac.</th><th style="text-align:right;">Acción</th></tr></thead>
                        <tbody>`;
            grouped[cat].forEach(p => {
                html += `<tr>
                            <td style="font-weight:600;">${p.name}</td>
                            <td style="color:#a3a3a3;">${p.birthdate}</td>
                            <td style="text-align:right;"><button class="delete-btn" onclick="deletePlayer('${p.id}')">Eliminar</button></td>
                         </tr>`;
            });
            html += `</tbody></table>`;
        });
        container.innerHTML = html;
    } catch(e) { container.innerHTML = "<p style='color:#ff3b3b;'>Error al cargar los planteles.</p>"; }
}

window.deletePlayer = async (id) => {
    if(confirm("¿Eliminar este jugador del plantel?")) {
        await deleteDoc(doc(db, "players", id));
        loadPlayers();
    }
};