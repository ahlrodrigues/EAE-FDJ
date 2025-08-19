/* /frontend/js/radio.js
 * Espera o menu ser injetado antes de iniciar o rádio.
 * Anti-duplo-clique, fallback de endpoints e hard stop confiável.
 */
(() => {
    const LOG = "[WebRadio]";
  
    // Evita múltiplas inicializações
    if (window.__EAE_webRadioInit) {
      console.log(`${LOG} Init ignorado (já inicializado).`);
      return;
    }
  
    // Espera DOM e, se preciso, o evento "menu:ready"
    const domReady = new Promise((r) => {
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", r, { once: true });
      } else {
        r();
      }
    });
  
    // Tenta achar os elementos; se não achar, aguarda "menu:ready" ou usa MutationObserver
    async function waitForRadioElements(timeoutMs = 12000) {
      // 1) checagem imediata
      let img = document.getElementById("webRadioImg");
      let player = document.getElementById("webRadioPlayer");
      if (img && player) return { img, player, how: "immediate" };
  
      // 2) ouve o evento disparado após a injeção do menu
      const menuReady = new Promise((resolve) => {
        const onMenuReady = (ev) => {
          console.log(`${LOG} Evento recebido: menu:ready`, ev.detail);
          const i = document.getElementById("webRadioImg");
          const p = document.getElementById("webRadioPlayer");
          if (i && p) {
            window.removeEventListener("menu:ready", onMenuReady);
            resolve({ img: i, player: p, how: "event" });
          }
        };
        window.addEventListener("menu:ready", onMenuReady);
      });
  
      // 3) fallback: MutationObserver no body (caso o evento não seja disparado)
      const observed = new Promise((resolve) => {
        const obs = new MutationObserver(() => {
          const i = document.getElementById("webRadioImg");
          const p = document.getElementById("webRadioPlayer");
          if (i && p) {
            obs.disconnect();
            resolve({ img: i, player: p, how: "observer" });
          }
        });
        obs.observe(document.body, { childList: true, subtree: true });
        // segurança: encerra observação no timeout
        setTimeout(() => { try { obs.disconnect(); } catch {} }, timeoutMs + 1000);
      });
  
      // 4) timeout guard
      const timed = new Promise((_, reject) => {
        setTimeout(() => reject(new Error("timeout esperando #webRadioImg / #webRadioPlayer")), timeoutMs);
      });
  
      // Corre em paralelo: evento, observer ou timeout
      return Promise.race([menuReady, observed, timed]);
    }
  
    (async () => {
      try {
        await domReady;
        console.log(`${LOG} DOM pronto. Aguardando elementos do rádio...`);
        const { img, player, how } = await waitForRadioElements();
        console.log(`${LOG} Elementos encontrados via: ${how}`);
  
        // Marca como inicializado só agora
        window.__EAE_webRadioInit = true;
  
        // ============== CONFIG ==============
        const STREAM_BASE = "https://stm35.srvstm.com:7246";
        const STREAM_CANDIDATES = [
          `${STREAM_BASE}/stream`,
          `${STREAM_BASE}/;stream.mp3`,
          `${STREAM_BASE}/;`,
          `${STREAM_BASE}/live`,
          `${STREAM_BASE}/`
        ];
  
        // ============== ESTADO ==============
        let isPlaying = false;
        let primed = false;
        let chosenUrl = null;
        let trying = false;
        let debounceTimer = null;
  
        // ============== UI/UTIL ==============
        function atualizarUI(tocando) {
            isPlaying = tocando;
          
            // alterna entre as imagens padrão
            const iconPath = tocando ? "../assets/playradio_pause.png" : "../assets/playradio.png";
            if (img.getAttribute("src") !== iconPath) {
              console.log("[WebRadio] Ícone =>", iconPath);
              img.setAttribute("src", iconPath);
            }
          
            img.setAttribute("aria-label", tocando ? "Pausar Web Rádio" : "Tocar Web Rádio");
            img.title = tocando ? "Clique para pausar" : "Clique para tocar";
          }
          
        function setBusy(on) {
          trying = on;
          img.classList.toggle("is-busy", on);
          console.log(`${LOG} Busy=${on}`);
        }
  
        // ============== PLAY ==============
        async function iniciar() {
          try {
            setBusy(true);
  
            if (!primed) {
              for (const url of STREAM_CANDIDATES) {
                console.log(`${LOG} Testando: ${url}`);
                if (await tentarPlay(url, 6000, player)) {
                  chosenUrl = url;
                  primed = true;
                  console.log(`${LOG} ✅ URL validada: ${chosenUrl}`);
                  break;
                }
                console.warn(`${LOG} ❌ Falha no candidato: ${url}`);
              }
              if (!primed) throw new Error("Nenhum endpoint do stream funcionou.");
            } else {
              console.log(`${LOG} Reutilizando URL: ${chosenUrl}`);
              // Reatribui o src a cada play (evita pipeline presa)
              player.autoplay = false;
              player.setAttribute("type", "audio/mpeg");
              player.preload = "auto";
              player.src = chosenUrl;
              await player.play();
            }
  
            atualizarUI(true);
            console.log(`${LOG} ▶️ Reproduzindo`);
          } catch (err) {
            console.error(`${LOG} Falha ao reproduzir:`, err);
            atualizarUI(false);
          } finally {
            setBusy(false);
          }
        }
  
        function tentarPlay(url, timeoutMs, player) {
            return new Promise(async (resolve) => {
              let resolved = false;
              let toId; // ✅ declarado antes para que cleanup possa usar
          
              const done = (ok) => {
                if (!resolved) {
                  resolved = true;
                  cleanup();
                  resolve(ok);
                }
              };
          
              const onPlaying = () => { console.log("[WebRadio] EVT playing"); done(true); };
              const onCanPlay = () => { console.log("[WebRadio] EVT canplay"); done(true); };
              const onError   = (e) => { console.warn("[WebRadio] EVT error", player.error || e); /* timeout decide */ };
              const onStalled = () =>  console.warn("[WebRadio] EVT stalled");
              const onAbort   = () =>  console.warn("[WebRadio] EVT abort");
          
              function cleanup() {
                try { clearTimeout(toId); } catch {}
                player.removeEventListener("playing", onPlaying);
                player.removeEventListener("canplay", onCanPlay);
                player.removeEventListener("error", onError);
                player.removeEventListener("stalled", onStalled);
                player.removeEventListener("abort", onAbort);
              }
          
              // Registra listeners ANTES de setar src/play()
              player.addEventListener("playing", onPlaying);
              player.addEventListener("canplay", onCanPlay);
              player.addEventListener("error", onError);
              player.addEventListener("stalled", onStalled);
              player.addEventListener("abort", onAbort);
          
              try {
                player.setAttribute("type", "audio/mpeg");
                player.preload = "auto";
                player.src = url;
                await player.play();
              } catch (err) {
                console.warn("[WebRadio] play() erro", err);
                // seguimos para o timeout/handlers decidirem
              }
          
              // ⏳ Timeout definido DEPOIS que listeners estão ativos
              toId = setTimeout(() => {
                console.warn(`[WebRadio] Timeout ${timeoutMs}ms em ${url}`);
                done(false);
              }, timeoutMs);
            });
          }
          
  
        // ============== STOP (HARD STOP) ==============
        function parar() {
          try {
            setBusy(true);
  
            console.log(`${LOG} ⏹️ Solicitando pausa...`);
            player.pause();
  
            // Hard stop: desmonta a pipeline e fecha a conexão
            try { player.removeAttribute("src"); } catch {}
            player.src = "";   // reforço
            player.load();     // descarrega o recurso/stream
            try { player.currentTime = 0; } catch {}
  
            atualizarUI(false);
  
            const RS = {0:"HAVE_NOTHING",1:"HAVE_METADATA",2:"HAVE_CURRENT_DATA",3:"HAVE_FUTURE_DATA",4:"HAVE_ENOUGH_DATA"};
            const NS = {0:"NETWORK_EMPTY",1:"NETWORK_IDLE",2:"NETWORK_LOADING",3:"NETWORK_NO_SOURCE"};
            console.log(`${LOG} ⏹️ Pausado (sanity): rs=${RS[player.readyState] ?? player.readyState}, ns=${NS[player.networkState] ?? player.networkState}, paused=${player.paused}`);
  
            // Garante que nenhum outro <audio> ficou tocando
            document.querySelectorAll("audio").forEach((a) => {
              if (a !== player && !a.paused) {
                try { a.pause(); } catch {}
              }
            });
  
          } catch (err) {
            console.error(`${LOG} Erro ao parar:`, err);
          } finally {
            setBusy(false);
          }
        }
  
        // ============== HANDLER (anti-duplo) ==============
        const onPointerUp = (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
  
          if (debounceTimer) {
            console.log(`${LOG} Ignorado por debounce`);
            return;
          }
          debounceTimer = setTimeout(() => (debounceTimer = null), 200);
  
          if (trying) {
            console.log(`${LOG} Ignorado: já em processamento`);
            return;
          }
  
          console.log(`${LOG} PointerUp: isPlaying=${isPlaying} primed=${primed} chosen=${chosenUrl || "—"} trying=${trying}`);
          if (!isPlaying) iniciar();
          else parar();
        };
  
        img.addEventListener("pointerup", onPointerUp, { passive: false, capture: true });
  
        // logs auxiliares
        player.addEventListener("error",   (e) => console.error(`${LOG} <audio> erro:`, player.error || e));
        player.addEventListener("waiting", () => console.log(`${LOG} <audio> waiting`));
        player.addEventListener("playing", () => console.log(`${LOG} <audio> playing`));
        player.addEventListener("pause",   () => console.log(`${LOG} <audio> pause`));
  
        atualizarUI(false);
        console.log(`${LOG} Inicializado após: ${how}`);
      } catch (err) {
        console.error(`${LOG} Falha ao localizar elementos do rádio:`, err);
      }
    })();
  })();
  