import { db } from "./services/firebase.config.js";
import { collection, onSnapshot, query, orderBy } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

document.addEventListener("DOMContentLoaded", () => {
    console.log("🏀 Plataforma del Club Funebrero inicializada.");

    // 1. Navegación suave
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

    // 2. Conectar Fixture en Tiempo Real
    listenToPublicFixtures();
});

function listenToPublicFixtures() {
    const container = document.getElementById("publicFixturesContainer");
    if (!container) return;

    // Pedimos los partidos ordenados por fecha de creación (los más nuevos arriba)
    const q = query(collection(db, "fixtures"), orderBy("createdAt", "desc"));
    
    // onSnapshot es el túnel en vivo: cualquier cambio en Firebase actualiza esto sin F5
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

        container.innerHTML = fixtures.map(f => {
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

            // Resaltamos visualmente cuando juega el Funebrero
            const homeWeight = f.homeClubId.toUpperCase() === 'FUNEBRERO' ? '800' : '400';
            const homeColor = f.homeClubId.toUpperCase() === 'FUNEBRERO' ? '#ffffff' : '#a3a3a3';
            const awayWeight = f.awayClubId.toUpperCase() === 'FUNEBRERO' ? '800' : '400';
            const awayColor = f.awayClubId.toUpperCase() === 'FUNEBRERO' ? '#ffffff' : '#a3a3a3';

            return `
                <div class="glass-premium" style="padding: 20px; margin-bottom: 20px; border-left: 5px solid #dc2626; display: flex; flex-direction: column; gap: 15px; text-align: left;">
                    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 10px; flex-wrap: wrap; gap: 10px;">
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <span style="background: rgba(220,38,38,0.2); color: #dc2626; padding: 4px 10px; border-radius: 4px; font-weight: bold; font-size: 0.85rem;">${f.categoryId}</span>
                            <span style="color: #3b82f6; font-weight: bold; font-size: 0.85rem; text-transform: uppercase;">${f.round || ''}</span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 15px;">
                            ${statusBadge}
                            <span style="color: #a3a3a3; font-size: 0.85rem; font-weight: 600;">📅 ${f.date} ${f.time ? '🕒 ' + f.time : ''}</span>
                        </div>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
                        <div style="flex: 1; text-align: right; font-size: 1.5rem; font-family: 'Bebas Neue', cursive; letter-spacing: 1px; font-weight: ${homeWeight}; color: ${homeColor};">${f.homeClubId}</div>
                        <div style="text-align: center; min-width: 100px;">${scoreHtml}</div>
                        <div style="flex: 1; text-align: left; font-size: 1.5rem; font-family: 'Bebas Neue', cursive; letter-spacing: 1px; font-weight: ${awayWeight}; color: ${awayColor};">${f.awayClubId}</div>
                    </div>
                </div>
            `;
        }).join("");
    }, (error) => {
        console.error("Error al sincronizar fixtures:", error);
        container.innerHTML = `<p style="color: #dc2626; text-align: center;">Error de conexión con la base de datos.</p>`;
    });
}