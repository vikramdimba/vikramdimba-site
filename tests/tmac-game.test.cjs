// Deterministic game-loop tests. No browser, dependencies, or production test hooks.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

function game({ reducedMotion = true, width = 1100, height = 620, film = null } = {}) {
  let now = 1000;
  const listeners = new Map(), elements = new Map();
  const noop = () => {};
  const gradient = { addColorStop: noop };
  const ctx = new Proxy({}, { get: (_, key) => key.startsWith('create') ? () => gradient : noop, set: () => true });
  const doc = { activeElement: null, hidden: false };
  function element(id) {
    if (elements.has(id)) return elements.get(id);
    const classes = new Set();
    const el = { id, disabled: false, hidden: false, style: {}, dataset: {}, textContent: '', attrs: {},
      classList: { add: c => classes.add(c), remove: c => classes.delete(c), contains: c => classes.has(c), toggle: (c, b) => b ? classes.add(c) : classes.delete(c) },
      addEventListener: (type, fn) => listeners.set(`${id}:${type}`, fn),
      setAttribute: (k, v) => el.attrs[k] = v,
      getContext: () => ctx,
      getBoundingClientRect: () => ({ width, height }),
      focus: () => { const old = doc.activeElement; doc.activeElement = el; if (old && old !== el) listeners.get('tmac-game:focusout')?.({ target: old, relatedTarget: el }); },
      contains: other => other && other.id !== 'outside',
      setPointerCapture: noop,
      querySelector: selector => element(selector),
      querySelectorAll: () => [0, 1, 3, 4].map(n => { const li = element(`li-${n}`); li.dataset.step = String(n); return li; })
    };
    elements.set(id, el); return el;
  }
  Object.assign(doc, { getElementById: element, createElement: id => element(`created-${id}`), addEventListener: (type, fn) => listeners.set(`document:${type}`, fn) });
  const window = { TmacFilm: film, devicePixelRatio: 1, addEventListener: (type, fn) => listeners.set(`window:${type}`, fn) };
  const context = { document: doc, window, performance: { now: () => now }, matchMedia: () => ({ matches: reducedMotion, addEventListener: noop }), requestAnimationFrame: noop, console };
  const source = fs.readFileSync(path.join(__dirname, '../tmac-game.js'), 'utf8');
  vm.runInNewContext(source.replace(/\}\)\(\);\s*$/, 'globalThis.testAPI = { state, tick }; })();'), context);
  const api = context.testAPI;
  const emit = (id, type, extras = {}) => listeners.get(`${id}:${type}`)?.({ target: element(id), preventDefault: noop, ...extras });
  function advance(seconds) {
    const end = now + seconds * 1000;
    while (now < end - .00001) { now = Math.min(end, now + 10); api.tick(now); }
  }
  function key(type, code = 'Space') { emit('tmac-game', type, { target: element('.moment-stage'), code }); }
  function hold(seconds = .77) { key('keydown'); advance(seconds); key('keyup'); }
  function settle() { advance(3.4); }
  function waitFor(predicate, limit = 8) {
    for (let t = 0; !predicate() && t < limit; t += .01) advance(.01);
    assert.ok(predicate(), `Timed out: ${api.state.mode}/${api.state.phase}/${api.state.step}`);
  }
  function shootGreen() {
    if (api.state.step === 1) { hold(.08); waitFor(() => api.state.fakeReady); }
    hold([.77, .59, .87, .58, .675][api.state.step]);
  }
  function reachSteal() {
    emit('moment-start', 'click');
    for (let step = 0; step < 4; step++) {
      waitFor(() => api.state.step === step && api.state.phase === 'ready');
      shootGreen();
    }
    waitFor(() => api.state.phase === 'steal');
  }
  function steal() {
    waitFor(() => api.state.phase === 'pullup');
  }
  return { state: api.state, el: element, emit, advance, hold, settle, key, doc, shootGreen, reachSteal, steal, waitFor, start: () => emit('moment-start', 'click') };
}

