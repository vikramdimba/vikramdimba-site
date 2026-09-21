// Deterministic game-loop tests. No browser, dependencies, or production test hooks.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

function game({ reducedMotion = true, width = 1100, height = 620 } = {}) {
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
  const window = { devicePixelRatio: 1, addEventListener: (type, fn) => listeners.set(`window:${type}`, fn) };
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
  function hold(seconds = .7125) { key('keydown'); advance(seconds); key('keyup'); }
  function settle() { advance(3.4); }
  return { state: api.state, el: element, emit, advance, hold, settle, key, doc, start: () => emit('moment-start', 'click') };
}

test('four threes, one free throw, and a steal produce Houston 81–80', () => {
  const g = game(); g.start();
  for (let step = 0; step < 4; step++) {
    assert.equal(g.state.step, step); g.hold(); g.settle();
  }
  assert.equal(g.state.phase, 'steal');
  assert.equal(g.state.home, 78); assert.equal(g.state.away, 80);
  g.hold(.7875); g.advance(1.85);
  assert.equal(g.state.phase, 'ready'); g.hold(); g.advance(1.1);
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
  const g = game(); g.start(); g.hold(); g.settle(); g.hold(); g.settle();
  assert.equal(g.state.step, 2); const time = g.state.remaining;
  g.advance(20); g.hold(.25); g.advance(3);
  assert.equal(g.state.remaining, time); assert.equal(g.state.step, 2); assert.equal(g.state.home, 74);
  g.hold(); g.advance(1.1); assert.equal(g.state.home, 75);
});

test('timeout ends the attempt and restart resets the complete game', () => {
  const g = game(); g.start(); g.advance(33.1); assert.equal(g.state.mode, 'lost');
  assert.equal(g.el('moment-shoot').disabled, true); g.start();
  assert.equal(g.state.remaining, 33); assert.equal(g.state.home, 68); assert.equal(g.state.away, 76);
  assert.equal(g.state.attempts, 0); assert.equal(g.state.made.size, 0); assert.equal(g.state.mode, 'playing');
});

test('a final shot released before the buzzer can still win after zero', () => {
  const g = game(); g.start();
  for (let i = 0; i < 4; i++) { g.hold(); g.settle(); }
  g.hold(.7875); g.advance(1.85); g.advance(g.state.remaining - .85);
  g.hold(); g.advance(1.1);
  assert.equal(g.state.remaining, 0); assert.equal(g.state.mode, 'won'); assert.equal(g.state.home, 81);
});

test('a failed steal loses time without awarding the winning possession', () => {
  const g = game(); g.start(); for (let i = 0; i < 4; i++) { g.hold(); g.settle(); }
  const time = g.state.remaining; g.hold(.2);
  assert.equal(g.state.phase, 'steal'); assert.equal(g.state.home, 78);
  assert.ok(Math.abs(g.state.remaining - (time - 1.2)) < .01);
});

test('pointer play returns focus to the court while a shot is in flight', () => {
  const g = game(); g.start();
  g.emit('moment-shoot', 'pointerdown', { button: 0, pointerId: 1 }); g.advance(.71); g.emit('moment-shoot', 'pointerup');
  assert.equal(g.doc.activeElement.id, '.moment-stage'); assert.equal(g.state.phase, 'shot');
  assert.equal(g.state.mode, 'playing');
});

function reachWinner(g) {
  g.start(); for (let i = 0; i < 4; i++) { g.hold(); g.settle(); }
  g.hold(.7875); g.advance(1.85); g.hold();
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
    g.hold(); g.settle();
  }
});
