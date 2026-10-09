import { auth } from "./services/firebase.config.js";
import { 
    db, 
    addPlayersBulk, getPlayers, updatePlayer, deletePlayer, 
    getFixtures, updateFixture, deleteFixture,
    getMeetings, createMeeting, updateMeeting, deleteMeeting,
    getSponsors, createSponsor, updateSponsor, deleteSponsor,
    addSociosBulk, getSocios, deleteSocio,
    getCarouselImages, createCarouselImage, deleteCarouselImage,
    getUpcomingMatches, createUpcomingMatch, deleteUpcomingMatch 
} from "./services/firestore.service.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { collection, addDoc, getDocs, doc, query, orderBy, where, writeBatch } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const superAdmins = ["mecinfotec@gmail.com", "admin@abnch.com", "admin@reydigital.com"];
const editores = ["editor@funebrero.com", "prensa@funebrero.com"];
const editoresSocios = ["socios@funebrero.com"]; 
const allowedUsers = [...superAdmins, ...editores, ...editoresSocios];

let isSuperAdmin = false;
let isSocioEditor = false;

const IMGBB_API_KEY = "4b6599a15cc7870198cb96ee95df9905";

let allFixturesCache = [];
let allMeetingsCache = [];
let allSponsorsCache = [];
let currentEditTarget = { id: null, type: null }; 
let currentSort = { column: 'createdAt', direction: 'desc' };
let pendingSponsorData = null;

window.setSort = (column) => {
    if (currentSort.column === column) {
        currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
    } else {
        currentSort.column = column;
        currentSort.direction = 'asc'; 
    }
    
    document.getElementById("sortCatArrow").textContent = currentSort.column === 'category' ? (currentSort.direction === 'asc' ? '↑' : '↓') : '↕';
    document.getElementById("sortCatArrow").style.color = currentSort.column === 'category' ? '#3b82f6' : '#94a3b8';
    
    document.getElementById("sortRoundArrow").textContent = currentSort.column === 'round' ? (currentSort.direction === 'asc' ? '↑' : '↓') : '↕';
    document.getElementById("sortRoundArrow").style.color = currentSort.column === 'round' ? '#3b82f6' : '#94a3b8';
    
    document.getElementById("sortTeamsArrow").textContent = currentSort.column === 'teams' ? (currentSort.direction === 'asc' ? '↑' : '↓') : '↕';
    document.getElementById("sortTeamsArrow").style.color = currentSort.column === 'teams' ? '#3b82f6' : '#94a3b8';
    
    renderFixturesTable();
};

onAuthStateChanged(auth, (user) => {
    if (!user || !allowedUsers.includes(user.email)) {
        window.location.replace("index.html");
    } else {
        isSuperAdmin = superAdmins.includes(user.email);
        isSocioEditor = editoresSocios.includes(user.email);
        const badge = document.getElementById("userRoleBadge");
        
        if(isSuperAdmin) {
            badge.textContent = "⚙️ Super Admin";
            badge.style.borderColor = "#dc2626";
            badge.style.color = "#dc2626";
            
            loadFixtures();
            loadPlayers();
            loadMeetingsAdmin();
            loadSponsorsAdmin();
            loadSociosAdmin(); 
            loadMainCarouselAdmin(); 
            loadUpcomingMatchesAdmin(); 
            
        } else if (isSocioEditor) {
            badge.textContent = "👥 Editor Socios";
            badge.style.borderColor = "#06b6d4";
            badge.style.color = "#06b6d4";
            
            const style = document.createElement('style');
            style.innerHTML = `
                details.fune-accordion { display: none !important; }
                #moduloSociosCarga, #moduloSociosLista { display: block !important; }
            `;
            document.head.appendChild(style);
            
            loadSociosAdmin();

        } else {
            badge.textContent = "✍️ Editor";
            const style = document.createElement('style');
            style.innerHTML = '.super-admin-only { display: none !important; }';
            document.head.appendChild(style);

            loadFixtures();
            loadPlayers();
        }
    }
});

