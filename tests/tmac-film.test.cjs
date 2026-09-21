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
    const el = { hidden: true, textContent: '', children: [], attrs: {},
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
    console: { warn: () => {} }, document, window, location: { origin: 'http://localhost:8765' },
    setTimeout: fn => { const id = ++nextTimer; timers.set(id, fn); return id; },
    clearTimeout: id => timers.delete(id)
  });
  return { api: window.TmacFilm, el: element, player, options: () => options, counts: () => ({ destroyed, muted, played }),
    ready: () => { window.YT = YT; window.onYouTubeIframeAPIReady(); },
    emit: (id, type, e = {}) => listeners.get(`${id}:${type}`)?.(e),
    pendingTimers: () => timers.size };
}

test('the official clip starts at the final shot, respects mute, and ends at results', async () => {
  const f = film(); let closed = 0;
  await f.api.show({ sound: false, onClose: () => closed++ });
  const o = f.options(); assert.equal(o.videoId, 's4QuUYG6kxI');
  assert.equal(o.playerVars.start, 44); assert.equal(o.playerVars.end, 60);
  o.events.onReady({ target: f.player });
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
  f.options().events.onReady({ target: f.player }); assert.equal(f.counts().muted, 0);
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
