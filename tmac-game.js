/* An original canvas arcade tribute to Houston / San Antonio, December 9, 2004.
   Scores and scoring order follow the comeback; the 33-second clock is an arcade rule. */
(() => {
  'use strict';
  const root = document.getElementById('tmac-game');
  if (!root) return;
  const $ = id => document.getElementById(`moment-${id}`);
  const canvas = $('canvas'), ctx = canvas.getContext('2d');
  if (!ctx) { $('status').textContent = 'Your browser does not support this game. The real moment is linked below.'; return; }
  const stage = root.querySelector('.moment-stage');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const plays = [
    { x: 110, y: 310, value: 3, title: '01 / THE FIRST THREE', prompt: 'Find your rhythm. Hold, then release in the green.', call: 'THERE’S STILL TIME.' },
    { x: -105, y: 309, value: 3, title: '02 / THE FOUR-POINT PLAY', prompt: 'Duncan closes out. Hold to draw him up, then release.', call: 'AND. ONE.' },
    { x: 0, y: 190, value: 1, title: '02 / FINISH THE AND-ONE', prompt: 'Clock stopped. Take a breath. Make the free throw.', call: 'ONE POSSESSION.' },
    { x: 177, y: 244, value: 3, title: '03 / OVER BOWEN', prompt: 'A hand in your face. Same shot. Same green window.', call: 'DON’T GO ANYWHERE.' },
    { x: -142, y: 307, value: 3, title: '04 / THE GAME WINNER', prompt: 'The ball. The game. The whole building. It’s yours.', call: 'DO YOU BELIEVE?!' }
  ];
  const state = {
    mode: 'intro', phase: 'ready', step: 0, home: 68, away: 76, remaining: 33,
    elapsed: 0, charge: null, shot: null, phaseTime: 0, phaseDuration: 0,
    next: null, player: { x: 110, y: 310 }, from: null, target: null,
    made: new Set(), attempts: 0, perfect: 0, call: '', callUntil: 0, cheer: 0,
    sound: false, audio: null, previous: 0, inView: true, lastBounce: 0,
    cameraX: 550, cameraZoom: 1, width: 1100, height: 620, feedbackUntil: 0,
    lastShot: null, celebrationTime: 0, replayTime: 0, best: null, lastTick: 33
  };
  const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = t => t * t * (3 - 2 * t);
  const point = (x, y, z = 0) => ({ x: 550 + x * 1.17 * (1 + y / 800), y: 215 + y * .78 - z * (1 + y / 1600) });
  const rim = point(0, 52, 94);
  const jersey = { home: '#faf5e5', away: '#222629', red: '#c82a40', silver: '#c4c8c9' };

  function announce(text) { $('status').textContent = text; }
  function callout(text, duration = 1.5) {
    state.call = text; state.callUntil = state.elapsed + duration;
    $('callout').textContent = text; $('callout').classList.add('visible');
  }
  function feedback(text, made) {
    $('feedback').textContent = text;
    $('feedback').classList.toggle('missed', !made);
    $('feedback').classList.add('visible'); state.feedbackUntil = state.elapsed + 1.5;
  }
  function sound(kind) {
    if (!state.sound || !state.audio) return;
    const a = state.audio, t = a.currentTime;
    const tone = (f, end, length, volume, type = 'sine', delay = 0) => {
      const o = a.createOscillator(), g = a.createGain();
      o.type = type; o.frequency.setValueAtTime(f, t + delay);
      o.frequency.exponentialRampToValueAtTime(Math.max(1, end), t + delay + length);
      g.gain.setValueAtTime(volume, t + delay); g.gain.exponentialRampToValueAtTime(.001, t + delay + length);
      o.connect(g); g.connect(a.destination); o.start(t + delay); o.stop(t + delay + length);
    };
    if (kind === 'bounce') tone(115, 45, .11, .1);
    if (kind === 'miss') tone(340, 100, .18, .07, 'triangle');
    if (kind === 'release') tone(500, 1000, .1, .025);
    if (kind === 'make' || kind === 'win') {
      [440, 554, 659, 880].forEach((f, i) => tone(f, f, .3, .045, 'triangle', i * .07));
      // Filtered procedural crowd noise: no recorded commentary or audio assets.
      const length = kind === 'win' ? 2.5 : .8;
      const buffer = a.createBuffer(1, Math.floor(a.sampleRate * length), a.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * Math.sin(Math.PI * i / data.length);
      const noise = a.createBufferSource(), filter = a.createBiquadFilter(), gain = a.createGain();
      noise.buffer = buffer; filter.type = 'bandpass'; filter.frequency.value = 850; filter.Q.value = .5;
      gain.gain.value = kind === 'win' ? .16 : .07;
      noise.connect(filter); filter.connect(gain); gain.connect(a.destination); noise.start();
    }
    if (kind === 'buzzer') tone(160, 145, .7, .09, 'sawtooth');
    if (kind === 'steal') tone(900, 1900, .16, .05, 'triangle');
    if (kind === 'whistle') tone(2100, 2300, .22, .035, 'sine');
    if (kind === 'tick') tone(360, 300, .065, .025, 'triangle');
  }
  async function toggleSound() {
    if (!state.audio) {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) { announce('Sound is unavailable in this browser. You can still play.'); return; }
      state.audio = new Audio();
    }
    try { await state.audio.resume(); } catch (_) { announce('Sound could not start. You can still play.'); return; }
    state.sound = !state.sound;
    $('audio').textContent = state.sound ? 'SOUND ON' : 'SOUND OFF';
    $('audio').setAttribute('aria-pressed', String(state.sound));
    $('audio').setAttribute('aria-label', state.sound ? 'Mute game sound' : 'Enable game sound');
    if (state.sound) sound('bounce');
  }
  function setText(id, value) {
    const el = $(id), next = String(value);
    if (el.textContent !== next) el.textContent = next;
  }
  function updateHUD() {
    setText('home', state.home); setText('away', state.away);
    setText('time', Math.max(0, state.remaining).toFixed(1));
    setText('period', ['won', 'celebrating', 'replay'].includes(state.mode) ? 'FINAL' : state.step === 2 && state.mode === 'playing' ? 'FT · STOP' : '4TH');
    root.querySelector('.moment-clock').classList.toggle('urgent', state.remaining <= 8 && state.mode === 'playing');
    setText('progress', `${state.home - 68} / 13 PTS`);
    root.classList.toggle('is-clutch', state.step === 4 && state.mode === 'playing');
    root.querySelectorAll('.moment-sequence li').forEach(li => {
      const step = Number(li.dataset.step);
      li.classList.toggle('done', step === 1 ? state.made.has(1) && state.made.has(2) : state.made.has(step));
      li.classList.toggle('current', step === state.step || (step === 1 && state.step === 2));
    });
  }
  function meterValue() {
    if (state.charge === null) return 0;
    const v = (state.elapsed - state.charge) / (state.phase === 'steal' ? 1.05 : .95);
    return 1 - Math.abs((v % 2) - 1);
  }
  function cancelCharge() {
    state.charge = null; $('shoot').classList.remove('charging');
    $('needle').style.left = '0%'; $('meter').setAttribute('aria-valuenow', '0');
  }
  function setAction(enabled, steal = false) {
    // Disabled controls lose focus in browsers. Keep keyboard play on the court.
    if (!enabled && document.activeElement === $('shoot')) stage.focus({ preventScroll: true });
    $('shoot').disabled = !enabled;
    $('shoot').innerHTML = `${steal ? 'HOLD TO STEAL' : 'HOLD TO SHOOT'} <span>SPACE</span>`;
    $('meter-label').textContent = steal ? 'RELEASE IN GREEN TO STEAL' : 'RELEASE IN THE GREEN';
  }
  function startGame() {
    root.classList.add('is-focused');
    root.classList.remove('is-replay');
    if (state.mode === 'paused') { resume(); return; }
    Object.assign(state, { mode: 'playing', phase: 'ready', step: 0, home: 68, away: 76,
      remaining: 33, elapsed: 0, charge: null, shot: null, phaseTime: 0,
      made: new Set(), attempts: 0, perfect: 0, cheer: 0, callUntil: 0,
      player: { x: plays[0].x, y: plays[0].y }, previous: performance.now(), lastBounce: 0,
      lastShot: null, celebrationTime: 0, replayTime: 0, lastTick: 33 });
    $('overlay').hidden = true; $('callout').classList.remove('visible');
    $('replay').hidden = true; $('feedback').classList.remove('visible');
    $('broadcast').innerHTML = '4TH QUARTER <span>HOUSTON</span>';
    $('pause').disabled = false; $('pause').textContent = 'Ⅱ'; $('pause').setAttribute('aria-label', 'Pause game');
    setAction(true); $('play-label').textContent = plays[0].title; announce(plays[0].prompt);
    stage.focus({ preventScroll: true }); updateHUD(); resize();
  }
  function showOverlay(kicker, title, body, button) {
    $('overlay-kicker').textContent = kicker;
    $('overlay-title').textContent = title;
    $('overlay-body').textContent = body;
    $('start').textContent = button;
    $('start-hint').textContent = state.mode === 'paused' ? 'The clock is stopped.' : 'Same moment. One more chance.';
    $('overlay').hidden = false;
    $('replay').hidden = state.mode !== 'won';
    $('start').focus({ preventScroll: true });
  }
  function pause() {
    if (state.mode !== 'playing') return;
    state.mode = 'paused'; cancelCharge(); setAction(false);
    $('callout').classList.remove('visible'); $('feedback').classList.remove('visible');
    $('pause').textContent = '▶'; $('pause').setAttribute('aria-label', 'Resume game');
    showOverlay('TAKE A BREATH.', 'Time out.', 'Your comeback will be right here.', 'BACK TO THE MOMENT ↗');
  }
  function resume() {
    if (document.hidden) return;
    state.mode = 'playing'; state.previous = performance.now(); $('overlay').hidden = true;
    $('pause').textContent = 'Ⅱ'; $('pause').setAttribute('aria-label', 'Pause game');
    setAction(state.phase === 'ready' || state.phase === 'steal', state.phase === 'steal');
    stage.focus({ preventScroll: true });
    resize();
  }
  function end(won) {
    state.mode = won ? 'won' : 'lost'; cancelCharge(); setAction(false); $('pause').disabled = true;
    root.classList.remove('is-replay');
    $('callout').classList.remove('visible'); $('feedback').classList.remove('visible');
    const used = (33 - state.remaining).toFixed(1);
    if (won) {
      state.cheer = 4;
      if (state.best === null || Number(used) < state.best) state.best = Number(used);
      announce(`Houston 81, San Antonio 80. You scored 13 points in ${used} seconds.`);
      showOverlay('HOUSTON 81. SAN ANTONIO 80.', 'They believe now.', `13 points in ${used} seconds of game time. ${state.attempts} shots. One impossible comeback. This is why the username is TMACFORMVP.`, 'RUN IT BACK ↗');
      $('start-hint').textContent = `Your best this visit: 13 in ${state.best.toFixed(1)} seconds.`;
      $('broadcast').innerHTML = 'FINAL <span>HOUSTON WINS</span>';
    } else {
      sound('buzzer'); announce(`Time expired. ${state.home - 68} of 13 points scored.`);
      showOverlay('THE CLOCK DOESN’T NEGOTIATE.', 'Almost a miracle.', `${state.home - 68} of 13 points. Hold until the needle reaches green, then let go. Houston needs every shot.`, 'ONE MORE CHANCE ↗');
    }
    updateHUD();
  }
  function celebrate() {
    state.mode = 'celebrating'; state.celebrationTime = 0; state.cheer = 4;
    cancelCharge(); setAction(false); $('pause').disabled = true;
    $('broadcast').innerHTML = '81–80 <span>HOUSTON LEADS!</span>';
    callout('DO YOU BELIEVE?!', 3); sound('win'); updateHUD();
    if (reduced.matches) end(true);
  }
  function replay() {
    if (state.mode !== 'won' || !state.lastShot) return;
    state.mode = 'replay'; state.phase = 'shot'; state.replayTime = 0; state.phaseTime = 0;
    state.shot = { ...state.lastShot, duration: 2.65 };
    state.cheer = 0; state.previous = performance.now();
    root.classList.add('is-focused'); root.classList.add('is-replay');
    $('overlay').hidden = true; $('callout').classList.remove('visible'); $('feedback').classList.remove('visible');
    $('broadcast').innerHTML = 'INSTANT REPLAY <span>THE GAME WINNER</span>';
    announce('Instant replay of your winning shot. The score and clock are unchanged.');
    stage.focus({ preventScroll: true }); resize();
  }
  function beginCharge() {
    if (state.mode !== 'playing' || !['ready', 'steal'].includes(state.phase) || state.charge !== null) return;
    state.charge = state.elapsed; $('shoot').classList.add('charging');
  }
  function release() {
    if (state.charge === null || state.mode !== 'playing') return;
    const value = meterValue(), held = state.elapsed - state.charge;
    const made = held >= .12 && value >= .66 && value <= .84;
    cancelCharge();
    if (held < .12) { announce('Hold the button down, then release when the needle reaches green.'); return; }
    feedback(made ? 'PERFECT RELEASE' : value < .66 ? 'EARLY RELEASE' : 'LATE RELEASE', made);
    if (state.phase === 'steal') {
      if (made) {
        sound('steal'); callout('STOLEN BY McGRADY!');
        announce('Brown loses it! Push up the floor. One three to win.');
        transition(1.8, () => ready(4), { x: plays[4].x, y: plays[4].y });
      } else {
        state.remaining = Math.max(0, state.remaining - 1); sound('miss'); callout('REACH AGAIN.', .75);
        announce('Missed the ball. One second lost. Hold and release in green to steal.');
        if (state.remaining <= 0) end(false);
      }
      return;
    }
    state.attempts++; if (made) state.perfect++;
    state.phase = 'shot'; state.phaseTime = 0; setAction(false); sound('release');
    const start = point(state.player.x, state.player.y, 90);
    state.shot = { start, made, value, duration: state.step === 4 && !reduced.matches ? 1.6 : 1.08, end: { x: rim.x + (made ? 0 : value < .66 ? -21 : 23), y: rim.y + (made ? 0 : 8) } };
    if (state.step === 4) state.lastShot = { ...state.shot };
    announce(state.step === 4 ? 'For the lead…' : made ? 'Perfect release. It’s on its way…' : value < .66 ? 'Early release…' : 'Late release…');
  }
  function transition(duration, next, target) {
    state.phase = 'transition'; state.phaseTime = 0; state.phaseDuration = duration;
    state.next = next; state.from = { ...state.player }; state.target = target || { ...state.player };
    setAction(false);
  }
  function ready(step) {
    state.step = step; state.phase = 'ready'; state.phaseTime = 0; state.shot = null;
    state.player = { x: plays[step].x, y: plays[step].y };
    $('play-label').textContent = plays[step].title; announce(plays[step].prompt); setAction(true); updateHUD();
    $('broadcast').innerHTML = step === 2 ? 'AND ONE <span>CLOCK STOPPED</span>' : step === 4 ? 'ONE SHOT <span>FOR THE LEAD</span>' : '4TH QUARTER <span>HOUSTON</span>';
  }
  function finishShot() {
    const shot = state.shot, play = plays[state.step]; state.shot = null;
    if (!shot.made) {
      sound('miss'); callout('OFF THE IRON.', .85); announce('Off the rim. Get it back and find the green.');
      if (state.remaining <= 0) { end(false); return; }
      transition(.8, () => ready(state.step)); return;
    }
    state.home += play.value; state.made.add(state.step); state.cheer = 1.5 + state.step * .3;
    sound('make'); callout(play.call, 1.7); updateHUD();
    if (state.step === 4) { celebrate(); return; }
    if (state.remaining <= 0) { end(false); return; }
    if (state.step === 0) {
      announce('76–71. Houston fouls. Brown makes both. Back to you.');
      transition(2.1, () => { state.away = 78; ready(1); }, plays[1]);
    } else if (state.step === 1) {
      sound('whistle');
      announce('Count it! Duncan gets you on the arm. One free throw.');
      // The dead-ball walk to the line and the free throw both stop the arcade clock.
      state.step = 2; updateHUD();
      transition(1.65, () => ready(2), plays[2]);
    } else if (state.step === 2) {
      announce('78–75. Houston fouls Duncan. He makes both. You need another three.');
      state.step = 3;
      transition(2.1, () => { state.away = 80; ready(3); }, plays[3]);
    } else {
      announce('80–78. Spurs inbound. Brown is trapped. Steal it!');
      transition(1.4, () => {
        state.step = 4; state.phase = 'steal'; state.phaseTime = 0;
        state.player = { x: -42, y: 393 };
        $('play-label').textContent = '04 / FIRST, STEAL THE INBOUND';
        announce('Brown stumbles. Hold and release in green to take the ball.'); setAction(true, true); updateHUD();
      }, { x: -42, y: 393 });
    }
  }

  // All court markings and uniforms are drawn locally; no image or game-engine dependency.
  function path(points, fill, stroke, width = 1, close = true) {
    ctx.beginPath(); points.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
    if (close) ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.stroke(); }
  }
  function line(a, b, color, width = 2) { path([a, b], null, color, width, false); }
  function ellipse(x, y, rx, ry, fill, stroke, width = 1) {
    ctx.beginPath(); ctx.ellipse(x, y, Math.max(.01, rx), Math.max(.01, ry), 0, 0, Math.PI * 2);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.stroke(); }
  }
  function text(str, x, y, size, color, align = 'center', weight = 600, family = 'Arial') {
    ctx.fillStyle = color; ctx.textAlign = align; ctx.font = `${weight} ${size}px ${family}`; ctx.fillText(str, x, y);
  }
  function floorPath(coords, fill, stroke, width = 2) { path(coords.map(([x, y]) => point(x, y)), fill, stroke, width); }
  function arc(cx, cy, r, start, end, color, width = 2) {
    const pts = [];
    for (let i = 0; i <= 60; i++) { const a = lerp(start, end, i / 60); pts.push(point(cx + Math.cos(a) * r, cy + Math.sin(a) * r)); }
    path(pts, null, color, width, false);
  }
  const crowd = Array.from({ length: 440 }, (_, i) => {
    const seed = Math.sin(i * 127.1 + 311.7) * 43758.5453;
    const r = seed - Math.floor(seed);
    return { x: (i % 55) * 21 - 16 + r * 10, y: 31 + Math.floor(i / 55) * 17,
      color: ['#772c32', '#aba994', '#243333', '#464c42', '#af3b45', '#787d6b'][Math.floor(r * 6)], r };
  });
  // Cache the static hardwood geometry; only the crowd and athletes repaint each frame.
  const floor = document.createElement('canvas'); floor.width = 1100; floor.height = 620;
  function drawCourt() {
    const c = ctx;
    const backdrop = c.createLinearGradient(0, 150, 0, 620);
    backdrop.addColorStop(0, '#28322a'); backdrop.addColorStop(1, '#0c1512'); c.fillStyle = backdrop; c.fillRect(0, 160, 1100, 460);
    floorPath([[-272, -17], [272, -17], [272, 489], [-272, 489]], '#9e1e33');
    floorPath([[-250, 0], [250, 0], [250, 470], [-250, 470]], '#cba46e');
    c.save(); path([point(-250, 0), point(250, 0), point(250, 470), point(-250, 470)], null, null); c.clip();
    for (let y = 0; y < 470; y += 11.75) {
      const band = Math.floor(y / 11.75);
      floorPath([[-250, y], [250, y], [250, y + 11.75], [-250, y + 11.75]], ['#c8a06a', '#cdaa75', '#d2ad79', '#c6a16d'][band % 4]);
      line(point(-250, y), point(250, y), '#96744542', .7);
      for (let x = -250 + (band % 3) * 34; x < 250; x += 100) line(point(x, y), point(x, y + 11.75), '#8b683538', .7);
    }
    for (let i = 0; i < 160; i++) {
      const y = (i * 37.3) % 470, x = ((i * 131.3) % 500) - 250;
      line(point(x, y), point(Math.min(250, x + 30 + (i % 40)), y + .5), '#efc89528', .65);
    }
    c.restore();
    floorPath([[-80, 0], [80, 0], [80, 190], [-80, 190]], '#ad2738', '#f6e4c3', 2);
    floorPath([[-60, 0], [60, 0], [60, 190], [-60, 190]], '#b62c3a');
    floorPath([[-250, 0], [250, 0], [250, 470], [-250, 470]], null, '#f6e4c3', 2.3);
    arc(0, 190, 60, 0, Math.PI, '#f8e4c4', 2);
    c.setLineDash([5, 6]); arc(0, 190, 60, Math.PI, 2 * Math.PI, '#efd9bb99', 1.5); c.setLineDash([]);
    arc(0, 52, 40, 0, Math.PI, '#f5dac0', 1.8);
    const cornerAngle = Math.acos(220 / 237.5), joinY = 52 + Math.sin(cornerAngle) * 237.5;
    line(point(-220, 0), point(-220, joinY), '#f6e4c3', 2.4);
    line(point(220, 0), point(220, joinY), '#f6e4c3', 2.4);
    arc(0, 52, 237.5, cornerAngle, Math.PI - cornerAngle, '#f6e4c3', 2.4);
    arc(0, 470, 61, Math.PI, 2 * Math.PI, '#b0273c', 2.4);
    for (const y of [70, 99, 126, 155]) for (const s of [-1, 1]) line(point(s * 80, y), point(s * 89, y), '#f6e4c3', 2);
    const logo = point(0, 414);
    c.save(); c.translate(logo.x, logo.y); c.scale(1, .63); c.rotate(-.1);
    ellipse(0, 0, 63, 43, null, '#b0253c', 3);
    text('R', 0, 33, 96, '#b0253c', 'center', 900, 'Georgia');
    line({ x: -14, y: 11 }, { x: -20, y: 55 }, '#b0253c', 6); line({ x: 14, y: 11 }, { x: 20, y: 55 }, '#b0253c', 6);
    c.restore();
    c.save(); c.translate(550, 211); c.scale(1, .63); text('H O U S T O N   R O C K E T S', 0, 0, 17, '#f2e7d5', 'center', 700); c.restore();
    c.save(); const loc = point(-172, 181); c.translate(loc.x, loc.y); c.rotate(-.12); c.scale(1, .65);
    text('TOYOTA', 0, 0, 17, '#8f2537', 'center', 700); text('CENTER', 0, 18, 11, '#8f2537', 'center', 600); c.restore();
    const shine = c.createLinearGradient(0, 220, 0, 600); shine.addColorStop(0, '#fff2ba17'); shine.addColorStop(.5, '#fff2ba00'); shine.addColorStop(1, '#30261915');
    c.fillStyle = shine; c.fillRect(0, 220, 1100, 400);
  }
  drawCourt(); floor.getContext('2d').drawImage(canvas, 0, 0);
  function drawArena(t) {
    ctx.fillStyle = '#111912'; ctx.fillRect(0, 0, 1100, 620);
    const glow = ctx.createRadialGradient(550, 95, 0, 550, 95, 610);
    glow.addColorStop(0, '#49503c'); glow.addColorStop(.7, '#18231b'); glow.addColorStop(1, '#0b140f');
    ctx.fillStyle = glow; ctx.fillRect(0, 0, 1100, 205);
    for (let row = 0; row < 8; row++) { ctx.fillStyle = row % 2 ? '#282c23' : '#22291f'; ctx.fillRect(0, 35 + row * 17, 1100, 13); }
    for (const fan of crowd) {
      const bounce = reduced.matches ? 0 : state.cheer > 0 ? Math.sin(t * 11 + fan.r * 30) * 4 * fan.r : Math.sin(t * 1.6 + fan.r * 12) * .7;
      const y = fan.y + bounce;
      ctx.fillStyle = fan.color; ctx.fillRect(fan.x - 4, y + 4, 9, 10);
      ellipse(fan.x, y + 2, 3.5, 3.8, fan.r > .5 ? '#97755b' : '#5a4433');
      if (state.cheer > .7 && fan.r > .4) {
        line({ x: fan.x - 4, y: y + 7 }, { x: fan.x - 8, y: y - 3 }, fan.color, 2);
        line({ x: fan.x + 4, y: y + 7 }, { x: fan.x + 8, y: y - 3 }, fan.color, 2);
      }
    }
    ctx.fillStyle = '#121912'; ctx.fillRect(0, 167, 1100, 29);
    ctx.fillStyle = '#b1263c'; ctx.fillRect(0, 166, 1100, 2);
    for (let x = 100; x < 1100; x += 225) text(x % 2 ? 'HOUSTON' : 'BE PART OF SOMETHING', x, 186, 9, '#ddd9bd', 'center', 600);
    text('HOUSTON', 545, 186, 11, '#f1e1c5');
    ctx.drawImage(floor, 0, 0);
    // Courtside chairs, media table, and bench silhouettes.
    for (const side of [-1, 1]) for (let i = 0; i < 9; i++) {
      const p = point(side * 264, 38 + i * 36);
      ctx.fillStyle = '#222b23'; ctx.fillRect(p.x - 9, p.y - 17, 18, 21);
      ellipse(p.x, p.y - 22, 4, 5, '#876c50'); line({ x: p.x, y: p.y - 16 }, { x: p.x, y: p.y - 2 }, '#364439', 9);
    }
  }
  function drawHoop(t) {
    const base = point(0, -8), glass = point(0, 30, 110);
    line({ x: base.x, y: base.y }, { x: base.x, y: glass.y - 20 }, '#23322c', 15);
    path([{ x: base.x - 19, y: base.y + 3 }, { x: base.x + 19, y: base.y + 3 }, { x: base.x + 12, y: base.y - 46 }, { x: base.x - 12, y: base.y - 46 }], '#9a2436', '#591c2b');
    text('HOU', base.x, base.y - 13, 9, '#f1ddcb');
    ctx.fillStyle = '#cfdfd22b'; ctx.strokeStyle = '#d3dcce'; ctx.lineWidth = 2.5;
    ctx.fillRect(glass.x - 44, glass.y - 29, 88, 51); ctx.strokeRect(glass.x - 44, glass.y - 29, 88, 51);
    ctx.lineWidth = 2; ctx.strokeStyle = '#ececdb'; ctx.strokeRect(glass.x - 17, glass.y - 4, 34, 23);
    const netMotion = reduced.matches ? 0 : state.cheer > 1 ? Math.sin(t * 23) * 3 : 0;
    for (let i = -2; i <= 2; i++) {
      line({ x: rim.x + i * 6, y: rim.y + 3 }, { x: rim.x + i * 4 + netMotion, y: rim.y + 22 }, '#f6e8d1af', 1.2);
      line({ x: rim.x + i * 6, y: rim.y + 3 }, { x: rim.x - i * 4 + netMotion, y: rim.y + 22 }, '#f6e8d17f', .8);
    }
    ellipse(rim.x + netMotion * .5, rim.y + 13, 11, 4, null, '#eee4cc99');
    ellipse(rim.x + netMotion, rim.y + 22, 8, 2.8, null, '#eee4cc99');
    ellipse(rim.x, rim.y, 16, 5, null, '#eb6834', 3);
    ctx.fillStyle = '#121912'; ctx.fillRect(glass.x - 22, glass.y - 51, 44, 17);
    text(state.mode === 'intro' ? '33' : Math.ceil(state.remaining).toString().padStart(2, '0'), glass.x, glass.y - 38, 13, '#ef9657', 'center', 600, 'monospace');
  }
  function basketball(x, y, r, rotation = 0) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rotation);
    ellipse(0, 0, r, r, '#dd7c2f', '#4c2918', 1.2);
    ctx.beginPath(); ctx.moveTo(-r, 0); ctx.lineTo(r, 0); ctx.moveTo(0, -r); ctx.lineTo(0, r);
    ctx.moveTo(-r * .65, -r * .72); ctx.quadraticCurveTo(r * .2, 0, -r * .65, r * .72);
    ctx.moveTo(r * .65, -r * .72); ctx.quadraticCurveTo(-r * .2, 0, r * .65, r * .72);
    ctx.strokeStyle = '#61371d'; ctx.lineWidth = 1; ctx.stroke();
    ellipse(-r * .3, -r * .35, r * .18, r * .12, '#f4b15b'); ctx.restore();
  }
  function player(p, t) {
    const loc = point(p.x, p.y), scale = (1 + p.y / 850) * (p.tall || 1);
    const moving = p.main && state.phase === 'transition';
    const run = reduced.matches ? 0 : Math.sin(t * (moving ? 13 : 3) + (p.number || 0)) * (moving ? 10 : 2);
    const shotTime = state.shot ? state.phaseTime * 1.08 / state.shot.duration : state.phaseTime;
    const shooting = p.main && (state.charge !== null || (state.shot && shotTime < .65));
    const shotJump = shooting && state.shot ? Math.sin(clamp(shotTime / .65) * Math.PI) * 20 : 0;
    const defending = !p.home && p.contest;
    const contesting = defending && (state.charge !== null || (state.shot && shotTime < .55));
    const lift = contesting ? Math.sin(clamp(state.charge !== null ? (state.elapsed - state.charge) / .9 : shotTime / .55) * Math.PI) * 14 : 0;
    const celebrating = p.home && ['celebrating', 'won'].includes(state.mode);
    const celebrationJump = celebrating && !reduced.matches ? Math.max(0, Math.sin(t * 6 + p.number)) * 11 : 0;
    ellipse(loc.x, loc.y + 1, 15 * scale, 5 * scale, '#32270c49');
    if (p.main) {
      ellipse(loc.x, loc.y + 2, 24 * scale, 8 * scale, '#d7f6750c', '#d7f675', 1.8);
      const tip = { x: loc.x, y: loc.y + 17 * scale };
      path([{ x: tip.x - 4, y: tip.y }, { x: tip.x + 4, y: tip.y }, { x: tip.x, y: tip.y - 6 }], '#d7f675');
    }
    ctx.save(); ctx.translate(loc.x, loc.y - shotJump - lift - celebrationJump); ctx.scale(scale, scale);
    if (moving) ctx.rotate(clamp((state.target.x - state.from.x) / 700, -.13, .13));
    const skin = p.skin || '#805337', edge = '#452f26', cloth = p.home ? jersey.home : jersey.away;
    const trim = p.home ? jersey.red : jersey.silver;
    const armUp = shooting || contesting || celebrating;
    const crouch = p.main && state.charge !== null ? 3 : 0;
    ctx.translate(0, crouch);
    // Legs, socks and period low-top shoes.
    line({ x: -6, y: -24 }, { x: -8 - run * .45, y: -7 }, skin, 6);
    line({ x: 6, y: -24 }, { x: 8 + run * .45, y: -7 }, skin, 6);
    line({ x: -8 - run * .45, y: -8 }, { x: -8 - run * .5, y: -3 }, '#e4e0d4', 5);
    line({ x: 8 + run * .45, y: -8 }, { x: 8 + run * .5, y: -3 }, '#e4e0d4', 5);
    ellipse(-10 - run * .5, -2, 6, 2.6, p.home ? '#262827' : '#d1d0c4');
    ellipse(10 + run * .5, -2, 6, 2.6, p.home ? '#262827' : '#d1d0c4');
    path([{ x: -12, y: -35 }, { x: 12, y: -35 }, { x: 14, y: -20 }, { x: 2, y: -20 }, { x: 0, y: -27 }, { x: -2, y: -20 }, { x: -14, y: -20 }], cloth, edge, .6);
    line({ x: -12, y: -32 }, { x: -13, y: -22 }, trim, 2); line({ x: 12, y: -32 }, { x: 13, y: -22 }, trim, 2);
    const leftHand = armUp ? { x: -10, y: -76 } : { x: -18 - run * .35, y: -34 };
    const rightHand = armUp ? { x: 10, y: -79 } : { x: 19 + run * .35, y: -36 };
    const elbowL = armUp ? { x: -21, y: -61 } : { x: -17, y: -46 };
    const elbowR = armUp ? { x: 20, y: -64 } : { x: 18, y: -47 };
    for (const [shoulder, elbow, hand] of [[{ x: -10, y: -58 }, elbowL, leftHand], [{ x: 10, y: -58 }, elbowR, rightHand]]) {
      line(shoulder, elbow, skin, 6); line(elbow, hand, skin, 4.8); ellipse(hand.x, hand.y, 2.8, 3, skin);
    }
    if (p.main) line(elbowL, { x: lerp(elbowL.x, leftHand.x, .6), y: lerp(elbowL.y, leftHand.y, .6) }, '#e8e5d6', 5.4);
    path([{ x: -9, y: -61 }, { x: -3, y: -63 }, { x: 3, y: -63 }, { x: 10, y: -60 }, { x: 12, y: -35 }, { x: -12, y: -35 }], cloth, edge, .7);
    line({ x: -10, y: -57 }, { x: -11, y: -37 }, trim, 2.1); line({ x: 10, y: -57 }, { x: 11, y: -37 }, trim, 2.1);
    path([{ x: -4, y: -62 }, { x: 0, y: -58 }, { x: 4, y: -62 }], null, trim, 1.4, false);
    text(p.main ? 'McGRADY' : p.home ? 'ROCKETS' : 'SPURS', 0, -51, p.main ? 3.7 : 4.1, trim, 'center', 800);
    text(String(p.number), 0, -39, 12, trim, 'center', 700);
    ctx.fillStyle = skin; ctx.fillRect(-3, -68, 6, 7);
    ellipse(0, -72, 6.4, 8, skin, edge, .7);
    path([{ x: -6, y: -73 }, { x: -5, y: -79 }, { x: 0, y: -81 }, { x: 5, y: -78 }, { x: 6, y: -74 }, { x: 0, y: -77 }], '#211e18');
    if (!p.main) { line({ x: -3, y: -71 }, { x: -1.5, y: -71 }, '#2c251e', .7); line({ x: 2, y: -71 }, { x: 3.5, y: -71 }, '#2c251e', .7); }
    if (p.main && !state.shot && state.phase !== 'steal' && !celebrating) {
      if (shooting) basketball(2, -85, 5.4, t);
      else {
        const bounce = reduced.matches ? .55 : Math.abs(Math.sin(t * 7));
        basketball(21, -7 - bounce * 30, 5.5, t * 2);
      }
    }
    if (p.ball) basketball(19, -23, 5.4, t);
    ctx.restore();
    if (p.main && state.mode === 'playing' && !state.shot) {
      text(state.phase === 'steal' ? 'STEAL' : 'McGRADY', loc.x, loc.y + 33 * scale, 9, '#f5f2df', 'center', 700, 'monospace');
      if (state.charge !== null) {
        const x = loc.x - 32, y = loc.y - 119 * scale;
        ctx.fillStyle = '#10190fe8'; ctx.fillRect(x - 3, y - 3, 70, 13);
        ctx.fillStyle = '#445039'; ctx.fillRect(x, y, 64, 7);
        ctx.fillStyle = '#d7f675'; ctx.fillRect(x + 64 * .66, y, 64 * .18, 7);
        ctx.fillStyle = '#ffffff'; ctx.fillRect(x + meterValue() * 64 - 1, y - 2, 3, 11);
      }
    }
  }
  function drawPlayers(t) {
    const p = state.player;
    const drift = reduced.matches ? 0 : Math.sin(t * 1.7) * 7;
    const ft = state.step === 2;
    const closeout = state.charge === null ? 0 : ease(clamp((state.elapsed - state.charge) / .8));
    const defenders = [
      { x: ft ? -89 : p.x - 31 + drift + closeout * 17, y: ft ? 145 : p.y - 55 + closeout * 27, number: state.step === 1 ? 21 : state.step === 4 ? 17 : 12, home: false, contest: !ft, skin: '#795239', tall: state.step === 1 ? 1.09 : 1 },
      { x: ft ? 90 : -72, y: 94 + drift, number: state.step === 1 ? 12 : 21, home: false, tall: 1.12, skin: '#997052' },
      { x: ft ? -91 : -172, y: ft ? 96 : 201 - drift, number: 9, home: false, skin: '#b28c68' },
      { x: ft ? 91 : 197, y: ft ? 99 : 136 + drift, number: 23, home: false, skin: '#77503b' },
      { x: ft ? 163 : 34, y: ft ? 297 : 325 + drift, number: state.step === 4 ? 12 : 17, home: false, skin: '#b89976' }
    ];
    if (state.phase === 'steal') {
      defenders[0].x = -12 + Math.sin(t * 4) * 6; defenders[0].y = 408; defenders[0].number = 23;
      defenders[0].contest = false; defenders[0].ball = true;
    }
    const teammates = [
      { x: ft ? -89 : 84, y: ft ? 120 : 116, home: true, number: 11, tall: 1.23, skin: '#c09a76' },
      { x: ft ? 89 : -196, y: ft ? 121 : 119 + drift, home: true, number: 35, skin: '#b89374' },
      { x: ft ? -165 : 216, y: ft ? 315 : 277 - drift, home: true, number: 3, skin: '#af8563' },
      { x: ft ? 174 : -90, y: ft ? 331 : 362 + drift, home: true, number: 20, skin: '#6d4935' }
    ];
    [...defenders, ...teammates, { ...p, main: true, number: 1, home: true, skin: '#825739', tall: 1.05 }]
      .sort((a, b) => a.y - b.y).forEach(p => player(p, t));
  }
  function drawShot() {
    const s = state.shot; if (!s) return;
    const t = clamp(state.phaseTime / s.duration), flight = clamp(t / .82);
    const x = lerp(s.start.x, s.end.x, flight);
    const y = lerp(s.start.y, s.end.y, flight) - Math.sin(flight * Math.PI) * 145;
    ellipse(lerp(s.start.x, rim.x, flight), lerp(point(state.player.x, state.player.y).y, point(0, 52).y, flight), 5, 2, '#33250740');
    if (t < .82) {
      if (!reduced.matches) for (let i = 3; i > 0; i--) {
        const f = clamp(flight - i * .025);
        ellipse(lerp(s.start.x, s.end.x, f), lerp(s.start.y, s.end.y, f) - Math.sin(f * Math.PI) * 145, 3, 3, `rgba(255,223,156,${.13 - i * .025})`);
      }
      basketball(x, y, 6.8 - flight * 1.7, flight * 9);
    } else {
      const fall = (t - .82) / .18;
      basketball(s.end.x + (s.made ? 0 : Math.sin(fall * 2) * 34), s.end.y + fall * (s.made ? 37 : 16) - (s.made ? 0 : Math.sin(fall * Math.PI) * 23), 5.2, t * 12);
    }
  }
  function render(t) {
    const dpr = canvas.width / state.width;
    const narrow = state.width / state.height < 1.25;
    const scale = (narrow ? state.height / 620 : Math.min(state.width / 1100, state.height / 620)) * state.cameraZoom;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#111810'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(scale * dpr, 0, 0, scale * dpr, (state.width / 2 - state.cameraX * scale) * dpr, (state.height / 2 - 310 * scale) * dpr);
    drawArena(t); drawHoop(t); drawPlayers(t); drawShot();
    const vignette = ctx.createRadialGradient(550, 330, 170, 550, 300, 650);
    vignette.addColorStop(0, '#09150e00'); vignette.addColorStop(1, '#09150e70'); ctx.fillStyle = vignette; ctx.fillRect(0, 0, 1100, 620);
    // Subtle broadcast scanlines; no flashes or camera shake.
    ctx.fillStyle = '#0912090b'; for (let y = 0; y < 620; y += 4) ctx.fillRect(0, y, 1100, 1);
  }
  function updateCamera(dt) {
    const narrow = state.width / state.height < 1.25;
    const targetX = narrow ? lerp(rim.x, point(state.player.x, state.player.y).x, .48) : 550;
    const targetZoom = !reduced.matches && state.step === 4 && (state.shot || state.phase === 'ready') ? 1.035 : 1;
    const follow = reduced.matches ? 1 : 1 - Math.exp(-Math.min(dt, .1) * 6);
    state.cameraX = lerp(state.cameraX, targetX, follow);
    state.cameraZoom = lerp(state.cameraZoom, targetZoom, follow);
  }
  function tick(now) {
    const dt = state.previous ? Math.max(0, (now - state.previous) / 1000) : 0;
    state.previous = now;
    if (state.mode === 'playing') {
      state.elapsed += dt; state.phaseTime += dt; state.cheer = Math.max(0, state.cheer - dt);
      if (state.step !== 2) state.remaining = Math.max(0, state.remaining - dt);
      if (state.remaining <= 0 && state.phase !== 'shot') end(false);
      if (state.mode === 'playing') {
        if (state.phase === 'shot' && state.phaseTime >= state.shot.duration) finishShot();
        else if (state.phase === 'transition') {
          const progress = ease(clamp(state.phaseTime / state.phaseDuration));
          state.player.x = lerp(state.from.x, state.target.x, progress); state.player.y = lerp(state.from.y, state.target.y, progress);
          if (state.phaseTime >= state.phaseDuration) { const next = state.next; state.next = null; next(); }
        }
        if (state.charge !== null) {
          const v = Math.round(meterValue() * 100); $('needle').style.left = `${v}%`; $('meter').setAttribute('aria-valuenow', String(v));
        }
        if (state.phase === 'ready' && state.charge === null && state.elapsed - state.lastBounce > .45) { sound('bounce'); state.lastBounce = state.elapsed; }
        if (state.elapsed > state.callUntil) $('callout').classList.remove('visible');
        if (state.elapsed > state.feedbackUntil) $('feedback').classList.remove('visible');
        const remainingSecond = Math.ceil(state.remaining);
        if (remainingSecond < state.lastTick && remainingSecond <= 5 && remainingSecond > 0 && state.step !== 2) sound('tick');
        state.lastTick = remainingSecond;
        updateHUD();
      }
    } else if (state.mode === 'celebrating') {
      state.celebrationTime += dt;
      if (state.celebrationTime >= 2) end(true);
    } else if (state.mode === 'replay') {
      state.replayTime += dt; state.phaseTime = state.replayTime;
      if (state.replayTime >= state.shot.duration) {
        state.shot = null; state.cheer = 4; state.mode = 'celebrating'; state.celebrationTime = .65;
        callout('ONE MORE LOOK.', 3); sound('make');
      }
    }
    updateCamera(dt);
    // Pausing freezes the scene; offscreen and reduced-motion idle states do not repaint.
    if (state.inView && state.mode !== 'paused' && (!reduced.matches || ['playing', 'replay', 'celebrating'].includes(state.mode))) render(state.mode === 'playing' ? state.elapsed : state.mode === 'replay' ? state.elapsed + state.replayTime * .4 : reduced.matches ? 0 : now / 1000);
    requestAnimationFrame(tick);
  }
  $('start').addEventListener('click', startGame);
  $('replay').addEventListener('click', replay);
  $('audio').addEventListener('click', toggleSound);
  $('pause').addEventListener('click', () => state.mode === 'paused' ? resume() : pause());
  $('shoot').addEventListener('pointerdown', e => {
    if (e.button !== 0 || state.charge !== null) return;
    e.preventDefault(); $('shoot').focus({ preventScroll: true });
    $('shoot').setPointerCapture(e.pointerId); beginCharge();
  });
  $('shoot').addEventListener('pointerup', release);
  $('shoot').addEventListener('pointercancel', cancelCharge);
  $('shoot').addEventListener('lostpointercapture', cancelCharge);
  root.addEventListener('keydown', e => {
    if ((e.code === 'Space' || e.code === 'Enter') && (e.target === stage || e.target === $('shoot'))) {
      e.preventDefault(); if (!e.repeat) beginCharge();
    }
    if (e.code === 'KeyP' || e.code === 'Escape') {
      if (!e.repeat && (state.mode === 'playing' || state.mode === 'paused')) { e.preventDefault(); state.mode === 'paused' ? resume() : pause(); }
    }
  });
  root.addEventListener('keyup', e => {
    if ((e.code === 'Space' || e.code === 'Enter') && (e.target === stage || e.target === $('shoot'))) { e.preventDefault(); release(); }
  });
  root.addEventListener('focusout', e => {
    if (!root.contains(e.relatedTarget) && state.mode === 'playing') pause();
    else if (e.target === $('shoot') || e.target === stage) cancelCharge();
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
  window.addEventListener('blur', pause);
  $('exit').addEventListener('click', () => {
    if (state.mode === 'replay' || state.mode === 'celebrating') { state.shot = null; end(true); }
    pause(); root.classList.remove('is-focused');
    resize();
    $('start').focus({ preventScroll: true });
  });
  if ('IntersectionObserver' in window) new IntersectionObserver(entries => {
    state.inView = entries[0].isIntersecting;
    if (!state.inView && state.mode === 'playing') pause();
    else if (state.inView) render(reduced.matches ? 0 : performance.now() / 1000);
  }, { threshold: .15 }).observe(stage);
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const bounds = stage.getBoundingClientRect();
    state.width = Math.max(1, bounds.width); state.height = Math.max(1, bounds.height);
    canvas.width = Math.round(state.width * dpr); canvas.height = Math.round(state.height * dpr);
    state.cameraX = state.width / state.height < 1.25 ? lerp(rim.x, point(state.player.x, state.player.y).x, .48) : 550;
    render(reduced.matches ? 0 : state.elapsed);
  }
  if ('ResizeObserver' in window) new ResizeObserver(resize).observe(stage);
  window.addEventListener('resize', resize); reduced.addEventListener('change', resize);
  resize(); updateHUD(); requestAnimationFrame(tick);
})();