document.getElementById("logoutBtn").addEventListener("click", async () => {
    await signOut(auth);
    window.location.replace("index.html");
});

document.getElementById("fixtureForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = document.getElementById("saveBtn"); btn.textContent = "Guardando..."; btn.disabled = true;
    const fixtureData = { categoryId: document.getElementById("categoria").value, homeClubId: document.getElementById("condicion").value === "local" ? "Funebrero" : document.getElementById("rival").value.trim(), awayClubId: document.getElementById("condicion").value === "visita" ? "Funebrero" : document.getElementById("rival").value.trim(), round: "A definir", date: document.getElementById("fecha").value, time: document.getElementById("hora").value || null, status: "scheduled", scoreLocal: null, scoreAway: null, createdAt: new Date().toISOString() };
    try { await addDoc(collection(db, "fixtures"), fixtureData); document.getElementById("fixtureForm").reset(); await loadFixtures(); } catch (error) { alert("Error al guardar el partido."); } finally { btn.textContent = "Guardar Partido"; btn.disabled = false; }
});

document.getElementById("magicFixtureForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = document.getElementById("saveMagicFixturesBtn"); btn.textContent = "Procesando..."; btn.disabled = true;
    const category = document.getElementById("magicFixtureCategory").value; const text = document.getElementById("magicFixtureBox").value;
    const lines = text.split('\n'); const fixturesToSave = [];
    lines.forEach(line => {
        const cleanLine = line.trim(); if (!cleanLine || cleanLine.toUpperCase().includes("LIBRE")) return;
        const matchVs = cleanLine.toUpperCase().split(" VS ");
        if (matchVs.length === 2) {
            const firstPart = matchVs[0].trim(); const spaceIndex = firstPart.indexOf(" ");
            let round = "A definir"; let home = firstPart;
            if (spaceIndex > -1 && !isNaN(firstPart.substring(0, spaceIndex))) { round = "Fecha " + firstPart.substring(0, spaceIndex); home = firstPart.substring(spaceIndex + 1).trim(); }
            home = home.replace("S. ZAPALLAR", "S. Zapallar").replace("FUNEBRERO", "Funebrero"); const away = matchVs[1].trim().replace("S. ZAPALLAR", "S. Zapallar").replace("FUNEBRERO", "Funebrero");
            fixturesToSave.push({ categoryId: category, homeClubId: home, awayClubId: away, round: round, date: "A definir", time: "", status: "scheduled", scoreLocal: null, scoreAway: null, createdAt: new Date().toISOString() });
        }
    });
    if (fixturesToSave.length === 0) { alert("No se detectaron partidos."); btn.textContent = "Procesar Fixture"; btn.disabled = false; return; }
    try {
        const q = query(collection(db, "fixtures"), where("categoryId", "==", category)); const existingSnap = await getDocs(q); const batch = writeBatch(db);
        existingSnap.forEach(docSnap => {
            const d = docSnap.data(); const matchExists = fixturesToSave.find(f => (f.homeClubId.toUpperCase() === d.homeClubId.toUpperCase() && f.awayClubId.toUpperCase() === d.awayClubId.toUpperCase()) || (f.homeClubId.toUpperCase() === d.awayClubId.toUpperCase() && f.awayClubId.toUpperCase() === d.homeClubId.toUpperCase()));
            if (matchExists && d.date === "A definir") { batch.delete(docSnap.ref); }
        });
        fixturesToSave.forEach(f => { const newRef = doc(collection(db, "fixtures")); batch.set(newRef, f); });
        await batch.commit(); document.getElementById("magicFixtureBox").value = ""; await loadFixtures(); alert(`Se cargaron ${fixturesToSave.length} partidos.`);
    } catch (err) { alert("Error al procesar."); } finally { btn.textContent = "Procesar Fixture"; btn.disabled = false; }
});