test('four threes, one free throw, and a steal produce Houston 81–80', () => {
  const g = game(); g.reachSteal();
  assert.equal(g.state.home, 78); assert.equal(g.state.away, 80);
  g.steal(); g.shootGreen(); g.advance(1.1);
  assert.equal(g.state.mode, 'won'); assert.equal(g.state.home, 81); assert.equal(g.state.away, 80);
  assert.equal(g.state.attempts, 5); assert.ok(g.state.remaining > 0);
  assert.equal(g.el('moment-progress').textContent, '13 / 13 PTS');
});

test('an early miss does not score or skip its possession', () => {
  const g = game(); g.start(); g.hold(.25); g.advance(2);
  assert.equal(g.state.home, 68); assert.equal(g.state.step, 0); assert.equal(g.state.phase, 'ready');
  assert.equal(g.state.attempts, 1); assert.equal(g.state.made.size, 0);
});

test('tap and pointer cancellation do not count as shot attempts', () => {
  const g = game(); g.start(); g.hold(.05);
  assert.equal(g.state.attempts, 0);
  g.emit('moment-shoot', 'pointerdown', { button: 0, pointerId: 1 }); g.advance(.5);
  g.emit('moment-shoot', 'pointercancel'); g.advance(.5); g.emit('moment-shoot', 'pointerup');
  assert.equal(g.state.attempts, 0); assert.equal(g.state.charge, null);
});

test('paused and hidden games freeze time and resume without a clock jump', () => {
  const g = game(); g.start(); g.advance(3); g.emit('moment-pause', 'click');
  const time = g.state.remaining; g.advance(120); assert.equal(g.state.remaining, time);
  g.emit('moment-start', 'click'); g.advance(1); assert.ok(Math.abs(g.state.remaining - time + 1) < .01);
  g.doc.hidden = true; g.emit('document', 'visibilitychange');
  assert.equal(g.state.mode, 'paused');
});

test('the free throw stops the clock, including retries', () => {
  const g = game(); g.start(); g.shootGreen(); g.settle(); g.shootGreen(); g.settle();
  assert.equal(g.state.step, 2); const time = g.state.remaining;
  g.advance(20); g.hold(.25); g.advance(3);
  assert.equal(g.state.remaining, time); assert.equal(g.state.step, 2); assert.equal(g.state.home, 74);
  g.shootGreen(); g.advance(1.1); assert.equal(g.state.home, 75);
});

test('timeout ends the attempt and restart resets the complete game', () => {
  const g = game(); g.start(); g.advance(33.1); assert.equal(g.state.mode, 'lost');
  assert.equal(g.el('moment-shoot').disabled, true); g.start();
  assert.equal(g.state.remaining, 33); assert.equal(g.state.home, 68); assert.equal(g.state.away, 76);
  assert.equal(g.state.attempts, 0); assert.equal(g.state.made.size, 0); assert.equal(g.state.mode, 'playing');
});

test('a final shot released before the buzzer can still win after zero', () => {
  const g = game(); g.reachSteal();
  g.steal();
  // Set only the clock for the buzzer edge; use real input for the moving shot.
  g.state.remaining = .8;
  g.shootGreen(); g.advance(1.1);
  assert.equal(g.state.remaining, 0); assert.equal(g.state.mode, 'won'); assert.equal(g.state.home, 81);
});

test('the steal is automatic and repeated Space presses cannot reset it or cost extra time', () => {
  const g = game(); g.reachSteal();
  const time = g.state.remaining, attempts = g.state.attempts;
  assert.equal(g.el('moment-shoot').disabled, true);
  assert.equal(g.el('moment-meter').hidden, true);
  assert.equal(g.el('moment-meter-label').textContent, 'WAIT — NO INPUT');
  for (let i = 0; i < 8; i++) { g.hold(.05); g.advance(.15); }
  g.steal();
  assert.equal(g.state.attempts, attempts); assert.equal(g.state.home, 78);
  assert.ok(time - g.state.remaining < 3.2);
  assert.equal(g.el('moment-meter-label').textContent, 'HOLD TO SHOOT');
});

test('pointer play returns focus to the court while a shot is in flight', () => {
  const g = game(); g.start();
  g.emit('moment-shoot', 'pointerdown', { button: 0, pointerId: 1 }); g.advance(.71); g.emit('moment-shoot', 'pointerup');
  assert.equal(g.doc.activeElement.id, '.moment-stage'); assert.equal(g.state.phase, 'shot');
  assert.equal(g.state.mode, 'playing');
});

