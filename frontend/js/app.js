document.addEventListener("DOMContentLoaded", () => {
    console.log("🏀 Plataforma del Club Funebrero inicializada.");

    // Efecto de aparición del Hero Section al cargar
    setTimeout(() => {
        const hero = document.querySelector(".hero");
        if (hero) {
            hero.style.opacity = "1";
            hero.style.transition = "opacity 1s ease-in-out";
        }
    }, 100);

    // Navegación suave para los enlaces del menú
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
});