document.getElementById("playerForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = document.getElementById("savePlayersBtn"); btn.textContent = "Procesando..."; btn.disabled = true;
    const category = document.getElementById("playerCategory").value; const text = document.getElementById("magicBox").value;
    const lines = text.split('\n'); const playersToSave = [];
    lines.forEach(line => {
        let cleanLine = line.trim(); if (!cleanLine || cleanLine.toLowerCase().includes("apellido") || cleanLine.toLowerCase().includes("fecha de nacimiento")) return;
        cleanLine = cleanLine.replace(/\b\d{1,2}[\.\-]?\d{3}[\.\-]?\d{3}\b/g, "").replace(/\s{2,}/g, " ").trim();
        let parts = cleanLine.split('\t'); if (parts.length < 2) parts = cleanLine.split(/ {2,}/);
        if (parts.length >= 2) { playersToSave.push({ name: parts[0].trim(), birthdate: parts[1].trim(), categoryId: category, clubId: "Funebrero", createdAt: new Date().toISOString() }); } 
        else { const lastSpace = cleanLine.lastIndexOf(' '); if (lastSpace > 0) { playersToSave.push({ name: cleanLine.substring(0, lastSpace).trim(), birthdate: cleanLine.substring(lastSpace + 1).trim(), categoryId: category, clubId: "Funebrero", createdAt: new Date().toISOString() }); } }
    });
    if (playersToSave.length === 0) { alert("Formato no reconocido. Asegurate de que quede Nombre y Fecha."); btn.textContent = "Procesar Plantel"; btn.disabled = false; return; }
    try { await addPlayersBulk(playersToSave); document.getElementById("magicBox").value = ""; await loadPlayers(); alert(`Se cargaron ${playersToSave.length} jugadores.`); } catch(err) { alert("Error al guardar."); } finally { btn.textContent = "Procesar Plantel"; btn.disabled = false; }
});

document.getElementById("socioForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = document.getElementById("saveSocioBtn"); btn.textContent = "Procesando..."; btn.disabled = true;
    const text = document.getElementById("magicSocioBox").value; const lines = text.split('\n'); const sociosToSave = [];

    lines.forEach(line => {
        let cleanLine = line.trim();
        if (!cleanLine || cleanLine.toLowerCase().includes("nombre y apellido") || cleanLine.toLowerCase().includes("cantid")) return;
        
        let parts = cleanLine.split('\t');
        if(parts.length >= 4) {
            let name = parts[1].trim();
            let dni = parts[2].replace(/\./g, '').trim(); 
            let birthdate = parts[3].trim();
            let numSocio = parts[4] ? parts[4].trim() : "S/N";
            sociosToSave.push({ name, dni, birthdate, numSocio, createdAt: new Date().toISOString() });
        } else {
            const dniMatch = cleanLine.match(/\b\d{1,2}\.?\d{3}\.?\d{3}\b/);
            const dateMatch = cleanLine.match(/\b\d{2}[/-]\d{2}[/-]\d{4}\b/);
            
            if (dniMatch && dateMatch) {
                const dniRaw = dniMatch[0];
                const dni = dniRaw.replace(/\./g, '');
                const birthdate = dateMatch[0];
                
                let remainder = cleanLine.replace(dniRaw, '').replace(birthdate, '').trim();
                
                let numSocioMatch = remainder.match(/\b\d{1,4}$/);
                let numSocio = numSocioMatch ? numSocioMatch[0] : "S/N";
                
                let name = remainder.replace(numSocio, '').trim().replace(/\s{2,}/g, ' ');
                name = name.replace(/^\d+\s*/, ''); 
                name = name.replace(/^,|,$/g, '').trim(); 
                
                sociosToSave.push({ name, dni, birthdate, numSocio, createdAt: new Date().toISOString() });
            }
        }
    });

    if (sociosToSave.length === 0) {
        alert("Formato no reconocido. Asegurate de incluir Nombre, Fecha de Nacimiento y DNI o pegar la tabla de Word.");
        btn.textContent = "Procesar Socios"; btn.disabled = false;
        return;
    }

    try {
        await addSociosBulk(sociosToSave);
        document.getElementById("magicSocioBox").value = "";
        await loadSociosAdmin();
        alert(`Se cargaron ${sociosToSave.length} socios.`);
    } catch(err) { alert("Error al guardar socios."); } 
    finally { btn.textContent = "Procesar Socios"; btn.disabled = false; }
});

