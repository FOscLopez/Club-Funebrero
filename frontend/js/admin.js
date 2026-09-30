import { auth, db } from "./services/firebase.config.js";
import { addPlayersBulk, getPlayers, updatePlayer, deletePlayer, getFixtures, updateFixture, deleteFixture } from "./services/firestore.service.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { collection, addDoc, getDocs, doc, query, orderBy, where, writeBatch } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const allowedAdmins = ["mecinfotec@gmail.com", "admin@abnch.com", "admin@reydigital.com"];
const IMGBB_API_KEY = "4b6599a15cc7870198cb96ee95df9905";

let allFixturesCache = [];
let currentEditTarget = { id: null, type: null }; 

// =========================================
// ESTADO DEL ORDENAMIENTO DE LA TABLA
// =========================================
let currentSort = { column: 'createdAt', direction: 'desc' };

window.setSort = (column) => {
    if (currentSort.column === column) {
        currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
    } else {
        currentSort.column = column;
        currentSort.direction = 'asc'; 
    }
    
    // Actualizar color e ícono de las flechitas visuales (Color Azul Admin)
    document.getElementById("sortCatArrow").textContent = currentSort.column === 'category' ? (currentSort.direction === 'asc' ? '↑' : '↓') : '↕';
    document.getElementById("sortCatArrow").style.color = currentSort.column === 'category' ? '#3b82f6' : '#94a3b8';
    
    document.getElementById("sortRoundArrow").textContent = currentSort.column === 'round' ? (currentSort.direction === 'asc' ? '↑' : '↓') : '↕';
    document.getElementById("sortRoundArrow").style.color = currentSort.column === 'round' ? '#3b82f6' : '#94a3b8';
    
    document.getElementById("sortTeamsArrow").textContent = currentSort.column === 'teams' ? (currentSort.direction === 'asc' ? '↑' : '↓') : '↕';
    document.getElementById("sortTeamsArrow").style.color = currentSort.column === 'teams' ? '#3b82f6' : '#94a3b8';
    
    renderFixturesTable();
};

onAuthStateChanged(auth, (user) => {
    if (!user || !allowedAdmins.includes(user.email)) {
        window.location.replace("index.html");
    } else {
        loadFixtures();
        loadPlayers();
    }
});

document.getElementById("logoutBtn").addEventListener("click", async () => {
    await signOut(auth);
    window.location.replace("index.html");
});

