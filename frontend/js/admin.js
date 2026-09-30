import { auth, db } from "./services/firebase.config.js";
import { addPlayersBulk, getPlayers, updatePlayer, deletePlayer, getFixtures, updateFixture, deleteFixture } from "./services/firestore.service.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { collection, addDoc, getDocs, doc, query, orderBy, where, writeBatch } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const allowedAdmins = ["mecinfotec@gmail.com", "admin@abnch.com", "admin@reydigital.com"];
const IMGBB_API_KEY = "4b6599a15cc7870198cb96ee95df9905";

let allFixturesCache = [];
let currentEditTarget = { id: null, type: null }; 

// =========================================
// ESTADO DEL ORDENAMIENTO (Por defecto: FECHA ASCENDENTE)
// =========================================
let currentSort = { column: 'date', direction: 'asc' };

window.setSort = (column) => {
    if (currentSort.column === column) {
        currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
    } else {
        currentSort.column = column;
        currentSort.direction = 'asc'; 
    }
    
    document.getElementById("sortCatArrow").textContent = currentSort.column === 'category' ? (currentSort.direction === 'asc' ? '↑' : '↓') : '↕';
    document.getElementById("sortCatArrow").style.color = currentSort.column === 'category' ? '#ff3b3b' : '#94a3b8';
    
    document.getElementById("sortRoundArrow").textContent = currentSort.column === 'date' ? (currentSort.direction === 'asc' ? '↑' : '↓') : '↕';
    document.getElementById("sortRoundArrow").style.color = currentSort.column === 'date' ? '#ff3b3b' : '#94a3b8';
    
    document.getElementById("sortTeamsArrow").textContent = currentSort.column === 'teams' ? (currentSort.direction === 'asc' ? '↑' : '↓') : '↕';
    document.getElementById("sortTeamsArrow").style.color = currentSort.column === 'teams' ? '#ff3b3b' : '#94a3b8';
    
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
// TABLA DE FIXTURES (EDICIÓN EN LÍNEA Y ORDEN AUTOMÁTICO)
// =========================================
async function loadFixtures() {
    const tbody = document.getElementById("fixturesList");
    try {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Cargando base de datos...</td></tr>';
        const q = query(collection(db, "fixtures"));
        const snapshot = await getDocs(q);
        
        allFixturesCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderFixturesTable();
    } catch (error) { 
        tbody.innerHTML = '<tr><td colspan="6">Error de lectura.</td></tr>'; 
    }
}

function renderFixturesTable() {
    const tbody = document.getElementById("fixturesList");
    
    if (allFixturesCache.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#a3a3a3;">El fixture está vacío.</td></tr>';
        return;
    }

    let sortedFixtures = [...allFixturesCache];

    // Lógica Matemática de Ordenamiento Inteligente
    sortedFixtures.sort((a, b) => {
        let valA, valB;
        if (currentSort.column === 'category') {
            valA = (a.categoryId || '').toLowerCase(); 
            valB = (b.categoryId || '').toLowerCase();
        } else if (currentSort.column === 'date') {
            // Ordenamos combinando Fecha Calendario + Categoría para que quede impecable
            valA = (a.date || '9999-12-31') + 'T' + (a.time || '23:59') + (a.categoryId || '');
            valB = (b.date || '9999-12-31') + 'T' + (b.time || '23:59') + (b.categoryId || '');
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

    tbody.innerHTML = sortedFixtures.map(f => {
        const isFinished = f.status === "finished";
        const valL = f.scoreLocal !== null && f.scoreLocal !== undefined ? f.scoreLocal : '';
        const valA = f.scoreAway !== null && f.scoreAway !== undefined ? f.scoreAway : '';
        
        const checkPhotoInline = (url, label, type) => {
            if (url) {
                return `<div style="margin-bottom: 5px; display: flex; align-items: center; justify-content: space-between; background: rgba(16, 185, 129, 0.1); padding: 3px 6px; border-radius: 4px; border: 1px solid rgba(16, 185, 129, 0.3);">
                            <a href="${url}" target="_blank" style="color:#10b981; font-size:0.65rem; text-decoration:none; font-weight:bold;">✅ ${label}</a>
                            <span onclick="triggerInlineUpload('${f.id}', '${type}')" style="font-size:0.6rem; cursor:pointer; color:#3b82f6; background: rgba(59, 130, 246, 0.2); padding: 2px 6px; border-radius: 4px;">Cambiar</span>
                        </div>`;
            } else {
                return `<div style="margin-bottom: 5px;">
                            <label onclick="triggerInlineUpload('${f.id}', '${type}')" style="cursor:pointer; font-size: 0.65rem; background: #1e293b; padding: 4px 8px; border-radius: 4px; border: 1px solid #334155; display: block; text-align: center; color: #a3a3a3; transition: 0.3s;" onmouseover="this.style.borderColor='#3b82f6'; this.style.color='#fff';" onmouseout="this.style.borderColor='#334155'; this.style.color='#a3a3a3';">📷 ${label}</label>
                        </div>`;
            }
        };

        const actionBtn = !isFinished
            ? `<button onclick="toggleStatusAdmin('${f.id}', 'finished')" style="width: 100%; padding: 6px; margin-bottom: 5px; font-size: 0.7rem; background: #10b981; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">🏁 Finalizar</button>`
            : `<button onclick="toggleStatusAdmin('${f.id}', 'scheduled')" style="width: 100%; padding: 6px; margin-bottom: 5px; font-size: 0.7rem; background: #334155; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">⏪ Reabrir</button>`;

        return `
            <tr>
                <td><span style="background: rgba(220,38,38,0.2); color: #dc2626; padding: 4px 8px; border-radius: 4px; font-size: 0.8rem;">${f.categoryId}</span></td>
                <td><span style="color:#3b82f6; font-weight:bold; font-size:0.8rem;">${f.round || ''}</span><br>${f.date} ${f.time ? '<br><span style="color:#a3a3a3; font-size:0.8rem;">'+f.time+'</span>' : ''}</td>
                <td>
                    <div style="font-size: 0.85rem; font-weight: ${f.homeClubId === 'Funebrero' ? 'bold' : 'normal'}; color: ${f.homeClubId === 'Funebrero' ? '#fff' : '#a3a3a3'};">${f.homeClubId}</div>
                    <div style="font-size: 0.65rem; color: #64748b;">vs</div>
                    <div style="font-size: 0.85rem; font-weight: ${f.awayClubId === 'Funebrero' ? 'bold' : 'normal'}; color: ${f.awayClubId === 'Funebrero' ? '#fff' : '#a3a3a3'};">${f.awayClubId}</div>
                </td>
                <td style="text-align: center; white-space: nowrap;">
                    <div style="display: flex; align-items: center; justify-content: center; gap: 5px;">
                        <input type="number" value="${valL}" style="width: 45px; text-align: center; background: #0f172a; border: 1px solid #334155; color: white; border-radius: 6px; padding: 6px; font-weight: bold; outline: none;" onchange="updateScoreInline('${f.id}', this.value, 'L')" ${isFinished ? 'disabled' : ''} placeholder="-">
                        <span style="color: #64748b;">-</span>
                        <input type="number" value="${valA}" style="width: 45px; text-align: center; background: #0f172a; border: 1px solid #334155; color: white; border-radius: 6px; padding: 6px; font-weight: bold; outline: none;" onchange="updateScoreInline('${f.id}', this.value, 'A')" ${isFinished ? 'disabled' : ''} placeholder="-">
                    </div>
                </td>
                <td style="min-width: 140px; vertical-align: middle;">
                    ${checkPhotoInline(f.planilla, 'Planilla', 'planilla')}
                    ${checkPhotoInline(f.photoHome, 'Eq. Local', 'photoHome')}
                    ${checkPhotoInline(f.photoAway, 'Eq. Visita', 'photoAway')}
                </td>
                <td style="text-align: center; vertical-align: middle;">
                    ${actionBtn}
                    <div style="display:flex; gap: 5px;">
                        <button style="flex:1; padding: 4px; font-size: 0.7rem; background: #3b82f6; color: white; border: none; border-radius: 4px; cursor: pointer;" onclick="openEditInfo('${f.id}')">✏️ Info</button>
                        <button style="flex:1; padding: 4px; font-size: 0.7rem; background: transparent; border: 1px solid #ef4444; color: #ef4444; border-radius: 4px; cursor: pointer;" onclick="deleteFixtureAdmin('${f.id}')">X</button>
                    </div>
                </td>
            </tr>`;
    }).join("");
}

window.updateScoreInline = async (id, val, side) => {
    const data = side === 'L' ? { scoreLocal: val === "" ? null : Number(val) } : { scoreAway: val === "" ? null : Number(val) };
    await updateFixture(id, data);
};

window.toggleStatusAdmin = async (id, newStatus) => {
    let msg = newStatus === 'finished' ? "¿Sellar partido? Pasará a la vista pública." : "¿Reabrir partido? Se habilitará la edición del marcador.";
    if(confirm(msg)) {
        await updateFixture(id, { status: newStatus });
        loadFixtures();
    }
};

window.deleteFixtureAdmin = async (id) => {
    if (confirm("¿Eliminar este partido permanentemente?")) {
        await deleteFixture(id);
        loadFixtures();
    }
};

// ==========================================
// SUBIDA DE FOTOS EN LÍNEA (IMGBB)
// ==========================================
let inlineUploadId = null;
let inlineUploadType = null;

window.triggerInlineUpload = (id, type) => {
    inlineUploadId = id;
    inlineUploadType = type;
    document.getElementById('adminFileUploader').click();
};

document.getElementById('adminFileUploader').onchange = async (e) => {
    const file = e.target.files[0];
    if (!file || !inlineUploadId) return;
    
    alert("⏳ Subiendo imagen... El panel se actualizará cuando termine.");
    const formData = new FormData();
    formData.append("image", file);
    
    try {
        const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, { method: "POST", body: formData });
        const data = await res.json();
        if (data.success) {
            await updateFixture(inlineUploadId, { [inlineUploadType]: data.data.url });
            loadFixtures();
        } else throw new Error();
    } catch(err) {
        alert("Error al subir la imagen. Intenta nuevamente.");
    } finally { 
        e.target.value = ""; 
        inlineUploadId = null; 
        inlineUploadType = null; 
    }
};

// =========================================
// RENDERIZADO DE JUGADORES Y BORRADO MASIVO
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
            html += `<div style="display:flex; justify-content:space-between; align-items:center; margin-top:25px; margin-bottom:10px; border-bottom: 1px solid #333; padding-bottom:5px;">
                        <h4 class="cat-header" style="margin:0; border:none; padding:0;">Categoría ${cat} <span style="color:#a3a3a3; font-size:0.8rem;">(${grouped[cat].length} jugadores)</span></h4>
                        <button class="danger delete-btn" style="padding: 5px 15px; font-size: 0.8rem; background: transparent; border: 1px solid #ef4444; color: #ef4444; border-radius: 4px; cursor: pointer;" onclick="deleteAllPlayersInCategory('${cat}')">🗑️ Borrar Toda la Categoría</button>
                     </div>`;
                     
            html += `<table>
                        <thead><tr><th>Nombre Completo</th><th>Fecha Nac.</th><th style="text-align:right;">Acción</th></tr></thead>
                        <tbody>`;
            grouped[cat].sort((a, b) => a.name.localeCompare(b.name)).forEach(p => {
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
    if(confirm("¿Eliminar este jugador individualmente?")) {
        await deletePlayer(id);
        loadPlayers();
    }
};

window.deleteAllPlayersInCategory = async (cat) => {
    if(confirm(`⚠️ PELIGRO EXTREMO: ¿Estás seguro de borrar TODOS los jugadores de la categoría ${cat}? Esta acción no se puede deshacer y borrará el plantel completo.`)) {
        try {
            const q = query(collection(db, "players"), where("categoryId", "==", cat));
            const snap = await getDocs(q);
            const batch = writeBatch(db);
            snap.forEach(docSnap => {
                batch.delete(docSnap.ref);
            });
            await batch.commit();
            alert(`✅ Plantel de ${cat} eliminado por completo.`);
            loadPlayers();
        } catch (error) {
            alert("Ocurrió un error al borrar el plantel masivamente.");
        }
    }
};

// ==========================================
// MODALES (REPARACIÓN DE ERRORES)
// ==========================================
const catsOptions = `
    <option value="Mosquito">Mosquito</option><option value="Mini">Mini</option><option value="Pre Mini">Pre Mini</option>
    <option value="U11">U11</option><option value="U13">U13</option><option value="U15">U15</option>
    <option value="U17">U17</option><option value="U21">U21</option><option value="Primera">Primera</option>
    <option value="Maxi 35">Maxi 35</option><option value="Maxi 42">Maxi 42</option>
`;

window.openEditPlayer = (id, name, birthdate, cat) => {
    currentEditTarget = { id, type: 'player' };
    document.getElementById('modalTitle').textContent = "✏️ Reparar Jugador";
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

window.openEditInfo = (id) => {
    const f = allFixturesCache.find(x => x.id === id);
    if (!f) return;
    currentEditTarget = { id, type: 'fixture' };
    document.getElementById('modalTitle').textContent = "✏️ Reparar Información de Partido";
    
    document.getElementById('modalFormContainer').innerHTML = `
        <div style="display:flex; gap:10px;">
            <div style="flex:1;"><label style="color:#a3a3a3; font-size:0.8rem;">Local:</label><input type="text" id="editFHome" class="form-input" value="${f.homeClubId}"></div>
            <div style="flex:1;"><label style="color:#a3a3a3; font-size:0.8rem;">Visitante:</label><input type="text" id="editFAway" class="form-input" value="${f.awayClubId}"></div>
        </div>
        <div style="display:flex; gap:10px;">
            <div style="flex:1;"><label style="color:#a3a3a3; font-size:0.8rem;">Fase/Jornada:</label><input type="text" id="editFRound" class="form-input" value="${f.round}"></div>
            <div style="flex:1;"><label style="color:#a3a3a3; font-size:0.8rem;">Categoría:</label><select id="editFCat" class="form-select">${catsOptions}</select></div>
        </div>
        <div style="display:flex; gap:10px;">
            <div style="flex:1;"><label style="color:#a3a3a3; font-size:0.8rem;">Fecha Calendario:</label><input type="text" id="editFDate" class="form-input" value="${f.date}"></div>
            <div style="flex:1;"><label style="color:#a3a3a3; font-size:0.8rem;">Hora:</label><input type="time" id="editFTime" class="form-input" value="${f.time || ''}"></div>
        </div>
    `;
    document.getElementById('editFCat').value = f.categoryId;
    document.getElementById('editModal').style.display = 'flex';
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
                time: document.getElementById('editFTime').value.trim()
            });
            await loadFixtures();
        }
        document.getElementById('editModal').style.display = 'none';
    } catch (e) { alert("Error al guardar los cambios."); } 
    finally { btn.textContent = "Guardar Cambios"; btn.disabled = false; }
};