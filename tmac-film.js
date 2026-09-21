/* Official ESPN footage stays in the YouTube player. Game results never depend on it. */
(() => {
  'use strict';
  const panel = document.getElementById('moment-film');
  const holder = document.getElementById('moment-film-player');
  const status = document.getElementById('moment-film-status');
  const skip = document.getElementById('moment-film-skip');
  const intro = document.getElementById('moment-film-intro');
  const play = document.getElementById('moment-film-play');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let introTimer = null, startPlayback = null;
  let player = null, generation = 0, callback = null, apiPromise = null, watchdog = null;
  function loadAPI() {
    if (window.YT?.Player) return Promise.resolve();
    if (apiPromise) return apiPromise;
    apiPromise = new Promise((resolve, reject) => {
      const previous = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => { if (previous) previous(); resolve(); };
      const script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api'; script.async = true;
      script.onerror = () => { apiPromise = null; script.remove(); reject(new Error('Video player unavailable')); };
      document.head.appendChild(script);
    });
    return apiPromise;
  }
  function close(notify = true) {
    generation++; clearTimeout(watchdog); clearTimeout(introTimer); startPlayback = null;
    if (player) { player.destroy(); player = null; }
    holder.replaceChildren(); panel.hidden = true;
    const done = callback; callback = null;
    if (notify && done) done();
  }
  async function show({ sound = false, onClose }) {
    close(false); const run = generation;
    callback = onClose; panel.hidden = false;
    intro.classList.remove('is-finished'); play.hidden = true;
    const openedAt = performance.now();
    let muted = !sound, retriedMuted = false;
    status.textContent = 'Loading the real finish from the ESPN archive…';
    skip.focus({ preventScroll: true });
    watchdog = setTimeout(() => {
      if (run === generation) { status.textContent = startPlayback ? 'Press play to watch, or skip to your results.' : 'The clip is taking a while. Watch on YouTube, or skip to your results.'; play.hidden = !startPlayback; }
    }, 9000);
    try {
      await loadAPI(); if (run !== generation) return;
      const mount = document.createElement('div'); holder.replaceChildren(mount);
      player = new window.YT.Player(mount, {
        host: 'https://www.youtube-nocookie.com', width: '100%', height: '100%',
        videoId: 's4QuUYG6kxI',
        playerVars: { start: 44, end: 60, autoplay: 0, playsinline: 1, controls: 1, rel: 0, origin: location.origin },
        events: {
          onReady: e => {
            if (run !== generation) return;
            e.target.getIframe().setAttribute('title', 'ESPN: Tracy McGrady’s game-winning shot, December 9, 2004');
            e.target.getIframe().setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
            e.target.getIframe().setAttribute('allow', 'autoplay; encrypted-media; picture-in-picture; fullscreen');
            startPlayback = () => {
              if (run !== generation) return;
              play.hidden = true;
              if (muted) e.target.mute();
              e.target.playVideo();
            };
            // Keep the beginning of the clip intact: reveal it only after the title beat.
            const delay = reduced.matches ? 0 : Math.max(0, 1100 - (performance.now() - openedAt));
            introTimer = setTimeout(startPlayback, delay);
          },
          onStateChange: e => {
            if (run !== generation) return;
            if (e.data === 1) {
              clearTimeout(watchdog); play.hidden = true; intro.classList.add('is-finished');
              status.textContent = muted ? 'SportsCenter archive · ESPN · Use the player volume control for sound.' : 'SportsCenter archive · ESPN';
              if (document.activeElement === play) skip.focus({ preventScroll: true });
            }
            if (e.data === 0) close();
          },
          onAutoplayBlocked: e => {
            if (run !== generation) return;
            if (!retriedMuted) {
              retriedMuted = true; muted = true; e.target.mute(); e.target.playVideo();
            } else {
              clearTimeout(watchdog); play.hidden = false;
              status.textContent = 'Tap Play to watch the real finish.';
            }
          },
          onError: e => { if (run === generation) { clearTimeout(watchdog); clearTimeout(introTimer); startPlayback = null; play.hidden = true; intro.classList.add('is-finished'); console.warn('Archive video player error:', e.data); status.textContent = 'This player can’t load the clip here. Watch on YouTube, or skip to your results.'; } }
        }
      });
    } catch (_) {
      if (run === generation) { clearTimeout(watchdog); status.textContent = 'The video is unavailable here. Watch on YouTube, or skip to your results.'; }
    }
  }
  play.addEventListener('click', () => { if (document.activeElement === play) skip.focus({ preventScroll: true }); startPlayback?.(); });
  skip.addEventListener('click', () => close());
  panel.addEventListener('keydown', e => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
    if (e.key === 'Tab') {
      const controls = Array.from(panel.querySelectorAll('button, a, iframe')).filter(el => !el.hidden);
      const first = controls[0], last = controls[controls.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
  window.addEventListener('pagehide', () => close(false));
  window.TmacFilm = { show, close, prepare: () => { loadAPI().catch(() => {}); } };
})();
