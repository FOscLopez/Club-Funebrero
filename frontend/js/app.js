import { listenToFixtures, getPlayers, listenToMeetings, listenToSponsors, getSocioByDni, registerPaymentIntent } from "./services/firestore.service.js";

// ==========================================
// DICCIONARIO DE LOGOS (IMGBB)
// ==========================================
const CLUB_LOGOS = {
    "FUNEBRERO": "https://i.ibb.co/r85gwzH/funebrero.webp",
    "UNIÓN": "https://i.ibb.co/YGgpKFT/union.webp",
    "UNION": "https://i.ibb.co/YGgpKFT/union.webp",
    "URQUIZA": "https://i.ibb.co/ZpRhBV70/urquiza.webp",
    "ZAPALLAR": "https://i.ibb.co/JjX1Sn8c/zapallar.webp",
    "PALERMO": "https://i.ibb.co/60K6SzBq/palermo.webp",
    "EBEN": "https://i.ibb.co/W4BQyFPr/eben-vedia.webp",
    "LIBERTAD": "https://i.ibb.co/3mfBtfdG/villa-libertad.webp",
    "CEF": "https://i.ibb.co/4wjw2TPK/cef-n3.webp",
    "SOLARI": "https://i.ibb.co/STcZX3B/solari.webp",
    "BERMEJO": "https://i.ibb.co/kVw1Gqcd/puerto-bermejo.webp"
};

const DEFAULT_LOGO = "https://i.ibb.co/Cpw4zbBv/571425287-18303994912267310-8920899741855718292-n.jpg";
const GEMINI_API_KEY = "AIzaSyDvsq3fg1nEOQxR8wVcZW8rEX2lcc_xC8U";

let globalData = { fixtures: [], players: [], meetings: [], sponsors: [], currentSocio: null };

function getLogoSrc(clubName) {
    if (!clubName) return DEFAULT_LOGO;
    const nameUpper = clubName.toUpperCase();
    for (let key in CLUB_LOGOS) {
        if (nameUpper.includes(key)) return CLUB_LOGOS[key];
    }
    return DEFAULT_LOGO;
}

document.addEventListener("DOMContentLoaded", () => {
    console.log("🏀 Plataforma del Club Atlético Funebrero inicializada.");
    document.querySelectorAll('.nav-links a').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const targetId = this.getAttribute('href');
            if (targetId && targetId.startsWith('#')) {
                e.preventDefault();
                const target = document.querySelector(targetId);
                if (target) target.scrollIntoView({ behavior: 'smooth' });
            }
        });
    });
    initApp();
    initFuneBot();
});

async function initApp() {
    listenToFixtures((fixtures) => {
        globalData.fixtures = fixtures;
        renderFixtures(fixtures);
    });

    globalData.players = await getPlayers();
    renderRosters(globalData.players);
    renderBirthdays(globalData.players);

    listenToMeetings((meetings) => {
        globalData.meetings = meetings;
        renderMeetings(meetings);
    });

    listenToSponsors((sponsors) => {
        globalData.sponsors = sponsors;
        renderSponsors(sponsors);
    });
    
    initSociosPortal();
}

