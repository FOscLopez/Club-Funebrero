import { 
    getClubs, getCategories, buildStandings, getNews, listenToFixtures, getSponsors, 
    listenToSystemSettings, getMeetings 
  } from "./services/firestore.service.js";
  
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
  
  const CACHE_TIME = 5 * 60 * 1000; 
  const GEMINI_API_KEY = "AIzaSyDvsq3fg1nEOQxR8wVcZW8rEX2lcc_xC8U";
  
  let isFirstLoad = true; 
  let globalClubs = []; 
  let globalFixtures = []; 
  let allMeetings = []; 
  
  // ==========================================
  // EFECTOS Y SONIDO
  // ==========================================
  function initParticles() {
    const canvas = document.getElementById("particle-canvas");
    if(!canvas) return;
    const ctx = canvas.getContext("2d");
    canvas.width = canvas.parentElement.clientWidth; 
    canvas.height = canvas.parentElement.clientHeight;
    let particles = [];
    for(let i=0; i<30; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: Math.random() * 3 + 1,
        dx: (Math.random() - 0.5) * 1.5,
        dy: (Math.random() - 0.5) * 1.5,
        alpha: Math.random()
      });
    }
    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(220, 38, 38, ${p.alpha})`;
        ctx.fill();
        p.x += p.dx; p.y += p.dy;
        p.alpha -= 0.02; 
        if(p.alpha <= 0) {
          p.x = Math.random() * canvas.width; p.y = Math.random() * canvas.height; p.alpha = 1;
        }
      });
      requestAnimationFrame(draw);
    }
    draw();
  }
  
  function initCourtSound() { 
    const btn = document.getElementById("soundToggleBtn"); 
    const audio = document.getElementById("court-sound"); 
    if(!btn || !audio) return;
    audio.volume = 0.4;
    btn.addEventListener("click", () => { 
      if(audio.paused) { 
        audio.play().then(() => { 
          btn.textContent = "🔊"; 
          btn.style.borderColor = "#10b981"; 
          btn.style.color = "#10b981"; 
        }).catch(e => console.warn("Audio bloqueado:", e)); 
      } else { 
        audio.pause(); 
        btn.textContent = "🔇"; 
        btn.style.borderColor = "rgba(220, 38, 38, 0.5)"; 
        btn.style.color = "#dc2626"; 
      } 
    }); 
  }
  
  // ==========================================
  // RENDERIZADO DOM (SPONSORS, NOTICIAS, ACTAS)
  // ==========================================
  function renderNewsTicker(newsList) {
    const tickerWrap = document.querySelector(".ticker-move");
    if (!tickerWrap) return;
    tickerWrap.innerHTML = newsList.length === 0 
      ? `<div class="ticker-item">Temporada 2026 - Club Funebrero</div>`
      : newsList.map(n => `<div class="ticker-item"><span style="color:#020617; background:#fff; padding:0 5px; border-radius:3px; font-weight:800; margin-right:10px;">${n.title}</span> ${n.text}</div>`).join("");
  }
  
  function renderClubsGrid(clubs) {
    const container = document.getElementById("clubs-container");
    if (!container) return;
    container.innerHTML = clubs.filter(c => c.id !== "tbd").map(club => `
      <div class="club-card" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(220, 38, 38, 0.2); padding: 15px; border-radius: 12px; text-align: center; color: white;">
        <img src="${getLogoSrc(club.name)}" alt="${club.name}" style="width: 80px; height: 80px; object-fit: contain; margin-bottom: 10px;">
        <h3 style="margin: 0; font-size: 1.1rem;">${club.name}</h3>
      </div>
    `).join("");
  }
  
  function renderMeetings(list) {
    const container = document.getElementById("meetings-container");
    if(!container) return;
    if(list.length === 0) {
      container.innerHTML = "<p style='color:#64748b; text-align:center; padding: 20px;'>No hay actas publicadas recientemente.</p>";
      return;
    }
    container.innerHTML = list.map(m => `
      <div style="display: flex; gap: 15px; background: rgba(0,0,0,0.4); padding: 15px; border-radius: 8px; margin-bottom: 15px; border-left: 4px solid #dc2626;">
        <div>
          <span style="color:#94a3b8; font-size:0.75rem;">📅 REUNIÓN DEL ${m.date}</span>
          <h4 style="margin: 5px 0; color: #fff;">${m.title}</h4>
          <p style="margin: 0; font-size: 0.85rem; color: #cbd5e1;">${m.summary || 'Sin reseña adjunta.'}</p>
        </div>
      </div>
    `).join("");
  }
  
  function renderSponsors(sponsorsList) {
    const container = document.getElementById("sponsors-container");
    if (!container) return;
    if (sponsorsList.length === 0) {
      document.querySelector('.sponsors-bar').style.display = 'none';
      return;
    }
    const duplicatedSponsors = [...sponsorsList, ...sponsorsList, ...sponsorsList];
    container.innerHTML = duplicatedSponsors.map(s => `
      <a href="${s.link || '#'}" target="_blank" class="sponsor-card">
        <div class="sponsor-logo-container">
          <img src="${s.logoUrl || DEFAULT_LOGO}" alt="${s.name}" class="sponsor-logo">
        </div>
        <div class="sponsor-info">
          <h4 class="sponsor-name" style="margin:0; font-size: 1rem; color: #fff;">${s.name}</h4>
          ${s.address ? `<p class="sponsor-address">📍 ${s.address}</p>` : ''}
        </div>
      </a>
    `).join("");
  }
  
  // ==========================================
  // RENDERIZADO DE FIXTURE (AGRUPADO Y ORDENADO)
  // ==========================================
  function renderGroupedFixtures(fixtures) {
    const container = document.getElementById("results-container");
    if (!container) return;
  
    if (fixtures.length === 0) {
        container.innerHTML = `<p style="text-align:center; color:#94a3b8; padding: 40px;">No hay partidos programados.</p>`;
        return;
    }
  
    // 1. Agrupar por Categoría
    const grouped = {};
    fixtures.forEach(f => {
        const cat = f.categoryId || "Sin Categoría";
        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat].push(f);
    });
  
    let finalHtml = "";
  
    Object.keys(grouped).sort().forEach(cat => {
        finalHtml += `
            <div style="margin-bottom: 50px;">
                <h3 style="color: #dc2626; font-family: 'Bebas Neue', cursive; font-size: 2.2rem; border-bottom: 2px solid rgba(220, 38, 38, 0.3); padding-bottom: 10px; margin-bottom: 20px; letter-spacing: 1px;">
                    🏆 CATEGORÍA ${cat}
                </h3>
        `;
  
        // 2. Ordenar Numéricamente por Fecha (Fecha 1, Fecha 2, Fecha 3...)
        grouped[cat].sort((a, b) => {
            const getRoundNum = (roundStr) => {
                if (!roundStr) return 999;
                const match = roundStr.match(/\d+/);
                return match ? parseInt(match[0], 10) : 999;
            };
            return getRoundNum(a.round) - getRoundNum(b.round);
        });
  
        // 3. Dibujar Partidos
        finalHtml += grouped[cat].map(f => {
            const isFinished = f.status === "finished";
            let statusBadge = '';
            let scoreHtml = `<strong style="color:#dc2626; font-size:1.5rem; margin: 0 15px;">VS</strong>`;
            
            if (isFinished) {
                statusBadge = `<span style="background: #333; color: #fff; padding: 4px 8px; border-radius: 4px; font-size: 0.7rem; font-weight: bold;">FINALIZADO</span>`;
                scoreHtml = `<strong style="color:#ffffff; font-size:1.8rem; margin: 0 15px; background: rgba(220,38,38,0.2); padding: 5px 15px; border-radius: 8px;">${f.scoreLocal || 0} - ${f.scoreAway || 0}</strong>`;
            }
  
            const homeWeight = f.homeClubId.toUpperCase() === 'FUNEBRERO' ? '800' : '400';
            const homeColor = f.homeClubId.toUpperCase() === 'FUNEBRERO' ? '#ffffff' : '#a3a3a3';
            const awayWeight = f.awayClubId.toUpperCase() === 'FUNEBRERO' ? '800' : '400';
            const awayColor = f.awayClubId.toUpperCase() === 'FUNEBRERO' ? '#ffffff' : '#a3a3a3';
  
            return `
                <div class="glass-premium" style="padding: 20px; margin-bottom: 20px; border-left: 5px solid #dc2626; display: flex; flex-direction: column; gap: 15px; background: rgba(15, 15, 15, 0.6); backdrop-filter: blur(10px); border-radius: 8px;">
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
                        
                        <!-- LOCAL -->
                        <div style="flex: 1; display: flex; align-items: center; justify-content: flex-end; gap: 15px;">
                            <span style="font-size: 1.4rem; font-family: 'Bebas Neue', cursive; letter-spacing: 1px; font-weight: ${homeWeight}; color: ${homeColor}; text-align: right; line-height: 1;">${f.homeClubId}</span>
                            <img src="${getLogoSrc(f.homeClubId)}" alt="${f.homeClubId}" style="width: 50px; height: 50px; object-fit: contain; filter: drop-shadow(0 2px 5px rgba(0,0,0,0.5));">
                        </div>
                        
                        <!-- RESULTADO -->
                        <div style="text-align: center; min-width: 100px;">${scoreHtml}</div>
                        
                        <!-- VISITANTE -->
                        <div style="flex: 1; display: flex; align-items: center; justify-content: flex-start; gap: 15px;">
                            <img src="${getLogoSrc(f.awayClubId)}" alt="${f.awayClubId}" style="width: 50px; height: 50px; object-fit: contain; filter: drop-shadow(0 2px 5px rgba(0,0,0,0.5));">
                            <span style="font-size: 1.4rem; font-family: 'Bebas Neue', cursive; letter-spacing: 1px; font-weight: ${awayWeight}; color: ${awayColor}; text-align: left; line-height: 1;">${f.awayClubId}</span>
                        </div>
                    </div>
                </div>
            `;
        }).join("");
        finalHtml += `</div>`;
    });
  
    container.innerHTML = finalHtml;
  }
  
  // ==========================================
  // INICIALIZACIÓN PRINCIPAL
  // ==========================================
  async function initPublicView() {
    listenToSystemSettings((s) => {
      const overlay = document.getElementById("maintenance-overlay");
      if (overlay) overlay.style.display = s.maintenance ? "flex" : "none";
    });
  
    try {
      const [clubs, categories, news, meetings, sponsors] = await Promise.all([
        getClubs(), getCategories(), getNews(), getMeetings(), getSponsors()
      ]);
      
      globalClubs = clubs;
      allMeetings = meetings;
      
      renderNewsTicker(news);
      renderClubsGrid(clubs);
      renderMeetings(meetings);
      renderSponsors(sponsors);
  
      listenToFixtures((liveFixtures) => {
        globalFixtures = liveFixtures;
        renderGroupedFixtures(liveFixtures);
      });
    } catch (err) { console.error("Error cargando vista pública:", err); }
  }
  
  // ==========================================
  // FUNEBOT (ASISTENTE IA)
  // ==========================================
  function initFuneBot() {
    const toggleBtn = document.getElementById("chatbot-toggle");
    const chatContainer = document.getElementById("chatbot-container");
    const closeBtn = document.getElementById("close-chat");
    const sendBtn = document.getElementById("send-chat");
    const inputEl = document.getElementById("chat-input");
    const messagesEl = document.getElementById("chat-messages");
  
    if(!toggleBtn || !chatContainer) return;
    let chatHistory = [];
  
    toggleBtn.addEventListener("click", () => {
      chatContainer.classList.toggle("hidden");
      if(!chatContainer.classList.contains("hidden")) inputEl.focus();
    });
  
    closeBtn.addEventListener("click", () => chatContainer.classList.add("hidden"));
  
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
      toggleBtn.classList.add("thinking");
  
      const finishedMatches = globalFixtures.filter(f => f.status === "finished").slice(-3);
      const scheduledMatches = globalFixtures.filter(f => f.status === "scheduled").slice(0, 3);
      
      let contextStr = `Eres BásquetBot, el asistente experto del Club Funebrero.\n`;
      contextStr += `Últimos 3 resultados: ${JSON.stringify(finishedMatches)}.\n`;
      contextStr += `Próximos 3 partidos: ${JSON.stringify(scheduledMatches)}.\nUsuario dice: ${userText}`;
  
      chatHistory.push({ role: "user", parts: [{ text: contextStr }] });
  
      try {
        const payload = { contents: chatHistory };
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`, {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error("Error servidor");
        const data = await res.json();
        const botReply = data.candidates[0].content.parts[0].text;
        
        appendMsg(botReply, "model");
        chatHistory.push({ role: "model", parts: [{ text: botReply }] });
      } catch(e) {
        appendMsg("Uf, estoy un poco mareado. ¿Me repetís la jugada?", "model");
        chatHistory.pop(); 
      } finally {
        toggleBtn.classList.remove("thinking");
      }
    };
  
    sendBtn.addEventListener("click", processMessage);
    inputEl.addEventListener("keypress", (e) => { if(e.key === "Enter") processMessage(); });
  }
  
  document.addEventListener("DOMContentLoaded", () => {
    const loader = document.getElementById("loader");
    if (loader) loader.classList.add("hidden"); 
    initParticles();
    initCourtSound();
    initFuneBot();
    initPublicView();
  });