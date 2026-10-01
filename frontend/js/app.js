import { listenToFixtures, getPlayers, getMeetings, getSponsors } from "./services/firestore.service.js";

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

// Almacenamiento Global para nutrir al Bot
let globalData = {
    fixtures: [],
    players: [],
    meetings: [],
    sponsors: []
};

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

    globalData.meetings = await getMeetings();
    renderMeetings(globalData.meetings);

    globalData.sponsors = await getSponsors();
    renderSponsors(globalData.sponsors);
}

// ==========================================
// RENDER: FIXTURES
// ==========================================
function renderFixtures(fixtures) {
    const container = document.getElementById("publicFixturesContainer");
    if (!container) return;

    if (fixtures.length === 0) {
        container.innerHTML = `<p style="text-align: center; color: #a3a3a3;">Aún no hay partidos programados.</p>`;
        return;
    }

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

        finalHtml += `
            <details class="fune-accordion">
                <summary>🏆 CATEGORÍA ${cat}</summary>
                <div class="fune-accordion-content">
        `;

        finalHtml += grouped[cat].map(f => {
            const isFinished = f.status === "finished";
            const scoreHtml = isFinished 
                ? `<strong style="color:#ffffff; font-size:1.8rem; margin: 0 15px; background: rgba(220,38,38,0.2); padding: 5px 15px; border-radius: 8px;">${f.scoreLocal || 0} - ${f.scoreAway || 0}</strong>`
                : `<strong style="color:#dc2626; font-size:1.5rem; margin: 0 15px;">VS</strong>`;

            return `
                <div class="glass-premium" style="padding: 15px; margin-bottom: 15px; border-left: 4px solid #dc2626; display: flex; flex-direction: column; gap: 10px; background: rgba(10, 10, 10, 0.8);">
                    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 8px;">
                        <span style="color: #3b82f6; font-weight: bold; font-size: 0.85rem; text-transform: uppercase;">${f.round || 'A DEFINIR'}</span>
                        <span style="color: #a3a3a3; font-size: 0.85rem;">📅 ${f.date} ${f.time ? '🕒 ' + f.time : ''}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap;">
                        <div style="flex: 1; display: flex; align-items: center; justify-content: flex-end; gap: 10px;">
                            <span style="font-size: 1.3rem; font-family: 'Bebas Neue', cursive; font-weight: 600; color: #fff;">${f.homeClubId}</span>
                            <img src="${getLogoSrc(f.homeClubId)}" alt="${f.homeClubId}" style="width: 40px; height: 40px; object-fit: contain;">
                        </div>
                        <div style="text-align: center; min-width: 90px;">${scoreHtml}</div>
                        <div style="flex: 1; display: flex; align-items: center; justify-content: flex-start; gap: 10px;">
                            <img src="${getLogoSrc(f.awayClubId)}" alt="${f.awayClubId}" style="width: 40px; height: 40px; object-fit: contain;">
                            <span style="font-size: 1.3rem; font-family: 'Bebas Neue', cursive; font-weight: 600; color: #fff;">${f.awayClubId}</span>
                        </div>
                    </div>
                </div>
            `;
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

    if (players.length === 0) {
        container.innerHTML = `<p style="text-align: center; color: #a3a3a3;">El cuerpo técnico está cerrando las listas.</p>`;
        return;
    }

    const grouped = {};
    players.forEach(p => {
        if (!grouped[p.categoryId]) grouped[p.categoryId] = [];
        grouped[p.categoryId].push(p);
    });

    let html = "";
    Object.keys(grouped).sort().forEach(cat => {
        html += `
            <details class="fune-accordion">
                <summary>🏀 CATEGORÍA ${cat} <span style="font-size: 1rem; color: #ffbaba; font-family: 'Poppins', sans-serif;">(${grouped[cat].length} Jugadores)</span></summary>
                <div class="fune-accordion-content" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 15px;">
        `;
        
        grouped[cat].sort((a, b) => a.name.localeCompare(b.name)).forEach(p => {
            html += `
                <div style="background: rgba(255,255,255,0.05); border-left: 3px solid #dc2626; padding: 12px; border-radius: 6px;">
                    <strong style="color: #fff; display: block; margin-bottom: 3px;">${p.name}</strong>
                    <span style="color: #a3a3a3; font-size: 0.8rem;">Nacimiento: ${p.birthdate}</span>
                </div>
            `;
        });
        
        html += `</div></details>`;
    });

    container.innerHTML = html;
}

// ==========================================
// RENDER: ACTAS DE COMISIÓN
// ==========================================
function renderMeetings(meetings) {
    const container = document.getElementById("meetingsContainer");
    if (!container) return;

    if (meetings.length === 0) {
        container.innerHTML = `<p style="text-align: center; color: #a3a3a3; padding: 20px;">No hay actas subidas por el momento.</p>`;
        return;
    }

    container.innerHTML = meetings.map(m => {
        let imgsHtml = "";
        if (m.images && Array.isArray(m.images)) {
            imgsHtml = `<div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:10px;">` + 
                m.images.map(url => `<a href="${url}" target="_blank"><img src="${url}" class="meeting-img" alt="Acta"></a>`).join("") + 
                `</div>`;
        } else if (m.imageUrl) {
            imgsHtml = `<div style="margin-top:10px;"><a href="${m.imageUrl}" target="_blank"><img src="${m.imageUrl}" class="meeting-img" alt="Acta"></a></div>`;
        }

        return `
            <div class="meeting-card">
                <div class="meeting-info">
                    <span style="color:#a3a3a3; font-size:0.75rem;">📅 REUNIÓN DEL ${m.date}</span>
                    <h4 class="meeting-title">${m.title}</h4>
                    <p class="meeting-summary">${m.summary || 'Sin reseña adjunta.'}</p>
                    ${imgsHtml}
                </div>
            </div>
        `;
    }).join("");
}

// ==========================================
// RENDER: SPONSORS
// ==========================================
function renderSponsors(sponsors) {
    const container = document.getElementById("sponsorsContainer");
    if (!container) return;

    if (sponsors.length === 0) {
        document.querySelector('.sponsors-bar').style.display = 'none';
        return;
    }

    const duplicated = [...sponsors, ...sponsors, ...sponsors];
    
    container.innerHTML = duplicated.map(s => `
        <a href="${s.link || '#'}" target="_blank" class="sponsor-card">
            <img src="${s.logoUrl || DEFAULT_LOGO}" alt="${s.name}" class="sponsor-logo">
            <div>
                <h4 style="margin:0; font-size: 1rem; color: #fff;">${s.name}</h4>
                ${s.address ? `<p style="color: #a3a3a3; font-size: 0.75rem; margin: 0;">${s.address}</p>` : ''}
            </div>
        </a>
    `).join("");
}

// ==========================================
// FUNEBOT OMNISCIENTE (ASISTENTE IA)
// ==========================================
function initFuneBot() {
  const toggleBtn = document.getElementById("chatbot-toggle");
  const chatContainer = document.getElementById("chatbot-container");
  const closeBtn = document.getElementById("close-chat");
  const sendBtn = document.getElementById("send-chat");
  const inputEl = document.getElementById("chat-input");
  const messagesEl = document.getElementById("chat-messages");

  if(!toggleBtn || !chatContainer) return;

  toggleBtn.addEventListener("click", () => {
    chatContainer.classList.toggle("hidden");
    if(!chatContainer.classList.contains("hidden")) inputEl.focus();
  });

  if (closeBtn) closeBtn.addEventListener("click", () => chatContainer.classList.add("hidden"));

  const appendMsg = (text, sender) => {
    const div = document.createElement("div");
    div.className = sender === "user" ? "msg-user" : "msg-bot";
    div.textContent = text;
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  };

  const processMessage = async () => {
    const userText = inputEl.value.trim();
    if(!userText) return;

    appendMsg(userText, "user");
    inputEl.value = "";

    // Construcción del Cerebro Omnisciente
    const dataContext = {
      partidos: globalData.fixtures.slice(0, 15), 
      institucional: globalData.meetings.slice(0, 5),
      jugadores_destacados: globalData.players.slice(0, 20),
      patrocinadores: globalData.sponsors
    };
    
    let contextStr = `Eres el FuneBot, el asistente inteligente oficial y fanático del Club Atlético Funebrero. 
    REGLA 1: La plataforma y tu inteligencia fueron desarrolladas y creadas por la agencia "Rey Digital del Norte", dirigida por Fabián O. López. 
    REGLA 2: Conoces absolutamente todo lo que pasa en el club. Si te preguntan por resultados, reuniones de comisión directiva, sponsors, categorías o creadores, responde con orgullo usando esta base de datos actualizada en tiempo real: ${JSON.stringify(dataContext)}. 
    REGLA 3: Si te preguntan de códigos, programación o lenguajes, di que esos son secretos tácticos del director Fabián O. López y Rey Digital del Norte. 
    PREGUNTA DEL USUARIO: ${userText}`;

    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
        method: "POST", 
        headers: { "Content-Type": "application/json" }, 
        body: JSON.stringify({ contents: [{ parts: [{ text: contextStr }] }] })
      });
      if (!res.ok) throw new Error("Error servidor");
      const data = await res.json();
      const botReply = data.candidates[0].content.parts[0].text;
      appendMsg(botReply, "model");
    } catch(e) {
      appendMsg("Uf, la cancha se quedó sin señal por un segundo. ¿Me repetís la jugada?", "model");
    }
  };

  if (sendBtn) sendBtn.addEventListener("click", processMessage);
  if (inputEl) inputEl.addEventListener("keypress", (e) => { if(e.key === "Enter") processMessage(); });
}