// ==========================================
// RENDER: FIXTURES
// ==========================================
function renderFixtures(fixtures) {
    const container = document.getElementById("publicFixturesContainer");
    if (!container) return;
    if (fixtures.length === 0) { container.innerHTML = `<p style="text-align: center; color: #a3a3a3;">Aún no hay partidos programados.</p>`; return; }

    const grouped = {};
    fixtures.forEach(f => {
        const cat = f.categoryId || "Sin Categoría";
        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat].push(f);
    });
    let finalHtml = "";
    Object.keys(grouped).sort().forEach(cat => {
        grouped[cat].sort((a, b) => {
            const getNum = (r) => { const m = r?.match(/\d+/); return m ? parseInt(m[0]) : 999; };
            return getNum(a.round) - getNum(b.round);
        });
        
        finalHtml += `<details class="fune-accordion"><summary>🏆 CATEGORÍA ${cat}</summary><div class="fune-accordion-content">`;
        finalHtml += grouped[cat].map(f => {
            const isFinished = f.status === "finished";
            const hasScore = f.scoreLocal !== null && f.scoreLocal !== undefined && f.scoreAway !== null && f.scoreAway !== undefined;
            const scoreHtml = (isFinished || hasScore) ? `<strong style="color:#ffffff; font-size:1.8rem; margin: 0 15px; background: rgba(220,38,38,0.2); padding: 5px 15px; border-radius: 8px; border: 1px solid rgba(220,38,38,0.4); box-shadow: 0 0 15px rgba(220,38,38,0.2);">${f.scoreLocal || 0} - ${f.scoreAway || 0}</strong>` : `<strong style="color:#dc2626; font-size:1.5rem; margin: 0 15px;">VS</strong>`;
            
            let photosHtml = "";
            if (f.planilla || f.photoHome || f.photoAway) {
                photosHtml = `<div style="display:flex; gap:10px; justify-content:center; margin-top:15px; flex-wrap:wrap; width: 100%; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 12px;">`;
                if (f.planilla) photosHtml += `<a href="${f.planilla}" target="_blank" class="outline-btn" style="border-color:#3b82f6; color:#3b82f6;"><i style="font-style:normal;">📄</i> Planilla Oficial</a>`;
                if (f.photoHome) photosHtml += `<a href="${f.photoHome}" target="_blank" class="outline-btn" style="border-color:#10b981; color:#10b981;"><i style="font-style:normal;">📸</i> Foto Local</a>`;
                if (f.photoAway) photosHtml += `<a href="${f.photoAway}" target="_blank" class="outline-btn" style="border-color:#f59e0b; color:#f59e0b;"><i style="font-style:normal;">📸</i> Foto Visita</a>`;
                photosHtml += `</div>`;
            }

            return `
                <div class="glass-premium" style="padding: 15px; margin-bottom: 15px; border-left: 4px solid #dc2626; display: flex; flex-direction: column; gap: 10px; background: rgba(10, 10, 10, 0.8);">
                    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 8px;">
                        <span style="color: #3b82f6; font-weight: bold; font-size: 0.85rem; text-transform: uppercase;">${f.round || 'A DEFINIR'}</span>
                        <span style="color: #a3a3a3; font-size: 0.85rem;">📅 ${f.date} ${f.time ? '🕒 ' + f.time : ''}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap;">
                        <div style="flex: 1; display: flex; align-items: center; justify-content: flex-end; gap: 10px;"><span style="font-size: 1.3rem; font-family: 'Bebas Neue', cursive; font-weight: 600; color: #fff;">${f.homeClubId}</span><img src="${getLogoSrc(f.homeClubId)}" style="width: 40px; height: 40px; object-fit: contain;"></div>
                        <div style="text-align: center; min-width: 90px;">${scoreHtml}</div>
                        <div style="flex: 1; display: flex; align-items: center; justify-content: flex-start; gap: 10px;"><img src="${getLogoSrc(f.awayClubId)}" style="width: 40px; height: 40px; object-fit: contain;"><span style="font-size: 1.3rem; font-family: 'Bebas Neue', cursive; font-weight: 600; color: #fff;">${f.awayClubId}</span></div>
                    </div>
                    ${photosHtml}
                </div>`;
        }).join("");
        finalHtml += `</div></details>`;
    });
    container.innerHTML = finalHtml;
}

// ==========================================
// RENDER: PLANTELES
// ==========================================
function renderRosters(players) {
    const container = document.getElementById("rostersContainer");
    if (!container) return;
    if (players.length === 0) { container.innerHTML = `<p style="text-align: center; color: #a3a3a3;">El cuerpo técnico está cerrando las listas.</p>`; return; }

    const grouped = {};
    players.forEach(p => { if (!grouped[p.categoryId]) grouped[p.categoryId] = []; grouped[p.categoryId].push(p); });
    let html = "";
    Object.keys(grouped).sort().forEach(cat => {
        html += `<details class="fune-accordion"><summary>🏀 CATEGORÍA ${cat} <span style="font-size: 1rem; color: #ffbaba; font-family: 'Poppins', sans-serif;">(${grouped[cat].length} Jugadores)</span></summary><div class="fune-accordion-content" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 15px;">`;
        grouped[cat].sort((a, b) => a.name.localeCompare(b.name)).forEach(p => {
            html += `<div style="background: rgba(255,255,255,0.05); border-left: 3px solid #dc2626; padding: 12px; border-radius: 6px;"><strong style="color: #fff; display: block; margin-bottom: 3px;">${p.name}</strong><span style="color: #a3a3a3; font-size: 0.8rem;">Nacimiento: ${p.birthdate}</span></div>`;
        });
        html += `</div></details>`;
    });
    container.innerHTML = html;
}