async function loadSociosAdmin() {
    const tbody = document.getElementById("sociosListContainer");
    try {
        const socios = await getSocios();
        if(socios.length === 0) { tbody.innerHTML = "<tr><td colspan='5' style='text-align:center;'>No hay socios registrados.</td></tr>"; return; }
        
        tbody.innerHTML = socios.map(s => `
            <tr>
                <td style="color:#f59e0b; font-weight:bold;">${s.numSocio || 'S/N'}</td>
                <td style="font-weight:600;">${s.name}</td>
                <td style="color:#3b82f6;">${s.dni}</td>
                <td style="color:#a3a3a3;">${s.birthdate}</td>
                <td style="text-align:right;">
                    <button class="delete-btn" onclick="deleteSocioAdmin('${s.id}')">Borrar</button>
                </td>
            </tr>
        `).join("");
    } catch(e) { tbody.innerHTML = "<tr><td colspan='5'>Error al cargar socios</td></tr>"; }
}

window.deleteSocioAdmin = async (id) => {
    if(confirm("¿Eliminar este socio?")) {
        await deleteSocio(id);
        loadSociosAdmin();
    }
};

// =========================================
// TABLA DE FIXTURES (EDICIÓN EN LÍNEA)
// =========================================
async function loadFixtures() {
    const tbody = document.getElementById("fixturesList");
    try {
        const q = query(collection(db, "fixtures"), orderBy("createdAt", "desc"));
        const snapshot = await getDocs(q);
        allFixturesCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderFixturesTable();
        
        // ACTUALIZAMOS EL DESPLEGABLE DE FLYERS AUTOMÁTICAMENTE
        populateFlyerDropdown();
        // RECARGAMOS LA TABLA DE FLYERS PARA VER LOS VÍNCULOS
        loadUpcomingMatchesAdmin();
        
    } catch (error) { 
        tbody.innerHTML = '<tr><td colspan="6">Error de lectura.</td></tr>'; 
    }
}

// NUEVA FUNCIÓN: Rellena la lista de partidos programados para el módulo de Flyers
function populateFlyerDropdown() {
    const select = document.getElementById("flyerFixtureSelect");
    if (!select) return;
    
    // Filtramos solo los partidos que NO estén finalizados
    const scheduledFixtures = allFixturesCache.filter(f => f.status !== "finished");
    
    if (scheduledFixtures.length === 0) {
        select.innerHTML = '<option value="">No hay partidos programados actualmente</option>';
        return;
    }
    
    select.innerHTML = '<option value="">Selecciona a qué partido corresponde el Flyer...</option>' + 
        scheduledFixtures.map(f => {
            return `<option value="${f.id}">CAT. ${f.categoryId} | ${f.homeClubId} vs ${f.awayClubId} (${f.round || 'S/N'})</option>`;
        }).join("");
}

