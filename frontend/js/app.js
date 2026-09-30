import { db } from "./services/firebase.config.js";
import { collection, onSnapshot, query, orderBy } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ==========================================
// DICCIONARIO DE LOGOS (IMGBB)
// Reemplaza los enlaces por los tuyos de ImgBB
// ==========================================
const CLUB_LOGOS = {
    "FUNEBRERO": "https://i.ibb.co/r85gwzH/funebrero.webp", // Usa tu logo local
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

// URL para rivales no encontrados o "A definir"
const DEFAULT_LOGO = "https://i.ibb.co/Cpw4zbBv/571425287-18303994912267310-8920899741855718292-n.jpg";

// Función inteligente que busca coincidencias en el nombre
function getLogoSrc(clubName) {
    if (!clubName) return DEFAULT_LOGO;
    const nameUpper = clubName.toUpperCase();
    for (let key in CLUB_LOGOS) {
        if (nameUpper.includes(key)) {
            return CLUB_LOGOS[key];
        }
    }
    return DEFAULT_LOGO;
}

document.addEventListener("DOMContentLoaded", () => {
    console.log("🏀 Plataforma del Club Funebrero inicializada.");

    // Navegación suave
    document.querySelectorAll('.nav-links a').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const targetId = this.getAttribute('href');
            if (targetId && targetId.startsWith('#')) {
                e.preventDefault();
                const targetElement = document.querySelector(targetId);
                if (targetElement) {
                    targetElement.scrollIntoView({ behavior: 'smooth' });
                }
            }
        });
    });

    // Conectar Fixture en Tiempo Real
    listenToPublicFixtures();
});