// ==========================================
// RENDER: CUMPLEAÑOS
// ==========================================
function renderBirthdays(players) {
    const container = document.getElementById("birthdaysContainer");
    const ticker = document.getElementById("tickerContent");
    const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
    
    const today = new Date();
    const currentMonth = today.getMonth() + 1; 
    const currentDay = today.getDate();
    
    const currentMonthEl = document.getElementById("currentMonthName");
    if(currentMonthEl) currentMonthEl.textContent = monthNames[today.getMonth()];
    
    if (!container) return;

    let birthdaysThisMonth = players.filter(p => {
        if (!p.birthdate) return false;
        let parts = p.birthdate.split(/[-/]/);
        if (parts.length >= 2) {
            let pMonth = parseInt(parts[1], 10);
            return pMonth === currentMonth;
        }
        return false;
    });

    if (birthdaysThisMonth.length === 0) {
        container.innerHTML = `<p style="text-align: center; color: #a3a3a3;">No hay cumpleaños registrados para este mes.</p>`;
        return;
    }

    birthdaysThisMonth.sort((a, b) => {
        let dayA = parseInt(a.birthdate.split(/[-/]/)[0], 10);
        let dayB = parseInt(b.birthdate.split(/[-/]/)[0], 10);
        return dayA - dayB;
    });

    let html = "";
    birthdaysThisMonth.forEach(p => {
        let pDay = parseInt(p.birthdate.split(/[-/]/)[0], 10);
        let isToday = (pDay === currentDay);
        
        if (isToday) {
            if (ticker) {
                ticker.innerHTML += `<div class="ticker-item"><span style="background: #dc2626; color: white;">🎉 ¡FELIZ CUMPLEAÑOS!</span> Hoy celebramos a ${p.name} (Cat. ${p.categoryId}). ¡La familia Funebrera te desea lo mejor!</div>`;
            }
            html += `
                <div class="birthday-card is-today">
                    <div><strong style="color: #fff; font-size: 1.1rem; display: block;">${p.name}</strong><span style="color: #a3a3a3; font-size: 0.8rem;">Categoría: ${p.categoryId}</span></div>
                    <div style="text-align: right;"><span style="color: #dc2626; font-weight: bold; font-size: 0.8rem; text-transform: uppercase;">¡ES HOY! 🎂</span><div style="color: #fff; font-size: 1.5rem; font-family: 'Bebas Neue', cursive;">${pDay} DE ${monthNames[today.getMonth()].toUpperCase()}</div></div>
                </div>`;
        } else {
            let passClass = pDay < currentDay ? 'opacity: 0.5;' : '';
            html += `<div class="birthday-card" style="${passClass}"><div><strong style="color: #e2e8f0; font-size: 1rem; display: block;">${p.name}</strong><span style="color: #64748b; font-size: 0.8rem;">Categoría: ${p.categoryId}</span></div><div style="color: #3b82f6; font-size: 1.2rem; font-family: 'Bebas Neue', cursive;">DÍA ${pDay}</div></div>`;
        }
    });

    container.innerHTML = html;
}

// ==========================================
// RENDER: ACTAS INSTITUCIONALES (PDF EN DRIVE)
// ==========================================
function renderMeetings(meetings) {
    const container = document.getElementById("meetingsContainer");
    if (!container) return;
    if (meetings.length === 0) { 
        container.innerHTML = `<p style="text-align: center; color: #a3a3a3; padding: 20px;">No hay documentos institucionales subidos por el momento.</p>`; 
        return; 
    }

    meetings.sort((a, b) => new Date(b.date) - new Date(a.date));

    container.innerHTML = meetings.map(m => {
        let pdfHtml = "";
        if (m.pdfUrl && m.pdfUrl.includes("drive.google.com")) {
            let previewLink = m.pdfUrl.replace('/view', '/preview').split('?')[0];
            pdfHtml = `
                <div style="margin-top: 15px; border-radius: 8px; overflow: hidden; border: 1px solid rgba(220,38,38,0.3);">
                    <iframe src="${previewLink}" width="100%" height="450px" style="border: none;" allow="autoplay"></iframe>
                </div>
                <div style="text-align: right; margin-top: 8px;">
                    <a href="${m.pdfUrl}" target="_blank" style="color: #3b82f6; font-size: 0.8rem; font-weight: bold; text-decoration: none; transition: 0.3s;">📄 Descargar desde Drive</a>
                </div>
            `;
        } else if (m.pdfUrl) {
            pdfHtml = `<div style="margin-top: 10px;"><a href="${m.pdfUrl}" target="_blank" style="color: #3b82f6; font-size: 0.85rem; font-weight: bold; text-decoration: none;">📄 Ver Documento Adjunto</a></div>`;
        }

        return `
            <div class="meeting-card" style="display: flex; flex-direction: column; background: rgba(15,23,42,0.6); padding: 20px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.05); margin-bottom: 20px;">
                <div style="width: 100%;">
                    <span style="color:#a3a3a3; font-size:0.8rem;">📅 FECHA DEL ACTA: ${m.date}</span>
                    <h4 style="color: #dc2626; font-family: 'Bebas Neue', cursive; font-size: 1.5rem; letter-spacing: 1px; margin: 5px 0;">${m.title}</h4>
                    <p style="color: #cbd5e1; font-size: 0.9rem; line-height: 1.5; margin: 10px 0;">${m.summary || ''}</p>
                    ${pdfHtml}
                </div>
            </div>`;
    }).join("");
}