document.getElementById("fixtureForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = document.getElementById("saveBtn");
    btn.textContent = "Guardando..."; btn.disabled = true;

    const fixtureData = {
        categoryId: document.getElementById("categoria").value,
        homeClubId: document.getElementById("condicion").value === "local" ? "Funebrero" : document.getElementById("rival").value.trim(),
        awayClubId: document.getElementById("condicion").value === "visita" ? "Funebrero" : document.getElementById("rival").value.trim(),
        round: "A definir",
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

document.getElementById("magicFixtureForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = document.getElementById("saveMagicFixturesBtn");
    btn.textContent = "Procesando..."; btn.disabled = true;

    const category = document.getElementById("magicFixtureCategory").value;
    const text = document.getElementById("magicFixtureBox").value;
    const lines = text.split('\n');
    const fixturesToSave = [];

    lines.forEach(line => {
        const cleanLine = line.trim();
        if (!cleanLine || cleanLine.toUpperCase().includes("LIBRE")) return;

        const matchVs = cleanLine.toUpperCase().split(" VS ");
        if (matchVs.length === 2) {
            const firstPart = matchVs[0].trim();
            const spaceIndex = firstPart.indexOf(" ");
            let round = "A definir";
            let home = firstPart;
            
            if (spaceIndex > -1 && !isNaN(firstPart.substring(0, spaceIndex))) {
                round = "Fecha " + firstPart.substring(0, spaceIndex);
                home = firstPart.substring(spaceIndex + 1).trim();
            }

            home = home.replace("S. ZAPALLAR", "S. Zapallar").replace("FUNEBRERO", "Funebrero");
            const away = matchVs[1].trim().replace("S. ZAPALLAR", "S. Zapallar").replace("FUNEBRERO", "Funebrero");

            fixturesToSave.push({
                categoryId: category,
                homeClubId: home,
                awayClubId: away,
                round: round,
                date: "A definir",
                time: "",
                status: "scheduled",
                scoreLocal: null, scoreAway: null,
                createdAt: new Date().toISOString()
            });
        }
    });

    if (fixturesToSave.length === 0) {
        alert("No se detectaron partidos.");
        btn.textContent = "Procesar Fixture"; btn.disabled = false;
        return;
    }

    try {
        const q = query(collection(db, "fixtures"), where("categoryId", "==", category));
        const existingSnap = await getDocs(q);
        const batch = writeBatch(db);
        
        existingSnap.forEach(docSnap => {
            const d = docSnap.data();
            const matchExists = fixturesToSave.find(f => 
                (f.homeClubId.toUpperCase() === d.homeClubId.toUpperCase() && f.awayClubId.toUpperCase() === d.awayClubId.toUpperCase()) ||
                (f.homeClubId.toUpperCase() === d.awayClubId.toUpperCase() && f.awayClubId.toUpperCase() === d.homeClubId.toUpperCase())
            );
            if (matchExists && d.date === "A definir") {
                batch.delete(docSnap.ref);
            }
        });

        fixturesToSave.forEach(f => {
            const newRef = doc(collection(db, "fixtures"));
            batch.set(newRef, f);
        });

        await batch.commit();
        document.getElementById("magicFixtureBox").value = "";
        await loadFixtures();
        alert(`Se cargaron ${fixturesToSave.length} partidos.`);
    } catch (err) { alert("Error al procesar."); } 
    finally { btn.textContent = "Procesar Fixture"; btn.disabled = false; }
});

document.getElementById("playerForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = document.getElementById("savePlayersBtn");
    btn.textContent = "Procesando..."; btn.disabled = true;

    const category = document.getElementById("playerCategory").value;
    const text = document.getElementById("magicBox").value;
    const lines = text.split('\n');
    const playersToSave = [];

    lines.forEach(line => {
        let cleanLine = line.trim();
        if (!cleanLine || cleanLine.toLowerCase().includes("apellido") || cleanLine.toLowerCase().includes("fecha de nacimiento")) return;

        cleanLine = cleanLine.replace(/\b\d{1,2}[\.\-]?\d{3}[\.\-]?\d{3}\b/g, "").replace(/\s{2,}/g, " ").trim();

        let parts = cleanLine.split('\t');
        if (parts.length < 2) parts = cleanLine.split(/ {2,}/);

        if (parts.length >= 2) {
            playersToSave.push({ name: parts[0].trim(), birthdate: parts[1].trim(), categoryId: category, clubId: "Funebrero", createdAt: new Date().toISOString() });
        } else {
            const lastSpace = cleanLine.lastIndexOf(' ');
            if (lastSpace > 0) {
                playersToSave.push({ name: cleanLine.substring(0, lastSpace).trim(), birthdate: cleanLine.substring(lastSpace + 1).trim(), categoryId: category, clubId: "Funebrero", createdAt: new Date().toISOString() });
            }
        }
    });

    if (playersToSave.length === 0) {
        alert("Formato no reconocido. Asegurate de que quede Nombre y Fecha.");
        btn.textContent = "Procesar Plantel"; btn.disabled = false;
        return;
    }

    try {
        await addPlayersBulk(playersToSave);
        document.getElementById("magicBox").value = "";
        await loadPlayers();
        alert(`Se cargaron ${playersToSave.length} jugadores.`);
    } catch(err) { alert("Error al guardar."); } 
    finally { btn.textContent = "Procesar Plantel"; btn.disabled = false; }
});

// =========================================
// RENDERIZADO INTERACTIVO DE FIXTURES
// =========================================
async function loadFixtures() {
    const tbody = document.getElementById("fixturesList");
    try {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Cargando base de datos...</td></tr>';
        const q = query(collection(db, "fixtures"), orderBy("createdAt", "desc"));
        const snapshot = await getDocs(q);
        
        allFixturesCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderFixturesTable();
    } catch (error) { 
        tbody.innerHTML = '<tr><td colspan="5">Error de lectura.</td></tr>'; 
    }
}