function renderFixturesTable() {
    const tbody = document.getElementById("fixturesList");
    
    if (allFixturesCache.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#a3a3a3;">El fixture está vacío.</td></tr>';
        return;
    }

    let sortedFixtures = [...allFixturesCache];

    sortedFixtures.sort((a, b) => {
        let valA, valB;
        if (currentSort.column === 'category') {
            valA = (a.categoryId || '').toLowerCase(); valB = (b.categoryId || '').toLowerCase();
        } else if (currentSort.column === 'round') {
            const numA = parseInt((a.round || '').replace(/\D/g, '')) || 999;
            const numB = parseInt((b.round || '').replace(/\D/g, '')) || 999;
            if (numA !== numB) return currentSort.direction === 'asc' ? numA - numB : numB - numA;
            valA = (a.round || '').toLowerCase(); valB = (b.round || '').toLowerCase();
        } else if (currentSort.column === 'teams') {
            valA = (a.homeClubId || '').toLowerCase(); valB = (b.homeClubId || '').toLowerCase();
        } else {
            valA = (a.createdAt || '').toLowerCase(); valB = (b.createdAt || '').toLowerCase();
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
                            <span onclick="triggerInlineUpload('${f.id}', '${type}')" id="lbl-${f.id}-${type}" style="font-size:0.6rem; cursor:pointer; color:#3b82f6; background: rgba(59, 130, 246, 0.2); padding: 2px 6px; border-radius: 4px;">Cambiar</span>
                        </div>`;
            } else {
                return `<div style="margin-bottom: 5px;">
                            <label onclick="triggerInlineUpload('${f.id}', '${type}')" id="lbl-${f.id}-${type}" style="cursor:pointer; font-size: 0.65rem; background: #1e293b; padding: 4px 8px; border-radius: 4px; border: 1px solid #334155; display: block; text-align: center; color: #a3a3a3; transition: 0.3s;" onmouseover="this.style.borderColor='#3b82f6'; this.style.color='#fff';" onmouseout="this.style.borderColor='#334155'; this.style.color='#a3a3a3';">📷 ${label}</label>
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
    let msg = newStatus === 'finished' ? "¿Sellar partido? El flyer publicitario desaparecerá del inicio automáticamente." : "¿Reabrir partido? El flyer volverá a mostrarse.";
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
    
    const label = document.getElementById(`lbl-${inlineUploadId}-${inlineUploadType}`);
    const originalText = label ? label.textContent : "📷";
    if (label) label.textContent = "⏳ Subiendo...";
    
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
        if (label) label.textContent = originalText;
    } finally { 
        e.target.value = ""; 
        inlineUploadId = null; 
        inlineUploadType = null; 
    }
};

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
                        <button class="danger delete-btn" style="padding: 5px 15px; font-size: 0.8rem; background: transparent; border: 1px solid #ef4444; color: #ef4444; border-radius: 4px; cursor: pointer;" onclick="deleteAllPlayersInCategory('${cat}')">🗑️ Borrar Categoría</button>
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
    if(confirm(`⚠️ PELIGRO: ¿Estás seguro de borrar TODOS los jugadores de la categoría ${cat}? Esta acción no se puede deshacer.`)) {
        try {
            const q = query(collection(db, "players"), where("categoryId", "==", cat));
            const snap = await getDocs(q);
            const batch = writeBatch(db);
            snap.forEach(docSnap => {
                batch.delete(docSnap.ref);
            });
            await batch.commit();
            alert(`✅ Plantel de la categoría ${cat} eliminado exitosamente.`);
            loadPlayers();
        } catch (error) {
            alert("Ocurrió un error al intentar borrar el plantel de manera masiva.");
        }
    }
};

document.getElementById("meetingForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = document.getElementById("saveMeetBtn");
    btn.textContent = "Guardando..."; btn.disabled = true;

    const data = {
        title: document.getElementById("meetTitle").value.trim(),
        date: document.getElementById("meetDate").value,
        summary: document.getElementById("meetSummary").value.trim(),
        pdfUrl: document.getElementById("meetPdf").value.trim()
    };

    try {
        await createMeeting(data);
        document.getElementById("meetingForm").reset();
        await loadMeetingsAdmin();
        alert("Documento guardado con éxito.");
    } catch(err) { alert("Error al guardar documento."); }
    finally { btn.textContent = "Guardar Documento"; btn.disabled = false; }
});