function listenToPublicFixtures() {
    const container = document.getElementById("publicFixturesContainer");
    if (!container) return;

    // Pedimos los partidos (se actualizará solo sin F5)
    const q = query(collection(db, "fixtures"), orderBy("createdAt", "desc"));
    
    onSnapshot(q, (snapshot) => {
        if (snapshot.empty) {
            container.innerHTML = `
                <div class="glass-premium" style="padding: 50px 20px; text-align: center;">
                    <h3 style="color: #dc2626; font-size: 2.5rem; margin-bottom: 15px;">Próximamente</h3>
                    <p style="font-size: 1.1rem; color: #a3a3a3;">Aún no hay partidos programados para esta temporada.</p>
                </div>
            `;
            return;
        }

        const fixtures = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // AGRUPAR POR CATEGORÍA
        const grouped = {};
        fixtures.forEach(f => {
            const cat = f.categoryId || "Sin Categoría";
            if (!grouped[cat]) grouped[cat] = [];
            grouped[cat].push(f);
        });

        let finalHtml = "";

        // Ordenamos y dibujamos las categorías
        Object.keys(grouped).sort().forEach(cat => {
            finalHtml += `
                <div style="margin-bottom: 50px;">
                    <h3 style="color: #ff3b3b; font-family: 'Bebas Neue', cursive; font-size: 2.2rem; border-bottom: 2px solid rgba(220, 38, 38, 0.3); padding-bottom: 10px; margin-bottom: 20px; letter-spacing: 1px;">
                        🏆 CATEGORÍA ${cat}
                    </h3>
            `;

            // Dibujamos los partidos de esta categoría
            finalHtml += grouped[cat].map(f => {
                const isFinished = f.status === "finished";
                const isLive = f.status === "live";
                
                let statusBadge = '';
                let scoreHtml = `<strong style="color:#dc2626; font-size:1.5rem; margin: 0 15px;">VS</strong>`;
                
                if (isFinished) {
                    statusBadge = `<span style="background: #333; color: #fff; padding: 4px 8px; border-radius: 4px; font-size: 0.7rem; font-weight: bold; letter-spacing: 1px;">FINALIZADO</span>`;
                    scoreHtml = `<strong style="color:#ffffff; font-size:1.8rem; margin: 0 15px; background: rgba(220,38,38,0.2); padding: 5px 15px; border-radius: 8px;">${f.scoreLocal || 0} - ${f.scoreAway || 0}</strong>`;
                } else if (isLive) {
                    statusBadge = `<span style="background: #dc2626; color: #fff; padding: 4px 8px; border-radius: 4px; font-size: 0.7rem; font-weight: bold; letter-spacing: 1px;">🔴 EN VIVO</span>`;
                    scoreHtml = `<strong style="color:#ffffff; font-size:1.8rem; margin: 0 15px; background: rgba(220,38,38,0.2); padding: 5px 15px; border-radius: 8px;">${f.scoreLocal || 0} - ${f.scoreAway || 0}</strong>`;
                }

                const homeWeight = f.homeClubId.toUpperCase() === 'FUNEBRERO' ? '800' : '400';
                const homeColor = f.homeClubId.toUpperCase() === 'FUNEBRERO' ? '#ffffff' : '#a3a3a3';
                const awayWeight = f.awayClubId.toUpperCase() === 'FUNEBRERO' ? '800' : '400';
                const awayColor = f.awayClubId.toUpperCase() === 'FUNEBRERO' ? '#ffffff' : '#a3a3a3';

                return `
                    <div class="glass-premium" style="padding: 20px; margin-bottom: 20px; border-left: 5px solid #dc2626; display: flex; flex-direction: column; gap: 15px; text-align: left; background: rgba(15, 15, 15, 0.6); backdrop-filter: blur(10px);">
                        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 10px; flex-wrap: wrap; gap: 10px;">
                            <div style="display: flex; align-items: center; gap: 10px;">
                                <span style="color: #3b82f6; font-weight: bold; font-size: 0.85rem; text-transform: uppercase; background: rgba(59, 130, 246, 0.2); padding: 4px 8px; border-radius: 4px;">${f.round || 'A DEFINIR'}</span>
                            </div>
                            <div style="display: flex; align-items: center; gap: 15px;">
                                ${statusBadge}
                                <span style="color: #a3a3a3; font-size: 0.85rem; font-weight: 600;">📅 ${f.date} ${f.time ? '🕒 ' + f.time : ''}</span>
                            </div>
                        </div>
                        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; padding-top: 5px;">
                            
                            <!-- EQUIPO LOCAL + LOGO -->
                            <div style="flex: 1; display: flex; align-items: center; justify-content: flex-end; gap: 15px;">
                                <span style="font-size: 1.6rem; font-family: 'Bebas Neue', cursive; letter-spacing: 1px; font-weight: ${homeWeight}; color: ${homeColor}; text-align: right; line-height: 1;">${f.homeClubId}</span>
                                <img src="${getLogoSrc(f.homeClubId)}" alt="${f.homeClubId}" style="width: 50px; height: 50px; object-fit: contain; filter: drop-shadow(0 2px 5px rgba(0,0,0,0.5));">
                            </div>
                            
                            <!-- RESULTADO CENTRAL -->
                            <div style="text-align: center; min-width: 100px;">${scoreHtml}</div>
                            
                            <!-- EQUIPO VISITANTE + LOGO -->
                            <div style="flex: 1; display: flex; align-items: center; justify-content: flex-start; gap: 15px;">
                                <img src="${getLogoSrc(f.awayClubId)}" alt="${f.awayClubId}" style="width: 50px; height: 50px; object-fit: contain; filter: drop-shadow(0 2px 5px rgba(0,0,0,0.5));">
                                <span style="font-size: 1.6rem; font-family: 'Bebas Neue', cursive; letter-spacing: 1px; font-weight: ${awayWeight}; color: ${awayColor}; text-align: left; line-height: 1;">${f.awayClubId}</span>
                            </div>

                        </div>
                    </div>
                `;
            }).join("");

            finalHtml += `</div>`; // Cierre de categoría
        });

        container.innerHTML = finalHtml;
    }, (error) => {
        console.error("Error al sincronizar fixtures:", error);
        container.innerHTML = `<p style="color: #dc2626; text-align: center;">Error de conexión con la base de datos.</p>`;
    });
}