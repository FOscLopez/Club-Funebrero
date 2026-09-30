import { auth, db } from "./services/firebase.config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { collection, addDoc, getDocs, deleteDoc, doc, query, orderBy } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// 1. Candado de Seguridad
onAuthStateChanged(auth, (user) => {
    if (!user || user.email !== "mecinfotec@gmail.com") {
        window.location.replace("login.html");
    } else {
        loadFixtures();
    }
});

// 2. Cerrar Sesión
document.getElementById("logoutBtn").addEventListener("click", async () => {
    await signOut(auth);
    window.location.replace("index.html");
});

// 3. Crear Partido Nuevo
document.getElementById("fixtureForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = document.getElementById("saveBtn");
    btn.textContent = "Guardando...";
    btn.disabled = true;

    const categoria = document.getElementById("categoria").value;
    const condicion = document.getElementById("condicion").value;
    const rival = document.getElementById("rival").value.trim();
    const fecha = document.getElementById("fecha").value;
    const hora = document.getElementById("hora").value;

    const fixtureData = {
        categoryId: categoria,
        homeClubId: condicion === "local" ? "Funebrero" : rival,
        awayClubId: condicion === "visita" ? "Funebrero" : rival,
        date: fecha,
        time: hora || null,
        status: "scheduled",
        scoreLocal: null,
        scoreAway: null,
        createdAt: new Date().toISOString()
    };

    try {
        await addDoc(collection(db, "fixtures"), fixtureData);
        document.getElementById("fixtureForm").reset();
        await loadFixtures();
    } catch (error) {
        console.error("Error al guardar:", error);
        alert("Ocurrió un error al conectar con la base de datos.");
    } finally {
        btn.textContent = "Guardar Partido en Fixture";
        btn.disabled = false;
    }
});

// 4. Leer Partidos (Tabla)
async function loadFixtures() {
    const tbody = document.getElementById("fixturesList");
    
    try {
        const q = query(collection(db, "fixtures"), orderBy("date", "desc"));
        const snapshot = await getDocs(q);
        
        if (snapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#a3a3a3;">El fixture está vacío. Programa un partido arriba.</td></tr>';
            return;
        }

        tbody.innerHTML = snapshot.docs.map(docSnap => {
            const f = docSnap.data();
            const homeStyle = f.homeClubId === 'Funebrero' ? 'color:#fff; font-weight:bold;' : 'color:#a3a3a3;';
            const awayStyle = f.awayClubId === 'Funebrero' ? 'color:#fff; font-weight:bold;' : 'color:#a3a3a3;';
            
            return `
                <tr>
                    <td><span style="background: rgba(220,38,38,0.2); color: #dc2626; padding: 4px 8px; border-radius: 4px; font-weight: bold; font-size: 0.8rem;">${f.categoryId}</span></td>
                    <td>${f.date} ${f.time ? '<br><span style="color:#a3a3a3; font-size:0.8rem;">'+f.time+'</span>' : ''}</td>
                    <td style="${homeStyle}">${f.homeClubId}</td>
                    <td style="${awayStyle}">${f.awayClubId}</td>
                    <td><button class="delete-btn" onclick="deleteFixture('${docSnap.id}')">Borrar</button></td>
                </tr>
            `;
        }).join("");
    } catch (error) {
        console.error("Error al cargar:", error);
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#ff3b3b;">Error de lectura de base de datos.</td></tr>';
    }
}

// 5. Borrar Partido
window.deleteFixture = async (id) => {
    if (confirm("¿Estás seguro de eliminar permanentemente este encuentro?")) {
        try {
            await deleteDoc(doc(db, "fixtures", id));
            loadFixtures();
        } catch (error) {
            console.error("Error al eliminar:", error);
            alert("No se pudo eliminar el partido.");
        }
    }
};