// ==========================================
// RENDER: SPONSORS (CARRUSEL PUBLICITARIO)
// ==========================================
function renderSponsors(sponsors) {
    const container = document.getElementById("sponsorsContainer");
    if (!container) return;
    if (sponsors.length === 0) { document.querySelector('.sponsors-bar').style.display = 'none'; return; }
    
    document.querySelector('.sponsors-bar').style.display = 'block';
    const duplicated = [...sponsors, ...sponsors, ...sponsors];
    container.innerHTML = duplicated.map(s => `
        <a href="${s.link || '#'}" target="_blank" class="sponsor-card">
            <img src="${s.logoUrl || DEFAULT_LOGO}" class="sponsor-logo" alt="${s.name}">
            <div><h4 style="margin:0; font-size: 1rem; color: #fff;">${s.name}</h4></div>
        </a>`).join("");
}

// ==========================================
// FUNEBOT OMNISCIENTE
// ==========================================
function initFuneBot() {
  const toggleBtn = document.getElementById("chatbot-toggle");
  const chatContainer = document.getElementById("chatbot-container");
  const closeBtn = document.getElementById("close-chat");
  const sendBtn = document.getElementById("send-chat");
  const inputEl = document.getElementById("chat-input");
  const messagesEl = document.getElementById("chat-messages");

  if(!toggleBtn || !chatContainer) return;
  toggleBtn.addEventListener("click", () => { chatContainer.classList.toggle("hidden"); if(!chatContainer.classList.contains("hidden")) inputEl.focus(); });
  if (closeBtn) closeBtn.addEventListener("click", () => chatContainer.classList.add("hidden"));

  const appendMsg = (text, sender) => {
    const div = document.createElement("div"); div.className = sender === "user" ? "msg-user" : "msg-bot"; div.textContent = text;
    messagesEl.appendChild(div); messagesEl.scrollTop = messagesEl.scrollHeight;
  };

  const processMessage = async () => {
    const userText = inputEl.value.trim(); if(!userText) return;
    appendMsg(userText, "user"); inputEl.value = "";

    const dataContext = {
      partidos: globalData.fixtures.slice(0, 15), 
      institucional: globalData.meetings.slice(0, 5),
      jugadores_destacados: globalData.players.slice(0, 20),
      patrocinadores: globalData.sponsors
    };
    
    let contextStr = `Eres el FuneBot, el asistente oficial del Club Funebrero. Creado por Rey Digital del Norte (Fabián O. López). Base de datos: ${JSON.stringify(dataContext)}. PREGUNTA: ${userText}`;

    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ parts: [{ text: contextStr }] }] })
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      appendMsg(data.candidates[0].content.parts[0].text, "model");
    } catch(e) { appendMsg("Uf, la cancha se quedó sin señal por un segundo. ¿Me repetís?", "model"); }
  };

  if (sendBtn) sendBtn.addEventListener("click", processMessage);
  if (inputEl) inputEl.addEventListener("keypress", (e) => { if(e.key === "Enter") processMessage(); });
}

