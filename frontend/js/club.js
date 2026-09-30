import { getPlayers } from "./services/firestore.service.js";

document.addEventListener("DOMContentLoaded", async () => {
    console.log("🏀 Cargando Perfil del Club Funebrero...");

    // Navegación suave
    document.querySelectorAll('.nav-links a').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const targetId = this.getAttribute('href');
            if (targetId.startsWith('#')) {
                e.preventDefault();
                const targetElement = document.querySelector(targetId);
                if (targetElement) {
                    targetElement.scrollIntoView({ behavior: 'smooth' });
                }
            }
        });
    });

    await loadPublicRosters();
});

async function loadPublicRosters() {
    const container = document.getElementById("rostersContainer");
    
    try {
        const players = await getPlayers();
        
        if (players.length === 0) {
            container.innerHTML = `
                <div class="glass-premium" style="text-align: center; padding: 40px;">
                    <h3 style="color: #dc2626;">Planteles en Formación</h3>
                    <p style="color: #a3a3a3;">El cuerpo técnico está cerrando las listas. ¡Pronto verás a los jugadores aquí!</p>
                </div>
            `;
            return;
        }

        // Agrupamos a los jugadores por categoría
        const grouped = {};
        players.forEach(p => {
            if (!grouped[p.categoryId]) grouped[p.categoryId] = [];
            grouped[p.categoryId].push(p);
        });

        let html = "";
        
        // Ordenamos las categorías alfabéticamente
        Object.keys(grouped).sort().forEach(cat => {
            html += `<h2 class="cat-title">Categoría ${cat}</h2>`;
            html += `<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 15px;">`;
            
            // Ordenamos a los jugadores por nombre dentro de la categoría
            grouped[cat].sort((a, b) => a.name.localeCompare(b.name)).forEach(p => {
                html += `
                    <div class="player-card">
                        <span class="player-name">${p.name}</span>
                        <span class="player-date">Nacimiento: ${p.birthdate}</span>
                    </div>
                `;
            });
            
            html += `</div>`;
        });

        container.innerHTML = html;

    } catch (error) {
        console.error("Error cargando planteles:", error);
        container.innerHTML = `<p style="color: #ff3b3b; text-align: center;">Error al cargar la base de datos de jugadores.</p>`;
    }
}