function renderFixturesTable() {
    const tbody = document.getElementById("fixturesList");
    
    if (allFixturesCache.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#a3a3a3;">El fixture está vacío.</td></tr>';
        return;
    }

    // Copiamos la caché para ordenar sin mutar el original de Firebase
    let sortedFixtures = [...allFixturesCache];

    // Lógica Matemática de Ordenamiento
    sortedFixtures.sort((a, b) => {
        let valA, valB;
        
        if (currentSort.column === 'category') {
            valA = (a.categoryId || '').toLowerCase();
            valB = (b.categoryId || '').toLowerCase();
        } else if (currentSort.column === 'round') {
            // Extrae el número de la Fase para ordenarlo matemáticamente (ej: Fecha 10 va después de Fecha 2)
            const numA = parseInt((a.round || '').replace(/\D/g, '')) || 999;
            const numB = parseInt((b.round || '').replace(/\D/g, '')) || 999;
            if (numA !== numB) {
                return currentSort.direction === 'asc' ? numA - numB : numB - numA;
            }
            // Si no hay números (ej: "A definir"), ordena alfabéticamente
            valA = (a.round || '').toLowerCase();
            valB = (b.round || '').toLowerCase();
        } else if (currentSort.column === 'teams') {
            valA = (a.homeClubId || '').toLowerCase();
            valB = (b.homeClubId || '').toLowerCase();
        } else {
            valA = (a.createdAt || '').toLowerCase();
            valB = (b.createdAt || '').toLowerCase();
        }

        if (valA < valB) return currentSort.direction === 'asc' ? -1 : 1;
        if (valA > valB) return currentSort.direction === 'asc' ? 1 : -1;
        return 0;
    });

    // Renderizamos la tabla ordenada
    tbody.innerHTML = sortedFixtures.map(f => {
        const homeStyle = f.homeClubId === 'Funebrero' ? 'color:#fff; font-weight:bold;' : 'color:#a3a3a3;';
        const awayStyle = f.awayClubId === 'Funebrero' ? 'color:#fff; font-weight:bold;' : 'color:#a3a3a3;';
        
        return `
            <tr>
                <td><span style="background: rgba(220,38,38,0.2); color: #dc2626; padding: 4px 8px; border-radius: 4px; font-size: 0.8rem;">${f.categoryId}</span></td>
                <td><span style="color:#3b82f6; font-weight:bold; font-size:0.8rem;">${f.round || ''}</span><br>${f.date} ${f.time ? '<br><span style="color:#a3a3a3; font-size:0.8rem;">'+f.time+'</span>' : ''}</td>
                <td style="${homeStyle}">${f.homeClubId}</td>
                <td style="${awayStyle}">${f.awayClubId}</td>
                <td style="text-align: center;">
                    <div style="display:flex; flex-direction: column; gap:5px; align-items: center;">
                        <button class="action-btn" style="background:#3b82f6; width:100%; padding: 4px; font-size: 0.7rem;" onclick="openEditFixture('${f.id}')">✏️ Editar</button>
                        <button class="danger delete-btn" style="width:100%; padding: 4px; font-size: 0.7rem;" onclick="deleteFixtureAdmin('${f.id}')">X Borrar</button>
                    </div>
                </td>
            </tr>`;
    }).join("");
}

window.deleteFixtureAdmin = async (id) => {
    if (confirm("¿Eliminar este partido permanentemente?")) {
        await deleteFixture(id);
        loadFixtures();
    }
};

