import { 
    listenToFixtures, getPlayers, listenToMeetings, listenToSponsors, 
    getSocioByDni, registerPaymentIntent, listenToCarouselImages, 
    listenToUpcomingMatches, listenToSocios, updateSocio 
} from "./services/firestore.service.js";

const CLUB_LOGOS = {
    "FUNEBRERO": "logo-funebrero_2.png",
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

const DEFAULT_LOGO = "logo-funebrero_2.png";
const GEMINI_API_KEY = "AIzaSyDvsq3fg1nEOQxR8wVcZW8rEX2lcc_xC8U";
const ADMIN_CUOTAS_WHATSAPP = "5493625451176";
const CUOTA_VALOR_MENSUAL = 5000;

// INICIO OFICIAL DEL CONTROL DE CUOTAS: MARZO 2027
const CUOTAS_START_YEAR = 2027;
const CUOTAS_START_MONTH = 3; // 1 = Enero ... 3 = Marzo
const MONTH_SHORT = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

let globalData = { 
    fixtures: [], players: [], meetings: [], sponsors: [], 
    socios: [], currentSocio: null, carouselImages: [], upcomingMatches: [] 
};
let sociosFilterState = { search: "", status: "all" };

function getLogoSrc(clubName) {
    if (!clubName) return DEFAULT_LOGO;
    const nameUpper = clubName.toUpperCase();
    for (let key in CLUB_LOGOS) {
        if (nameUpper.includes(key)) return CLUB_LOGOS[key];
    }
    return DEFAULT_LOGO;
}

// ==========================================
// MOTOR DE CÁLCULO DE CUOTAS (DESDE MARZO 2027, VENCIMIENTO DÍA 10)
// ==========================================
function formatMonthKey(key) {
    const [y, m] = key.split("-");
    const idx = parseInt(m, 10) - 1;
    return `${MONTH_SHORT[idx] || m} ${y}`;
}

function getSelectableMonthKeys() {
    const keys = [];
    const now = new Date();
    const endYear = Math.max(now.getFullYear() + 1, 2028);
    let y = CUOTAS_START_YEAR;
    let m = CUOTAS_START_MONTH;
    while (y < endYear || (y === endYear && m <= 12)) {
        keys.push(`${y}-${String(m).padStart(2, "0")}`);
        m++;
        if (m > 12) { m = 1; y++; }
    }
    return keys;
}

function evaluateSocioStatus(socio) {
    const paidMonths = Array.isArray(socio.paidMonths) ? [...new Set(socio.paidMonths)].sort() : [];
    const now = new Date();
    const currYear = now.getFullYear();
    const currMonth = now.getMonth() + 1;
    const currDay = now.getDate();

    const isBeforeStart = (currYear < CUOTAS_START_YEAR) || (currYear === CUOTAS_START_YEAR && currMonth < CUOTAS_START_MONTH);

    if (isBeforeStart) {
        return {
            status: "al-dia",
            label: "AL DÍA (Inicio Mar 2027)",
            paidMonths,
            owedMonths: [],
            pendingCurrentMonth: null,
            isBeforeStart: true
        };
    }

    const owedMonths = [];
    let pendingCurrentMonth = null;

    let y = CUOTAS_START_YEAR;
    let m = CUOTAS_START_MONTH;
    while (y < currYear || (y === currYear && m <= currMonth)) {
        const key = `${y}-${String(m).padStart(2, "0")}`;
        if (!paidMonths.includes(key)) {
            if (y === currYear && m === currMonth && currDay <= 10) {
                pendingCurrentMonth = key;
            } else {
                owedMonths.push(key);
            }
        }
        m++;
        if (m > 12) { m = 1; y++; }
    }

    if (owedMonths.length > 0) {
        return {
            status: "moroso",
            label: `MOROSO (${owedMonths.length} ${owedMonths.length === 1 ? "mes" : "meses"})`,
            paidMonths,
            owedMonths,
            pendingCurrentMonth,
            isBeforeStart: false
        };
    }

    if (pendingCurrentMonth) {
        return {
            status: "en-plazo",
            label: "VENCE EL 10",
            paidMonths,
            owedMonths: [],
            pendingCurrentMonth,
            isBeforeStart: false
        };
    }

    return {
        status: "al-dia",
        label: "AL DÍA",
        paidMonths,
        owedMonths: [],
        pendingCurrentMonth: null,
        isBeforeStart: false
    };
}

// ==========================================
// INICIADOR DE ANIMACIONES DE SCROLL
// ==========================================
const scrollObserverOptions = { root: null, rootMargin: '0px', threshold: 0.15 };
const scrollObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('active');
            observer.unobserve(entry.target); 
        }
    });
}, scrollObserverOptions);

