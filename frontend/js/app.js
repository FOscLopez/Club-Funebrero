import { getFixtures, getClubs, getCategories } from "./services/firestore.service.js";

document.addEventListener("DOMContentLoaded", async () => {
    console.log("🏀 Plataforma del Club Funebrero inicializada.");

    // 1. Navegación suave
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

    // 2. Carga de Fixture y Resultados
    await loadClubFixtures();
});

async function loadClubFixtures() {
    const fixtureContainer = document.querySelector("#fixture .glass-premium");
    if (!fixtureContainer) return;

    try {
        // Obtenemos todos los datos necesarios
        const [fixtures, clubs, categories] = await Promise.all([
            getFixtures(),
            getClubs(),
            getCategories()
        ]);

        // Asegurarse de que el club base es el Funebrero
        const funebreroId = "funebrero"; // Reemplazar si el ID en tu DB es distinto

        // Filtramos solo los partidos donde juegue el Funebrero
        const clubMatches = fixtures.filter(f => f.homeClubId === funebreroId || f.awayClubId === funebreroId)
                                    .sort((a,b) => new Date(b.date) - new Date(a.date));

        if (clubMatches.length === 0) {
            fixtureContainer.innerHTML = `
                <h3 style="color: #dc2626; font-size: 2.5rem;">Próximamente</h3>
                <p style="font-size: 1.1rem; color: #a3a3a3;">Aún no hay partidos registrados en la base de datos para esta temporada.</p>
            `;
            return;
        }

        // Renderizamos los partidos
        fixtureContainer.innerHTML = clubMatches.map(f => {
            const home = clubs.find(c => c.id === f.homeClubId)?.name || "Local";
            const away = clubs.find(c => c.id === f.awayClubId)?.name || "Visita";
            const cat = categories.find(c => c.id === f.categoryId)?.name || "Categoría";
            
            const isFinished = f.status === "finished";
            const scoreHtml = isFinished 
                ? `<strong style="color:#ffffff; font-size:1.5rem; margin: 0 15px; background: rgba(220,38,38,0.2); padding: 5px 15px; border-radius: 8px;">${f.scoreLocal} - ${f.scoreAway}</strong>` 
                : `<strong style="color:#dc2626; font-size:1.2rem; margin: 0 15px;">VS</strong>`;
            
            return `
                <div style="background: rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.1); border-left: 4px solid #dc2626; border-radius: 8px; padding: 15px; margin-bottom: 15px;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                        <span style="font-size: 0.8rem; color: #dc2626; font-weight: bold; text-transform: uppercase;">${cat}</span>
                        <span style="font-size: 0.8rem; color: #a3a3a3;">F. ${f.round || '?'} | 📅 ${f.date} | 🕒 ${f.time || 'A def.'}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="flex:1; text-align:right; font-weight: ${f.homeClubId === funebreroId ? '800' : '400'}; color: ${f.homeClubId === funebreroId ? '#fff' : '#a3a3a3'};">${home}</span>
                        ${scoreHtml}
                        <span style="flex:1; text-align:left; font-weight: ${f.awayClubId === funebreroId ? '800' : '400'}; color: ${f.awayClubId === funebreroId ? '#fff' : '#a3a3a3'};">${away}</span>
                    </div>
                </div>
            `;
        }).join("");

    } catch (error) {
        console.error("Error cargando fixture:", error);
        fixtureContainer.innerHTML = `<p style="color: #dc2626;">Error al cargar los datos. Intenta nuevamente.</p>`;
    }
}