// =========================================
// RENDERIZADO DE JUGADORES
// =========================================
async function loadPlayers() {
    const container = document.getElementById("playersListContainer");
    try {
        const players = await getPlayers();
        if(players.length === 0) { container.innerHTML = "<p style='text-align:center;'>No hay jugadores.</p>"; return; }

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
                            <td style="text-align:right; width: 140px;">
                                <button class="action-btn" style="background:#3b82f6; padding: 4px 8px; font-size: 0.7rem; margin-right: 5px;" onclick="openEditPlayer('${p.id}', '${p.name}', '${p.birthdate}', '${p.categoryId}')">✏️ Editar</button>
                                <button class="delete-btn" onclick="deletePlayerAdmin('${p.id}')">Borrar</button>
                            </td>
                         </tr>`;
            });
            html += `</tbody></table>`;
        });
        container.innerHTML = html;
    } catch(e) { container.innerHTML = "<p style='color:#ff3b3b;'>Error.</p>"; }
}

window.deletePlayerAdmin = async (id) => {
    if(confirm("¿Eliminar este jugador?")) {
        await deletePlayer(id);
        loadPlayers();
    }
};

// ==========================================
// MODAL DE EDICIÓN Y SUBIDA IMGBB
// ==========================================
const catsOptions = `
    <option value="Mosquito">Mosquito</option><option value="Mini">Mini</option><option value="Pre Mini">Pre Mini</option>
    <option value="U11">U11</option><option value="U13">U13</option><option value="U15">U15</option>
    <option value="U17">U17</option><option value="U21">U21</option><option value="Primera">Primera</option>
    <option value="Maxi 35">Maxi 35</option><option value="Maxi 42">Maxi 42</option>
`;

window.openEditPlayer = (id, name, birthdate, cat) => {
    currentEditTarget = { id, type: 'player' };
    document.getElementById('modalTitle').textContent = "✏️ Editar Jugador";
    document.getElementById('modalFormContainer').innerHTML = `
        <label style="color:#a3a3a3; font-size:0.8rem; margin-bottom:-10px;">Nombre Completo:</label>
        <input type="text" id="editPName" class="form-input" value="${name}">
        <label style="color:#a3a3a3; font-size:0.8rem; margin-bottom:-10px;">Fecha de Nacimiento:</label>
        <input type="text" id="editPBirth" class="form-input" value="${birthdate}">
        <label style="color:#a3a3a3; font-size:0.8rem; margin-bottom:-10px;">Corregir Categoría:</label>
        <select id="editPCat" class="form-select">${catsOptions}</select>
    `;
    document.getElementById('editPCat').value = cat;
    document.getElementById('editModal').style.display = 'flex';
};

window.openEditFixture = (id) => {
    const f = allFixturesCache.find(x => x.id === id);
    if (!f) return;
    currentEditTarget = { id, type: 'fixture' };
    document.getElementById('modalTitle').textContent = "✏️ Editar Partido y Cargar Fotos";
    
    document.getElementById('modalFormContainer').innerHTML = `
        <div style="display:flex; gap:10px;">
            <div style="flex:1;"><label style="color:#a3a3a3; font-size:0.8rem;">Local:</label><input type="text" id="editFHome" class="form-input" value="${f.homeClubId}"></div>
            <div style="flex:1;"><label style="color:#a3a3a3; font-size:0.8rem;">Visitante:</label><input type="text" id="editFAway" class="form-input" value="${f.awayClubId}"></div>
        </div>
        <div style="display:flex; gap:10px;">
            <div style="flex:1;"><label style="color:#a3a3a3; font-size:0.8rem;">Pts Local:</label><input type="number" id="editScoreHome" class="form-input" value="${f.scoreLocal || ''}" placeholder="-"></div>
            <div style="flex:1;"><label style="color:#a3a3a3; font-size:0.8rem;">Pts Visita:</label><input type="number" id="editScoreAway" class="form-input" value="${f.scoreAway || ''}" placeholder="-"></div>
            <div style="flex:1;"><label style="color:#a3a3a3; font-size:0.8rem;">Estado:</label>
                <select id="editStatus" class="form-select">
                    <option value="scheduled" ${f.status==='scheduled'?'selected':''}>Pendiente</option>
                    <option value="finished" ${f.status==='finished'?'selected':''}>Finalizado</option>
                </select>
            </div>
        </div>
        <div style="display:flex; gap:10px;">
            <div style="flex:1;"><label style="color:#a3a3a3; font-size:0.8rem;">Fase/Jornada:</label><input type="text" id="editFRound" class="form-input" value="${f.round}"></div>
            <div style="flex:1;"><label style="color:#a3a3a3; font-size:0.8rem;">Categoría:</label><select id="editFCat" class="form-select">${catsOptions}</select></div>
        </div>
        <div style="display:flex; gap:10px;">
            <div style="flex:1;"><label style="color:#a3a3a3; font-size:0.8rem;">Fecha Calendario:</label><input type="text" id="editFDate" class="form-input" value="${f.date}"></div>
            <div style="flex:1;"><label style="color:#a3a3a3; font-size:0.8rem;">Hora:</label><input type="time" id="editFTime" class="form-input" value="${f.time}"></div>
        </div>
        <hr style="border-color: #333; margin: 10px 0;">
        <div style="display:flex; gap:10px;">
            <div style="flex:1;">
                <label style="color:#a3a3a3; font-size:0.8rem;">Planilla de Juego:</label>
                <div style="display:flex; gap:5px;">
                    <input type="text" id="editPlanilla" class="form-input" value="${f.planilla || ''}" placeholder="Link ImgBB">
                    <button type="button" id="btnPlanilla" class="action-btn" style="padding: 0 10px; font-size: 0.8rem;" onclick="triggerModalUpload('Planilla')">📷 Subir</button>
                </div>
            </div>
        </div>
        <div style="display:flex; gap:10px;">
            <div style="flex:1;">
                <label style="color:#a3a3a3; font-size:0.8rem;">Foto Local:</label>
                <div style="display:flex; gap:5px;">
                    <input type="text" id="editPhotoHome" class="form-input" value="${f.photoHome || ''}" placeholder="Link ImgBB">
                    <button type="button" id="btnPhotoHome" class="action-btn" style="padding: 0 10px; font-size: 0.8rem;" onclick="triggerModalUpload('PhotoHome')">📷 Subir</button>
                </div>
            </div>
            <div style="flex:1;">
                <label style="color:#a3a3a3; font-size:0.8rem;">Foto Visita:</label>
                <div style="display:flex; gap:5px;">
                    <input type="text" id="editPhotoAway" class="form-input" value="${f.photoAway || ''}" placeholder="Link ImgBB">
                    <button type="button" id="btnPhotoAway" class="action-btn" style="padding: 0 10px; font-size: 0.8rem;" onclick="triggerModalUpload('PhotoAway')">📷 Subir</button>
                </div>
            </div>
        </div>
    `;
    document.getElementById('editFCat').value = f.categoryId;
    document.getElementById('editModal').style.display = 'flex';
};

let currentUploadField = '';
window.triggerModalUpload = (field) => {
    currentUploadField = field;
    document.getElementById('modalFileUploader').click();
};

document.getElementById('modalFileUploader').onchange = async (e) => {
    const file = e.target.files[0];
    if (!file || !currentUploadField) return;
    
    const btn = document.getElementById('btn' + currentUploadField);
    const originalText = btn.textContent;
    btn.textContent = "⏳...";
    
    const formData = new FormData();
    formData.append("image", file);
    
    try {
        const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, { method: "POST", body: formData });
        const data = await res.json();
        if (data.success) {
            document.getElementById('edit' + currentUploadField).value = data.data.url;
            btn.textContent = "✅ OK";
            btn.style.background = "#10b981";
        } else throw new Error();
    } catch(err) {
        alert("Error al subir la imagen. Intenta nuevamente.");
        btn.textContent = originalText;
    } finally { 
        e.target.value = ""; 
    }
};

document.getElementById('modalSaveBtn').onclick = async () => {
    const btn = document.getElementById('modalSaveBtn');
    btn.textContent = "⏳ Procesando..."; btn.disabled = true;
    try {
        if (currentEditTarget.type === 'player') {
            await updatePlayer(currentEditTarget.id, {
                name: document.getElementById('editPName').value.trim(),
                birthdate: document.getElementById('editPBirth').value.trim(),
                categoryId: document.getElementById('editPCat').value
            });
            await loadPlayers();
        } else if (currentEditTarget.type === 'fixture') {
            await updateFixture(currentEditTarget.id, {
                homeClubId: document.getElementById('editFHome').value.trim(),
                awayClubId: document.getElementById('editFAway').value.trim(),
                round: document.getElementById('editFRound').value.trim(),
                categoryId: document.getElementById('editFCat').value,
                date: document.getElementById('editFDate').value.trim(),
                time: document.getElementById('editFTime').value.trim(),
                scoreLocal: document.getElementById('editScoreHome').value ? Number(document.getElementById('editScoreHome').value) : null,
                scoreAway: document.getElementById('editScoreAway').value ? Number(document.getElementById('editScoreAway').value) : null,
                status: document.getElementById('editStatus').value,
                planilla: document.getElementById('editPlanilla').value.trim() || null,
                photoHome: document.getElementById('editPhotoHome').value.trim() || null,
                photoAway: document.getElementById('editPhotoAway').value.trim() || null
            });
            await loadFixtures();
        }
        document.getElementById('editModal').style.display = 'none';
    } catch (e) { alert("Error al guardar los cambios."); } 
    finally { btn.textContent = "Guardar Cambios"; btn.disabled = false; }
};