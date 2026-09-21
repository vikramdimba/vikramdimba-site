const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

function film({ apiReady = true } = {}) {
  const elements = new Map(), listeners = new Map(), timers = new Map();
  let options, destroyed = 0, muted = 0, played = 0, nextTimer = 0;
  function element(id) {
    if (elements.has(id)) return elements.get(id);
    const classes = new Set();
    const el = { classList: { add: c => classes.add(c), remove: c => classes.delete(c), contains: c => classes.has(c) }, hidden: false, textContent: '', children: [], attrs: {},
      focus: () => { document.activeElement = el; },
      addEventListener: (type, fn) => listeners.set(`${id}:${type}`, fn),
      replaceChildren: (...children) => { el.children = children; },
      appendChild: child => el.children.push(child), remove: () => {},
      setAttribute: (key, val) => { el.attrs[key] = val; },
      querySelectorAll: () => [element('moment-film-skip'), element('link')] };
    elements.set(id, el); return el;
  }
  const document = { getElementById: element, createElement: tag => element(tag), head: element('head') };
  const player = { destroy: () => destroyed++, mute: () => muted++, playVideo: () => played++, getIframe: () => element('iframe') };
  const YT = { Player: function (_, opts) { options = opts; return player; } };
  const window = { YT: apiReady ? YT : null, addEventListener: () => {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../tmac-film.js'), 'utf8'), {
    performance: { now: () => 1000 }, matchMedia: () => ({ matches: false }), console: { warn: () => {} }, document, window, location: { origin: 'http://localhost:8765' },
    setTimeout: (fn, delay) => { const id = ++nextTimer; timers.set(id, { fn, delay }); return id; },
    clearTimeout: id => timers.delete(id)
  });
  return { api: window.TmacFilm, el: element, player, options: () => options, counts: () => ({ destroyed, muted, played }),
    ready: () => { window.YT = YT; window.onYouTubeIframeAPIReady(); },
    emit: (id, type, e = {}) => listeners.get(`${id}:${type}`)?.(e),
    runIntro: () => { for (const [id, t] of timers) if (t.delay <= 1100) { timers.delete(id); t.fn(); } },
    pendingTimers: () => timers.size };
}

test('the official clip starts at the final shot, respects mute, and ends at results', async () => {
  const f = film(); let closed = 0;
  await f.api.show({ sound: false, onClose: () => closed++ });
  const o = f.options(); assert.equal(o.videoId, 's4QuUYG6kxI');
  assert.equal(o.playerVars.start, 44); assert.equal(o.playerVars.end, 60);
  o.events.onReady({ target: f.player }); f.runIntro();
  assert.equal(f.counts().muted, 1); assert.equal(f.counts().played, 1);
  o.events.onStateChange({ data: 1 }); assert.equal(f.pendingTimers(), 0);
  o.events.onStateChange({ data: 0 });
  assert.equal(closed, 1); assert.equal(f.el('moment-film').hidden, true); assert.equal(f.counts().destroyed, 1);
});

test('skipping while the API loads prevents a late video from appearing', async () => {
  const f = film({ apiReady: false }); let closed = 0;
  const pending = f.api.show({ onClose: () => closed++ });
  f.emit('moment-film-skip', 'click'); f.ready(); await pending;
  assert.equal(closed, 1); assert.equal(f.options(), undefined); assert.equal(f.el('moment-film').hidden, true);
});

test('an embed error leaves an accessible fallback and results remain skippable', async () => {
  const f = film(); let closed = 0;
  await f.api.show({ sound: true, onClose: () => closed++ });
  f.options().events.onReady({ target: f.player }); f.runIntro(); assert.equal(f.counts().muted, 0);
  f.options().events.onError({ data: 150 }); assert.match(f.el('moment-film-status').textContent, /Watch on YouTube/);
  f.emit('moment-film-skip', 'click'); assert.equal(closed, 1);
  f.options().events.onStateChange({ data: 0 }); assert.equal(closed, 1);
});

test('restarting destroys the old player without triggering its results callback', async () => {
  const f = film(); let oldClosed = 0, newClosed = 0;
  await f.api.show({ onClose: () => oldClosed++ }); const old = f.options();
  await f.api.show({ onClose: () => newClosed++ });
  old.events.onStateChange({ data: 0 }); assert.equal(newClosed, 0); assert.equal(oldClosed, 0);
  assert.equal(f.el('moment-film').hidden, false);
  f.emit('moment-film-skip', 'click'); assert.equal(newClosed, 1); assert.equal(f.counts().destroyed, 2);
});


test('the intro holds the first frame until its title beat finishes', async () => {
  const f = film(); await f.api.show({ onClose: () => {} });
  f.options().events.onReady({ target: f.player });
  assert.equal(f.options().playerVars.autoplay, 0);
  assert.equal(f.counts().played, 0);
  f.runIntro(); assert.equal(f.counts().played, 1);
  assert.equal(f.el('moment-film-intro').classList.contains('is-finished'), false);
  f.options().events.onStateChange({ data: 1 });
  assert.equal(f.el('moment-film-intro').classList.contains('is-finished'), true);
});

test('blocked sound retries muted once, then offers a manual play fallback', async () => {
  const f = film(); await f.api.show({ sound: true, onClose: () => {} });
  const o = f.options(); o.events.onReady({ target: f.player }); f.runIntro();
  assert.equal(f.counts().muted, 0);
  o.events.onAutoplayBlocked({ target: f.player });
  assert.equal(f.counts().muted, 1); assert.equal(f.counts().played, 2);
  o.events.onAutoplayBlocked({ target: f.player });
  assert.equal(f.el('moment-film-play').hidden, false); assert.equal(f.counts().played, 2);
  f.emit('moment-film-play', 'click'); assert.equal(f.counts().played, 3);
  o.events.onStateChange({ data: 1 });
  assert.equal(f.el('moment-film-play').hidden, true);
  assert.match(f.el('moment-film-status').textContent, /volume control/);
});

test('skipping during the animation cancels pending autoplay and ignores stale events', async () => {
  const f = film(); await f.api.show({ onClose: () => {} });
  const o = f.options(); o.events.onReady({ target: f.player });
  f.emit('moment-film-skip', 'click'); f.runIntro();
  o.events.onAutoplayBlocked({ target: f.player });
  assert.equal(f.counts().played, 0); assert.equal(f.pendingTimers(), 0);
});
