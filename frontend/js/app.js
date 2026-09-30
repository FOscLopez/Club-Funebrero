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

function getLogoSrc(clubName) {
    if (!clubName) return DEFAULT_LOGO;
    const nameUpper = clubName.toUpperCase();
    for (let key in CLUB_LOGOS) {
        if (nameUpper.includes(key)) return CLUB_LOGOS[key];
    }
    return DEFAULT_LOGO;
}

document.addEventListener("DOMContentLoaded", () => {
    console.log("🏀 Plataforma del Club Funebrero inicializada.");

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
});

async function initApp() {
    listenToFixtures((fixtures) => {
        renderFixtures(fixtures);
    });

    const players = await getPlayers();
    renderRosters(players);

    const meetings = await getMeetings();
    renderMeetings(meetings);

    const sponsors = await getSponsors();
    renderSponsors(sponsors);
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

        // NOTA: Se quitó el atributo 'open' para que inicie cerrado
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

    container.innerHTML = meetings.map(m => `
        <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); padding: 15px; border-radius: 8px; margin-bottom: 15px; border-left: 4px solid #3b82f6;">
            <span style="color:#a3a3a3; font-size:0.8rem;">📅 REUNIÓN DEL ${m.date}</span>
            <h4 style="margin: 5px 0; color: #fff; font-size: 1.1rem;">${m.title}</h4>
            <p style="margin: 0; font-size: 0.9rem; color: #cbd5e1;">${m.summary || 'Sin reseña adjunta.'}</p>
        </div>
    `).join("");
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