function reachWinner(g) {
  g.reachSteal(); g.steal(); g.shootGreen();
}

test('the cinematic winner pauses the clock for celebration, then offers a replay', () => {
  const g = game({ reducedMotion: false }); reachWinner(g); g.advance(1.7);
  assert.equal(g.state.mode, 'celebrating'); assert.equal(g.state.home, 81);
  const time = g.state.remaining; g.advance(2.1);
  assert.equal(g.state.mode, 'won'); assert.equal(g.state.remaining, time);
  assert.equal(g.el('moment-replay').hidden, false);
});

test('replaying the winning shot cannot change scores, attempts, or game time', () => {
  const g = game(); reachWinner(g); g.advance(1.1);
  const before = [g.state.home, g.state.away, g.state.attempts, g.state.remaining, g.state.best];
  g.emit('moment-replay', 'click'); assert.equal(g.state.mode, 'replay');
  g.advance(4.1); assert.equal(g.state.mode, 'won');
  assert.deepEqual([g.state.home, g.state.away, g.state.attempts, g.state.remaining, g.state.best], before);
  g.start(); assert.equal(g.state.lastShot, null); assert.equal(g.el('moment-replay').hidden, true);
});

test('exit during replay returns safely to the result, with no stale ball animation', () => {
  const g = game(); reachWinner(g); g.advance(1.1); g.emit('moment-replay', 'click');
  g.advance(.4); g.emit('moment-exit', 'click');
  assert.equal(g.state.mode, 'won'); assert.equal(g.state.shot, null);
  assert.equal(g.el('tmac-game').classList.contains('is-focused'), false);
});

test('a portrait camera keeps the shooter and hoop in frame on every possession', () => {
  const g = game({ width: 368, height: 594 }); g.start();
  for (let i = 0; i < 4; i++) {
    const scale = g.state.height / 620;
    const shooterX = 550 + g.state.player.x * 1.17 * (1 + g.state.player.y / 800);
    for (const x of [shooterX, 550]) {
      const screenX = g.state.width / 2 + (x - g.state.cameraX) * scale;
      assert.ok(screenX > 12 && screenX < g.state.width - 12, `Possession ${i}: x=${screenX}`);
    }
    g.shootGreen(); g.settle();
  }
});

test('Duncan’s first press always fakes, with a separate shoot cue and no shot penalty', () => {
  const g = game(); g.start(); g.shootGreen(); g.settle();
  assert.equal(g.el('moment-cue-step').textContent, '1 OF 2 · PUMP FAKE');
  assert.equal(g.el('moment-meter').hidden, true);
  g.key('keydown'); g.advance(.8);
  assert.equal(g.el('moment-meter-label').textContent, 'LET GO TO FAKE');
  g.key('keyup');
  assert.equal(g.state.phase, 'pump'); assert.equal(g.state.attempts, 1);
  assert.equal(g.el('moment-cue-step').textContent, '2 OF 2 · SHOOT');
  assert.equal(g.el('moment-meter').hidden, false);
  g.hold(.59); g.advance(1.1); assert.equal(g.state.home, 74);
});

test('an expired fake clearly returns to the fake instruction', () => {
  const g = game(); g.start(); g.shootGreen(); g.settle();
  g.hold(.08); g.advance(1.9);
  assert.equal(g.state.fakeReady, false);
  assert.equal(g.el('moment-meter').hidden, true);
  assert.equal(g.el('moment-cue-step').textContent, '1 OF 2 · PUMP FAKE');
  g.shootGreen(); g.advance(1.1); assert.equal(g.state.home, 74);
});

test('holding past the green never cycles back into a made shot', () => {
  const g = game(); g.start(); g.hold(2.77);
  assert.equal(g.state.shot.made, false); assert.equal(g.state.shot.value, 1);
});

test('Bowen closes the shot window and resets the catch without scoring', () => {
  const g = game(); g.start();
  for (let step = 0; step < 3; step++) {
    g.waitFor(() => g.state.step === step && g.state.phase === 'ready'); g.shootGreen();
  }
  g.waitFor(() => g.state.step === 3 && g.state.phase === 'ready');
  const time = g.state.remaining;
  g.advance(2.15); assert.equal(g.state.phase, 'transition'); assert.equal(g.state.home, 75);
  g.advance(.8); assert.equal(g.state.phase, 'ready'); assert.equal(g.state.step, 3);
  assert.ok(g.state.remaining < time - 2.9);
});