async function loadMeetingsAdmin() {
    const tbody = document.getElementById("meetingsList");
    try {
        const meetings = await getMeetings();
        allMeetingsCache = meetings; 
        if(meetings.length === 0) { tbody.innerHTML = "<tr><td colspan='3' style='text-align:center;'>No hay documentos</td></tr>"; return; }
        
        meetings.sort((a,b) => new Date(b.date) - new Date(a.date));
        
        tbody.innerHTML = meetings.map(m => `
            <tr>
                <td>${m.date}</td>
                <td><strong>${m.title}</strong></td>
                <td style="text-align:right; width: 140px;">
                    <button class="action-btn" style="background:#3b82f6; padding: 4px 8px; font-size: 0.7rem; margin-right: 5px;" onclick="openEditMeeting('${m.id}')">✏️ Editar</button>
                    <button onclick="deleteMeetAdmin('${m.id}')" class="delete-btn">Borrar</button>
                </td>
            </tr>
        `).join("");
    } catch(e) { tbody.innerHTML = "<tr><td colspan='3'>Error al cargar</td></tr>"; }
}

window.deleteMeetAdmin = async (id) => {
    if(confirm("¿Eliminar este documento institucional?")) {
        await deleteMeeting(id);
        loadMeetingsAdmin();
    }
};

document.getElementById("sponsorForm").addEventListener("submit", (e) => {
    e.preventDefault();
    pendingSponsorData = {
        name: document.getElementById("spName").value.trim(),
        link: document.getElementById("spLink").value.trim()
    };
    document.getElementById("sponsorFileUploader").click();
});

document.getElementById("sponsorFileUploader").onchange = async (e) => {
    const file = e.target.files[0];
    if (!file || !pendingSponsorData) return;
    
    const btn = document.getElementById("saveSpBtn");
    btn.textContent = "⏳ Subiendo..."; btn.disabled = true;

    const formData = new FormData();
    formData.append("image", file);
    
    try {
        const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, { method: "POST", body: formData });
        const data = await res.json();
        if (data.success) {
            pendingSponsorData.logoUrl = data.data.url;
            await createSponsor(pendingSponsorData);
            document.getElementById("sponsorForm").reset();
            loadSponsorsAdmin();
            alert("Sponsor añadido al carrusel.");
        } else throw new Error();
    } catch(err) {
        alert("Error al subir el logo.");
    } finally { 
        e.target.value = ""; 
        pendingSponsorData = null;
        btn.textContent = "Guardar y Subir Logo"; btn.disabled = false;
    }
};

async function loadSponsorsAdmin() {
    const tbody = document.getElementById("sponsorsList");
    try {
        const sponsors = await getSponsors();
        allSponsorsCache = sponsors; 
        if(sponsors.length === 0) { tbody.innerHTML = "<tr><td colspan='3' style='text-align:center;'>No hay sponsors</td></tr>"; return; }
        
        tbody.innerHTML = sponsors.map(s => `
            <tr>
                <td><img src="${s.logoUrl}" style="height:30px; object-fit:contain; border-radius:4px; background:white; padding:2px;"></td>
                <td><strong>${s.name}</strong></td>
                <td style="text-align:right; width: 140px;">
                    <button class="action-btn" style="background:#3b82f6; padding: 4px 8px; font-size: 0.7rem; margin-right: 5px;" onclick="openEditSponsor('${s.id}')">✏️ Editar</button>
                    <button onclick="deleteSpAdmin('${s.id}')" class="delete-btn">Borrar</button>
                </td>
            </tr>
        `).join("");
    } catch(e) { tbody.innerHTML = "<tr><td colspan='3'>Error al cargar</td></tr>"; }
}

window.deleteSpAdmin = async (id) => {
    if(confirm("¿Quitar este sponsor del carrusel?")) {
        await deleteSponsor(id);
        loadSponsorsAdmin();
    }
};

document.getElementById("triggerMainCarouselUploadBtn").addEventListener("click", () => {
    document.getElementById("mainCarouselFileUploader").click();
});