function initScrollReveal() {
    document.querySelectorAll('.reveal').forEach(el => scrollObserver.observe(el));
}

window.observeDynamicElements = () => {
    setTimeout(() => {
        document.querySelectorAll('.reveal:not(.active)').forEach(el => scrollObserver.observe(el));
    }, 100); 
};

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
    initScrollReveal();
    initApp();
    initFuneBot();
});

async function initApp() {
    listenToFixtures((fixtures) => {
        globalData.fixtures = fixtures;
        renderFixtures(fixtures);
        if(globalData.upcomingMatches.length > 0) {
            renderUpcomingMatches(globalData.upcomingMatches);
        }
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

    listenToCarouselImages((images) => {
        globalData.carouselImages = images;
        renderMainCarousel(images);
    });

    listenToUpcomingMatches((matches) => {
        globalData.upcomingMatches = matches;
        renderUpcomingMatches(matches);
    });

    listenToSocios((socios) => {
        globalData.socios = socios;
        renderPublicSociosGrid();
        if (globalData.currentSocio && globalData.currentSocio.id) {
            const updated = socios.find(s => s.id === globalData.currentSocio.id);
            if (updated) {
                globalData.currentSocio = updated;
                renderSocioDashboardCuotas(updated);
            }
        }
    });
    
    initSociosGridControls();
    initSociosPortal();
}

// ==========================================
// PLANILLA PÚBLICA DE SOCIOS
// ==========================================
function initSociosGridControls() {
    const searchInput = document.getElementById("sociosSearchInput");
    if (searchInput) {
        searchInput.addEventListener("input", (e) => {
            sociosFilterState.search = e.target.value.trim().toLowerCase();
            renderPublicSociosGrid();
        });
    }
    document.querySelectorAll(".filter-chip").forEach(btn => {
        btn.addEventListener("click", () => {
            document.querySelectorAll(".filter-chip").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            sociosFilterState.status = btn.getAttribute("data-filter") || "all";
            renderPublicSociosGrid();
        });
    });
}

window.scrollToSocioLogin = () => {
    const loginBox = document.getElementById("login-socio-box");
    const dniInput = document.getElementById("socioDniInput");
    if (loginBox) loginBox.scrollIntoView({ behavior: "smooth", block: "center" });
    if (dniInput) setTimeout(() => dniInput.focus(), 500);
};

function renderPublicSociosGrid() {
    const tbody = document.getElementById("publicSociosTableBody");
    const summaryBar = document.getElementById("sociosSummaryBar");
    if (!tbody) return;

    if (globalData.socios.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:#94a3b8; padding: 25px;">Aún no hay socios cargados en el padrón.</td></tr>`;
        return;
    }

    let countOk = 0, countWarn = 0, countBad = 0;

    const evaluated = globalData.socios.map(s => {
        const info = evaluateSocioStatus(s);
        if (info.status === "al-dia") countOk++;
        else if (info.status === "en-plazo") countWarn++;
        else countBad++;
        return { socio: s, info };
    });

    if (summaryBar) {
        summaryBar.innerHTML = `
            <span class="summary-pill pill-ok">✅ Al día: ${countOk}</span>
            <span class="summary-pill pill-warn">⏳ En plazo (1 al 10): ${countWarn}</span>
            <span class="summary-pill pill-bad">🚨 Morosos: ${countBad}</span>
        `;
    }

    const filtered = evaluated.filter(({ socio, info }) => {
        const matchesStatus = sociosFilterState.status === "all" || info.status === sociosFilterState.status;
        const q = sociosFilterState.search;
        const matchesSearch = !q ||
            (socio.name || "").toLowerCase().includes(q) ||
            String(socio.numSocio || "").toLowerCase().includes(q);
        return matchesStatus && matchesSearch;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:#94a3b8; padding: 20px;">No se encontraron socios con ese filtro.</td></tr>`;
        return;
    }

    tbody.innerHTML = filtered.map(({ socio, info }) => {
        const rowClass = info.status === "al-dia" ? "row-al-dia" : (info.status === "en-plazo" ? "row-en-plazo" : "row-moroso");
        const badgeIcon = info.status === "al-dia" ? "✅" : (info.status === "en-plazo" ? "⏳" : "🚨");

        const paidHtml = info.paidMonths.length > 0
            ? info.paidMonths.map(k => `<span class="month-pill paid">${formatMonthKey(k)}</span>`).join("")
            : `<span style="color:#64748b; font-size:0.78rem;">Sin pagos aún</span>`;

        let owedHtml = "";
        if (info.owedMonths.length > 0) {
            owedHtml += info.owedMonths.map(k => `<span class="month-pill owed">${formatMonthKey(k)}</span>`).join("");
        }
        if (info.pendingCurrentMonth) {
            owedHtml += `<span class="month-pill pending">${formatMonthKey(info.pendingCurrentMonth)} (hasta el 10)</span>`;
        }
        if (!owedHtml) {
            owedHtml = `<span style="color:#34d399; font-size:0.8rem; font-weight:600;">Ninguno</span>`;
        }

        const owedListText = [...info.owedMonths, ...(info.pendingCurrentMonth ? [info.pendingCurrentMonth] : [])]
            .map(formatMonthKey).join(", ");
        const wpText = owedListText
            ? `Hola 👋, soy *${socio.name}* (Socio Nº ${socio.numSocio || 'S/N'}). Quiero consultar/regularizar mis cuotas (${owedListText}).`
            : `Hola 👋, soy *${socio.name}* (Socio Nº ${socio.numSocio || 'S/N'}). Quiero consultar sobre mi cuota social.`;
        const wpUrl = `https://wa.me/${ADMIN_CUOTAS_WHATSAPP}?text=${encodeURIComponent(wpText)}`;

        return `
            <tr class="${rowClass}">
                <td>
                    <strong style="color:#fff; display:block;">${socio.name}</strong>
                    <span style="color:#94a3b8; font-size:0.75rem;">Socio Nº ${socio.numSocio || 'S/N'}</span>
                </td>
                <td><span class="status-badge ${info.status}">${badgeIcon} ${info.label}</span></td>
                <td>${paidHtml}</td>
                <td>${owedHtml}</td>
                <td style="text-align:right; white-space:nowrap;">
                    <button type="button" class="mini-action-btn pay" onclick="scrollToSocioLogin()">💳 Pagar</button>
                    <a href="${wpUrl}" target="_blank" class="mini-action-btn wp">📲 Admin</a>
                </td>
            </tr>
        `;
    }).join("");
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
        
        finalHtml += `<details class="fune-accordion reveal"><summary>🏆 CATEGORÍA ${cat}</summary><div class="fune-accordion-content custom-grid">`;
        
        finalHtml += grouped[cat].map(f => {
            const isFinished = f.status === "finished";
            const scoreL = f.scoreLocal !== null && f.scoreLocal !== undefined ? f.scoreLocal : "-";
            const scoreA = f.scoreAway !== null && f.scoreAway !== undefined ? f.scoreAway : "-";
            const displayScore = isFinished || (scoreL !== "-" && scoreA !== "-") ? `${scoreL} - ${scoreA}` : "VS";
            const scoreColor = isFinished ? "var(--rojo-funebrero)" : "#a3a3a3";
            
            let photosHtml = "";
            if (f.planilla || f.photoHome || f.photoAway) {
                photosHtml = `<div style="display:flex; gap:10px; justify-content:center; margin-top:15px; flex-wrap:wrap; width: 100%; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 12px;">`;
                if (f.planilla) photosHtml += `<a href="${f.planilla}" target="_blank" class="outline-btn" style="border-color:#3b82f6; color:#3b82f6;"><i style="font-style:normal;">📄</i> Planilla</a>`;
                if (f.photoHome) photosHtml += `<a href="${f.photoHome}" target="_blank" class="outline-btn" style="border-color:#10b981; color:#10b981;"><i style="font-style:normal;">📸</i> Local</a>`;
                if (f.photoAway) photosHtml += `<a href="${f.photoAway}" target="_blank" class="outline-btn" style="border-color:#f59e0b; color:#f59e0b;"><i style="font-style:normal;">📸</i> Visita</a>`;
                photosHtml += `</div>`;
            }

            return `
                <div class="match-card">
                    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 8px;">
                        <span style="color: #3b82f6; font-weight: bold; font-size: 0.85rem; text-transform: uppercase;">${f.round || 'A DEFINIR'}</span>
                        <span style="color: #a3a3a3; font-size: 0.85rem;">📅 ${f.date} ${f.time ? '🕒 ' + f.time : ''}</span>
                    </div>
                    <div class="match-teams">
                        <div class="match-team">
                            <img src="${getLogoSrc(f.homeClubId)}" alt="Local">
                            <span>${f.homeClubId.substring(0,12)}</span>
                        </div>
                        <div class="match-score-box" style="color: ${scoreColor}">${displayScore}</div>
                        <div class="match-team">
                            <img src="${getLogoSrc(f.awayClubId)}" alt="Visita">
                            <span>${f.awayClubId.substring(0,12)}</span>
                        </div>
                    </div>
                    ${photosHtml}
                </div>`;
        }).join("");
        finalHtml += `</div></details>`;
    });
    container.innerHTML = finalHtml;
    if(window.observeDynamicElements) window.observeDynamicElements();
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
    
    const svgBall = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='46' fill='%23ea580c' stroke='%23431407' stroke-width='4'/><path d='M50 4 v92' stroke='%23431407' stroke-width='3' fill='none'/><path d='M4 50 h92' stroke='%23431407' stroke-width='3' fill='none'/><path d='M15 15 a 40 40 0 0 0 0 70' stroke='%23431407' stroke-width='3' fill='none'/><path d='M85 15 a 40 40 0 0 1 0 70' stroke='%23431407' stroke-width='3' fill='none'/><circle cx='35' cy='35' r='6' fill='%23000'/><circle cx='65' cy='35' r='6' fill='%23000'/><path d='M35 55 Q50 75 65 55' stroke='%23000' stroke-width='5' fill='none' stroke-linecap='round'/></svg>";

    let html = "";
    Object.keys(grouped).sort().forEach(cat => {
        html += `<details class="fune-accordion reveal"><summary>🏀 CATEGORÍA ${cat} <span style="font-size: 0.9rem; color: #a3a3a3; font-family: 'Poppins', sans-serif; font-weight: normal; margin-left: 10px;">(${grouped[cat].length} Jugadores)</span></summary><div class="fune-accordion-content custom-grid-players">`;
        
        grouped[cat].sort((a, b) => a.name.localeCompare(b.name)).forEach(p => {
            html += `
                <div class="player-card">
                    <img src="${p.photoUrl || svgBall}" class="smiling-ball" alt="Jugador">
                    <strong style="color: #fff; display: block; font-family: 'Bebas Neue', cursive; font-size: 1.2rem; letter-spacing: 1px;">${p.name}</strong>
                    <span style="color: #a3a3a3; font-size: 0.75rem;">Nac: ${p.birthdate}</span>
                </div>`;
        });
        html += `</div></details>`;
    });
    container.innerHTML = html;
    if(window.observeDynamicElements) window.observeDynamicElements();
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

    let html = `<div class="custom-grid">`;
    birthdaysThisMonth.forEach(p => {
        let pDay = parseInt(p.birthdate.split(/[-/]/)[0], 10);
        let isToday = (pDay === currentDay);
        
        if (isToday) {
            if (ticker && !ticker.innerHTML.includes(p.name)) {
                ticker.innerHTML += `<div class="ticker-item"><span style="background: #dc2626; color: white;">🎉 ¡FELIZ CUMPLEAÑOS!</span> Hoy celebramos a ${p.name} (Cat. ${p.categoryId}). ¡La familia Funebrera te desea lo mejor!</div>`;
            }
            html += `
                <div class="birthday-card is-today">
                    <div>
                        <strong style="color: #fff; font-size: 1.1rem; display: block;">${p.name}</strong>
                        <span style="color: #a3a3a3; font-size: 0.8rem;">Categoría: ${p.categoryId}</span>
                    </div>
                    <div style="text-align: right; margin-top: 15px;">
                        <span style="color: #dc2626; font-weight: bold; font-size: 0.8rem; text-transform: uppercase;">¡ES HOY! 🎂</span>
                        <div style="color: #fff; font-size: 1.8rem; font-family: 'Bebas Neue', cursive;">${pDay} DE ${monthNames[today.getMonth()].toUpperCase()}</div>
                    </div>
                </div>`;
        } else {
            let passClass = pDay < currentDay ? 'opacity: 0.5;' : '';
            html += `
                <div class="birthday-card" style="${passClass}">
                    <div>
                        <strong style="color: #e2e8f0; font-size: 1rem; display: block;">${p.name}</strong>
                        <span style="color: #64748b; font-size: 0.8rem;">Categoría: ${p.categoryId}</span>
                    </div>
                    <div style="text-align: right; margin-top: 15px;">
                        <div style="color: #3b82f6; font-size: 1.8rem; font-family: 'Bebas Neue', cursive;">DÍA ${pDay}</div>
                    </div>
                </div>`;
        }
    });

    html += `</div>`;
    container.innerHTML = html;
}

// ==========================================
// RENDER: ACTAS INSTITUCIONALES
// ==========================================
function renderMeetings(meetings) {
    const container = document.getElementById("meetingsContainer");
    if (!container) return;
    if (meetings.length === 0) { 
        container.innerHTML = `<p style="text-align: center; color: #a3a3a3; padding: 20px;">No hay documentos institucionales subidos por el momento.</p>`; 
        return; 
    }

    meetings.sort((a, b) => new Date(b.date) - new Date(a.date));

    let html = `<div class="custom-grid">`;
    
    html += meetings.map(m => {
        let pdfHtml = "";
        if (m.pdfUrl && m.pdfUrl.includes("drive.google.com")) {
            let previewLink = m.pdfUrl.replace('/view', '/preview').split('?')[0];
            pdfHtml = `
                <div style="margin-top: 15px; border-radius: 8px; overflow: hidden; border: 1px solid rgba(220,38,38,0.3);">
                    <iframe src="${previewLink}" width="100%" height="250px" style="border: none;" allow="autoplay"></iframe>
                </div>
                <div style="text-align: right; margin-top: 8px;">
                    <a href="${m.pdfUrl}" target="_blank" style="color: #3b82f6; font-size: 0.8rem; font-weight: bold; text-decoration: none; transition: 0.3s;">📄 Descargar Documento</a>
                </div>
            `;
        } else if (m.pdfUrl) {
            pdfHtml = `<div style="margin-top: 10px; text-align: center;"><a href="${m.pdfUrl}" target="_blank" style="color: #3b82f6; font-size: 0.85rem; font-weight: bold; text-decoration: none; background: rgba(59, 130, 246, 0.1); padding: 8px 15px; border-radius: 6px; border: 1px solid rgba(59, 130, 246, 0.3); display: inline-block;">📄 Ver Documento Adjunto</a></div>`;
        }

        return `
            <div class="meeting-card-horiz">
                <div style="width: 100%;">
                    <span style="color:#a3a3a3; font-size:0.8rem;">📅 FECHA: ${m.date}</span>
                    <h4 style="color: #dc2626; font-family: 'Bebas Neue', cursive; font-size: 1.5rem; letter-spacing: 1px; margin: 5px 0;">${m.title}</h4>
                    <p style="color: #cbd5e1; font-size: 0.9rem; line-height: 1.5; margin: 10px 0;">${m.summary || ''}</p>
                    ${pdfHtml}
                </div>
            </div>`;
    }).join("");
    
    html += `</div>`;
    container.innerHTML = html;
    if(window.observeDynamicElements) window.observeDynamicElements();
}

// ==========================================
// RENDER: SPONSORS
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
// RENDER: CARRUSEL PRINCIPAL
// ==========================================
let carouselInterval = null;
function renderMainCarousel(images) {
    const container = document.getElementById("main-carousel-container");
    if (!container) return;
    
    if (images.length === 0) {
        container.style.display = 'none';
        if (carouselInterval) clearInterval(carouselInterval);
        return;
    }

    container.style.display = 'block';
    
    container.innerHTML = images.map((img, idx) => `
        <img src="${img.imageUrl}" class="carousel-slide ${idx === 0 ? 'active' : ''}" alt="Club Funebrero">
    `).join("");

    if (carouselInterval) clearInterval(carouselInterval);

    if (images.length > 1) {
        let currentIndex = 0;
        const slides = container.querySelectorAll('.carousel-slide');
        carouselInterval = setInterval(() => {
            slides[currentIndex].classList.remove('active');
            currentIndex = (currentIndex + 1) % slides.length;
            slides[currentIndex].classList.add('active');
        }, 4000); 
    }
}

// ==========================================
// RENDER: PRÓXIMOS PARTIDOS
// ==========================================
let matchesInterval = null;
function renderUpcomingMatches(matches) {
    const container = document.getElementById("upcoming-matches-container");
    if (!container) return;
    
    const activeMatches = matches.filter(m => {
        if (!m.fixtureId) return true; 
        const linkedFixture = globalData.fixtures.find(f => f.id === m.fixtureId);
        if (!linkedFixture) return false; 
        return linkedFixture.status !== "finished";
    });

    if (activeMatches.length === 0) {
        container.innerHTML = `
            <div style="background: rgba(15,15,15,0.6); padding: 30px; border-radius: 12px; border: 1px dashed #333;">
                <p style="color:#a3a3a3; font-size:1.1rem; margin:0;">⏳ Esperando confirmación de próximos partidos...</p>
            </div>
        `;
        if (matchesInterval) clearInterval(matchesInterval);
        return;
    }

    container.innerHTML = `
        <div class="reveal" style="position: relative; height: 400px; border-radius: 12px; overflow: hidden; background: #000; box-shadow: 0 10px 30px rgba(0,0,0,0.5); border: 1px solid rgba(220, 38, 38, 0.3);">
            ${activeMatches.map((match, idx) => `
                <img src="${match.imageUrl}" class="match-slide ${idx === 0 ? 'active' : ''}" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; opacity: ${idx === 0 ? '1' : '0'}; transition: opacity 1s ease-in-out; object-fit: contain;" alt="Próximo Partido">
            `).join("")}
        </div>
    `;

    if (matchesInterval) clearInterval(matchesInterval);
    
    if (activeMatches.length > 1) {
        let currentIndex = 0;
        const slides = container.querySelectorAll('.match-slide');
        matchesInterval = setInterval(() => {
            slides[currentIndex].classList.remove('active');
            slides[currentIndex].style.opacity = '0';
            currentIndex = (currentIndex + 1) % activeMatches.length;
            slides[currentIndex].classList.add('active');
            slides[currentIndex].style.opacity = '1';
        }, 5000);
    }
    if(window.observeDynamicElements) window.observeDynamicElements();
}

// ==========================================
// PORTAL DE SOCIOS (AUTOGESTIÓN DE CUOTAS)
// ==========================================
function renderSocioDashboardCuotas(socio) {
    const banner = document.getElementById("dash-status-banner");
    const selector = document.getElementById("socioMonthsSelector");
    const pagoMonto = document.getElementById("pagoMonto");
    if (!banner || !selector) return;

    const info = evaluateSocioStatus(socio);
    if (info.status === "al-dia") {
        banner.className = "socio-alert-banner ok";
        banner.innerHTML = info.isBeforeStart
            ? "✅ Estás AL DÍA. El calendario de cuotas comienza en Marzo 2027 (podés adelantar cuotas si querés)."
            : "✅ ¡Excelente! Estás AL DÍA con tus cuotas sociales.";
    } else if (info.status === "en-plazo") {
        banner.className = "socio-alert-banner warn";
        banner.innerHTML = `⏳ ALERTA DE PAGO: Tenés tiempo hasta el día 10 para abonar ${formatMonthKey(info.pendingCurrentMonth)} sin mora.`;
    } else {
        banner.className = "socio-alert-banner bad";
        const deudaTxt = info.owedMonths.map(formatMonthKey).join(", ");
        banner.innerHTML = `🚨 CUOTA VENCIDA: Adeudás ${deudaTxt}. Seleccioná los meses abajo para ponerte al día.`;
    }

    const selectableKeys = getSelectableMonthKeys();
    const toAutoCheck = [...info.owedMonths, ...(info.pendingCurrentMonth ? [info.pendingCurrentMonth] : [])];
    const firstUnpaid = selectableKeys.find(k => !info.paidMonths.includes(k));

    selector.innerHTML = selectableKeys.map(key => {
        const isPaid = info.paidMonths.includes(key);
        const isOwed = info.owedMonths.includes(key);
        const shouldCheck = !isPaid && (toAutoCheck.length > 0 ? toAutoCheck.includes(key) : key === firstUnpaid);
        const cls = isPaid ? "is-paid" : (isOwed ? "is-owed" : "");
        return `
            <label class="month-check-label ${cls}">
                <input type="checkbox" class="socio-month-cb" value="${key}" ${isPaid ? "checked disabled" : (shouldCheck ? "checked" : "")}>
                <span>${formatMonthKey(key)}${isPaid ? " ✓" : ""}</span>
            </label>
        `;
    }).join("");

    const updateSelectedAmount = () => {
        const selected = Array.from(document.querySelectorAll(".socio-month-cb:checked:not(:disabled)")).map(cb => cb.value);
        const count = Math.max(selected.length, 1);
        const calculated = count * CUOTA_VALOR_MENSUAL;
        if (pagoMonto) {
            pagoMonto.min = calculated;
            pagoMonto.value = calculated;
            document.getElementById("pdf-monto").textContent = calculated;
        }
        const pdfMeses = document.getElementById("pdf-meses");
        if (pdfMeses) pdfMeses.textContent = selected.length > 0 ? selected.map(formatMonthKey).join(", ") : "Aporte Voluntario";
    };

    selector.querySelectorAll(".socio-month-cb:not(:disabled)").forEach(cb => {
        cb.addEventListener("change", updateSelectedAmount);
    });
    updateSelectedAmount();
}

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
    const btnEnviarWhatsApp = document.getElementById("btnEnviarWhatsApp");
    const pagoMonto = document.getElementById("pagoMonto");
    const pdfInfoText = document.getElementById("pdfInfoText");

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

        if (socio) {
            const cleanBirth = (socio.birthdate || "").replace(/[^0-9]/g, '');
            
            if (pass !== cleanBirth) {
                errorMsg.textContent = "Contraseña incorrecta. (Recuerda: fecha de nacimiento sin barras, ej: 13031990)";
                errorMsg.style.display = "block";
            } else {
                globalData.currentSocio = socio;
                document.getElementById("dash-nombre").textContent = socio.name; 
                document.getElementById("pdf-nombre").textContent = socio.name;
                document.getElementById("pdf-dni").innerHTML = `${socio.dni} <strong style="color:#dc2626; margin-left: 10px;">| N° Socio: ${socio.numSocio || 'S/N'}</strong>`;
                document.getElementById("pdf-fecha").textContent = new Date().toLocaleDateString();

                renderSocioDashboardCuotas(socio);

                if (btnDescargarPdf) {
                    btnDescargarPdf.disabled = true;
                    btnDescargarPdf.style.opacity = "0.5";
                    btnDescargarPdf.style.cursor = "not-allowed";
                    if(pdfInfoText) pdfInfoText.style.display = "block";
                }

                boxLogin.style.display = "none";
                boxDash.style.display = "block";
            }
        } else {
            errorMsg.textContent = "DNI no registrado en el sistema. Verifica que esté bien escrito o comunícate con nosotros.";
            errorMsg.style.display = "block";
            wpMsg.style.display = "block"; 
        }
        btnBuscar.textContent = "Ingresar a mi Cuenta";
    });

    if(pagoMonto) {
        pagoMonto.addEventListener("blur", () => {
            const minVal = parseInt(pagoMonto.min, 10) || CUOTA_VALOR_MENSUAL;
            if (parseInt(pagoMonto.value, 10) < minVal || isNaN(parseInt(pagoMonto.value, 10))) {
                pagoMonto.value = minVal;
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
            const selectedMonths = Array.from(document.querySelectorAll(".socio-month-cb:checked:not(:disabled)")).map(cb => cb.value);
            await registerPaymentIntent({ 
                socioId: globalData.currentSocio.id || null,
                socioDni: globalData.currentSocio.dni, 
                socioNombre: globalData.currentSocio.name, 
                months: selectedMonths,
                monto: pagoMonto ? parseInt(pagoMonto.value, 10) : CUOTA_VALOR_MENSUAL,
                origen: "portal_mp"
            });
        }
    });

    if(btnEnviarWhatsApp) {
        btnEnviarWhatsApp.addEventListener("click", async () => {
            if(globalData.currentSocio) {
                const selectedMonths = Array.from(document.querySelectorAll(".socio-month-cb:checked:not(:disabled)")).map(cb => cb.value);
                const monto = pagoMonto ? parseInt(pagoMonto.value, 10) : CUOTA_VALOR_MENSUAL;
                document.getElementById("pdf-monto").textContent = monto;
                const mesesLegibles = selectedMonths.length > 0 ? selectedMonths.map(formatMonthKey).join(", ") : "Aporte Voluntario";
                const pdfMeses = document.getElementById("pdf-meses");
                if (pdfMeses) pdfMeses.textContent = mesesLegibles;

                // Carga automatizada en Firestore de las cuotas abonadas por el socio
                if (globalData.currentSocio.id && selectedMonths.length > 0) {
                    const prevPaid = Array.isArray(globalData.currentSocio.paidMonths) ? globalData.currentSocio.paidMonths : [];
                    const mergedPaid = [...new Set([...prevPaid, ...selectedMonths])].sort();
                    try {
                        await updateSocio(globalData.currentSocio.id, {
                            paidMonths: mergedPaid,
                            lastPaymentDate: new Date().toISOString()
                        });
                        await registerPaymentIntent({
                            socioId: globalData.currentSocio.id,
                            socioDni: globalData.currentSocio.dni,
                            socioNombre: globalData.currentSocio.name,
                            months: selectedMonths,
                            monto: monto,
                            status: "acreditado_portal",
                            origen: "portal_socios"
                        });
                        globalData.currentSocio.paidMonths = mergedPaid;
                        renderSocioDashboardCuotas(globalData.currentSocio);
                    } catch (err) {
                        console.error("Error acreditando cuota automática:", err);
                    }
                }
                
                const numSo = globalData.currentSocio.numSocio || 'S/N';
                const mensaje = `Hola Vicente 👋.\n\nSoy el socio/a *${globalData.currentSocio.name}*\n(DNI: ${globalData.currentSocio.dni} - Socio Nº: ${numSo}).\nMeses abonados: *${mesesLegibles}*.\nMonto total: *$${monto}*.\n\nTe envío adjunto el comprobante de mi aporte al Club.\n¡Abrazo Funebrero!`;
                
                const url = `https://wa.me/${ADMIN_CUOTAS_WHATSAPP}?text=${encodeURIComponent(mensaje)}`;
                window.open(url, "_blank");

                if (btnDescargarPdf) {
                    btnDescargarPdf.disabled = false;
                    btnDescargarPdf.style.opacity = "1";
                    btnDescargarPdf.style.cursor = "pointer";
                    if(pdfInfoText) pdfInfoText.style.display = "none";
                }
            }
        });
    }

    btnDescargarPdf.addEventListener("click", () => {
        if (btnDescargarPdf.disabled) return; 
        
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