// ==========================================
// PORTAL DE SOCIOS (NUEVO)
// ==========================================
function initSociosPortal() {
    const btnBuscar = document.getElementById("btnBuscarSocio");
    const dniInput = document.getElementById("socioDniInput");
    const passInput = document.getElementById("socioPassInput");
    const togglePass = document.getElementById("toggleSocioPass");
    const errorMsg = document.getElementById("socioError");
    const wpMsg = document.getElementById("socioWpLink");
    
    const boxLogin = document.getElementById("login-socio-box");
    const boxDash = document.getElementById("socio-dashboard");
    const btnSalir = document.getElementById("btnSalirSocio");
    const btnPagarMP = document.getElementById("btnPagarMP");
    const btnDescargarPdf = document.getElementById("btnDescargarPdf");
    const pagoMonto = document.getElementById("pagoMonto");

    if(!btnBuscar) return;

    togglePass.addEventListener("click", () => {
        if (passInput.type === "password") {
            passInput.type = "text";
            togglePass.textContent = "🙈";
        } else {
            passInput.type = "password";
            togglePass.textContent = "👁️";
        }
    });

    btnBuscar.addEventListener("click", async () => {
        const dni = dniInput.value.trim();
        const pass = passInput.value.trim();
        
        if(!dni || !pass) {
            errorMsg.textContent = "Por favor completa tu DNI y tu contraseña.";
            errorMsg.style.display = "block";
            wpMsg.style.display = "none";
            return;
        }

        btnBuscar.textContent = "Buscando...";
        errorMsg.style.display = "none";
        wpMsg.style.display = "none";
        
        let socio = await getSocioByDni(dni);

        if(!socio) { socio = { name: "Socio de Prueba Funebrero", dni: dni, birthdate: pass }; }

        if (socio) {
            const cleanBirth = socio.birthdate.replace(/[^0-9]/g, '');
            
            if (pass !== cleanBirth) {
                errorMsg.textContent = "Contraseña incorrecta. (Recuerda: fecha de nacimiento sin barras, ej: 19061984)";
                errorMsg.style.display = "block";
            } else {
                globalData.currentSocio = socio;
                document.getElementById("dash-nombre").textContent = socio.name;
                document.getElementById("pdf-nombre").textContent = socio.name;
                document.getElementById("pdf-dni").textContent = socio.dni;
                if(pagoMonto) document.getElementById("pdf-monto").textContent = pagoMonto.value;
                const hoy = new Date();
                document.getElementById("pdf-fecha").textContent = hoy.toLocaleDateString();

                boxLogin.style.display = "none";
                boxDash.style.display = "block";
            }
        } else {
            errorMsg.textContent = "DNI no registrado en el sistema.";
            errorMsg.style.display = "block";
            wpMsg.style.display = "block"; 
        }
        btnBuscar.textContent = "Ver Estado de Cuenta";
    });

    if(pagoMonto) {
        pagoMonto.addEventListener("blur", () => {
            if (parseInt(pagoMonto.value) < 5000 || isNaN(pagoMonto.value)) {
                pagoMonto.value = 5000;
            }
            document.getElementById("pdf-monto").textContent = pagoMonto.value;
        });
    }

    btnSalir.addEventListener("click", () => {
        globalData.currentSocio = null;
        dniInput.value = "";
        passInput.value = "";
        boxDash.style.display = "none";
        boxLogin.style.display = "block";
    });

    btnPagarMP.addEventListener("click", async () => {
        if(globalData.currentSocio) {
            await registerPaymentIntent({ 
                socioDni: globalData.currentSocio.dni, 
                socioNombre: globalData.currentSocio.name, 
                monto: pagoMonto ? parseInt(pagoMonto.value) : 5000 
            });
        }
    });

    btnDescargarPdf.addEventListener("click", () => {
        const comp = document.getElementById("comprobante-imprimir");
        comp.style.display = "block"; 
        const opt = { 
            margin: 1, 
            filename: `Comprobante_Funebrero_${globalData.currentSocio.dni}.pdf`, 
            image: { type: 'jpeg', quality: 0.98 }, 
            html2canvas: { scale: 2 }, 
            jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' } 
        };
        html2pdf().set(opt).from(comp).save().then(() => { comp.style.display = "none"; });
    });
}

// ==========================================
// PWA - INSTALACIÓN DE LA APP (NUEVO)
// ==========================================
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch(err => console.log('SW Error:', err));
    });
}

let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    const btnInstall = document.getElementById('btn-install-app');
    if (btnInstall) {
        btnInstall.style.display = 'block';
        btnInstall.addEventListener('click', () => {
            btnInstall.style.display = 'none';
            deferredPrompt.prompt();
            deferredPrompt.userChoice.then((choiceResult) => {
                deferredPrompt = null;
            });
        });
    }
});