document.getElementById("mainCarouselFileUploader").onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const btn = document.getElementById("triggerMainCarouselUploadBtn");
    const originalText = btn.textContent;
    btn.textContent = "⏳ Subiendo a ImgBB..."; 
    btn.disabled = true;

    const formData = new FormData();
    formData.append("image", file);
    
    try {
        const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, { method: "POST", body: formData });
        const data = await res.json();
        if (data.success) {
            await createCarouselImage({ imageUrl: data.data.url });
            loadMainCarouselAdmin();
            alert("Foto agregada al carrusel principal.");
        } else throw new Error();
    } catch(err) {
        alert("Error al subir la imagen al carrusel.");
    } finally { 
        e.target.value = ""; 
        btn.textContent = originalText; 
        btn.disabled = false;
    }
};

async function loadMainCarouselAdmin() {
    const tbody = document.getElementById("mainCarouselList");
    try {
        const images = await getCarouselImages();
        if(images.length === 0) { tbody.innerHTML = "<tr><td colspan='2' style='text-align:center;'>No hay fotos en el carrusel</td></tr>"; return; }
        
        tbody.innerHTML = images.map(img => `
            <tr>
                <td><img src="${img.imageUrl}" style="height:60px; object-fit:cover; border-radius:4px; border: 1px solid #333;"></td>
                <td style="text-align:right;">
                    <button class="delete-btn" onclick="deleteMainCarouselImgAdmin('${img.id}')">Borrar</button>
                </td>
            </tr>
        `).join("");
    } catch(e) { tbody.innerHTML = "<tr><td colspan='2'>Error al cargar</td></tr>"; }
}

window.deleteMainCarouselImgAdmin = async (id) => {
    if(confirm("¿Quitar esta foto del carrusel de inicio?")) {
        await deleteCarouselImage(id);
        loadMainCarouselAdmin();
    }
};

// ==========================================
// NUEVO: GESTIÓN DE PRÓXIMOS PARTIDOS
// ==========================================
document.getElementById("triggerUpcomingMatchUploadBtn").addEventListener("click", () => {
    document.getElementById("upcomingMatchFileUploader").click();
});

document.getElementById("upcomingMatchFileUploader").onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // VALIDACIÓN: Verificamos que se haya seleccionado un partido del menú
    const fixtureId = document.getElementById("flyerFixtureSelect").value;
    if(!fixtureId) {
        alert("Por favor, selecciona a qué partido corresponde el flyer antes de subirlo.");
        e.target.value = ""; 
        return;
    }
    
    const btn = document.getElementById("triggerUpcomingMatchUploadBtn");
    const originalText = btn.textContent;
    btn.textContent = "⏳ Subiendo Flyer..."; 
    btn.disabled = true;

    const formData = new FormData();
    formData.append("image", file);
    
    try {
        const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, { method: "POST", body: formData });
        const data = await res.json();
        if (data.success) {
            // Guardamos el flyer JUNTO con el ID del partido
            await createUpcomingMatch({ imageUrl: data.data.url, fixtureId: fixtureId });
            loadUpcomingMatchesAdmin();
            alert("Flyer vinculado y agregado correctamente.");
        } else throw new Error();
    } catch(err) {
        alert("Error al subir el flyer.");
    } finally { 
        e.target.value = ""; 
        btn.textContent = originalText; 
        btn.disabled = false;
    }
};