test('the final run waits for the familiar hold gesture, then moves while charging', () => {
  const g = game(); g.reachSteal(); g.steal();
  const x = g.state.player.x; g.advance(2);
  assert.equal(g.state.phase, 'pullup'); assert.equal(g.state.player.x, x);
  g.key('keydown'); g.advance(.675);
  assert.notEqual(g.state.player.x, x);
  assert.equal(g.el('moment-meter-label').textContent, 'LET GO IN GREEN');
  g.key('keyup'); g.advance(1.1); assert.equal(g.state.mode, 'won');
});

test('holding through the automatic steal carries cleanly into the final shot', () => {
  const g = game(); g.reachSteal(); g.key('keydown'); g.steal();
  assert.notEqual(g.state.charge, null); assert.equal(g.state.runStarted, true);
  g.advance(.675); g.key('keyup'); g.advance(1.1);
  assert.equal(g.state.mode, 'won'); assert.equal(g.state.attempts, 5);
});

test('R restarts both an active and a paused game', () => {
  const g = game(); g.start(); g.advance(4); g.key('keydown', 'KeyR');
  assert.equal(g.state.remaining, 33); assert.equal(g.state.mode, 'playing');
  g.advance(3); g.key('keydown', 'KeyP'); g.key('keydown', 'KeyR');
  assert.equal(g.state.remaining, 33); assert.equal(g.state.mode, 'playing');
});

test('winning opens the film once, freezes the score, and skip returns to results', () => {
  let options, count = 0;
  const film = { close: () => {}, show: o => { options = o; count++; } };
  const g = game({ reducedMotion: false, film }); reachWinner(g); g.advance(3.8);
  assert.equal(g.state.mode, 'film'); assert.equal(count, 1);
  const score = [g.state.home, g.state.away, g.state.remaining, g.state.attempts];
  g.advance(20); assert.deepEqual([g.state.home, g.state.away, g.state.remaining, g.state.attempts], score);
  options.onClose(); assert.equal(g.state.mode, 'won');
  g.emit('moment-replay', 'click'); g.advance(4.1);
  assert.equal(g.state.mode, 'won'); assert.equal(count, 1);
});

test('reduced motion makes the real footage optional, including after replay', () => {
  let count = 0;
  const g = game({ film: { close: () => {}, show: () => { count++; } } });
  reachWinner(g); g.advance(1.1); assert.equal(g.state.mode, 'won'); assert.equal(count, 0);
  g.emit('moment-replay', 'click'); g.advance(4.1); assert.equal(count, 0);
  g.emit('moment-original', 'click'); assert.equal(count, 1); assert.equal(g.state.mode, 'film');
});


test('a quick tap then immediate hold shoots smoothly through the pump animation', () => {
  const g = game(); g.start(); g.shootGreen(); g.settle();
  g.hold(.08); assert.equal(g.state.phase, 'pump');
  g.hold(.59); assert.equal(g.state.shot.made, true); assert.equal(g.state.attempts, 2);
});


test('shot instructions and the only DOM meter live together above the player', () => {
  const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  assert.equal((html.match(/id="moment-meter"/g) || []).length, 1);
  assert.ok(html.indexOf('id="moment-meter"') < html.indexOf('class="moment-controls"'));
  const g = game({ width: 368, height: 594 }); g.start();
  assert.equal(g.el('moment-cue').hidden, false);
  assert.equal(g.el('moment-meter-label').textContent, 'HOLD TO SHOOT');
  const x = parseFloat(g.el('moment-cue').style.left);
  assert.ok(x >= 120 && x <= 248);
  g.key('keydown'); g.advance(.4);
  assert.equal(g.el('moment-meter-label').textContent, 'LET GO IN GREEN');
  assert.equal(g.el('moment-meter').attrs['aria-valuenow'], '40');
  g.key('keyup'); assert.equal(g.el('moment-cue').hidden, true);
});