async function loadUpcomingMatchesAdmin() {
    const tbody = document.getElementById("upcomingMatchesList");
    try {
        const images = await getUpcomingMatches();
        if(images.length === 0) { tbody.innerHTML = "<tr><td colspan='3' style='text-align:center;'>No hay flyers cargados</td></tr>"; return; }
        
        tbody.innerHTML = images.map(img => {
            // Buscamos el partido vinculado en el caché
            const linkedFix = allFixturesCache.find(f => f.id === img.fixtureId);
            const fixText = linkedFix ? `${linkedFix.homeClubId} vs ${linkedFix.awayClubId} (${linkedFix.status === 'finished' ? 'FINALIZADO' : 'PENDIENTE'})` : 'Sin vincular';
            
            return `
                <tr>
                    <td><img src="${img.imageUrl}" style="height:60px; object-fit:contain; border-radius:4px; border: 1px solid #333;"></td>
                    <td style="color:#a3a3a3; font-size:0.85rem;">${fixText}</td>
                    <td style="text-align:right;">
                        <button class="delete-btn" onclick="deleteUpcomingMatchAdmin('${img.id}')">Borrar</button>
                    </td>
                </tr>
            `;
        }).join("");
    } catch(e) { tbody.innerHTML = "<tr><td colspan='3'>Error al cargar</td></tr>"; }
}

window.deleteUpcomingMatchAdmin = async (id) => {
    if(confirm("¿Quitar este flyer de los próximos partidos?")) {
        await deleteUpcomingMatch(id);
        loadUpcomingMatchesAdmin();
    }
};

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

window.openEditMeeting = (id) => {
    const m = allMeetingsCache.find(x => x.id === id);
    if (!m) return;
    currentEditTarget = { id, type: 'meeting' };
    document.getElementById('modalTitle').textContent = "✏️ Reparar Documento Institucional";
    document.getElementById('modalFormContainer').innerHTML = `
        <label style="color:#a3a3a3; font-size:0.8rem; margin-bottom:-10px;">Título:</label>
        <input type="text" id="editMTitle" class="form-input" value="${m.title}">
        <label style="color:#a3a3a3; font-size:0.8rem; margin-bottom:-10px;">Fecha:</label>
        <input type="date" id="editMDate" class="form-input" value="${m.date}">
        <label style="color:#a3a3a3; font-size:0.8rem; margin-bottom:-10px;">Resumen:</label>
        <textarea id="editMSummary" class="form-input" rows="3">${m.summary || ''}</textarea>
        <label style="color:#a3a3a3; font-size:0.8rem; margin-bottom:-10px;">Link PDF / Drive:</label>
        <input type="text" id="editMPdf" class="form-input" value="${m.pdfUrl || ''}">
    `;
    document.getElementById('editModal').style.display = 'flex';
};

window.openEditSponsor = (id) => {
    const s = allSponsorsCache.find(x => x.id === id);
    if (!s) return;
    currentEditTarget = { id, type: 'sponsor' };
    document.getElementById('modalTitle').textContent = "✏️ Reparar Sponsor";
    document.getElementById('modalFormContainer').innerHTML = `
        <label style="color:#a3a3a3; font-size:0.8rem; margin-bottom:-10px;">Nombre Marca:</label>
        <input type="text" id="editSName" class="form-input" value="${s.name}">
        <label style="color:#a3a3a3; font-size:0.8rem; margin-bottom:-10px;">Link a su Web/Redes:</label>
        <input type="text" id="editSLink" class="form-input" value="${s.link || ''}">
    `;
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
        } else if (currentEditTarget.type === 'meeting') {
            await updateMeeting(currentEditTarget.id, {
                title: document.getElementById('editMTitle').value.trim(),
                date: document.getElementById('editMDate').value,
                summary: document.getElementById('editMSummary').value.trim(),
                pdfUrl: document.getElementById('editMPdf').value.trim()
            });
            await loadMeetingsAdmin();
        } else if (currentEditTarget.type === 'sponsor') {
            await updateSponsor(currentEditTarget.id, {
                name: document.getElementById('editSName').value.trim(),
                link: document.getElementById('editSLink').value.trim()
            });
            await loadSponsorsAdmin();
        }
        document.getElementById('editModal').style.display = 'none';
    } catch (e) { alert("Error al guardar los cambios."); } 
    finally { btn.textContent = "Guardar Cambios"; btn.disabled = false; }
};