/* Goose Pond: game engine. All words live in lines.js, all art in sprites.js / goodies.js. */
(function () {
  'use strict';

  var LINES = window.LINES, SPR = window.Sprites, GOODIES = window.GOODIES, WEIGHTS = window.GOODIE_WEIGHTS;
  var Q = new URLSearchParams(location.search);
  var KEY = 'goosepond.v1';

  /* ---------- small helpers ---------- */
  function $(id) { return document.getElementById(id); }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function rint(a, b) { return Math.floor(rnd(a, b + 1)); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function ymd(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
  function daysBetween(a, b) {
    var pa = a.split('-'), pb = b.split('-');
    return Math.round((Date.UTC(+pb[0], +pb[1] - 1, +pb[2]) - Date.UTC(+pa[0], +pa[1] - 1, +pa[2])) / 86400000);
  }
  function hex2rgb(h) { var n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function mixc(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
  function rgb(c) { return 'rgb(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ')'; }
  function mulberry(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  /* ---------- saved state ---------- */
  function defaultState() {
    return { seen: [], bread: 0, dates: [], last: '', goodies: [], lastRare: '', firstDone: false,
      mute: false, daily: '', day2Done: false, day2Date: '', pending: [],
      stage: 0, diamonds: 0, finaleDone: false, mood: '', moodDate: '', dev: '', talks: [],
      mem: { events: [], likes: [], people: [], lastMem: '' }, wishes: { date: '', ids: [], prog: {}, done: {} }, hintSkip: false, hintWish: false,
      inv: {}, made: [], boat: false, lastFed: 0, hintIdx: {}, forest: { date: '', spots: {}, found: {}, checked: {} },
      fire: false, feeder: false, seeds: 0, feeds: 0, bond: {}, smores: 0, seenV: [], starDate: '', balloonDate: '', cooked: {}, quest: null };
  }
  var ST = defaultState();
  function loadState() {
    try {
      if (Q.get('reset') === '1') localStorage.removeItem(KEY);
      var raw = localStorage.getItem(KEY);
      if (raw) {
        var o = JSON.parse(raw), d = defaultState();
        Object.keys(d).forEach(function (k) { if (o[k] !== undefined && typeof o[k] === typeof d[k]) d[k] = o[k]; });
        ST = d;
      }
    } catch (e) { ST = defaultState(); }
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(ST)); } catch (e) { /* storage unavailable: carry on */ } }
  function has(id) { return ST.goodies.indexOf(id) >= 0; }
  function isSeen(k) { return ST.seen.indexOf(k) >= 0; }
  function markSeen(k) { if (!isSeen(k)) ST.seen.push(k); }

  /* ---------- clock and day/night ---------- */
  var forcedHour = Q.has('hour') ? parseFloat(Q.get('hour')) : NaN;
  var hourF = 12, slot = 'afternoon';
  var PH = {
    night: { skyT: '#0a1230', skyB: '#1d2a58', wL: '#22406e', wD: '#162a52', gr: '#1f3d30', gr2: '#183226', far: '#0e1c2c', tint: [18, 28, 92, 0.38], star: 1, fly: 1, lamp: 1 },
    dawn: { skyT: '#6f86bd', skyB: '#f7b79b', wL: '#8db0cf', wD: '#6a93b8', gr: '#5c9a64', gr2: '#4d8856', far: '#4b6a7a', tint: [255, 170, 120, 0.10], star: 0.1, fly: 0, lamp: 0.25 },
    day: { skyT: '#62b8ee', skyB: '#c9ecf8', wL: '#5db4e2', wD: '#3f9ad0', gr: '#69bf62', gr2: '#58ad55', far: '#4f8f6a', tint: [0, 0, 0, 0], star: 0, fly: 0, lamp: 0 },
    dusk: { skyT: '#4f4590', skyB: '#f08a68', wL: '#7a74ad', wD: '#575a94', gr: '#4f8059', gr2: '#416c4d', far: '#34425f', tint: [255, 110, 90, 0.16], star: 0.35, fly: 1, lamp: 0.7 }
  };
  var COLORKEYS = ['skyT', 'skyB', 'wL', 'wD', 'gr', 'gr2', 'far'];
  Object.keys(PH).forEach(function (n) { COLORKEYS.forEach(function (k) { PH[n][k] = hex2rgb(PH[n][k]); }); });
  var KEYS = [[4.5, 'night'], [6.5, 'dawn'], [8.5, 'day'], [16.5, 'day'], [18.5, 'dusk'], [20.5, 'night']];
  var cur = null, bgDirty = true;

  function readClock() {
    var h;
    if (!isNaN(forcedHour)) h = ((forcedHour % 24) + 24) % 24;
    else { var d = new Date(); h = d.getHours() + d.getMinutes() / 60; }
    hourF = h;
    slot = h >= 5 && h < 12 ? 'morning' : h >= 12 && h < 17 ? 'afternoon' : h >= 17 && h < 20 ? 'evening' : 'night';
    var a = PH.night, b = PH.night, t = 0, i;
    if (h > KEYS[0][0] && h < KEYS[KEYS.length - 1][0]) {
      for (i = 0; i < KEYS.length - 1; i++) {
        if (h >= KEYS[i][0] && h < KEYS[i + 1][0]) {
          a = PH[KEYS[i][1]]; b = PH[KEYS[i + 1][1]];
          t = (h - KEYS[i][0]) / (KEYS[i + 1][0] - KEYS[i][0]); t = t * t * (3 - 2 * t); break;
        }
      }
    }
    var c = {};
    COLORKEYS.forEach(function (k) { c[k] = mixc(a[k], b[k], t); });
    c.tint = [lerp(a.tint[0], b.tint[0], t), lerp(a.tint[1], b.tint[1], t), lerp(a.tint[2], b.tint[2], t), lerp(a.tint[3], b.tint[3], t)];
    c.star = lerp(a.star, b.star, t); c.fly = lerp(a.fly, b.fly, t); c.lamp = lerp(a.lamp, b.lamp, t);
    cur = c; bgDirty = true; fbgDirty = true; hbgDirty = true;
  }
  function isNightHour() { return hourF >= 20 || hourF < 5; }

  /* ---------- audio (Web Audio synth, optional) ---------- */
  var AC = null, master = null;
  function unlockAudio() {
    try {
      if (AC) { if (AC.state !== 'running') AC.resume(); return; }
      var C = window.AudioContext || window.webkitAudioContext;
      if (!C) return;
      AC = new C();
      master = AC.createGain(); master.gain.value = ST.mute ? 0 : 0.9; master.connect(AC.destination);
      AC.resume();
      var b = AC.createBuffer(1, 1, 22050), s = AC.createBufferSource();
      s.buffer = b; s.connect(AC.destination); s.start(0);
    } catch (e) { AC = null; }
  }
  function canSound() { return AC && !ST.mute && AC.state === 'running'; }
  function tone(freq, t0, dur, type, vol, f2) {
    var o = AC.createOscillator(), g = AC.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t0);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(master); o.start(t0); o.stop(t0 + dur + 0.05);
  }
  function sfx(fn) { if (!canSound()) return; try { fn(AC.currentTime); } catch (e) { /* ignore */ } }
  function sPlop() { sfx(function (t) { tone(520, t, 0.11, 'sine', 0.22, 170); tone(900, t + 0.03, 0.05, 'sine', 0.05, 400); }); }
  function sHonk() {
    sfx(function (t) {
      [0, 0.2].forEach(function (d, i) {
        var o = AC.createOscillator(), f = AC.createBiquadFilter(), g = AC.createGain();
        o.type = 'sawtooth'; o.frequency.setValueAtTime(i ? 300 : 360, t + d); o.frequency.exponentialRampToValueAtTime(i ? 230 : 290, t + d + 0.17);
        f.type = 'lowpass'; f.frequency.value = 850;
        g.gain.setValueAtTime(0.0001, t + d); g.gain.exponentialRampToValueAtTime(0.1, t + d + 0.03);
        g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.19);
        o.connect(f); f.connect(g); g.connect(master); o.start(t + d); o.stop(t + d + 0.22);
      });
    });
  }
  function sBubble() { sfx(function (t) { tone(784, t, 0.5, 'sine', 0.07); tone(1175, t + 0.12, 0.6, 'sine', 0.05); }); }
  function sCollect() { sfx(function (t) { tone(659, t, 0.3, 'sine', 0.07); tone(831, t + 0.09, 0.3, 'sine', 0.07); tone(1047, t + 0.18, 0.5, 'sine', 0.07); }); }
  function cricketTick() {
    if (ST.fire && fireLit() && !document.hidden && canSound() && Math.random() < 0.5) sfx(function (t) { tone(rnd(180, 520), t, 0.025, 'square', 0.012); });
    if (!cur || cur.star < 0.6 || document.hidden || !canSound()) return;
    if (Math.random() < 0.35) return;
    sfx(function (t) {
      var base = 4100 + rnd(-200, 250), n = rint(2, 4);
      for (var i = 0; i < n; i++) tone(base, t + i * 0.07, 0.04, 'sine', 0.014);
    });
  }
  setInterval(cricketTick, 900);

  /* ---------- canvas and layout ---------- */
  var cv = $('view'), vctx = cv.getContext('2d');
  var lc = document.createElement('canvas'), ctx = lc.getContext('2d');
  var bg = document.createElement('canvas');
  var scale = 4, lw = 150, lh = 200, sw = 150, ox = 0, oy = 0, cssW = 0, cssH = 0, dpr = 1;
  var inset = { t: 0, r: 0, b: 0, l: 0 };
  var BANK_Y = 148, L = {};
  var stars = [], shimmer = [], flies = [], clouds = [], bflies = [], pxK = 1, trailT = 0, extras = { pads: [], reeds: [] };
  var glowC = null;

  function layout() {
    L.benchCX = Math.round(sw * 0.74); L.benchL = L.benchCX - 12; L.benchY = 176;
    L.juneL = L.benchL + 6; L.juneT = 154;
    L.lampX = Math.round(sw * 0.13); L.lampY = 172;
    L.hutCX = Math.round(sw * 0.27); L.hutL = L.hutCX - 15; L.hutY = 181;
    L.napDayX = Math.round(sw * 0.52); L.boatX = Math.round(sw * 0.62);
    L.fireX = Math.round(sw * 0.42); L.fireY = 188; L.feederX = Math.round(sw * 0.9); L.feederY = 182; L.napDayY = 178;
    L.slotY = 186;
  }
  function slotX(i) { return L.benchL + 2 - i * 12; }

  function readInsets() {
    var cs = getComputedStyle($('probe'));
    inset = { t: parseFloat(cs.paddingTop) || 0, r: parseFloat(cs.paddingRight) || 0, b: parseFloat(cs.paddingBottom) || 0, l: parseFloat(cs.paddingLeft) || 0 };
  }

  function resize() {
    cssW = window.innerWidth; cssH = window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    sw = clamp(Math.round(200 * cssW / cssH), 150, 360);
    // whole device pixels per art pixel, so every art pixel is the same crisp size
    var want = Math.min(cssW / sw, cssH / 200) * dpr, kk = Math.max(1, Math.floor(want));
    if (sw * (kk + 1) / dpr <= cssW + 0.5 && 200 - cssH / ((kk + 1) / dpr) <= 8) kk++;
    pxK = kk; scale = kk / dpr;
    lw = Math.ceil(cssW / scale); lh = Math.ceil(cssH / scale);
    ox = Math.floor((lw - sw) / 2); oy = lh - 200;
    lc.width = lw; lc.height = lh; bg.width = lw; bg.height = lh;
    ctx.imageSmoothingEnabled = false;
    cv.style.width = (lw * scale) + 'px'; cv.style.height = (lh * scale) + 'px';
    cv.width = lw * pxK; cv.height = lh * pxK;
    vctx.imageSmoothingEnabled = false;
    var root = document.documentElement.style;
    root.setProperty('--px', scale + 'px');
    root.setProperty('--bpx', clamp(scale, 2, 3) + 'px');
    readInsets(); layout();

    var r = mulberry(99), i;
    stars = [];
    for (i = 0; i < Math.floor(lw * (oy + 62) / 230); i++) stars.push({ x: Math.floor(r() * lw), y: Math.floor(r() * (oy + 62)), ph: r() * 6.28, sp: 0.8 + r() * 2, big: r() < 0.12 });
    shimmer = [];
    for (i = 0; i < Math.floor(lw / 8); i++) shimmer.push({ x: r() * lw, y: oy + 88 + r() * 54, w: 3 + Math.floor(r() * 6), ph: r() * 6.28 });
    if (!flies.length) for (i = 0; i < 12; i++) flies.push({ x: rnd(0, 150), y: rnd(100, 175), vx: 0, vy: 0, ph: rnd(0, 6.28), t: 0 });
    if (!fishes.length) initFish();
    extras = { pads: [], reeds: [] };
    for (i = 0; i < Math.floor(ox / 34); i++) {
      [-1, 1].forEach(function (sd) {
        var ex = sd < 0 ? -ox + 8 + i * 34 + r() * 10 : sw + 8 + i * 34 + r() * 10;
        extras.pads.push({ x: ex, y: 96 + r() * 44 });
        extras.reeds.push({ x: ex + 12, y: i % 2 ? 148 : 90 });
      });
    }
    clouds = [];
    for (i = 0; i < 4 + Math.floor(lw / 120); i++) clouds.push({ x: r() * lw, y: 6 + r() * Math.max(30, oy + 46), c: i % 3, sp: 1.5 + r() * 3 });
    if (!bflies.length) for (i = 0; i < 3; i++) bflies.push({ x: rnd(10, 140), y: rnd(150, 185), vx: 0, vy: 0, t: 0, ph: rnd(0, 6), col: i });
    bgDirty = true; rebuildForest(); rebuildHut();
    clampGoose();
  }

  /* ---------- scenery art (drawn once per palette into the background canvas) ---------- */
  function treeBlob(g, cx, cy, r, col, hi, sh) {
    var rx = r, ry = r * 0.85, x, y;
    for (y = -Math.ceil(ry); y <= Math.ceil(ry); y++) for (x = -rx; x <= rx; x++) {
      if ((x * x) / (rx * rx) + (y * y) / (ry * ry) > 1) continue;
      var s = x + y;
      g.fillStyle = s < -r * 0.5 ? hi : s > r * 0.45 ? sh : col;
      g.fillRect(cx + x, cy + y, 1, 1);
    }
  }
  function makeCloudC(w, h, seed) {
    var r = mulberry(seed), c = document.createElement('canvas'); c.width = w; c.height = h;
    var x = c.getContext('2d'), blobs = [], n = 3 + Math.floor(r() * 2), i, px, py;
    for (i = 0; i < n; i++) blobs.push([w * (0.2 + 0.6 * i / (n - 1)), h * (0.58 - (i % 2) * 0.2), h * (0.3 + r() * 0.15)]);
    for (py = 0; py < h; py++) for (px = 0; px < w; px++) {
      var inside = false;
      for (i = 0; i < blobs.length; i++) if (Math.hypot((px - blobs[i][0]) / 1.4, py - blobs[i][1]) <= blobs[i][2]) inside = true;
      if (inside) { x.fillStyle = py > h * 0.64 ? '#dbe6f4' : '#ffffff'; x.fillRect(px, py, 1, 1); }
    }
    return c;
  }
  var CLOUDC = null;
  function cloudSet() { if (!CLOUDC) CLOUDC = [makeCloudC(28, 13, 3), makeCloudC(38, 15, 8), makeCloudC(22, 11, 21)]; return CLOUDC; }
  var SUNC = (function () {
    var c = document.createElement('canvas'); c.width = c.height = 13; var x = c.getContext('2d');
    for (var j = 0; j < 13; j++) for (var i = 0; i < 13; i++) {
      var d = Math.hypot(i - 6, j - 6);
      if (d <= 5.4) { x.fillStyle = d > 4.2 ? '#ffc94a' : '#fff1a6'; x.fillRect(i, j, 1, 1); }
    }
    return c;
  })();

  function renderBG() {
    var g = bg.getContext('2d'); g.imageSmoothingEnabled = false; g.globalAlpha = 1;
    var P = cur, r = mulberry(1234), hz = oy + 72, wt = oy + 84, wb = oy + BANK_Y, x, y, k, prev = null, n;
    // sky: 4px bands with a dithered seam between them
    for (y = 0; y < hz; y += 4) {
      var col = rgb(mixc(P.skyT, P.skyB, Math.min(1, y / hz)));
      g.fillStyle = col; g.fillRect(0, y, lw, 4);
      if (prev) {
        g.fillStyle = prev;
        for (x = 0; x < lw; x += 2) { g.fillRect(x + ((y >> 2) & 1), y, 1, 1); g.fillRect(x + 1 - ((y >> 2) & 1), y + 1, 1, 1); }
      }
      prev = col;
    }
    // distant mountains fill the tall sky on portrait screens
    var MH = clamp(oy * 0.5 + 30, 30, 100);
    [[0.7, 1, 0.014, 0.7], [0.55, 0.62, 0.03, 2.1]].forEach(function (mt, li) {
      var col = mixc(P.far, P.skyB, mt[0]);
      for (x = 0; x < lw; x++) {
        var nz = Math.abs(Math.sin(x * mt[2] + mt[3]) + 0.6 * Math.sin(x * mt[2] * 2.3 + 1.1)) / 1.6, hh2 = Math.round(MH * mt[1] * (0.35 + 0.65 * nz));
        g.fillStyle = rgb(col); g.fillRect(x, hz - hh2, 1, hh2 + 1);
        if (li === 0 && hh2 > MH * 0.78) { g.fillStyle = rgb(mixc(col, [255, 255, 255], 0.55)); g.fillRect(x, hz - hh2, 1, 3); }
      }
    });
    // hills
    var layers = [[0.55, 12, 6, 0.03, 0.5, 3, 0.09], [0.32, 7, 4, 0.05, 1.2, 2, 0.13]];
    layers.forEach(function (L2) {
      g.fillStyle = rgb(mixc(P.far, P.skyB, L2[0]));
      for (x = 0; x < lw; x++) {
        var hh = Math.round(L2[1] + L2[2] * Math.sin(x * L2[3] + L2[4]) + L2[5] * Math.sin(x * L2[6] + 0.4));
        g.fillRect(x, hz - hh, 1, hh + 1);
      }
    });
    // trees: a lighter back row and a darker front row with lit tops
    function treeRow(mixT, rmin, rvar, lift) {
      var base = mixc(P.far, P.skyB, mixT), hi = mixc(base, [255, 255, 215], 0.2), sh = mixc(base, [0, 8, 28], 0.4);
      var c0 = rgb(base), c1 = rgb(hi), c2 = rgb(sh), rr, tx = -3;
      while (tx < lw + 6) {
        rr = rmin + Math.floor(r() * rvar);
        treeBlob(g, tx, hz - Math.round(rr * 0.75) - lift, rr, c0, c1, c2);
        tx += rr * 2 - 1 + Math.floor(r() * 4);
      }
    }
    treeRow(0.3, 4, 3, 3); treeRow(0, 5, 4, 0);
    // far shore with bushes
    g.fillStyle = rgb(mixc(P.gr2, P.far, 0.45)); g.fillRect(0, hz, lw, wt - hz);
    var bb = mixc(P.gr2, P.far, 0.25), b0 = rgb(bb), b1 = rgb(mixc(bb, [255, 255, 200], 0.15)), b2 = rgb(mixc(bb, [0, 10, 20], 0.3));
    for (x = 2; x < lw; x += 5 + Math.floor(r() * 5)) treeBlob(g, x, wt - 3, 2 + Math.floor(r() * 2), b0, b1, b2);
    // water: depth bands, a faint mirror of the far shore, soft ripples
    for (y = wt; y < wb; y += 4) {
      var t = (y - wt) / (wb - wt), c3 = mixc(mixc(P.wL, P.skyB, 0.3 * (1 - t)), P.wD, t * 0.85);
      if (((y - wt) / 4) & 1) c3 = mixc(c3, [255, 255, 255], 0.05);
      g.fillStyle = rgb(c3); g.fillRect(0, y, lw, Math.min(4, wb - y));
    }
    g.save(); g.globalAlpha = 0.15; g.translate(0, wt - 1); g.scale(1, -1);
    g.drawImage(bg, 0, wt - 32, lw, 32, 0, -32, lw, 32); g.restore();
    g.fillStyle = '#fff'; g.globalAlpha = 0.09;
    for (k = 0; k < lw / 5; k++) g.fillRect(Math.floor(r() * lw), wt + 4 + Math.floor(r() * (wb - wt - 8)), 3 + Math.floor(r() * 7), 1);
    g.globalAlpha = 1;
    // shore: wet edge, foam, rocks
    g.fillStyle = rgb(mixc(P.gr2, P.wD, 0.5)); g.fillRect(0, wb - 1, lw, 2);
    g.fillStyle = '#fff'; g.globalAlpha = 0.28;
    for (x = 0; x < lw; x += 4) g.fillRect(x + ((x >> 2) & 1), wb - 3, 2, 1);
    g.globalAlpha = 1;
    for (k = 0; k < Math.floor(lw / 38); k++) {
      var rx2 = 10 + Math.floor(r() * (lw - 20));
      g.fillStyle = '#6c727c'; g.fillRect(rx2 - 1, wb - 1, 5, 2);
      g.fillStyle = '#9aa0a8'; g.fillRect(rx2, wb - 2, 3, 2);
      g.fillStyle = '#c9ced6'; g.fillRect(rx2, wb - 2, 1, 1);
    }
    // grass
    g.fillStyle = rgb(P.gr); g.fillRect(0, wb + 1, lw, lh - wb);
    g.fillStyle = rgb(mixc(P.gr, [255, 255, 255], 0.16)); g.fillRect(0, wb + 1, lw, 1);
    var dark = rgb(P.gr2), light = rgb(mixc(P.gr, [255, 255, 255], 0.15));
    n = Math.floor(lw * (lh - wb) / 55);
    for (k = 0; k < n; k++) {
      var tx2 = Math.floor(r() * lw), ty2 = wb + 4 + Math.floor(r() * (lh - wb - 6));
      g.fillStyle = dark; g.fillRect(tx2, ty2 + 1, 1, 1); g.fillRect(tx2 + 2, ty2 + 1, 1, 1);
      g.fillStyle = light; g.fillRect(tx2 + 1, ty2, 1, 2);
    }
    var fcols = ['#fffaf0', '#f48fb1', '#ffd75a', '#cdb6ff'], stem = rgb(mixc(P.gr2, [0, 30, 0], 0.3));
    for (k = 0; k < Math.floor(lw / 12); k++) {
      var cx2 = Math.floor(r() * lw), cy2 = wb + 8 + Math.floor(r() * (lh - wb - 14)), fc = fcols[Math.floor(r() * fcols.length)], m;
      for (m = 0; m < 3 + Math.floor(r() * 3); m++) {
        var fx = cx2 + Math.floor(r() * 7) - 3, fy = cy2 + Math.floor(r() * 5) - 2;
        g.fillStyle = stem; g.fillRect(fx, fy + 1, 1, 2); g.fillStyle = fc; g.fillRect(fx, fy, 1, 1);
      }
    }
    // foreground bushes in the bottom corners
    var fb = mixc(P.gr, [0, 40, 10], 0.35), f0 = rgb(fb), f1 = rgb(mixc(fb, [255, 255, 190], 0.18)), f2 = rgb(mixc(fb, [0, 10, 20], 0.35));
    treeBlob(g, 4, lh - 3, 9, f0, f1, f2); treeBlob(g, 15, lh - 1, 6, f0, f1, f2);
    treeBlob(g, lw - 5, lh - 3, 10, f0, f1, f2); treeBlob(g, lw - 17, lh - 1, 6, f0, f1, f2);
    bgDirty = false;
  }

  /* ---------- sprites ---------- */
  var PRE = ['gosling_', 'juv_', 'goose_'];
  var forcedStage = Q.has('stage') ? parseInt(Q.get('stage'), 10) : NaN;
  function gp(n) { return PRE[clamp(ST.stage | 0, 0, 2)] + n; }
  function computeStage() {
    if (!isNaN(forcedStage)) return clamp(forcedStage, 0, 2);
    var d = ST.dates.length, b = ST.bread;
    return (b >= 180 && d >= 14) ? 2 : (b >= 60 && d >= 5) ? 1 : 0;
  }
  var goodieSpr = {}, goodieDef = {};
  var goodieSprO = {};
  GOODIES.forEach(function (d) { goodieDef[d.id] = d; goodieSpr[d.id] = SPR.fromRows(d.art); goodieSprO[d.id] = SPR.outlined(goodieSpr[d.id]); });
  function spr(name, i) { return SPR.get(name, i); }
  function blit(s, x, y, flipX) { ctx.drawImage(flipX ? s.f : s.c, Math.round(x + ox), Math.round(y + oy)); }
  function blitO(s, x, y, flipX) { blit(s, x - 1, y - 1, flipX); }
  function blitC(c, x, y) { ctx.drawImage(c, Math.round(x + ox), Math.round(y + oy)); }

  glowC = (function () {
    var c = document.createElement('canvas'); c.width = c.height = 64;
    var x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,222,140,0.6)'); g.addColorStop(0.5, 'rgba(255,200,110,0.22)'); g.addColorStop(1, 'rgba(255,190,100,0)');
    x.fillStyle = g; x.fillRect(0, 0, 64, 64); return c;
  })();

  /* ---------- entities ---------- */
  var T = 0, playTime = 0;
  var breads = [], ripples = [], sparkles = [], zees = [], ground = [], flyList = [], finale = null, sparks = [];
  var goose = { x: 60, y: 118, dir: 1, state: 'idle', t: 0, wp: null, wait: 1, path: null, done: null, carry: null, tapN: 0, variant: 0, bread: null };
  var june = { mode: 'idle', t: 0, pending: null, awakeT: 0 };
  var rollPending = false, eatenSinceRoll = 0, nextRollAt = rint(4, 6), lastRollGoodie = false;
  var forceChat = Q.get('chat') === '1', forceBubble = Q.get('bubble') === '1', forceGoodie = Q.get('goodie') === '1';
  var napEpoch = 0, napDelay = rint(60, 120), firstNap = true;
  var sessionBubbles = 0, waitingShown = false, lastCat = '', newDateToday = false, greetT = 1.2;
  var WATER = { x0: 10, x1: 140 };

  function clampGoose() {
    if (goose.state === 'idle' || goose.state === 'chase') { goose.x = clamp(goose.x, 8 - ox * 0.7, sw - 8 + ox * 0.7); }
  }
  function nightish() { return cur && cur.star > 0.5; }
  function hasHat() { return has('hat'); }

  /* ----- June ----- */
  function juneIdle() { june.mode = 'idle'; june.t = 0; }
  function juneWave() { june.mode = 'wave'; june.t = 0; june.awakeT = 8; }
  function spawnBread(tx, ty) {
    var hp = handPos();
    breads.push({ state: 'fly', t: 0, sx: hp.x, sy: hp.y, ex: tx, ey: ty, x: hp.x, y: hp.y, age: 0, claimed: false });
  }
  function releasePending() { if (june.pending) { spawnBread(june.pending.x, june.pending.y); june.pending = null; } }
  function juneToss(tx, ty) {
    releasePending();
    if (juneAway()) { spawnBread(clamp(tx, 10 - ox * 0.8, sw - 10 + ox * 0.8), clamp(ty, 92, 143)); return; }
    june.mode = 'toss'; june.t = 0; june.awakeT = 8;
    june.pending = { x: clamp(tx, 10 - ox * 0.8, sw - 10 + ox * 0.8), y: clamp(ty, 92, 143) };
  }
  function breadCount() { return breads.length + (june.pending ? 1 : 0); }
  function juneMove(tx, ty, sp, dt) {
    var dx = tx - june.wx, dy = ty - june.wy, d = Math.hypot(dx, dy);
    if (d <= 0.8) { june.vel = 0; return true; }
    june.vel = (june.vel || 0) + (sp - (june.vel || 0)) * Math.min(1, dt * 7);   // ease into the walk
    var st = Math.min(d, Math.max(4, june.vel) * dt);
    june.wx += dx / d * st; june.wy += dy / d * st;
    if (Math.abs(dx) > 0.3) june.fdir = dx < 0 ? -1 : 1;
    june.face = Math.abs(dy) > Math.abs(dx) * 1.2 ? (dy > 0 ? 'd' : 'u') : 's';
    return d - st <= 0.8;
  }
  function juneHome() { june.mode = 'idle'; june.t = 0; june.strollAt = playTime + rnd(50, 100); }
  function juneStrollStart() {
    releasePending();
    var shore = Math.random() < 0.6;
    june.wx = L.juneL + 8; june.wy = 182;
    june.target = shore ? { x: rnd(24, sw - 24), y: rnd(157, 163) } : { x: rnd(20, sw - 20), y: rnd(172, 192) };
    june.shore = shore; june.mode = 'strollOut'; june.t = 0; june.fdir = june.target.x < june.wx ? -1 : 1;
  }
  function updateJune(dt) {
    june.t += dt;
    var mode = june.mode;
    if (mode === 'tripWalk') { if (juneMove(L.boatX, 157, 26, dt)) tripBoard(); return; }
    if (mode === 'tripBoat') return;
    if (mode === 'smoresWalk') { if (juneMove(L.fireX + 13, 189, 26, dt)) { june.mode = 'smoresRoast'; june.t = 0; june.fdir = -1; } return; }
    if (mode === 'smoresRoast') return;
    if (mode === 'grassWalk') {
      if (juneMove(june.target.x, june.target.y, 30, dt)) { june.mode = 'grassAct'; june.t = 0; june.act = pick(['sit', 'jump', 'dance']); june.fdir = Math.random() < 0.5 ? -1 : 1; if (june.act === 'dance') wishEvent('dance'); }
      return;
    }
    if (mode === 'grassAct') {
      if (june.act === 'dance' && Math.random() < dt * 3) hearts.push({ x: june.wx + rnd(-8, 8), y: june.wy - 26 - rnd(0, 8), t: 0, note: true });
      if (june.t > ACTS[june.act]) june.mode = 'strollBack';
      return;
    }
    if (mode === 'hutEnter') {
      if (juneMove(L.hutCX, 182, 28, dt) && !june.fading) { june.fading = true; doFade(function () { june.fading = false; enterHut(); }); }
      return;
    }
    if (mode === 'walkOut') { if (juneMove(L.hutCX, 182, 24, dt)) { june.mode = 'hutSleep'; june.t = 0; wishEvent('hut'); } return; }
    if (mode === 'hutSleep') {
      june.nap -= dt; june.zT = (june.zT || 0) + dt;
      if (june.zT > 1.2) { june.zT = 0; zees.push({ x: L.hutCX + 2, y: L.hutY - 26, t: 0 }); }
      if (june.nap <= 0) { june.mode = 'walkBack'; june.wx = L.hutCX; june.wy = 182; }
      return;
    }
    if (mode === 'walkBack') { if (juneMove(L.juneL + 8, 182, 24, dt)) juneHome(); return; }
    if (mode === 'strollOut') {
      if (juneMove(june.target.x, june.target.y, 20, dt)) { june.mode = 'strollIdle'; june.t = 0; june.stay = rnd(3, 6); june.threw = false; }
      return;
    }
    if (mode === 'strollIdle') {
      if (june.shore && !june.threw && june.t > 1.2) { june.threw = true; launchStone(rnd(-0.55, 0.55), -1, rnd(450, 1500)); }
      if (june.t > june.stay) june.mode = 'strollBack';
      return;
    }
    if (mode === 'strollBack') { if (juneMove(L.juneL + 8, 182, 20, dt)) juneHome(); return; }
    if (mode === 'idle' && nightish() && !june.nappedOnce && playTime > 120 && !talk && !finale && !bub.on) { june.nappedOnce = true; juneGoNap(45); return; }
    if (mode === 'idle' && !nightish() && playTime > june.strollAt && !talk && !finale && !bub.on) { juneStrollStart(); return; }
    if (june.awakeT > 0) june.awakeT -= dt;
    if (mode === 'toss') {
      if (june.t >= 0.28) {
        releasePending();
        if (june.stoneQ) { var q = june.stoneQ; june.stoneQ = null; launchStone(q.dx, q.dy, q.power); }
      }
      if (june.t > 0.75) juneIdle();
    } else if (mode === 'wave' && june.t > 1.5) juneIdle();
    else if (mode === 'smile' && june.t > 2.6) juneIdle();
  }
  function juneFrame() {
    switch (june.mode) {
      case 'wave': return spr('june_wave', Math.floor(june.t * 4) % 2);
      case 'toss': return spr('june_toss', june.t < 0.28 ? 0 : 1);
      case 'smile': return spr('june_smile', 0);
    }
    if (nightish() && june.awakeT <= 0) return spr('june_doze', Math.floor(T / 0.9) % 2);
    return spr('june_idle', (T % 4.2) > 4.0 ? 1 : 0);
  }

  /* ----- bread ----- */
  function addRipple(x, y) { ripples.push({ x: x, y: y, t: 0 }); }
  function updateBreads(dt) {
    for (var i = breads.length - 1; i >= 0; i--) {
      var b = breads[i];
      if (b.state === 'fly') {
        b.t += dt; var u = b.t / 0.6;
        if (u >= 1) { b.state = 'float'; b.x = b.ex; b.y = b.ey; addRipple(b.x, b.y); sPlop(); }
        else { b.x = lerp(b.sx, b.ex, u); b.y = lerp(b.sy, b.ey, u) - 4 * 26 * u * (1 - u); }
      } else b.age += dt;
    }
  }
  function nearestBread() {
    var best = null, bd = 1e9;
    breads.forEach(function (b) {
      if (b.state !== 'float' || b.claimed) return;
      var d = Math.hypot(b.x - goose.x, b.y - goose.y);
      if (d < bd) { bd = d; best = b; }
    });
    return best;
  }

  /* ----- goose ----- */
  function moveTo(tx, ty, sp, dt, stop) {
    stop = stop || 0.6;
    var dx = tx - goose.x, dy = ty - goose.y, d = Math.hypot(dx, dy);
    if (d <= stop) return true;
    var s = Math.min(d, sp * hungerMul() * dt);
    goose.x += dx / d * s; goose.y += dy / d * s;
    if (Math.abs(dx) > 0.4) goose.dir = dx > 0 ? 1 : -1;
    return d - s <= stop;
  }
  function gooseWalk(path, done) { goose.state = 'path'; goose.path = path.slice(); goose.done = done; }
  function gooseWait(sec, done) { goose.state = 'wait'; goose.t = 0; goose.wt = sec; goose.done = done; }
  function swimHome() {
    return [{ x: goose.x, y: BANK_Y - 3, sp: 28 }, { x: clamp(goose.x + rnd(-14, 14), 14, sw - 14), y: rint(108, 130), sp: 26 }];
  }
  function toIdle() { goose.state = 'idle'; goose.wp = null; goose.wait = rnd(0.5, 1.5); goose.carry = null; }

  function napDue() {
    var delay = (nightish() && firstNap) ? 60 : napDelay;
    return playTime - napEpoch >= delay;
  }
  function startNap() {
    hideBubble(); firstNap = false;
    var beside = nightish() && Math.random() < 0.5;
    var nx = beside ? L.benchL - 34 : L.napDayX, ny = beside ? 184 : L.napDayY;
    gooseWalk([{ x: nx, y: BANK_Y - 3, sp: 36 }, { x: nx, y: ny, sp: 26 }], function () {
      goose.state = 'sleep'; goose.t = 0; goose.tapN = 0; goose.dir = beside ? 1 : -1; goose.zT = 0;
    });
  }
  function tapGoose() {
    if (goose.state !== 'sleep' && goose.state !== 'wakeAnim') return;
    goose.tapN++;
    if (goose.tapN < 5) { goose.state = 'wakeAnim'; goose.variant = goose.tapN; goose.t = 0; }
    else {
      goose.state = 'wakeEnd'; goose.t = 0; sHonk();
    }
  }

  function updateGoose(dt) {
    var g = goose, b;
    g.t += dt;
    switch (g.state) {
      case 'idle':
        if (napDue()) { startNap(); break; }
        b = nearestBread();
        if (b) { g.state = 'chase'; g.bread = b; break; }
        g.wait -= dt;
        if (!g.wp || g.wait <= 0) { g.wp = { x: rnd(14 - ox * 0.7, sw - 14 + ox * 0.7), y: rnd(104, 136) }; g.wait = rnd(2.5, 6); }
        if (moveTo(g.wp.x, g.wp.y, 12, dt, 1)) { g.wp = null; g.wait = Math.min(g.wait, rnd(1, 3)); }
        g.x = clamp(g.x, 8 - ox * 0.7, sw - 8 + ox * 0.7);
        break;
      case 'chase':
        b = g.bread;
        if (!b || breads.indexOf(b) < 0) { toIdle(); break; }
        var dirTo = b.x >= g.x ? 1 : -1;
        if (moveTo(b.x - dirTo * 7, b.y + 2, 42, dt, 1.2)) { g.dir = dirTo; g.state = 'eat'; g.t = 0; b.claimed = true; }
        break;
      case 'eat':
        if (g.bread && g.t > 0.5) {
          var ix = breads.indexOf(g.bread); if (ix >= 0) breads.splice(ix, 1);
          g.bread = null; ST.bread++; eatenSinceRoll++; checkGrowth(); wishEvent('feed', 1);
          fedPending = Math.max(fedPending, hungerLevel()); ST.lastFed = Date.now(); hungerShown = 0;
          if (eatenSinceRoll >= nextRollAt) { eatenSinceRoll = 0; nextRollAt = rint(4, 6); rollPending = true; }
          save();
        }
        if (g.t > 0.95) { g.state = 'honk'; g.t = 0; sHonk(); }
        break;
      case 'honk':
        if (g.t > 0.75) {
          toIdle();
          if (fedPending >= 2) {
            fedPending = 0; showBubble({ text: LINES.hunger.fed }, { noCount: true });
            for (var fi = 0; fi < 4; fi++) sparkles.push({ x: g.x + rnd(-8, 8), y: g.y - rnd(4, 16), t: -fi * 0.08 });
          } else { fedPending = 0; if (rollPending) { rollPending = false; doRoll(); } }
        }
        break;
      case 'path':
        var pt = g.path[0];
        if (!pt) { var d1 = g.done; g.done = null; if (d1) d1(); break; }
        if (moveTo(pt.x, pt.y, pt.sp, dt)) g.path.shift();
        break;
      case 'wait':
        if (g.t >= g.wt) { var d2 = g.done; g.done = null; if (d2) d2(); }
        break;
      case 'sleep':
        g.zT = (g.zT || 0) + dt;
        if (g.zT > 1.1) { g.zT = 0; zees.push({ x: g.x + g.dir * 5, y: g.y - 14, t: 0 }); }
        break;
      case 'wakeAnim':
        if (g.t > 1.4) { g.state = 'sleep'; g.t = 0; g.zT = 0.6; }
        break;
      case 'wakeEnd':
        if (g.t > 1.8) {
          gooseWalk([{ x: g.x, y: BANK_Y - 3, sp: 30 }, { x: clamp(g.x, 16, sw - 16), y: 124, sp: 26 }], function () {
            napEpoch = playTime; napDelay = rint(300, 480); toIdle();
          });
        }
        break;
    }
  }

  /* ----- goodies ----- */
  function pickGoodie() {
    var night = isNightHour();
    var canRare = !ST.lastRare || daysBetween(ST.lastRare, ymd(new Date())) >= 7;
    var pool = GOODIES.filter(function (d) {
      return !(d.night && !night) && !(d.once && has(d.id)) && !(d.rarity === 'rare' && (!canRare || has(d.id)));
    });
    var total = 0; function wt(d) { return WEIGHTS[d.rarity] * (has(d.id) ? 1 : 3); }
    pool.forEach(function (d) { total += wt(d); });
    var r = Math.random() * total;
    for (var i = 0; i < pool.length; i++) { r -= wt(pool[i]); if (r <= 0) return pool[i]; }
    return pool[0];
  }
  function placeGoodie(id, slotIdx, withFx) {
    var gd = { id: id, x: slotX(slotIdx), y: L.slotY, slot: slotIdx, fx: rnd(1, 2.5) };
    ground.push(gd);
    if (withFx) sparkles.push({ x: gd.x, y: gd.y - 6, t: 0 });
  }
  function startGoodieDrop() {
    var def = pickGoodie();
    if (def.rarity === 'rare') ST.lastRare = ymd(new Date());
    var used = ground.map(function (g) { return g.slot; }), s = 0;
    while (used.indexOf(s) >= 0) s++;
    var gx = slotX(s), gy = L.slotY, wx = clamp(gx - 16, 14, sw - 14);
    ST.daily = ymd(new Date());
    goose.carry = def.id; hideBubble();
    gooseWalk([{ x: wx, y: BANK_Y - 3, sp: 36 }, { x: wx, y: gy - 1, sp: 26 }], function () {
      goose.dir = 1; goose.state = 'wait'; goose.t = 0; goose.wt = 0.6;
      goose.done = function () {
        goose.carry = null; goose.placing = false;
        placeGoodie(def.id, s, true);
        ST.pending.push(def.id); save();
        if (!juneAway()) { june.mode = 'smile'; june.t = 0; }
        gooseWait(1.2, function () {
          gooseWalk([{ x: wx, y: BANK_Y - 3, sp: 28 }, { x: clamp(wx + rnd(-10, 10), 14, sw - 14), y: rint(110, 130), sp: 26 }], toIdle);
        });
      };
      goose.placing = true;
    });
  }
  function collectGoodie(gd) {
    wishEvent('collect'); addItem(gd.id, 1);
    ground.splice(ground.indexOf(gd), 1);
    var pi = ST.pending.indexOf(gd.id); if (pi >= 0) ST.pending.splice(pi, 1);
    if (!has(gd.id)) ST.goodies.push(gd.id);
    save();
    var pr = $('pouchBtn').getBoundingClientRect();
    var fe = (pr.left + pr.width / 2) / scale - ox, fy2 = (pr.top + pr.height / 2) / scale - oy;
    flyList.push({ kind: 'goodie', id: gd.id, sx: gd.x, sy: gd.y - 5, ex: fe, ey: fy2, t: 0, arc: 18 });
    flyList.push({ kind: 'diamond', sx: gd.x, sy: gd.y - 8, ex: fe, ey: fy2, t: -0.18, arc: 30 });
    ST.diamonds++; save();
    sCollect();
  }

  /* ---------- lines and bubbles ---------- */
  var ALL = [];
  Object.keys(LINES).forEach(function (cat) {
    if (Array.isArray(LINES[cat])) LINES[cat].forEach(function (l) { var o = {}; for (var k in l) o[k] = l[k]; o.cat = cat; ALL.push(o); });
  });
  function eligible(l) {
    if (l.firstSession || l.date) return false;
    if (l.day2 && !(ST.day2Done && ST.day2Date !== ymd(new Date()))) return false;
    if (l.slot && l.slot !== slot) return false;
    return true;
  }
  function poolOf(cat) { return ALL.filter(function (l) { return l.cat === cat && eligible(l); }); }
  function pickFrom(cat) {
    var pool = poolOf(cat);
    if (!pool.length) return null;
    var unseen = pool.filter(function (l) { return !isSeen(l.id); });
    if (!unseen.length) {
      var ids = pool.map(function (l) { return l.id; });
      ST.seen = ST.seen.filter(function (id) { return ids.indexOf(id) < 0; });
      unseen = pool;
    }
    var l = pick(unseen); markSeen(l.id); return l;
  }
  function datedLine() {
    var now = new Date(), mmdd = ymd(now).slice(5), yr = now.getFullYear();
    for (var i = 0; i < ALL.length; i++) {
      var l = ALL[i];
      if (l.date === mmdd && !isSeen(l.id + '@' + yr)) { markSeen(l.id + '@' + yr); return l; }
    }
    return null;
  }
  function greetingLine() {
    var d = datedLine(); if (d) return d;
    if (newDateToday && ST.dates.length >= 2 && !ST.day2Done) {
      var p2 = ALL.filter(function (l) { return l.day2; })[0];
      if (p2) { ST.day2Done = true; ST.day2Date = ymd(new Date()); markSeen(p2.id); lastCat = 'apology'; return p2; }
    }
    var mg = memoryGreeting(); if (mg) return mg;
    if (newDateToday && ST.mood && LINES.followUp[ST.mood] && ST.moodDate !== ymd(new Date())) {
      var fu = LINES.followUp[ST.mood]; ST.mood = ''; return fu;
    }
    var cat = Math.random() < 0.5 ? 'welcome' : 'timeOfDay';
    var l = pickFrom(cat) || pickFrom('welcome');
    lastCat = cat; return l;
  }
  var CATW = { appreciate: 1, ask: 1, waiting: 0.6, timeOfDay: 1, apology: 0.35 };
  function rollLine() {
    var d = datedLine(); if (d) return d;
    if (!ST.firstDone && sessionBubbles === 2) {
      var p1 = ALL.filter(function (l) { return l.firstSession && !isSeen(l.id); })[0];
      if (p1) { ST.firstDone = true; markSeen(p1.id); lastCat = 'apology'; return p1; }
    }
    var ml = memoryRoll(); if (ml) return ml;
    var cats = Object.keys(CATW).filter(function (c) {
      return c !== lastCat && !(c === 'waiting' && waitingShown) && poolOf(c).length;
    });
    if (!cats.length) cats = ['appreciate'];
    var total = 0; cats.forEach(function (c) { total += CATW[c]; });
    var r = Math.random() * total, cat = cats[0];
    for (var i = 0; i < cats.length; i++) { r -= CATW[cats[i]]; if (r <= 0) { cat = cats[i]; break; } }
    if (cat === 'waiting') waitingShown = true;
    lastCat = cat;
    return pickFrom(cat);
  }

  var bubEl = $('bubble'), bubText = $('bubbleText'), bubTail = $('bubbleTail');
  var bub = { on: false, t: 0, w: 0, h: 0, tw: 0 }, bubAnchor = goose;
  function showBubble(line, opts) {
    if (!line) return;
    opts = opts || {};
    bubText.textContent = line.text;
    bubActions.innerHTML = '';
    (opts.actions || []).forEach(function (act) {
      var el = document.createElement(act.href ? 'a' : 'button');
      el.textContent = act.label;
      if (act.href) { el.href = act.href; el.target = '_blank'; el.rel = 'noopener'; } else el.type = 'button';
      el.addEventListener('click', function (ev) {
        ev.stopPropagation(); unlockAudio();
        if (act.fn) { hideBubble(); act.fn(); } else setTimeout(hideBubble, 300);
      });
      bubActions.appendChild(el);
    });
    bubEl.classList.add('show'); bub.on = true; bub.t = opts.dur || (opts.actions ? 18 : 6);
    bub.w = bubEl.offsetWidth; bub.h = bubEl.offsetHeight; bub.tw = bubTail.offsetWidth;
    var bp = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--bpx')) || 3;
    bubEl.style.backgroundImage = 'url("' + SPR.cloud(Math.max(12, Math.round(bub.w / bp)), Math.max(12, Math.round(bub.h / bp))) + '")';
    if (!opts.noCount) sessionBubbles++;
    save(); sBubble(); placeBubble();
  }
  function hideBubble() { if (bub.on) { bub.on = false; bubEl.classList.remove('show'); } }
  function placeBubble() {
    var gx = (bubAnchor.x + ox) * scale, gy = (bubAnchor.y + oy - (bubAnchor.topH || 20)) * scale;
    var minL = inset.l + 8, maxL = cssW - inset.r - 8 - bub.w;
    var left = clamp(gx - bub.w / 2, minL, Math.max(minL, maxL));
    var top = Math.max(inset.t + 56, gy - bub.h - bub.tw * 0.9);
    bubEl.style.transform = 'translate(' + Math.round(left) + 'px,' + Math.round(top) + 'px)';
    bubEl.style.setProperty('--tailx', Math.round(clamp(gx - left - bub.tw / 2, 14, Math.max(14, bub.w - 14 - bub.tw))) + 'px');
  }
  function updateBubble(dt) {
    if (!bub.on) return;
    bub.t -= dt; if (bub.t <= 0) { hideBubble(); return; }
    placeBubble();
  }
  bubEl.addEventListener('pointerdown', function (e) { if (e.target.closest && e.target.closest('#bubbleActions')) { e.stopPropagation(); return; } e.preventDefault(); e.stopPropagation(); unlockAudio(); hideBubble(); });

  function doRoll() {
    var type;
    if (forceGoodie) { type = 'goodie'; forceGoodie = false; }
    else if (forceBubble || forceChat) { type = 'bubble'; forceBubble = false; }
    else if (ground.length >= 3) type = 'bubble';
    else if (ST.daily !== ymd(new Date())) type = 'goodie';
    else if (lastRollGoodie) type = 'bubble';
    else type = Math.random() < 0.6 ? 'bubble' : 'goodie';
    lastRollGoodie = type === 'goodie';
    if (type === 'goodie') startGoodieDrop();
    else if (forceChat || (talkDue() && Math.random() < 0.55)) { forceChat = false; startTalk(); }
    else { var rl = rollLine(); showBubble(rl, moreAction(rl)); }
  }

  /* ---------- talking: she types or records, the goose answers, and it is saved for him to read ---------- */
  var CFG = window.POND_CONFIG || {};
  var QKEY = 'goosepond.queue', flushing = false;
  var talk = null;
  var talkEl = $('talk'), talkCard = $('talkCard'), talkQ = $('talkQ'), talkIn = $('talkIn'), talkNote = $('talkNote'),
    talkSend = $('talkSend'), talkSkip = $('talkSkip'), talkMic = $('talkMic'), talkVoiceSend = $('talkVoiceSend'), talkTimer = $('talkTimer');
  var bubActions = $('bubbleActions');
  var NEG = ['sad', 'upset', 'cry', 'crying', 'cried', 'tired', 'exhausted', 'stressed', 'stress', 'anxious', 'anxiety', 'worried', 'bad', 'awful',
    'terrible', 'rough', 'hard', 'lonely', 'angry', 'hurt', 'down', 'miserable', 'overwhelmed', 'horrible', 'depressed', 'drained',
    'sucked', 'sucks', 'annoyed', 'frustrated', 'sick', 'pain', 'worst', 'heavy', 'low', 'meh', 'ugh', 'fight', 'argued'];
  var POS = ['good', 'great', 'happy', 'amazing', 'fun', 'nice', 'wonderful', 'lovely', 'awesome', 'excited', 'better', 'calm', 'relaxed',
    'proud', 'fine', 'best', 'perfect', 'enjoyed', 'loved', 'smile', 'smiled', 'laughed', 'cozy', 'peaceful'];
  function tokens(text) { return text.toLowerCase().replace(/[^a-z' ]+/g, ' ').split(/\s+/).filter(Boolean); }
  function negatedAt(w, i) { return w[i - 1] === 'not' || w[i - 1] === "isn't" || w[i - 1] === "wasn't" || w[i - 2] === 'not' || w[i - 1] === 'no' || w[i - 1] === 'never' || w[i - 1] === "don't"; }
  function guessMood(text) {
    var w = tokens(text), neg = 0, pos = 0;
    for (var i = 0; i < w.length; i++) {
      var n = negatedAt(w, i);
      if (NEG.indexOf(w[i]) >= 0) { if (n) pos++; else neg++; }
      else if (POS.indexOf(w[i]) >= 0) { if (n) neg++; else pos++; }
    }
    return neg > pos ? 'low' : pos > neg ? 'good' : 'neutral';
  }
  function wordHit(tok, pat) {
    if (pat.charAt(pat.length - 1) === '*') return tok.indexOf(pat.slice(0, -1)) === 0;
    return tok === pat;
  }
  // Pick the topic whose words appear most (words starting with ~ count half). Negated cheerful words count as sad.
  function pickReply(text) {
    var w = tokens(text), best = null, bs = 0, i, t, k;
    var sadTopic = null;
    LINES.replies.forEach(function (r) { if (r.topic === 'sad') sadTopic = r; });
    var scores = LINES.replies.map(function () { return 0; });
    for (i = 0; i < w.length; i++) {
      for (t = 0; t < LINES.replies.length; t++) {
        var r2 = LINES.replies[t];
        for (k = 0; k < r2.words.length; k++) {
          var p = r2.words[k], weak = p.charAt(0) === '~';
          if (weak) p = p.slice(1);
          if (wordHit(w[i], p)) {
            var amt = weak ? 0.5 : 1;
            if ((r2.topic === 'happy' || r2.topic === 'laugh') && negatedAt(w, i)) scores[LINES.replies.indexOf(sadTopic)] += amt;
            else scores[t] += amt;
            break;
          }
        }
      }
    }
    for (t = 0; t < scores.length; t++) { if (scores[t] > bs) { bs = scores[t]; best = LINES.replies[t]; } }
    if (best) return { line: pick(best.lines), topic: best.topic };
    var gm = guessMood(text);
    return { line: pick(LINES.replyDefault) };
  }
  function uid() {
    try { if (window.crypto && crypto.randomUUID) return crypto.randomUUID(); } catch (e) { /* fall through */ }
    return 'x' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  }
  function readQueue() { try { return JSON.parse(localStorage.getItem(QKEY)) || []; } catch (e) { return []; } }
  function writeQueue(q) { try { localStorage.setItem(QKEY, JSON.stringify(q)); } catch (e) { /* unavailable */ } }
  function flushQueue() {
    if (flushing || !CFG.url || !CFG.key || navigator.onLine === false) return;
    var q = readQueue(); if (!q.length) return;
    flushing = true;
    fetch(CFG.url.replace(/\/$/, '') + '/rest/v1/goose_pond_entries', {
      method: 'POST', keepalive: true,
      headers: { apikey: CFG.key, Authorization: 'Bearer ' + CFG.key, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify(q[0])
    }).then(function (res) {
      flushing = false;
      if (res.ok || res.status === 409) { var rest = readQueue(); rest.shift(); writeQueue(rest); flushQueue(); }
    }).catch(function () { flushing = false; });
  }
  function addEntry(kind, prompt, answer, mood) {
    var d = new Date();
    if (!ST.dev) { ST.dev = uid(); save(); }
    var q = readQueue();
    q.push({ client_id: uid(), device_id: ST.dev, local_date: ymd(d), local_time: pad2(d.getHours()) + ':' + pad2(d.getMinutes()),
      slot: slot, kind: kind, prompt: prompt, answer: answer, mood_guess: mood || null });
    writeQueue(q); flushQueue();
  }

  /* ----- the talk card ----- */
  function talkKey() { return ymd(new Date()) + '|' + slot; }
  function talkDue() { return !talk && ST.talks.indexOf(talkKey()) < 0; }
  function refreshTalkBG() {
    var bp = clamp(scale, 2, 3);
    talkCard.style.backgroundImage = 'url("' + SPR.cloud(Math.max(12, Math.round(talkCard.offsetWidth / bp)), Math.max(12, Math.round(talkCard.offsetHeight / bp))) + '")';
  }
  function openTalk(prompt, kind) {
    hideBubble();
    talk = { kind: kind, prompt: prompt };
    talkQ.textContent = prompt; talkIn.value = ''; talkNote.textContent = LINES.ui.talkNote;
    voiceReset();
    talkMic.hidden = !(CFG.url && CFG.key && micSupported());
    talkEl.classList.add('open'); refreshTalkBG();
  }
  function startTalk() {
    ST.talks.push(talkKey()); ST.talks = ST.talks.slice(-12); save();
    openTalk(LINES.talk.ask[slot] || LINES.talk.ask.evening, 'day');
  }
  function openFreeTalk() { if (!talk) openTalk(pick(LINES.talk.free), 'free'); }
  function closeTalk() {
    voiceCancel(); talkEl.classList.remove('open'); talkIn.blur(); talk = null;
  }
  function replyBubble(text) {
    showBubble({ text: text }, { actions: [{ label: LINES.ui.more, fn: openFreeTalk }], noCount: true });
  }
  function submitTalk() {
    var text = talkIn.value.trim();
    if (!text) { talkIn.focus(); return; }
    var t = talk, mood = guessMood(text);
    addEntry(t.kind, t.prompt, text.slice(0, 2000), mood);
    addMemories(text); wishEvent('talk');
    ST.mood = mood === 'low' ? 'low' : mood === 'good' ? 'good' : 'meh'; ST.moodDate = ymd(new Date()); save();
    var r = pickReply(text);
    closeTalk();
    replyBubble(r.line);
    if (r.topic === 'tired') setTimeout(function () { juneGoNap(35); }, 5000);
  }
  function skipTalk() {
    var wasNew = talk && talk.kind === 'day';
    closeTalk();
    if (wasNew) showBubble({ text: LINES.talk.skip }, { noCount: true });
  }
  talkSend.addEventListener('click', submitTalk);
  talkSkip.addEventListener('click', skipTalk);
  talkIn.setAttribute('placeholder', LINES.ui.talkPlaceholder);
  talkSend.textContent = LINES.ui.talkSend; talkSkip.textContent = LINES.ui.talkSkip;
  window.addEventListener('online', flushQueue);

  /* ----- voice messages ----- */
  var MAX_VOICE = 300;
  function fmtSecs(s) { return Math.floor(s / 60) + ':' + pad2(s % 60); }
  var rec = null, voiceBlob = null, voiceSecs = 0, voiceTimer = 0;
  function micSupported() { return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder); }
  function setMic(label) { talkMic.textContent = label; }
  function voiceReset() {
    voiceBlob = null; voiceSecs = 0; clearInterval(voiceTimer);
    setMic(LINES.ui.voiceStart); talkTimer.textContent = ''; talkVoiceSend.hidden = true; talkVoiceSend.disabled = false;
    talkVoiceSend.textContent = LINES.ui.voiceSend; talkMic.classList.remove('rec');
  }
  function voiceCancel() {
    if (rec) { rec.cancelled = true; try { if (rec.mr.state !== 'inactive') rec.mr.stop(); } catch (e) { /* ignore */ } rec = null; }
    voiceReset();
  }
  function startRec() {
    navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
      var types = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm'], mt = '';
      for (var i = 0; i < types.length; i++) { if (MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(types[i])) { mt = types[i]; break; } }
      var mr = mt ? new MediaRecorder(stream, { mimeType: mt }) : new MediaRecorder(stream);
      rec = { mr: mr, chunks: [], stream: stream, t0: Date.now(), type: (mr.mimeType || mt || 'audio/mp4').split(';')[0], cancelled: false };
      var mine = rec;
      mr.ondataavailable = function (e) { if (e.data && e.data.size) mine.chunks.push(e.data); };
      mr.onstop = function () {
        mine.stream.getTracks().forEach(function (tr) { tr.stop(); });
        clearInterval(voiceTimer); talkMic.classList.remove('rec');
        if (mine.cancelled) return;
        voiceBlob = new Blob(mine.chunks, { type: mine.type }); voiceSecs = Math.max(1, Math.round((Date.now() - mine.t0) / 1000));
        rec = null; setMic(LINES.ui.voiceAgain); talkVoiceSend.hidden = false;
        talkTimer.textContent = fmtSecs(voiceSecs); refreshTalkBG();
      };
      mr.start(); talkMic.classList.add('rec'); setMic(LINES.ui.voiceStop); talkVoiceSend.hidden = true; voiceBlob = null;
      voiceTimer = setInterval(function () {
        var s = Math.round((Date.now() - mine.t0) / 1000); talkTimer.textContent = fmtSecs(s);
        if (s >= MAX_VOICE) stopRec();
      }, 250);
    }).catch(function () { talkNote.textContent = LINES.ui.voiceDenied; refreshTalkBG(); });
  }
  function stopRec() { if (rec && rec.mr.state !== 'inactive') rec.mr.stop(); }
  talkMic.addEventListener('click', function () {
    if (rec) stopRec(); else { voiceBlob = null; startRec(); }
  });
  talkVoiceSend.addEventListener('click', function () {
    if (!voiceBlob || !talk) return;
    var blob = voiceBlob, secs = voiceSecs, d = new Date();
    var ext = blob.type.indexOf('webm') >= 0 ? 'webm' : blob.type.indexOf('ogg') >= 0 ? 'ogg' : 'm4a';
    var path = ymd(d) + '/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.' + ext;
    talkVoiceSend.disabled = true; talkVoiceSend.textContent = LINES.ui.voiceSending;
    fetch(CFG.url.replace(/\/$/, '') + '/storage/v1/object/goose-voice/' + path, {
      method: 'POST', headers: { apikey: CFG.key, Authorization: 'Bearer ' + CFG.key, 'Content-Type': blob.type || 'audio/mp4', 'x-upsert': 'false' }, body: blob
    }).then(function (res) {
      if (!res.ok) throw new Error('upload ' + res.status);
      addEntry('voice', 'voice message', 'voice:' + path + ' (' + secs + 's)', null);
      wishEvent('talk');
      closeTalk();
      replyBubble(pick(LINES.talk.voice));
    }).catch(function () {
      talkVoiceSend.disabled = false; talkVoiceSend.textContent = LINES.ui.voiceSend;
      talkNote.textContent = LINES.ui.voiceFail; refreshTalkBG();
    });
  });

  /* ---------- growing up ---------- */
  var growPending = false;
  function checkGrowth() {
    var s = computeStage();
    if (s > ST.stage) { ST.stage = s; growPending = true; save(); }
  }
  function growMoment() {
    growPending = false;
    var l = LINES.growth[Math.max(0, ST.stage - 1)];
    for (var i = 0; i < 6; i++) sparkles.push({ x: goose.x + rnd(-10, 10), y: goose.y - rnd(4, 16), t: -i * 0.08 });
    goose.state = 'honk'; goose.t = 0; sHonk();
    if (l) showBubble(l);
  }

  /* ---------- session start ---------- */
  function updateDayLabel() {
    $('dayLabel').textContent = LINES.ui.dayLabel.replace('{n}', Math.max(1, ST.dates.length));
  }
  function startSession() {
    var today = ymd(new Date());
    newDateToday = ST.dates.indexOf(today) < 0;
    if (newDateToday) {
      if (ST.dates.length && !ST.firstDone) ST.firstDone = true;
      ST.dates.push(today);
    }
    ST.last = today;
    sessionBubbles = 0; waitingShown = false; lastCat = '';
    checkGrowth(); ensureWishes(); buildPending = nextBuild();
    greetT = 1.2; save(); updateDayLabel();
  }
  function showGreeting() { var gl = greetingLine(); showBubble(gl, moreAction(gl)); }

  /* ---------- the puppy, the fish and the hut ---------- */
  var dog = { x: 0, y: 189, dir: -1, state: 'sit', t: 0, wp: null, wait: 4, hop: 0, awakeT: 0 };
  var fishes = [], hearts = [];
  function juneAway() { var m = june.mode; return m === 'walkOut' || m === 'hutSleep' || m === 'walkBack' || m === 'strollOut' || m === 'strollIdle' || m === 'strollBack' || m === 'tripWalk' || m === 'tripBoat' || m === 'smoresWalk' || m === 'smoresRoast' || m === 'grassWalk' || m === 'grassAct' || m === 'hutEnter'; }
  function juneGoNap(sec) {
    if (juneAway() || talk || finale) return;
    releasePending();
    june.mode = 'walkOut'; june.t = 0; june.wx = L.juneL + 8; june.wy = 182; june.fdir = -1; june.nap = sec; june.zT = 0;
  }
  function handPos() { return juneAway() ? { x: june.wx, y: june.wy - 12 } : { x: L.juneL + 1, y: L.juneT + 11 }; }

  function dogHome() { return { x: clamp(L.benchL - 8, 14, sw - 14), y: 189 }; }
  function dogMove(tx, ty, sp, dt) {
    var dx = tx - dog.x, dy = ty - dog.y, d = Math.hypot(dx, dy);
    if (d <= 0.8) return true;
    var s = Math.min(d, sp * dt);
    dog.x += dx / d * s; dog.y += dy / d * s;
    if (Math.abs(dx) > 0.3) dog.dir = dx < 0 ? -1 : 1;
    return d - s <= 0.8;
  }
  function updateDog(dt) {
    var d = dog; d.t += dt;
    if (june.mode === 'tripBoat') return;
    if (d.hop > 0) d.hop -= dt;
    if (d.awakeT > 0) d.awakeT -= dt;
    var sleepy = d.awakeT <= 0 && (june.mode === 'hutSleep' || (nightish() && playTime > 75));
    if (sleepy) {
      if (d.state !== 'sleep') {
        d.state = 'walk';
        if (dogMove(L.hutCX + 19, 185, 18, dt)) { d.state = 'sleep'; d.dir = -1; }
      }
      return;
    }
    if (d.state === 'sleep') { d.state = 'sit'; d.wait = 1; }
    if (dogTrick(dt)) return;
    if (june.mode.indexOf('stroll') === 0 || june.mode === 'tripWalk' || june.mode === 'grassWalk' || june.mode === 'hutEnter') {
      d.state = dogMove(clamp(june.wx + 11, 12, sw - 12), clamp(june.wy + 3, 160, 194), 21, dt) ? 'sit' : 'walk';
      return;
    }
    if (d.dig) {
      if (dogMove(d.dig.x + 7, d.dig.y, 20, dt)) {
        d.state = 'dig'; d.dir = -1; d.dig.t += dt;
        if (Math.random() < 0.15) sparkles.push({ x: d.dig.x + rnd(-3, 3), y: d.dig.y - 2, t: -0.1 });
        if (d.dig.t > 2.2) {
          mounds.push({ x: d.dig.x, y: d.dig.y, item: wpick(Forest.DIG_POOL), t: 0 });
          d.dig = null; d.state = 'sit'; d.wait = rnd(6, 12); d.hop = 0.4;
          sfx(function (t) { tone(800, t, 0.07, 'square', 0.04, 1100); });
        }
      } else d.state = 'walk';
      return;
    }
    if (d.state === 'walk') { if (!d.wp || dogMove(d.wp.x, d.wp.y, 17, dt)) { d.state = 'sit'; d.wait = rnd(5, 12); } return; }
    d.wait -= dt;
    if (d.wait <= 0) {
      var h = dogHome();
      d.state = 'walk';
      d.wp = Math.random() < 0.5 ? { x: h.x + rnd(-8, 8), y: h.y + rnd(-4, 3) } : { x: rnd(18, sw - 18), y: rnd(165, 194) };
    }
  }
  function petDog() {
    wishEvent('pet');
    dog.hop = 0.5; dog.awakeT = 10;
    if (dog.state === 'sleep') { dog.state = 'sit'; dog.wait = 6; }
    hearts.push({ x: dog.x - 3, y: dog.y - 12, t: 0 }, { x: dog.x + 3, y: dog.y - 15, t: -0.15 });
    if (Math.random() < 0.4) speak('dog', dog);
    sfx(function (t) { tone(900, t, 0.07, 'square', 0.04, 1300); tone(1000, t + 0.1, 0.08, 'square', 0.04, 1400); });
  }
  function drawDog() {
    var d = dog, fr = d.state === 'sleep' ? spr('dog_sleep', 0) : d.state === 'walk' ? spr('dog_walk', Math.floor(T * 6) % 2) : spr('dog_sit', Math.floor(T * 4) % 2);
    var hop = d.hop > 0 ? Math.abs(Math.sin(d.hop / 0.5 * Math.PI * 2)) * 4 : (d.state === 'dig' ? (Math.floor(T * 10) % 2) * 2 : 0);
    ctx.drawImage(d.dir > 0 ? fr.f : fr.c, Math.round(d.x - fr.w / 2 + ox), Math.round(d.y - fr.h + 2 - hop + oy));
  }

  /* the puppy: eager and easily distracted. Zoomies, chasing butterflies, and bringing a stick. */
  function butterfliesOut() { return cur.star < 0.2 && cur.fly < 0.2 && hourF > 7.5 && hourF < 18; }
  function startDogTrick() {
    var d = dog, opts = ['zoom'];
    if (butterfliesOut()) opts.push('chase', 'chase');
    if (gifts.length < 2 && ST.boat) opts.push('fetch');
    var type = pick(opts);
    if (type === 'zoom') { d.trick = { type: 'zoom', t: 0 }; }
    else if (type === 'chase') { d.trick = { type: 'chase', t: 0, bf: pick(bflies) }; }
    else { d.trick = { type: 'fetch', t: 0, phase: 'go' }; }
    d.awakeT = Math.max(d.awakeT, 6);
    sfx(function (t) { tone(900, t, 0.06, 'square', 0.035, 1200); tone(1000, t + 0.09, 0.06, 'square', 0.035, 1300); });
  }
  function dogTrick(dt) {
    var d = dog, tr = d.trick;
    if (!tr) {
      d.trickT -= dt;
      if (d.trickT <= 0) {
        d.trickT = rnd(90, 160);
        if (d.state !== 'sleep' && !d.dig && !juneAway() && !talk && !finale && !trip && !building && !smores && !nightish()) startDogTrick();
      }
      return false;
    }
    tr.t += dt;
    function end() { d.trick = null; d.trickT = rnd(100, 170); d.state = 'sit'; d.wait = 2; }
    if (tr.type === 'zoom') {
      if (!tr.p || dogMove(tr.p.x, tr.p.y, 66, dt)) {
        if (tr.t > 4) { end(); return false; }
        tr.p = { x: rnd(14 - ox * 0.5, sw - 14 + ox * 0.5), y: rnd(164, 194) };
      }
      d.state = 'walk'; return true;
    }
    if (tr.type === 'chase') {
      var b = tr.bf;
      if (tr.t > 5 || !b || !butterfliesOut()) { end(); return false; }
      dogMove(b.x, b.y + 3, 36, dt); d.state = 'walk';
      if (Math.random() < 0.04) d.hop = 0.3;
      return true;
    }
    // fetch: brings June a stick and drops it at her feet
    var tx = L.benchL + 2, ty = 188;
    if (tr.phase === 'go') {
      if (dogMove(tx, ty, 34, dt)) {
        tr.phase = 'drop'; tr.t = 0; d.state = 'sit'; d.dir = 1;
        dropGift(L.benchL + 2, 188, 'twig'); hearts.push({ x: d.x, y: d.y - 12, t: 0 });
        sfx(function (t) { tone(800, t, 0.07, 'square', 0.04, 1100); tone(800, t + 0.12, 0.07, 'square', 0.04, 1100); });
      } else d.state = 'walk';
      return true;
    }
    d.state = 'sit'; if (tr.t > 2) { end(); return false; }
    return true;
  }

  function initFish() {
    fishes = [];
    for (var i = 0; i < 6; i++) fishes.push({ x: rnd(12 - ox, sw - 12 + ox), y: rnd(100, 138), dir: Math.random() < 0.5 ? -1 : 1, sp: rnd(5, 11), col: i % 4, ph: rnd(0, 6), jump: 0, jt: rnd(4, 14), dash: 0, nib: 0 });
  }
  /* fish: orange is bold and nibbles at bread, white is lazy, yellow shows off by jumping, blue is shy and darts away from splashes */
  function updateFish(dt) {
    if (!fishes.length) initFish();
    var minX = 8 - ox, maxX = sw + ox - 8;
    fishes.forEach(function (f) {
      var sp = f.sp * (f.col === 1 ? 0.5 : 1), q;
      if (f.dash > 0) { f.dash -= dt; sp *= 3.2; }
      if (f.col === 3 && f.dash <= 0) {
        for (q = 0; q < ripples.length; q++) { var rp = ripples[q]; if (rp.t < 0.3 && Math.hypot(rp.x - f.x, rp.y - f.y) < 26) { f.dash = 1; f.dir = rp.x > f.x ? -1 : 1; break; } }
      }
      if (f.col === 0 && f.dash <= 0) {
        var nb = null, nd = 45;
        breads.forEach(function (b) { if (b.state === 'float') { var d2 = Math.hypot(b.x - f.x, b.y - f.y); if (d2 < nd) { nd = d2; nb = b; } } });
        if (nb) {
          f.dir = nb.x > f.x ? 1 : -1; f.y += (nb.y - f.y) * Math.min(1, dt * 1.5);
          if (nd < 4) { f.nib -= dt; if (f.nib <= 0) { f.nib = 1.4; addRipple(nb.x, nb.y + 1); } sp = 0; }
        }
      }
      f.x += f.dir * sp * dt;
      if (f.x < minX) { f.x = minX; f.dir = 1; } else if (f.x > maxX) { f.x = maxX; f.dir = -1; }
      f.y = clamp(f.y + Math.sin(T * 0.7 + f.ph) * 3 * dt, 98, 140);
      f.jt -= dt;
      var jmin = f.col === 2 ? 3 : f.col === 1 ? 14 : 8, jmax = f.col === 2 ? 8 : f.col === 1 ? 30 : 20;
      if (f.jump <= 0 && f.jt <= 0) { f.jump = 0.0001; f.jt = rnd(jmin, jmax); addRipple(f.x, f.y); wishEvent('fish'); }
      if (f.jump > 0) {
        f.jump += dt;
        if (f.jump > 0.7) { f.jump = 0; addRipple(f.x + f.dir * 3, f.y); sfx(function (t) { tone(700, t, 0.05, 'sine', 0.04, 350); }); }
      }
    });
  }

  function drawFish() {
    fishes.forEach(function (f) {
      var fr = spr('fish_' + f.col, Math.floor(T * 5 + f.ph) % 2), jy = 0;
      if (f.jump > 0) jy = Math.sin(f.jump / 0.7 * Math.PI) * 11;
      ctx.globalAlpha = f.jump > 0 ? 1 : 0.7;
      ctx.drawImage(f.dir > 0 ? fr.c : fr.f, Math.round(f.x - fr.w / 2 + ox), Math.round(f.y - jy + oy));
    });
    ctx.globalAlpha = 1;
  }

  /* ---------- stone skipping ---------- */
  var stones = [], lastSkipLine = -99, press = null;
  function launchStone(dx, dy, power) {
    var len = Math.hypot(dx, dy) || 1; dx /= len; dy /= len;
    if (dy > -0.2) { dy = -0.2; var l2 = Math.hypot(dx, dy); dx /= l2; dy /= l2; }
    var hp = handPos(), n = clamp(Math.round(power / 300) + rint(-1, 1), 1, 9), d0 = clamp(power / 18, 22, 46), i, skips = 0, d = d0;
    var cx = clamp(clamp(hp.x, 12, sw - 12) + dx * d0 * 1.2, 6, sw - 6), cy = Math.max(BANK_Y - 2 + dy * d0 * 1.2, 90);
    var segs = [{ fx: hp.x, fy: hp.y, tx: cx, ty: cy, dur: 0.55, h: 16 }];
    for (i = 0; i < n; i++) {
      if (cy <= 92) break;
      d *= 0.8;
      var nx = clamp(cx + dx * d, 6, sw - 6), ny = Math.max(cy + dy * d * 0.8, 90);
      segs.push({ fx: cx, fy: cy, tx: nx, ty: ny, dur: 0.3 * Math.pow(0.84, i), h: 8 * Math.pow(0.8, i) });
      cx = nx; cy = ny; skips++;
    }
    stones.push({ segs: segs, i: 0, t: 0, skips: skips });
    wishEvent('stones', 1); if (skips >= 3) wishEvent('skip', 1);
  }
  function throwStone(dx, dy, power) {
    releasePending();
    if (juneAway()) { launchStone(dx, dy, power); return; }
    june.mode = 'toss'; june.t = 0; june.awakeT = 8; june.stoneQ = { dx: dx, dy: dy, power: power };
  }
  function updateStones(dt) {
    for (var k = stones.length - 1; k >= 0; k--) {
      var s = stones[k], sg = s.segs[s.i], idx = s.i;
      s.t += dt;
      if (s.t < sg.dur) continue;
      addRipple(sg.tx, sg.ty);
      sfx(function (t) { tone(520 + idx * 90, t, 0.06, 'sine', 0.05, 260); });
      s.i++; s.t = 0;
      if (s.i >= s.segs.length) {
        stones.splice(k, 1);
        if (s.skips >= 5) {
          for (var q = 0; q < 3; q++) sparkles.push({ x: sg.tx + rnd(-6, 6), y: sg.ty - rnd(2, 8), t: -q * 0.1 });
          if (!talk && !finale) { sCollect(); if (goose.state === 'idle') { goose.state = 'honk'; goose.t = 0; sHonk(); } }
          if (s.skips >= 6 && !talk && !finale && T - lastSkipLine > 25) { lastSkipLine = T; showBubble({ text: pick(LINES.stone.nice) }, { noCount: true }); }
        }
      }
    }
  }
  function drawStones() {
    var sp = spr('stone', 0);
    stones.forEach(function (s) {
      var sg = s.segs[s.i], u = clamp(s.t / sg.dur, 0, 1), x = lerp(sg.fx, sg.tx, u), y = lerp(sg.fy, sg.ty, u) - Math.sin(Math.PI * u) * sg.h;
      ctx.globalAlpha = 0.25; ctx.fillStyle = '#000'; ctx.fillRect(Math.round(x - 1 + ox), Math.round(lerp(sg.fy, sg.ty, u) + oy), 3, 1); ctx.globalAlpha = 1;
      ctx.drawImage(sp.c, Math.round(x - 2 + ox), Math.round(y - 1 + oy));
    });
  }
  function onUp(e) {
    if (!press || (e.pointerId !== undefined && press.id !== e.pointerId)) return;
    var p = press; press = null;
    var dx = e.clientX - p.x, dy = e.clientY - p.y, dist = Math.hypot(dx, dy), dtm = Math.max(30, performance.now() - p.t);
    if (dist >= 26 && dtm < 900) { throwStone(dx, dy, clamp(dist / dtm * 1000, 250, 2400)); return; }
    if (p.water) { if (breadCount() >= 5) return; juneToss(p.rx, p.ry); }
    else if (p.ry > BANK_Y + 2) grassGo(p.rx, p.ry);
  }
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', function () { press = null; });

  /* ---------- tiny daily wishes ---------- */
  function hashStr(s) { var h = 7; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h; }
  function wishDef(id) { return LINES.wishes.pool.filter(function (x) { return x.id === id; })[0]; }
  function ensureWishes() {
    var today = ymd(new Date()), w = ST.wishes;
    if (w.date === today && w.ids && w.ids.length) return;
    var pool = LINES.wishes.pool.slice(), r = mulberry(hashStr(today)), ids = [];
    while (ids.length < 3 && pool.length) { var j = Math.floor(r() * pool.length); ids.push(pool[j].id); pool.splice(j, 1); }
    ST.wishes = { date: today, ids: ids, prog: {}, done: {} }; save();
  }
  function wishEvent(id, n) {
    ensureWishes();
    var w = ST.wishes, def = wishDef(id);
    if (!def || w.ids.indexOf(id) < 0 || w.done[id]) return;
    w.prog[id] = (w.prog[id] || 0) + (n || 1);
    if (w.prog[id] >= def.target) {
      w.done[id] = true; ST.diamonds++; save();
      var all = w.ids.every(function (x) { return w.done[x]; });
      if (!talk && !finale) {
        sCollect();
        var wb = $('wishBtn').getBoundingClientRect(), pb = $('pouchBtn').getBoundingClientRect();
        flyList.push({ kind: 'diamond', sx: (wb.left + wb.width / 2) / scale - ox, sy: (wb.top + wb.height / 2) / scale - oy,
          ex: (pb.left + pb.width / 2) / scale - ox, ey: (pb.top + pb.height / 2) / scale - oy, t: 0, arc: 10 });
        showBubble({ text: all ? LINES.wishes.allDone : pick(LINES.wishes.done) }, { noCount: true });
      }
    } else save();
    if ($('wishOverlay').classList.contains('open')) fillWishes();
  }
  function fillWishes() {
    ensureWishes();
    var list = $('wishList'), w = ST.wishes;
    list.innerHTML = '';
    $('wishTitle').textContent = LINES.wishes.title; $('wishNote').textContent = LINES.wishes.note;
    w.ids.forEach(function (id) {
      var def = wishDef(id), done = !!w.done[id], row = document.createElement('div');
      row.className = 'wish' + (done ? ' done' : '');
      var mark = document.createElement('span'); mark.className = 'mark'; mark.textContent = done ? '✓' : '';
      var tx = document.createElement('span'); tx.className = 'wtext'; tx.textContent = def.text;
      var pg = document.createElement('span'); pg.className = 'prog'; pg.textContent = (def.target > 1 && !done) ? ((w.prog[id] || 0) + '/' + def.target) : '';
      row.appendChild(mark); row.appendChild(tx); row.appendChild(pg); list.appendChild(row);
    });
  }
  $('wishBtn').addEventListener('click', function () { unlockAudio(); fillWishes(); $('wishOverlay').classList.add('open'); });
  $('wishOverlay').addEventListener('click', function (e) { if (e.target === $('wishOverlay')) $('wishOverlay').classList.remove('open'); });

  /* ---------- remembering her ---------- */
  var EVENT_DEFS = [
    { key: 'exam', re: /\b(exam|exams|test|tests|quiz|finals|viva)\b/, label: 'your exam' },
    { key: 'interview', re: /\binterview\b/, label: 'your interview' },
    { key: 'presentation', re: /\b(presentation|pitch|demo)\b/, label: 'your presentation' },
    { key: 'meeting', re: /\bmeeting\b/, label: 'your meeting' },
    { key: 'trip', re: /\b(trip|flight|vacation|holiday|travelling|traveling)\b/, label: 'your trip' },
    { key: 'appointment', re: /\b(doctor|dentist|appointment|check-?up)\b/, label: 'your appointment' },
    { key: 'deadline', re: /\b(deadline|submission|assignment)\b/, label: 'your deadline' },
    { key: 'party', re: /\b(party|wedding|get-?together)\b/, label: 'the party' },
    { key: 'birthday', re: /\bbirthday\b/, label: 'the birthday' }
  ];
  var FUTURE_RE = /\b(tomorrow|tonight|later|next|soon|this (week|weekend|evening|afternoon)|upcoming|coming up|have (an?|the)|got (an?|the)|got to|going to|gotta|need to|will)\b/;
  var LIKE_RE = /\bi(?:'m| am)? (?:really |so |absolutely )?(?:love|loved|like|adore|enjoy|obsessed with|into) ([a-z0-9' -]{2,30}?)(?=[.!,;?]|$| because| so | but | and i| cause| lol)/i;
  var PERSON_RE = /\bmy (friend|best friend|bestie|sister|brother|mom|mum|dad|mother|father|cousin|roommate|boss|colleague|teacher) ([A-Z][a-z]{2,})/;
  function addMemories(text) {
    var m = ST.mem, today = ymd(new Date()), low = text.toLowerCase(), i;
    if (FUTURE_RE.test(low)) {
      EVENT_DEFS.forEach(function (d) {
        if (d.re.test(low) && !m.events.some(function (e) { return e.key === d.key && e.day === today; })) m.events.push({ key: d.key, label: d.label, day: today, asked: false });
      });
      m.events = m.events.slice(-8);
    }
    var lk = LIKE_RE.exec(text);
    if (lk) {
      var x = lk[1].trim().replace(/^(the|a|an|my|some|to|being|doing) /i, '');
      if (x && x.split(/\s+/).length <= 4 && !/\b(you|u|this|it|that|him|her|them|how|when)\b/i.test(x) && !m.likes.some(function (l) { return l.x.toLowerCase() === x.toLowerCase(); })) {
        m.likes.push({ x: x, day: today }); m.likes = m.likes.slice(-8);
      }
    }
    var pr = PERSON_RE.exec(text);
    if (pr && !m.people.some(function (p) { return p.name === pr[2]; })) { m.people.push({ rel: pr[1], name: pr[2], day: today }); m.people = m.people.slice(-6); }
    save();
  }
  function fillX(t, x) { return t.replace('{x}', x); }
  function pendingEvent() { var today = ymd(new Date()); return ST.mem.events.filter(function (e) { return !e.asked && e.day !== today; })[0]; }
  function memoryGreeting() {
    var ev = pendingEvent();
    if (!ev) return null;
    ev.asked = true; save();
    return { text: fillX(pick(LINES.memory.event), ev.label), more: true };
  }
  function memoryRoll() {
    var m = ST.mem, today = ymd(new Date()), ev = pendingEvent();
    if (ev && Math.random() < 0.7) { ev.asked = true; save(); return { text: fillX(pick(LINES.memory.event), ev.label), more: true }; }
    if (m.lastMem !== today && Math.random() < 0.3) {
      var olds = m.likes.filter(function (l) { return daysBetween(l.day, today) >= 2; });
      if (olds.length) { m.lastMem = today; save(); return { text: fillX(pick(LINES.memory.like), pick(olds).x), more: true }; }
      if (m.people.length && Math.random() < 0.5) { m.lastMem = today; save(); return { text: fillX(pick(LINES.memory.person), pick(m.people).name), more: true }; }
    }
    return null;
  }
  function moreAction(line) { return line && line.more ? { actions: [{ label: LINES.ui.more, fn: openFreeTalk }] } : undefined; }

  /* ---------- hunger: the goose slows down if he has not been fed for a long while ---------- */
  var forcedHunger = Q.has('hungry') ? parseInt(Q.get('hungry'), 10) : NaN;
  var fedPending = 0, hungerShown = 0, hungerT = 8;
  function hungerLevel() {
    if (!isNaN(forcedHunger)) return clamp(forcedHunger, 0, 3);
    var h = (Date.now() - (ST.lastFed || Date.now())) / 3600000;
    return h >= 72 ? 3 : h >= 30 ? 2 : h >= 12 ? 1 : 0;
  }
  function hungerMul() { var l = hungerLevel(); return l === 3 ? 0.4 : l === 2 ? 0.6 : l === 1 ? 0.85 : 1; }
  function hungerTick(dt) {
    hungerT -= dt; if (hungerT > 0) return; hungerT = 6;
    var l = hungerLevel();
    if (l > hungerShown && l >= 1 && !bub.on && !talk && !finale && greetT <= 0 && goose.state === 'idle' && !trip) {
      hungerShown = l; showBubble({ text: LINES.hunger['l' + l] }, { noCount: true });
    }
  }

  /* ---------- things she finds ---------- */
  var itemSpr = {};
  Object.keys(Forest.ITEMS).forEach(function (id) { itemSpr[id] = SPR.fromRows(Forest.ITEMS[id]); });
  function itemCanvas(id) { return goodieSpr[id] || itemSpr[id]; }
  function addItem(id, n) { ST.inv[id] = (ST.inv[id] || 0) + (n || 1); save(); }
  function wpick(pool, rf) {
    var tot = 0, i; pool.forEach(function (p) { tot += p.w; });
    var r = (rf ? rf() : Math.random()) * tot;
    for (i = 0; i < pool.length; i++) { r -= pool[i].w; if (r <= 0) return pool[i].id; }
    return pool[0].id;
  }
  function paint(canvas, id) {
    canvas.width = 12; canvas.height = 12;
    var x = canvas.getContext('2d'); x.clearRect(0, 0, 12, 12);
    if (id) x.drawImage(itemCanvas(id), 1, 1);
  }
  function giveItem(id, sx, sy) { // sx, sy are in scene units (what the sprite blitters expect)
    addItem(id, 1);
    var pr = $('pouchBtn').getBoundingClientRect();
    flyList.push({ kind: 'item', id: id, sx: sx, sy: sy, ex: (pr.left + pr.width / 2) / scale - ox, ey: (pr.top + pr.height / 2) / scale - oy, t: 0, arc: 20 });
    sparkles.push({ x: sx, y: sy - 4, t: 0 }, { x: sx + 5, y: sy - 8, t: -0.1 });
    sCollect();
  }

  /* ---------- the puppy buries things by the pond ---------- */
  var mounds = [], digT = 70;
  function updateMounds(dt) {
    digT -= dt;
    if (digT <= 0) {
      digT = rnd(70, 130);
      if (!dog.dig && mounds.length < 2 && !nightish() && dog.state !== 'sleep' && !juneAway() && !trip && !building) dog.dig = { x: rnd(18, sw - 18), y: rnd(166, 194), t: 0 };
    }
    mounds.forEach(function (m) { m.t += dt; if (m.t > 2.4) { m.t = 0; sparkles.push({ x: m.x + rnd(-3, 3), y: m.y - 3, t: 0 }); } });
  }
  function digUp(m) {
    mounds.splice(mounds.indexOf(m), 1);
    giveItem(m.item, m.x, m.y - 4); wishEvent('dig');
    dog.hop = 0.5; dog.awakeT = 6; hearts.push({ x: dog.x, y: dog.y - 12, t: 0 });
  }
  function drawMounds() {
    var ms = spr('mound', 0);
    return mounds.map(function (m) { return { y: m.y, f: function () { blitO(ms, m.x - 4, m.y - 4); } }; });
  }

  /* ---------- the goose builds things himself once she has what he needs ---------- */
  var building = null, buildPending = '';
  function haveNeeds(n) { for (var k in n) if ((ST.inv[k] || 0) < n[k]) return false; return true; }
  function buildDef(id) { return Forest.BUILDS.filter(function (b) { return b.id === id; })[0]; }
  function nextBuild() {
    if (Q.get('boat') === '1' && !ST.boat) return 'boat';
    if (!ST.boat) return ST.goodies.length >= buildDef('boat').goodies ? 'boat' : '';
    if (!ST.fire && haveNeeds(buildDef('fire').needs)) return 'fire';
    if (ST.fire && !ST.feeder && haveNeeds(buildDef('feeder').needs)) return 'feeder';
    return '';
  }
  function siteOf(id) { return id === 'boat' ? { x: L.boatX, sy: BANK_Y - 6, water: true } : id === 'fire' ? { x: L.fireX, sy: 188 } : { x: L.feederX, sy: 187 }; }
  function startBuild(id) {
    buildPending = ''; hideBubble();
    var s = siteOf(id);
    building = { id: id, t: 0, phase: 'go', tapT: 0, s: s };
    goose.state = 'path';
    goose.path = s.water ? [{ x: s.x - 14, y: s.sy, sp: 30 }] : [{ x: s.x - 14, y: BANK_Y - 3, sp: 34 }, { x: s.x - 14, y: s.sy, sp: 26 }];
    goose.done = function () { goose.state = 'wait'; goose.t = 0; goose.wt = 999; goose.placing = true; goose.done = null; building.phase = 'hammer'; building.t = 0; };
    dog.dig = null; dog.state = 'walk'; dog.wp = { x: s.x + 14, y: Math.max(172, s.sy - 2) };
  }
  function buildAlpha(id) { return building && building.id === id && !ST[id] ? clamp(building.t / 4, 0, 1) : 1; }
  function updateBuild(dt) {
    if (!building || building.phase !== 'hammer') return;
    var s = building.s;
    building.t += dt; building.tapT -= dt;
    if (building.tapT <= 0) {
      building.tapT = 0.5;
      sparkles.push({ x: s.x + rnd(-8, 8), y: (s.water ? BANK_Y : s.sy) - rnd(4, 12), t: 0 });
      sfx(function (t) { tone(240, t, 0.05, 'square', 0.05, 160); });
    }
    if (building.t >= 4.5) {
      var id = building.id, def = buildDef(id), k;
      if (def.needs) for (k in def.needs) ST.inv[k] = Math.max(0, (ST.inv[k] || 0) - def.needs[k]);
      ST[id] = true; if (id === 'feeder') ST.seeds = 4;
      save(); building = null; goose.placing = false;
      if (s.water) toIdle(); else gooseWalk([{ x: goose.x, y: BANK_Y - 3, sp: 28 }, { x: goose.x, y: 122, sp: 26 }], toIdle);
      for (var i = 0; i < 5; i++) sparkles.push({ x: s.x + rnd(-10, 10), y: (s.water ? BANK_Y : s.sy) - rnd(2, 14), t: -i * 0.1 });
      sCollect(); dog.hop = 0.5; sayAt(goose, LINES.build[id], { noCount: true, dur: 10 });
    }
  }

  /* ---------- the campfire and s'mores ---------- */
  var smores = null;
  function fireLit() { return ST.fire && !building && (cur.lamp > 0.25 || !!smores); }
  function drawFire(alpha) {
    var ps = spr('fire_pit', 0), x = Math.round(L.fireX - ps.w / 2 + ox), y = Math.round(L.fireY - ps.h + oy);
    if (alpha < 1) ctx.globalAlpha = alpha;
    ctx.drawImage(ps.c, x, y); ctx.globalAlpha = 1;
    if (fireLit()) { var fr = spr('flame', Math.floor(T * 8) % 3); ctx.drawImage(fr.c, Math.round(L.fireX - fr.w / 2 + ox), y - fr.h + 4); }
  }
  function kitReady() { return (ST.inv.marshmallow || 0) >= 1 && (ST.inv.chocolate || 0) >= 1 && (ST.inv.cracker || 0) >= 1; }
  function askFire() {
    if (!ST.fire || smores || juneAway() || trip || building || talk || finale || scene !== 'pond') return;
    if (kitReady()) showBubble({ text: LINES.smores.ask }, { noCount: true, dur: 14, actions: [{ label: LINES.ui.roast, fn: startSmores }, { label: LINES.ui.later }] });
    else showBubble({ text: pick(LINES.smores.need) }, { noCount: true, dur: 8 });
  }
  function startSmores() {
    if (smores || juneAway() || !kitReady()) return;
    releasePending(); hideBubble();
    smores = { t: 0 };
    june.wx = L.juneL + 8; june.wy = 182; june.fdir = -1; june.mode = 'smoresWalk';
    goose.state = 'path'; goose.path = [{ x: L.fireX - 14, y: BANK_Y - 3, sp: 34 }, { x: L.fireX - 14, y: 188, sp: 26 }];
    goose.done = function () { goose.state = 'wait'; goose.t = 0; goose.wt = 999; goose.placing = true; goose.done = null; goose.dir = 1; };
    dog.dig = null; dog.state = 'walk'; dog.wp = { x: L.fireX + 2, y: 192 };
  }
  function updateSmores(dt) {
    if (!smores || june.mode !== 'smoresRoast') return;
    smores.t += dt;
    if (smores.t >= 7.5) {
      ST.inv.marshmallow--; ST.inv.chocolate--; ST.inv.cracker--; ST.smores = (ST.smores || 0) + 1; ST.diamonds++; save();
      smores = null; june.mode = 'strollBack'; goose.placing = false; wishEvent('smores');
      gooseWalk([{ x: goose.x, y: BANK_Y - 3, sp: 28 }, { x: goose.x, y: 122, sp: 26 }], toIdle);
      hearts.push({ x: L.fireX, y: L.fireY - 14, t: 0 }, { x: L.fireX + 6, y: L.fireY - 18, t: -0.2 }); sCollect();
      sayAt(goose, pick(LINES.smores.done), { noCount: true, dur: 8 });
    }
  }
  function drawStick() {
    var p = clamp(smores.t / 5, 0, 1), hx = june.wx - 6 + ox, hy = june.wy - 9 + oy, tx = L.fireX + 3 + ox, ty = L.fireY - 8 + oy;
    ctx.fillStyle = '#8a5a30'; pxLine(hx, hy, tx, ty);
    if (smores.t < 5.8) { ctx.fillStyle = rgb(mixc([255, 250, 240], [120, 70, 30], p)); ctx.fillRect(Math.round(tx) - 1, Math.round(ty) - 1, 3, 3); }
  }

  /* ---------- each animal has a personality; tapping one gets a line in its own voice ---------- */
  var speakCool = 0, muttT = 200;
  function speak(key, e) {
    if (T < speakCool || talk || finale || scene !== 'pond' || bub.on) return;
    var l = LINES.animals[key]; if (!l) return;
    speakCool = T + 7;
    sayAt({ x: e.x, y: e.y, topH: 14 }, pick(l), { noCount: true, dur: 4.5 });
  }

  /* ---------- the bird feeder, the birds and their gifts ---------- */
  var birds = [], gifts = [], birdT = 20;
  function birdDef(id) { return Forest.BIRDS.filter(function (b) { return b.id === id; })[0]; }
  function edgeX(side) { return side < 0 ? -ox - 8 : lw - ox + 8; }
  function drawFeeder(alpha) {
    var fs = spr('feeder', 0), x = Math.round(L.feederX - fs.w / 2 + ox), y = Math.round(L.feederY - fs.h + 2 + oy);
    if (alpha < 1) ctx.globalAlpha = alpha;
    ctx.drawImage(fs.c, x, y); ctx.globalAlpha = 1;
  }
  function spawnBird() {
    var list = Forest.BIRDS.filter(function (b) { return (ST.feeds || 0) >= b.feeds; }), tot = 0, i, sp;
    list.forEach(function (b) { tot += b.w; });
    var r = Math.random() * tot; sp = list[0];
    for (i = 0; i < list.length; i++) { r -= list[i].w; if (r <= 0) { sp = list[i]; break; } }
    var side = Math.random() < 0.5 ? -1 : 1, onTray = sp.id === 'red' ? true : Math.random() < 0.6;
    birds.push({ kind: sp.id, x: edgeX(side), y: rnd(-oy * 0.5 + 20, 70), state: 'in', t: 0, tx: L.feederX + (onTray ? rnd(-4, 4) : rnd(-16, 10)), ty: onTray ? L.feederY - 17 : L.feederY + 3, dir: side < 0 ? 1 : -1, side: side, songT: 1.5 });
    ST.seeds = Math.max(0, (ST.seeds || 0) - 1); save();
  }
  function dropGift(x, y, id) {
    if (gifts.length >= 3) return;
    gifts.push({ x: x + rnd(-6, 6), y: y, id: id || wpick(Forest.GIFT_POOL), t: 0 });
    sparkles.push({ x: x, y: y - 6, t: 0 });
  }
  function birdSong(b) {
    var base = rnd(2000, 2500);
    sfx(function (t) { [1, 1.25, 1.5, 1.25].forEach(function (m, i) { tone(base * m, t + i * 0.12, 0.09, 'sine', 0.025, base * m * 1.08); }); });
    hearts.push({ x: b.x, y: b.y - 8, t: 0 });
  }
  function leaveBird(b) {
    var def = birdDef(b.kind);
    b.state = 'out'; b.t = 0; b.dir = b.side;
    if (b.bolt) { b.x += 0; }
    else {
      ST.feeds = (ST.feeds || 0) + 1; ST.bond[b.kind] = (ST.bond[b.kind] || 0) + 1; save();
      if (ST.bond[b.kind] % def.gift === 0) dropGift(L.feederX, L.feederY + 6, b.kind === 'red' ? pick(['ribbon', 'pearl', 'feather']) : undefined);
    }
  }
  function updateBirds(dt) {
    gifts.forEach(function (gf) { gf.t += dt; if (gf.t > 2.5) { gf.t = 0; sparkles.push({ x: gf.x + rnd(-3, 3), y: gf.y - rnd(6, 10), t: 0 }); } });
    if (ST.feeder) {
      birdT -= dt;
      if (birdT <= 0) {
        birdT = rnd(25, 55);
        if ((ST.seeds || 0) > 0 && birds.length < 3 && !nightish() && !talk && !finale && !trip) spawnBird();
      }
    }
    for (var i = birds.length - 1; i >= 0; i--) {
      var b = birds[i], def = birdDef(b.kind);
      b.t += dt;
      if (b.state === 'in') {
        var dx = b.tx - b.x, dy = b.ty - b.y, d = Math.hypot(dx, dy), st = 58 * dt;
        b.dir = dx < 0 ? -1 : 1;
        if (d <= st) { b.x = b.tx; b.y = b.ty; b.state = 'perch'; b.t = 0; b.stay = rnd(def.stay[0], def.stay[1]); } else { b.x += dx / d * st; b.y += dy / d * st; }
      } else if (b.state === 'perch') {
        if (def.shy && (Math.hypot(dog.x - b.x, dog.y - b.y) < def.shy || Math.hypot(goose.x - b.x, goose.y - b.y) < def.shy)) { b.bolt = true; leaveBird(b); sfx(function (t) { tone(3000, t, 0.05, 'sine', 0.03, 3600); }); continue; }
        if (def.sing) { b.songT -= dt; if (b.songT <= 0) { b.songT = rnd(4, 6); birdSong(b); } }
        if (b.t > b.stay) leaveBird(b);
      } else {
        b.x += b.dir * (b.bolt ? 90 : 62) * dt; b.y -= (b.bolt ? 40 : 24) * dt;
        if (b.x < -ox - 14 || b.x > lw - ox + 14 || b.y < -oy - 10) birds.splice(i, 1);
      }
    }
  }
  function tapFeeder() {
    var low = (ST.seeds || 0) < 3;
    ST.seeds = 6; save();
    for (var i = 0; i < 4; i++) sparkles.push({ x: L.feederX + rnd(-8, 8), y: L.feederY - rnd(8, 18), t: -i * 0.06 });
    sfx(function (t) { tone(1800, t, 0.03, 'sine', 0.03); tone(2100, t + 0.05, 0.03, 'sine', 0.03); tone(1900, t + 0.1, 0.03, 'sine', 0.03); });
    if (low) { wishEvent('feeder'); if (!talk && !finale) sayAt(goose, pick(LINES.feeder.fed), { noCount: true, dur: 5 }); }
    birdT = Math.min(birdT, 6);
  }
  function petBird(b) {
    hearts.push({ x: b.x, y: b.y - 8, t: 0 });
    sfx(function (t) { var f = rnd(2600, 3300); tone(f, t, 0.06, 'sine', 0.03, f * 1.2); });
    if (b.state === 'perch') speak(b.kind, b);
  }
  function collectGift(g) {
    gifts.splice(gifts.indexOf(g), 1);
    giveItem(g.id, g.x, g.y - 6);
  }
  function drawBird(b) {
    var idx = b.state === 'perch' ? (Math.floor(b.t * (b.kind === 'sparrow' ? 4 : 2.5)) % 2 === 0 ? 1 : 0) : 2;
    var sprite = spr('bird_' + b.kind, idx), hop = b.state === 'perch' && b.ty > L.feederY && b.kind === 'sparrow' ? Math.abs(Math.sin(T * 6)) * 1.5 : 0;
    ctx.drawImage(b.dir < 0 ? sprite.f : sprite.c, Math.round(b.x - sprite.w / 2 + ox), Math.round(b.y - sprite.h - hop + oy));
  }

  /* ---------- little visitors that come once the birds have been fed for a while ---------- */
  var visitor = null, visitT = 100;
  function inHours(rs) { return rs.some(function (r) { return hourF >= r[0] && hourF < r[1]; }); }
  function spawnVisitor() {
    var list = Forest.VISITORS.filter(function (v) { return (ST.feeds || 0) >= v.feeds && inHours(v.hours); });
    if (!list.length) return;
    var v = pick(list), side = Math.random() < 0.5 ? -1 : 1;
    visitor = { id: v.id, x: edgeX(side) - side * 2, y: rnd(168, 192), state: 'in', tx: rnd(sw * 0.3, sw * 0.8), t: 0, stay: v.id === 'fox' ? rnd(30, 50) : rnd(40, 80), pets: 0, dir: side < 0 ? 1 : -1, side: side, hop: 0, gifted: false, scared: 0, ball: 0, pounce: rnd(3, 6), fleeDir: 1 };
    if (ST.seenV.indexOf(v.id) < 0) { ST.seenV.push(v.id); save(); setTimeout(function () { if (visitor && !talk && !finale && scene === 'pond') sayAt(goose, LINES.visitors.first[v.id], { noCount: true, dur: 8 }); }, 2500); }
  }
  function updateVisitor(dt) {
    if (!visitor) {
      visitT -= dt;
      if (visitT <= 0) { visitT = rnd(150, 280); if (!talk && !finale && !trip && Math.random() < 0.75) spawnVisitor(); }
      return;
    }
    var v = visitor; v.t += dt; if (v.hop > 0) v.hop -= dt;
    function near(e, r) { return Math.hypot(e.x - v.x, e.y - v.y) < r; }
    var minX = -ox + 6, maxX = lw - ox - 6;
    if (v.id === 'bunny' && v.state !== 'out') {   // shy: bolts when the goose or the puppy comes close
      if (v.scared > 0) { v.scared -= dt; v.x = clamp(v.x + v.fleeDir * 42 * dt, minX, maxX); return; }
      if (v.pets < 3 && (near(goose, 30) || near(dog, 30))) { v.scared = 1.6; v.fleeDir = v.x >= (near(dog, 30) ? dog.x : goose.x) ? 1 : -1; v.dir = v.fleeDir; return; }
    }
    if (v.id === 'hedgehog' && v.state !== 'out') {   // grumpy: curls into a ball until it trusts her
      if (v.ball > 0) { v.ball -= dt; return; }
      if (v.pets < 3 && (near(goose, 26) || near(dog, 26))) { v.ball = 3; return; }
    }
    if (v.id === 'fox' && v.state !== 'out') {   // playful: pounces about and starts games with the puppy
      v.pounce -= dt;
      if (v.pounce <= 0) {
        v.pounce = rnd(4, 8); v.hop = 0.4; sfx(function (t) { tone(600, t, 0.08, 'sine', 0.04, 900); });
        if (near(dog, 70) && dog.state !== 'sleep' && !dog.trick && !dog.dig) { dog.trick = { type: 'zoom', t: 0 }; dog.awakeT = 8; }
      }
    }
    if (v.state === 'in') {
      var dx = v.tx - v.x; v.dir = dx < 0 ? -1 : 1;
      if (Math.abs(dx) < 1.5) { v.state = 'idle'; v.t = 0; } else v.x += v.dir * (v.id === 'fox' ? 22 : 16) * dt;
    } else if (v.state === 'idle') {
      if (v.t > v.stay) { v.state = 'out'; v.dir = v.side; }
    } else { v.x += v.dir * 18 * dt; if (v.x < -ox - 14 || v.x > lw - ox + 14) visitor = null; }
  }
  function petVisitor() {
    var v = visitor; if (!v) return;
    if (v.id === 'bunny' && v.scared > 0) return;
    if (v.ball > 0) { v.ball = 0; }
    v.hop = 0.4; v.pets++; hearts.push({ x: v.x, y: v.y - 12, t: 0 }, { x: v.x + 4, y: v.y - 15, t: -0.15 });
    sfx(function (t) { tone(520, t, 0.1, 'sine', 0.04, 700); });
    wishEvent('visitor');
    if (v.pets === 1 || Math.random() < 0.5) { speakCool = 0; speak(v.id, v); }
    var need = v.id === 'fox' ? 2 : 3;
    if (v.pets >= need && !v.gifted) { v.gifted = true; dropGift(v.x, v.y + 2, v.id === 'bunny' ? 'clover' : v.id === 'hedgehog' ? 'mushroom' : pick(['button', 'pearl'])); }
  }
  function drawVisitor() {
    var v = visitor, moving = v.state !== 'idle' || v.scared > 0;
    var fr = v.ball > 0 ? spr('visit_hedgehog_ball', 0) : spr('visit_' + v.id, moving ? Math.floor(T * 5) % 2 : (Math.floor(T * 1.2) % 2));
    var hop = v.hop > 0 ? Math.abs(Math.sin(v.hop / 0.4 * Math.PI)) * 4 : (moving && v.ball <= 0 ? (Math.floor(T * 5) % 2) * 1 : 0);
    ctx.drawImage(v.dir < 0 ? fr.f : fr.c, Math.round(v.x - fr.w / 2 + ox), Math.round(v.y - fr.h + 2 - hop + oy));
  }

  /* ---------- the sky: cousins flying over, a balloon, shooting stars ---------- */
  var flock = null, balloon = null, shoot = null, skyT = { flock: 25, balloon: 90, shoot: 20 };
  function skyTop() { return -oy + 8; }
  function updateSky(dt) {
    skyT.flock -= dt; skyT.balloon -= dt; skyT.shoot -= dt;
    if (skyT.flock <= 0 && !flock) {
      skyT.flock = rnd(40, 80);
      if (!nightish()) { var side = Math.random() < 0.5 ? -1 : 1; flock = { x: edgeX(side) - side * 14, y: rnd(skyTop() + 6, 50), dir: side < 0 ? 1 : -1, n: rint(3, 5), t: 0 }; }
    }
    if (flock) { flock.t += dt; flock.x += flock.dir * 20 * dt; flock.y += Math.sin(flock.t * 0.8) * 3 * dt; if (flock.x < -ox - 40 || flock.x > lw - ox + 40) flock = null; }
    if (skyT.balloon <= 0 && !balloon) {
      skyT.balloon = rnd(150, 260);
      if (hourF > 7 && hourF < 18) balloon = { x: -ox - 12, y: rnd(skyTop() + 16, 46), t: 0 };
    }
    if (balloon) { balloon.t += dt; balloon.x += 6 * dt; if (balloon.x > lw - ox + 14) balloon = null; }
    if (skyT.shoot <= 0 && !shoot) {
      skyT.shoot = rnd(25, 60);
      if (cur.star > 0.7) shoot = { x: rnd(-ox + 30, lw - ox - 30), y: skyTop() + rnd(2, 24), vx: rnd(60, 90) * (Math.random() < 0.5 ? -1 : 1), vy: rnd(25, 40), t: 0 };
    }
    if (shoot) { shoot.t += dt; shoot.x += shoot.vx * dt; shoot.y += shoot.vy * dt; if (shoot.t > 1.6) shoot = null; }
  }
  function drawSkyLife() {
    var i;
    if (balloon) {
      var bs = spr('balloon', 0), by = balloon.y + Math.sin(balloon.t * 0.6) * 3;
      ctx.drawImage(bs.c, Math.round(balloon.x - bs.w / 2 + ox), Math.round(by + oy));
    }
    if (flock) {
      var fb = spr('flockbird', Math.floor(T * 5 + flock.t) % 2);
      for (i = 0; i < flock.n; i++) {
        var k = Math.ceil(i / 2), fx = flock.x - flock.dir * k * 6, fy = flock.y + (i === 0 ? 0 : (i % 2 ? 1 : -1) * k * 3);
        ctx.drawImage(fb.c, Math.round(fx + ox), Math.round(fy + oy + Math.sin(T * 5 + i) * 0.8));
      }
    }
    if (shoot) {
      var a = clamp(1 - shoot.t / 1.6, 0, 1);
      ctx.globalAlpha = a; ctx.fillStyle = '#fff'; ctx.fillRect(Math.round(shoot.x + ox), Math.round(shoot.y + oy), 2, 2);
      ctx.globalAlpha = a * 0.5; var nx = Math.sign(shoot.vx), tx0 = shoot.x - nx * 3;
      for (i = 1; i < 7; i++) { ctx.fillRect(Math.round(tx0 - nx * i * 2 + ox), Math.round(shoot.y - i * 1.2 * (shoot.vy / Math.abs(shoot.vx)) + oy), 1, 1); }
      ctx.globalAlpha = 1;
    }
  }
  function tapSky(rx, ry, hr) {
    var today = ymd(new Date());
    if (shoot && Math.hypot(rx - shoot.x, ry - shoot.y) < Math.max(18, hr * 1.2)) {
      if (ST.starDate !== today) { ST.starDate = today; ST.diamonds++; save(); sCollect(); for (var s = 0; s < 4; s++) sparkles.push({ x: shoot.x + rnd(-6, 6), y: shoot.y + rnd(-4, 4), t: -s * 0.08 }); sayAt(goose, pick(LINES.sky.wish), { noCount: true, dur: 6 }); }
      shoot = null; return true;
    }
    if (balloon) {
      var by = balloon.y + Math.sin(balloon.t * 0.6) * 3;
      if (Math.hypot(rx - balloon.x, ry - (by + 8)) < Math.max(16, hr * 1.1)) {
        if (ST.balloonDate !== today) { ST.balloonDate = today; save(); dropGift(clamp(balloon.x, 20, sw - 20), 186); sayAt(goose, pick(LINES.sky.balloon), { noCount: true, dur: 6 }); }
        else if (T > speakCool) { speakCool = T + 6; sayAt(goose, pick(LINES.sky.balloonAgain), { noCount: true, dur: 4 }); }
        hearts.push({ x: balloon.x, y: by + 6, t: 0 }); return true;
      }
    }
    if (flock) {
      for (var i = 0; i < flock.n; i++) {
        var k = Math.ceil(i / 2), fx = flock.x - flock.dir * k * 6, fy = flock.y + (i === 0 ? 0 : (i % 2 ? 1 : -1) * k * 3);
        if (Math.hypot(rx - fx, ry - fy) < Math.max(14, hr)) {
          sHonk(); hearts.push({ x: fx, y: fy - 4, t: 0 });
          if (T > speakCool) { speakCool = T + 6; sayAt(goose, pick(LINES.sky.flock), { noCount: true, dur: 4 }); }
          return true;
        }
      }
    }
    return false;
  }

  /* ---------- the boat trip, from the pond side ---------- */
  var scene = 'pond', fadeA = 0, fadeDir = 0, fadeCb = null, trip = null;
  function doFade(cb) { fadeDir = 1; fadeCb = cb; }
  function updateFade(dt) {
    if (fadeDir === 0) return;
    fadeA = clamp(fadeA + fadeDir * dt * 3.2, 0, 1);
    if (fadeDir === 1 && fadeA >= 1) { fadeDir = -1; var cb = fadeCb; fadeCb = null; if (cb) cb(); }
    else if (fadeDir === -1 && fadeA <= 0) fadeDir = 0;
  }
  function drawFade() {
    if (fadeA <= 0.01) return;
    ctx.fillStyle = 'rgba(8,12,30,' + fadeA.toFixed(3) + ')'; ctx.fillRect(0, 0, lw, lh);
  }
  function present() {
    vctx.clearRect(0, 0, cv.width, cv.height);
    vctx.drawImage(lc, 0, 0, lw, lh, 0, 0, lw * pxK, lh * pxK);
  }
  var tripQueued = false;
  function askRow() {
    if (!ST.boat || trip || scene !== 'pond' || finale) return;
    if (talk) closeTalk();
    showBubble({ text: LINES.forest.rowAsk }, { noCount: true, dur: 14, actions: [{ label: LINES.ui.go, fn: startTrip }, { label: LINES.ui.later }] });
  }
  function startTrip() {
    if (trip || scene !== 'pond' || finale || fadeDir !== 0 || june.fading) return;
    if (building) { tripQueued = true; sayAt(goose, LINES.boat.busy, { noCount: true, dur: 5 }); return; }   // wait until he has finished building
    tripQueued = false;
    if (smores) { smores = null; goose.placing = false; }
    releasePending(); hideBubble();
    trip = { phase: 'walk', t: 0, by: BANK_Y - 3 };
    var m = june.mode;
    if (m === 'hutSleep' || m === 'walkBack' || m === 'walkOut') { june.wx = L.hutCX; june.wy = 182; }
    else if (!juneAway()) { june.wx = L.juneL + 8; june.wy = 182; }
    june.fdir = june.wx < L.boatX ? 1 : -1; june.mode = 'tripWalk'; june.nap = 0; june.fading = false;
  }
  function tripBoard() {
    june.mode = 'tripBoat'; trip.phase = 'row'; trip.t = 0;
    goose.state = 'path'; goose.path = [{ x: L.boatX + 18, y: BANK_Y - 6, sp: 36 }, { x: L.boatX + 18, y: 104, sp: 30 }];
    goose.done = function () { goose.state = 'wait'; goose.t = 0; goose.wt = 99; goose.done = null; };
  }
  function updateTrip(dt) {
    if (tripQueued && !building && !trip && scene === 'pond' && !finale) startTrip();
    if (!trip || trip.phase !== 'row') return;
    trip.t += dt;
    var u = clamp(trip.t / 5, 0, 1), e = u * u * (3 - 2 * u);
    trip.by = lerp(BANK_Y - 3, 92, e);
    trip.rt = (trip.rt || 0) - dt;
    if (trip.rt <= 0) { trip.rt = 0.35; ripples.push({ x: L.boatX, y: trip.by + 3, t: 0, mini: true }); }
    if (u >= 1 && fadeDir === 0) doFade(function () { trip = null; enterForest(); });
  }
  function pxLine(x0, y0, x1, y1) {
    var dx = x1 - x0, dy = y1 - y0, n = Math.max(Math.abs(dx), Math.abs(dy), 1);
    for (var i = 0; i <= n; i++) ctx.fillRect(Math.round(x0 + dx * i / n), Math.round(y0 + dy * i / n), 1, 1);
  }
  function drawBoat(alpha) {
    var rowing = trip && trip.phase === 'row', by0 = rowing ? trip.by : BANK_Y - 3, bs = spr('boat', 0);
    var bx = Math.round(L.boatX - bs.w / 2 + ox), by = Math.round(by0 - bs.h + 3 + oy);
    if (alpha !== undefined && alpha < 1) ctx.globalAlpha = Math.max(0, alpha);
    if (rowing) {
      var jr = spr('june_row', 0), dr = spr('dog_row', Math.floor(T * 4) % 2 ? 0 : 0);
      ctx.drawImage(jr.f, bx + 4, by - jr.h + 5);
      ctx.drawImage(dr.f, bx + bs.w - dr.w - 2, by - dr.h + 5);
    }
    ctx.drawImage(bs.c, bx, by);
    ctx.globalAlpha = 1;
    if (rowing) {
      var ph = Math.sin(T * 3.4), px = bx + 11, py = by + 1;
      ctx.fillStyle = '#a8723f'; pxLine(px - 3, py - 5, px + ph * 4, py + 6);
      ctx.fillStyle = '#d9b38c'; pxLine(px + ph * 4, py + 6, px + ph * 6, py + 9);
      ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fillRect(Math.round(px + ph * 6) - 1, by + 10, 3, 1);
    }
  }

  /* ---------- the ingredient adventure: no ingredients? go and find them in the forest ---------- */
  function recipeById(id) { return Hut.RECIPES.filter(function (r) { return r.id === id; })[0]; }
  function questRecipe() { return ST.quest ? recipeById(ST.quest.id) : null; }
  function wantedItems() {
    var r = questRecipe(), w = {};
    if (r) for (var k in r.needs) if ((ST.inv[k] || 0) < r.needs[k]) w[k] = true;
    return w;
  }
  function updateQuestBar() {
    var bar = $('questBar'), r = questRecipe();
    if (!r || scene !== 'forest') { bar.style.display = 'none'; return; }
    bar.innerHTML = '';
    var t = document.createElement('div'); t.className = 'qtitle'; t.textContent = LINES.quest.title.replace('{x}', LINES.dishes[r.id]); bar.appendChild(t);
    var row = document.createElement('div'); row.className = 'qchips';
    Object.keys(r.needs).forEach(function (k) {
      var chip = document.createElement('span'), c2 = document.createElement('canvas'), b = document.createElement('b'), have = Math.min(ST.inv[k] || 0, r.needs[k]);
      c2.width = 12; c2.height = 12; paint(c2, k); chip.appendChild(c2); b.textContent = have + '/' + r.needs[k];
      if (have >= r.needs[k]) chip.className = 'got';
      chip.appendChild(b); row.appendChild(chip);
    });
    bar.appendChild(row); bar.style.display = 'block';
  }
  function startQuest(id) {
    var r = recipeById(id), k, any = false;
    if (!r) return;
    for (k in r.needs) if ((ST.inv[k] || 0) < r.needs[k]) any = true;
    if (!any) return;
    if (!ST.boat) { hutSay(LINES.quest.noBoat); return; }
    ST.quest = { id: id, stage: 'forest' }; save();
    hutSay(pick(LINES.quest.start));
    var rx = hutRx();
    hutWalk(rx + Hut.SPOTS.door.stand, function () { doFade(function () { leaveHut(); startTrip(); }); });
  }
  // the puppy hides the missing ingredients in the forest (and a few other things), in fresh places
  function applyQuest() {
    var r = questRecipe();
    if (!r || ST.quest.stage !== 'forest' || ST.quest.applied === ymd(new Date())) return;
    ST.quest.applied = ymd(new Date());
    var need = [], k, i;
    for (k in r.needs) for (i = (ST.inv[k] || 0); i < r.needs[k]; i++) need.push(k);
    if (!need.length) return;
    var ids = [], spots = {}, total = Math.min(world.spots.length, Math.max(6, need.length + 3));
    for (i = 0; i < world.spots.length; i++) ids.push(i);
    var picks = [];
    while (picks.length < total && ids.length) picks.push(ids.splice(Math.floor(Math.random() * ids.length), 1)[0]);
    picks.forEach(function (id, n) { spots[id] = n < need.length ? need[n] : wpick(Forest.FOREST_POOL); });
    ST.forest = { date: ymd(new Date()), spots: spots, found: {}, checked: {} }; save();
  }
  function questCheck() {
    var r = questRecipe();
    updateQuestBar();
    if (!r || ST.quest.stage !== 'forest' || !haveNeeds(r.needs)) return;
    ST.quest.stage = 'return'; save();
    bubAnchor = anchorOf(guideOf());
    showBubble({ text: LINES.quest.done.replace('{x}', LINES.dishes[r.id]) }, { noCount: true, dur: 20, actions: [
      { label: LINES.ui.rowHome, fn: function () { doFade(leaveForest); } }, { label: LINES.ui.stay }
    ] });
  }

  /* ---------- the forest, seen from above ---------- */
  var fw = 360, fh = 480, world = null, nav = null, cam = { x: 0, y: 0 }, fbg = document.createElement('canvas'), fbgDirty = true;
  var spotSpr = Forest.makeSpots(SPR.outlined);
  var fj = { x: 0, y: 0, dir: 'n', path: null, cb: null, mv: false, trail: [], hold: 0, topH: 16, startle: 0 };
  var fd = { x: 0, y: 0, dir: 'n', path: null, job: null, mv: false, hop: 0, topH: 12 };
  var fg = { x: 0, y: 0, dir: 'n', path: null, job: null, mv: false, joined: false, topH: 14 };
  var snakes = [], frogs = [], squirrels = [], glints = {}, fpops = [], leaves = [], guideT = 20, chirpT = 3, vigC = null, vigKey = '';
  function anchorOf(e) {
    if (!e._a) e._a = { get x() { return e.x - cam.x - ox; }, get y() { return e.y - cam.y - oy; }, get topH() { return e.topH; } };
    return e._a;
  }
  function sayAt(e, text, opts) { bubAnchor = scene === 'forest' && e !== goose ? anchorOf(e) : scene === 'hut' ? anchorH(e) : e; showBubble({ text: text }, opts || { noCount: true }); }
  function rebuildForest() {
    fw = Math.max(360, lw + 24); fh = Math.max(480, lh + 24);
    world = Forest.build(fw, fh); nav = Forest.makeNav(world); fbgDirty = true;
    if (scene === 'forest') { fj.x = world.landing.x; fj.y = world.landing.y; fj.path = null; fj.trail = []; }
  }
  function fsp(wx, wy, delay) { sparkles.push({ x: wx - cam.x - ox, y: wy - cam.y - oy, t: delay || 0 }); }
  function fheart(wx, wy, delay) { hearts.push({ x: wx - cam.x - ox, y: wy - cam.y - oy, t: delay || 0 }); }
  function ensureForest() {
    var today = ymd(new Date()), f = ST.forest;
    if (f.date === today && f.spots) return;
    var r = mulberry(hashStr('forest' + today)), ids = [], spots = {}, i;
    for (i = 0; i < world.spots.length; i++) ids.push(i);
    for (i = 0; i < 6; i++) { var j = Math.floor(r() * ids.length), id = ids.splice(j, 1)[0]; spots[id] = wpick(Forest.FOREST_POOL, r); }
    ST.forest = { date: today, spots: spots, found: {}, checked: {} }; save();
  }
  function randFree(minD) {
    for (var i = 0; i < 80; i++) {
      var x = rnd(14, fw - 14), y = rnd(14, world.shoreY - 10);
      if (!nav.blockedAt(x, y) && Math.hypot(x - fj.x, y - fj.y) > (minD || 0)) return { x: x, y: y };
    }
    return { x: world.landing.x, y: world.landing.y - 20 };
  }
  function initCritters() {
    var i, p;
    snakes = []; frogs = []; squirrels = [];
    for (i = 0; i < 3; i++) {
      p = world.trailPts[Math.floor(Math.random() * world.trailPts.length)];
      var s = { x: p[0], y: p[1], a: rnd(0, 6.28), segs: [], flee: 0, wob: rnd(0, 6) };
      for (var k = 0; k < 11; k++) s.segs.push({ x: s.x, y: s.y });
      snakes.push(s);
    }
    for (i = 0; i < 4; i++) { p = randFree(30); frogs.push({ x: p.x, y: p.y, t: rnd(1, 3), hop: 0, fx: p.x, fy: p.y, tx: p.x, ty: p.y }); }
    for (i = 0; i < 3; i++) {
      var tr = world.trees[Math.floor(Math.random() * world.trees.length)];
      squirrels.push({ x: tr.x + tr.r * 0.9, y: tr.y + tr.r * 0.4, vis: true, t: rnd(2, 6), run: null, dir: 1 });
    }
    leaves = [];
    for (i = 0; i < 8; i++) leaves.push({ x: rnd(0, lw), y: rnd(0, lh), v: rnd(5, 11), s: rnd(0, 6) });
  }

  function enterForest() {
    scene = 'forest'; rebuildForest(); ensureForest(); applyQuest();
    var l0 = world.landing;
    fj.x = l0.x; fj.y = l0.y; fj.path = null; fj.cb = null; fj.trail = []; fj.dir = 'n'; fj.hold = 0;
    fd.x = l0.x + 8; fd.y = l0.y + 3; fd.path = null; fd.job = null; fd.dir = 'n';
    fg.joined = false; fg.path = null; fg.job = null; fg.dir = 'n'; fg.x = world.boat.x + 14; fg.y = world.boat.y - 4;
    initCritters(); glints = {}; guideT = 22;
    cam.x = clamp(fj.x - lw / 2, 0, fw - lw); cam.y = clamp(fj.y - lh / 2 + 10, 0, fh - lh);
    hideBubble();
    updateQuestBar();
    setTimeout(function () { if (scene === 'forest') askJoin(); }, 800);
  }
  function askJoin() {
    bubAnchor = anchorOf(fg);
    showBubble({ text: LINES.forest.join }, { noCount: true, dur: 120, actions: [
      { label: LINES.ui.joinYes, fn: function () { fg.joined = true; sayAt(fg, LINES.forest.joined); setTimeout(questCheck, 2500); } },
      { label: LINES.ui.joinNo, fn: function () { fg.joined = false; sayAt(fd, pick(LINES.forest.dogLead)); setTimeout(questCheck, 2500); sfx(function (t) { tone(800, t, 0.07, 'square', 0.04, 1100); }); } }
    ] });
  }
  function askHome() {
    bubAnchor = anchorOf(fj);
    showBubble({ text: LINES.forest.homeAsk }, { noCount: true, dur: 14, actions: [
      { label: LINES.ui.rowHome, fn: function () { doFade(leaveForest); } }, { label: LINES.ui.stay }
    ] });
  }
  function leaveForest() {
    scene = 'pond'; hideBubble(); bubAnchor = goose; updateQuestBar();
    june.mode = 'idle'; june.t = 0; june.strollAt = playTime + rnd(40, 80); june.wx = L.juneL + 8; june.wy = 182;
    goose.x = L.boatX + 18; goose.y = 112; goose.dir = -1; toIdle();
    dog.x = dogHome().x; dog.y = dogHome().y; dog.state = 'sit'; dog.wait = 4; dog.dig = null;
    sayAt(goose, ST.quest && ST.quest.stage === 'return' ? LINES.quest.home : LINES.forest.home);
  }

  /* walking */
  function setDir(e, dx, dy) { e.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'e' : 'w') : (dy > 0 ? 's' : 'n'); }
  function followPath(e, sp, dt) {
    e.mv = false;
    if (!e.path || !e.path.length) return true;
    var p = e.path[0], dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy), st = sp * dt;
    e.mv = true;
    if (d <= Math.max(0.6, st)) { e.x = p.x; e.y = p.y; e.path.shift(); return e.path.length === 0; }
    e.x += dx / d * st; e.y += dy / d * st; setDir(e, dx, dy);
    return false;
  }
  function walkTo(e, tx, ty) { e.path = nav.path(e.x, e.y, tx, ty); }
  function followTrail(e, gap, sp, dt) {
    var tl = fj.trail, idx = Math.min(tl.length - 1, Math.round(gap / 2)), t = idx >= 0 ? tl[idx] : { x: fj.x, y: fj.y };
    var dx = t.x - e.x, dy = t.y - e.y, d = Math.hypot(dx, dy);
    e.mv = false;
    if (d > 80) { e.x = t.x; e.y = t.y; return; }
    if (d > 1.6) { var st = Math.min(d, sp * dt); e.x += dx / d * st; e.y += dy / d * st; e.mv = true; setDir(e, dx, dy); }
    else if (!fj.mv) { e.dir = fj.dir; }
  }
  function spotHasItem(s) { var f = ST.forest; return !!f.spots[s.id] && !f.found[s.id]; }
  function guideOf() { return fg.joined ? fg : fd; }
  function guideTo(s) {
    var g = guideOf();
    g.job = { phase: 'go', spot: s, t: 0 };
    g.path = nav.path(g.x, g.y, s.x, s.y + 8);
  }
  function guidePing(e, j) {
    var s = j.spot;
    if (spotHasItem(s)) {
      glints[s.id] = 4;
      fsp(s.x, s.y - 6); fsp(s.x + 6, s.y - 10, -0.12);
      if (e === fg) sHonk();
      else { fheart(e.x, e.y - 10); sfx(function (t) { tone(800, t, 0.07, 'square', 0.04, 1100); tone(800, t + 0.12, 0.07, 'square', 0.04, 1100); }); e.hop = 0.5; }
    } else if (e === fd) e.hop = 0.25;
  }
  function updateGuide(e, dt) {
    var j = e.job;
    if (j.phase === 'go') { if (followPath(e, e === fg ? 46 : 44, dt)) { j.phase = 'point'; j.t = 0; guidePing(e, j); } }
    else { e.mv = false; j.t += dt; if (j.t > 2.2) e.job = null; }
  }
  function goSpot(s) {
    guideTo(s); guideT = 26;
    walkTo(fj, s.x, s.y + 9);
    fj.cb = function () { searchSpot(s); };
    if (!fj.path.length) { fj.path = null; fj.cb = null; searchSpot(s); }
  }
  function searchSpot(s) {
    var f = ST.forest;
    if (spotHasItem(s)) {
      f.found[s.id] = true; save(); delete glints[s.id];
      giveItem(f.spots[s.id], s.x - cam.x - ox, s.y - cam.y - oy - 8); wishEvent('forest');
      var left = Object.keys(f.spots).filter(function (k) { return !f.found[k]; }).length;
      if (questRecipe() && ST.quest.stage === 'forest') { questCheck(); if (ST.quest.stage === 'return') return; }
      if (left === 0) sayAt(guideOf(), LINES.forest.allFound, { noCount: true, dur: 8 });
      else if (Math.random() < 0.5) sayAt(guideOf(), pick(LINES.forest.found), { noCount: true, dur: 5 });
    } else {
      f.checked[s.id] = true;
      if (Math.random() < 0.4) sayAt(guideOf(), pick(LINES.forest.empty), { noCount: true, dur: 4 });
    }
  }
  function nearestUnfound() {
    var best = null, bd = 1e9;
    world.spots.forEach(function (s) { if (spotHasItem(s)) { var dd = Math.hypot(s.x - fj.x, s.y - fj.y); if (dd < bd) { bd = dd; best = s; } } });
    return best;
  }

  /* wildlife */
  function updateCritters(dt) {
    snakes.forEach(function (s) {
      s.wob += dt * 4;
      var dj = Math.hypot(s.x - fj.x, s.y - fj.y);
      if (dj < 20 && s.flee <= 0) { s.flee = 3; s.a = Math.atan2(s.y - fj.y, s.x - fj.x); }
      var sp = s.flee > 0 ? 24 : 7;
      if (s.flee > 0) s.flee -= dt; else s.a += (Math.random() - 0.5) * dt * 3;
      var nx = s.x + Math.cos(s.a) * sp * dt, ny = s.y + Math.sin(s.a) * sp * dt;
      if (nav.blockedAt(nx, ny)) s.a += 1.4 + Math.random(); else { s.x = nx; s.y = ny; }
      s.segs[0].x = s.x; s.segs[0].y = s.y;
      for (var i = 1; i < s.segs.length; i++) {
        var p = s.segs[i - 1], q = s.segs[i], d = Math.hypot(q.x - p.x, q.y - p.y);
        if (d > 2) { q.x = p.x + (q.x - p.x) / d * 2; q.y = p.y + (q.y - p.y) / d * 2; }
      }
      if (dj < 13 && fj.startle <= 0 && scene === 'forest') {
        fj.startle = 8; fj.hold = 1.1; fj.exclT = 1.1;
        sfx(function (t) { tone(1400, t, 0.12, 'sawtooth', 0.02, 700); });
        if (Math.random() < 0.7) sayAt(guideOf(), pick(LINES.forest.snake), { noCount: true, dur: 4 });
      }
    });
    fj.startle -= dt; if (fj.exclT > 0) fj.exclT -= dt;
    frogs.forEach(function (f) {
      f.t -= dt;
      if (f.hop > 0) { f.hop += dt; if (f.hop >= 0.35) { f.hop = 0; f.x = f.tx; f.y = f.ty; } else { var u = f.hop / 0.35; f.x = lerp(f.fx, f.tx, u); f.y = lerp(f.fy, f.ty, u); } return; }
      var near = Math.hypot(f.x - fj.x, f.y - fj.y) < 16;
      if (f.t <= 0 || near) {
        f.t = rnd(2, 5); var a = near ? Math.atan2(f.y - fj.y, f.x - fj.x) : rnd(0, 6.28), d = rnd(6, 14), tx = f.x + Math.cos(a) * d, ty = f.y + Math.sin(a) * d;
        if (!nav.blockedAt(tx, ty)) { f.fx = f.x; f.fy = f.y; f.tx = tx; f.ty = ty; f.hop = 0.001; }
      }
    });
    squirrels.forEach(function (q) {
      q.t -= dt;
      if (!q.vis) { if (q.t <= 0) { var p = randFree(40); q.x = p.x; q.y = p.y; q.vis = true; q.t = rnd(4, 8); } return; }
      if (q.run) {
        var dx = q.run.x - q.x, dy = q.run.y - q.y, d = Math.hypot(dx, dy), st = 38 * dt;
        q.dir = dx < 0 ? -1 : 1;
        if (d <= st) { q.vis = false; q.run = null; q.t = rnd(6, 12); } else { q.x += dx / d * st; q.y += dy / d * st; }
        return;
      }
      if (Math.hypot(q.x - fj.x, q.y - fj.y) < 22) {
        var best = null, bd = 1e9;
        world.trees.forEach(function (t) { var dd = Math.hypot(t.x - q.x, t.y - q.y); if (dd > 6 && dd < bd && dd < 60) { bd = dd; best = t; } });
        q.run = best ? { x: best.x, y: best.y } : { x: q.x + rnd(-30, 30), y: q.y + rnd(-30, 30) };
      }
    });
    for (var i = 0; i < leaves.length; i++) { var lf = leaves[i]; lf.y += lf.v * dt; lf.x += Math.sin(T * 1.3 + lf.s) * 6 * dt; if (lf.y > lh + 3) { lf.y = -3; lf.x = rnd(0, lw); } }
  }

  function updateForest(dt) {
    if (fj.hold > 0) { fj.hold -= dt; fj.mv = false; }
    else if (fj.path && fj.path.length) {
      var px = fj.x, py = fj.y, done = followPath(fj, 34, dt);
      if (Math.hypot(fj.x - px, fj.y - py) > 0) {
        var tl = fj.trail, last = tl[0];
        if (!last || Math.hypot(fj.x - last.x, fj.y - last.y) >= 2) { tl.unshift({ x: fj.x, y: fj.y }); if (tl.length > 40) tl.pop(); }
      }
      if (done) { fj.path = null; var cb = fj.cb; fj.cb = null; if (cb) cb(); }
    } else fj.mv = false;
    if (fg.joined) { if (fg.job) updateGuide(fg, dt); else followTrail(fg, 20, 40, dt); }
    else { fg.mv = false; fg.x = world.boat.x + 14 + Math.sin(T) * 1.2; fg.y = world.boat.y - 4; fg.dir = 'n'; }
    if (!fg.joined && fd.job) updateGuide(fd, dt); else { fd.job = null; followTrail(fd, 9, 46, dt); }
    if (fd.hop > 0) fd.hop -= dt;
    updateCritters(dt);
    guideT -= dt;
    if (guideT <= 0 && !fj.path && !guideOf().job && !bub.on) { guideT = rnd(22, 34); var s = nearestUnfound(); if (s) guideTo(s); }
    Object.keys(glints).forEach(function (k) { glints[k] -= dt; if (glints[k] <= 0) delete glints[k]; });
    // camera follows June
    var tx = clamp(fj.x - lw / 2, 0, fw - lw), ty = clamp(fj.y - lh / 2 + 10, 0, fh - lh), k2 = 1 - Math.pow(0.002, dt);
    cam.x += (tx - cam.x) * k2; cam.y += (ty - cam.y) * k2;
  }
  function onForestDown(wx, wy, hr) {
    if (Math.hypot(wx - world.landing.x, wy - world.shoreY - 6) < Math.max(20, hr) || Math.hypot(wx - world.boat.x, wy - world.boat.y) < Math.max(16, hr)) { askHome(); return; }
    if (Math.hypot(wx - fd.x, wy - (fd.y - 4)) < Math.max(10, hr)) {
      fd.hop = 0.5; fheart(fd.x - 3, fd.y - 8); fheart(fd.x + 3, fd.y - 11, -0.15);
      sfx(function (t) { tone(900, t, 0.07, 'square', 0.04, 1300); tone(1000, t + 0.1, 0.08, 'square', 0.04, 1400); });
      return;
    }
    if (fg.joined && Math.hypot(wx - fg.x, wy - (fg.y - 4)) < Math.max(11, hr)) { fsp(fg.x, fg.y - 10); sHonk(); return; }
    var best = null, bd = 1e9;
    world.spots.forEach(function (s) { var dd = Math.hypot(wx - s.x, wy - s.y); if (dd < Math.max(15, hr) && dd < bd) { bd = dd; best = s; } });
    if (best) { goSpot(best); return; }
    for (var i = 0; i < snakes.length; i++) {
      var sn = snakes[i];
      if (Math.hypot(wx - sn.x, wy - sn.y) < Math.max(12, hr)) { sn.flee = 3; sn.a = Math.atan2(sn.y - fj.y, sn.x - fj.x); fd.hop = 0.4; sfx(function (t) { tone(800, t, 0.07, 'square', 0.04, 1000); }); return; }
    }
    walkTo(fj, clamp(wx, 8, fw - 8), Math.min(wy, world.shoreY + 6)); fj.cb = null;
    if (fj.path && !fj.path.length) fj.path = null;
  }

  /* drawing the forest */
  function shadow(x, y, w) { ctx.globalAlpha = 0.28; ctx.fillStyle = '#001408'; ctx.fillRect(Math.round(x - w / 2), Math.round(y), w, 2); ctx.globalAlpha = 1; }
  function drawSnake(s, cx, cy) {
    var i, n = s.segs.length;
    for (i = n - 1; i >= 0; i--) {
      var q = s.segs[i], off = Math.sin(s.wob + i * 0.8) * 0.8;
      ctx.fillStyle = i === 0 ? '#2f5a2a' : (i % 3 === 0 ? '#7ab648' : '#4a8a3f');
      var sz = i === 0 ? 3 : (i > n - 3 ? 1 : 2);
      ctx.fillRect(Math.round(q.x - cx + off - sz / 2), Math.round(q.y - cy - sz / 2), sz, sz);
    }
    ctx.fillStyle = '#e04848'; if (Math.floor(T * 1.3 + s.wob) % 3 === 0) ctx.fillRect(Math.round(s.x - cx + Math.cos(s.a) * 3), Math.round(s.y - cy + Math.sin(s.a) * 3), 1, 1);
  }
  function renderForest() {
    if (fbgDirty) { fbg.width = fw; fbg.height = fh; Forest.paintWorld(fbg.getContext('2d'), world, cur); fbgDirty = false; }
    var cx = Math.round(cam.x), cy = Math.round(cam.y), items = [], i;
    ctx.drawImage(fbg, cx, cy, lw, lh, 0, 0, lw, lh);
    world.spots.forEach(function (s) {
      var d = spotSpr[s.type];
      items.push({ y: s.y, f: function () {
        ctx.drawImage(d.c, Math.round(s.x - cx - d.w / 2), Math.round(s.y - cy - d.h / 2));
        if (glints[s.id] && Math.floor(T * 4) % 2) { var sp0 = spr('sparkle', 1); ctx.drawImage(sp0.c, Math.round(s.x - cx - 2), Math.round(s.y - cy - d.h / 2 - 5)); }
      } });
    });
    snakes.forEach(function (s) { items.push({ y: s.y, f: function () { drawSnake(s, cx, cy); } }); });
    frogs.forEach(function (f) {
      var hopY = f.hop > 0 ? Math.sin(f.hop / 0.35 * Math.PI) * 4 : 0;
      items.push({ y: f.y, f: function () { shadow(f.x - cx, f.y - cy + 1, 4); ctx.drawImage(Forest.FROG, Math.round(f.x - cx - 3), Math.round(f.y - cy - 3 - hopY)); } });
    });
    squirrels.forEach(function (q) {
      if (!q.vis) return;
      items.push({ y: q.y, f: function () {
        var c = Forest.SQUIRREL; shadow(q.x - cx, q.y - cy + 2, 6);
        if (q.dir < 0) { ctx.save(); ctx.translate(Math.round(q.x - cx + 4), Math.round(q.y - cy - 3)); ctx.scale(-1, 1); ctx.drawImage(c, 0, 0); ctx.restore(); }
        else ctx.drawImage(c, Math.round(q.x - cx - 4), Math.round(q.y - cy - 3));
      } });
    });
    function actor(e, kind, opt) {
      items.push({ y: e.y, f: function () {
        var c = Forest.tdSprite(kind, e.mv ? Math.floor(T * 6) % 2 : 0, e.dir, opt);
        var hop = e.hop > 0 ? Math.abs(Math.sin(e.hop / 0.5 * Math.PI * 2)) * 3 : 0;
        shadow(e.x - cx, e.y - cy + c.height * 0.2, c.width - 2);
        ctx.drawImage(c, Math.round(e.x - cx - c.width / 2), Math.round(e.y - cy - c.height * 0.55 - hop));
        if (kind === 'june' && fj.exclT > 0) ctx.drawImage(Forest.EXCL, Math.round(e.x - cx - 1), Math.round(e.y - cy - 15));
      } });
    }
    actor(fj, 'june'); actor(fd, 'dog'); actor(fg, 'goose', { stage: clamp(ST.stage | 0, 0, 2), hat: hasHat() });
    items.sort(function (p, q) { return p.y - q.y; });
    for (i = 0; i < items.length; i++) items[i].f();
    // drifting leaves, sunbeams, shade at the edges, and the time of day
    ctx.fillStyle = '#c8873a';
    for (i = 0; i < leaves.length; i++) ctx.fillRect(Math.round(leaves[i].x), Math.round(leaves[i].y), 2, 1);
    if (cur.star < 0.4) {
      ctx.globalCompositeOperation = 'lighter';
      for (i = 0; i < 4; i++) {
        var bx = ((i * 83 + T * 3) % (lw + 80)) - 40, a = 0.05 + 0.025 * Math.sin(T * 0.6 + i);
        ctx.globalAlpha = a; ctx.fillStyle = '#fff2b0';
        ctx.beginPath(); ctx.moveTo(bx, 0); ctx.lineTo(bx + 14, 0); ctx.lineTo(bx + 54, lh); ctx.lineTo(bx + 36, lh); ctx.closePath(); ctx.fill();
      }
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    }
    var vk = lw + 'x' + lh;
    if (vigKey !== vk) {
      vigC = document.createElement('canvas'); vigC.width = lw; vigC.height = lh;
      var vg = vigC.getContext('2d'), gr = vg.createRadialGradient(lw / 2, lh / 2, Math.min(lw, lh) * 0.25, lw / 2, lh / 2, Math.max(lw, lh) * 0.7);
      gr.addColorStop(0, 'rgba(0,14,8,0)'); gr.addColorStop(1, 'rgba(0,14,8,0.5)'); vg.fillStyle = gr; vg.fillRect(0, 0, lw, lh); vigKey = vk;
    }
    ctx.drawImage(vigC, 0, 0);
    var tn = cur.tint;
    if (tn[3] > 0.005) { ctx.fillStyle = 'rgba(' + (tn[0] | 0) + ',' + (tn[1] | 0) + ',' + (tn[2] | 0) + ',' + tn[3].toFixed(3) + ')'; ctx.fillRect(0, 0, lw, lh); }
    if (cur.fly > 0.02) {
      for (i = 0; i < flies.length; i++) {
        var f = flies[i], tw = 0.5 + 0.5 * Math.sin(T * 2.4 + f.ph);
        ctx.globalAlpha = cur.fly * tw;
        ctx.drawImage(spr('firefly', tw > 0.55 ? 0 : 1).c, Math.round(f.x / sw * lw - 1), Math.round((f.y - 96) / 84 * lh - 1));
      }
      ctx.globalAlpha = 1;
    }
    for (i = 0; i < sparkles.length; i++) {
      var sp = sparkles[i]; if (sp.t < 0) continue;
      var ss = spr('sparkle', Math.min(2, Math.floor(sp.t / 0.27)));
      ctx.globalAlpha = clamp(1 - sp.t / 0.8, 0, 1); blit(ss, sp.x - Math.floor(ss.w / 2), sp.y - Math.floor(ss.h / 2));
    }
    for (i = 0; i < hearts.length; i++) {
      var ht = hearts[i]; if (ht.t < 0) continue;
      ctx.globalAlpha = clamp(1 - ht.t, 0, 1); { var hs0 = ht.note ? spr('note', 0) : spr('heart', 0); ctx.drawImage(hs0.c, Math.round(ht.x + ox - 3), Math.round(ht.y + oy), ht.note ? hs0.w : 6, ht.note ? hs0.h : 4); }
    }
    ctx.globalAlpha = 1;
    flyList.forEach(function (f2) {
      if (f2.t < 0) return;
      var u = f2.t / 0.7, e = u * u * (3 - 2 * u), fx = lerp(f2.sx, f2.ex, e), fy = lerp(f2.sy, f2.ey, e) - Math.sin(u * Math.PI) * f2.arc;
      var fs = f2.kind === 'diamond' ? spr('diamond', 0).c : itemCanvas(f2.id), sz = lerp(10, 5, e);
      ctx.drawImage(fs, Math.round(fx + ox - sz / 2), Math.round(fy + oy - sz / 2), Math.round(sz), Math.round(sz));
    });
  }
  function tickFx(dt) {
    var i;
    for (i = sparkles.length - 1; i >= 0; i--) { sparkles[i].t += dt; if (sparkles[i].t > 0.8) sparkles.splice(i, 1); }
    for (i = hearts.length - 1; i >= 0; i--) { hearts[i].t += dt; hearts[i].y -= 12 * dt; if (hearts[i].t > 1) hearts.splice(i, 1); }
    for (i = flyList.length - 1; i >= 0; i--) {
      var f = flyList[i]; f.t += dt;
      if (f.t >= 0.7) { flyList.splice(i, 1); var pb = $('pouchBtn'); pb.classList.remove('bump'); void pb.offsetWidth; pb.classList.add('bump'); }
    }
    if (cur.fly > 0.02) flies.forEach(function (f2) {
      f2.t -= dt;
      if (f2.t <= 0) { f2.t = rnd(0.6, 1.6); f2.vx = rnd(-8, 8); f2.vy = rnd(-5, 5); }
      f2.x += f2.vx * dt; f2.y += f2.vy * dt;
      if (f2.x < 0 || f2.x > sw) f2.vx = -f2.vx;
      if (f2.y < 96 || f2.y > 180) f2.vy = -f2.vy;
    });
    chirpT -= dt;
    if (chirpT <= 0) { chirpT = rnd(2.5, 6); if (!nightish()) sfx(function (t) { var b = rnd(2400, 3200); tone(b, t, 0.06, 'sine', 0.02, b * 1.25); tone(b * 1.1, t + 0.09, 0.05, 'sine', 0.02, b * 1.4); }); }
  }

  /* ---------- June outdoors: shadows, walking in every direction, sitting, jumping and dancing ---------- */
  function drawShadow(sx, sy, w) {
    ctx.globalAlpha = 0.28; ctx.fillStyle = '#001408';
    ctx.fillRect(Math.round(sx - (w - 2) / 2), Math.round(sy - 2), w - 2, 1); ctx.fillRect(Math.round(sx - w / 2), Math.round(sy - 1), w, 2);
    ctx.globalAlpha = 1;
  }
  function drawJuneAct(sx, sy, act, t, dir) { // sx = centre, sy = feet, both in screen units
    var fr, dy = 0, dx = 0, sh = 14;
    if (act === 'sit') {
      var blink = (t % 3.4) > 3.2, breathe = Math.floor(t * 1.1) % 2;
      fr = spr('june_sitf', blink ? 1 : (breathe ? 2 : 0));
    } else if (act === 'jump') {
      var p = t % 0.95;
      if (p < 0.14 || p > 0.8) fr = spr('june_jump', 0);
      else { fr = spr('june_jump', 1); dy = Math.sin(Math.PI * (p - 0.14) / 0.66) * 11; sh = Math.max(8, 14 - dy * 0.35); }
    } else {
      var beat = Math.floor(t * 6);
      fr = spr('june_dance', beat % 4); dx = Math.round(Math.sin(t * 6) * 1.5); dy = Math.abs(Math.sin(t * 6)) * 1.5;
    }
    drawShadow(sx + dx * 0.5, sy, sh);
    ctx.drawImage(fr.c, Math.round(sx - fr.w / 2 + dx), Math.round(sy - fr.h - dy));
  }
  var ACTS = { sit: 4.2, jump: 3.8, dance: 5.4 };
  // walking on the grass: side, front or back view depending on where she is heading, with a little bob
  function drawJuneWalk() {
    var still = june.mode === 'strollIdle' || june.mode === 'smoresRoast', sx = june.wx + ox, sy = june.wy + 3 + oy, fr, bob = 0, flip = false, k = Math.floor(T * 7) % 4;
    drawShadow(sx, sy, 12);
    if (!still && june.face === 'd') { fr = spr('june_front', k); bob = (k & 1) ? 1 : 0; }
    else if (!still && june.face === 'u') { fr = spr('june_back', k); bob = (k & 1) ? 1 : 0; }
    else if (still && june.mode === 'strollIdle') { fr = spr('june_front', 0); }
    else { var s2 = Math.floor(T * 6) % 2; fr = spr('june_walk', still ? 1 : s2); bob = !still && s2 ? 1 : 0; flip = june.fdir > 0; }
    ctx.drawImage(flip ? fr.f : fr.c, Math.round(sx - fr.w / 2), Math.round(sy - fr.h - bob));
  }

  /* ---------- tap the grass: June walks there and sits, jumps or dances ---------- */
  function grassGo(rx, ry) {
    var m = june.mode;
    if (scene !== 'pond' || juneAway() || (m !== 'idle' && m !== 'smile' && m !== 'wave') || talk || finale || trip || building || smores) return;
    releasePending();
    june.wx = L.juneL + 8; june.wy = 182; june.fdir = -1; june.vel = 0;
    june.target = { x: clamp(rx, 14 - ox * 0.7, sw - 14 + ox * 0.7), y: clamp(ry, 160, 194) };
    june.mode = 'grassWalk'; june.t = 0;
  }
  function startHutEnter() {
    var m = june.mode;
    if (scene !== 'pond' || juneAway() || (m !== 'idle' && m !== 'smile' && m !== 'wave') || talk || finale || trip || building || smores) return;
    releasePending(); hideBubble();
    june.wx = L.juneL + 8; june.wy = 182; june.fdir = -1; june.mode = 'hutEnter'; june.t = 0; june.fading = false; june.vel = 0;
  }

  /* ---------- inside the hut ---------- */
  var HW = 300, hcam = 0, hbg = document.createElement('canvas'), hbgDirty = true, furn = Hut.makeFurniture();
  var dishSpr = {};
  Object.keys(Hut.DISH).forEach(function (id) { dishSpr[id] = SPR.fromRows(Hut.DISH[id]); });
  var hj = { x: 0, dir: -1, mv: false, tx: 0, cb: null, mode: 'idle', t: 0, act: '', dur: 0, topH: 30, dish: '', phase: '', zT: 0 };
  var hd = { x: 0, dir: 1, mv: false, mode: 'sit', t: 0, topH: 14, hop: 0 };
  var puffs = [], steam = [], puffT = 0;
  var CHAIR_X = 154, STOVE_X = 202;
  function hutRx() { return Math.round((HW - Hut.ROOM_W) / 2); }
  function hutPeakY() { var ceilY = oy + Hut.CEIL; return ceilY - Math.max(18, Math.min(54, ceilY - 6)); }
  function rebuildHut() { HW = Math.max(300, lw); hbgDirty = true; }
  function anchorH(e) {
    if (!e._h) e._h = { get x() { return e.x - hcam - ox; }, get y() { return Hut.FLOOR; }, get topH() { return e.topH; } };
    return e._h;
  }
  function hsp(wx, wy, delay) { sparkles.push({ x: wx - hcam - ox, y: wy, t: delay || 0 }); }
  function hheart(wx, wy, delay, note) { hearts.push({ x: wx - hcam - ox, y: wy, t: delay || 0, note: !!note }); }
  function hutSay(text, who) { sayAt(who || hd, text, { noCount: true, dur: 5 }); }

  function enterHut() {
    scene = 'hut'; rebuildHut();
    var rx = hutRx();
    hj.x = rx + Hut.SPOTS.door.stand - 8; hj.dir = -1; hj.mode = 'idle'; hj.tx = hj.x; hj.cb = null; hj.t = 0; hj.mv = false; hj.dish = '';
    hd.x = hj.x + 12; hd.dir = -1; hd.mode = 'sit';
    hcam = clamp(hj.x - lw / 2, 0, HW - lw);
    hideBubble(); bubAnchor = anchorH(hd);
    setTimeout(function () {
      if (scene !== 'hut') return;
      var r = questRecipe();
      if (r && ST.quest.stage === 'return' && haveNeeds(r.needs)) {
        hutSay(LINES.quest.cookNow);
        setTimeout(function () { if (scene === 'hut') hutWalk(hutRx() + STOVE_X, function () { hj.dir = 1; openCook(); }); }, 1500);
      } else hutSay(pick(LINES.hut.enter));
    }, 700);
  }
  function leaveHut() {
    $('cookOverlay').classList.remove('open');
    scene = 'pond'; hideBubble(); bubAnchor = goose;
    june.mode = 'idle'; june.t = 0; june.strollAt = playTime + rnd(30, 70); june.wx = L.juneL + 8; june.wy = 182;
    dog.x = L.hutCX + 18; dog.y = 186; dog.state = 'sit'; dog.wait = 3; dog.dig = null; dog.trick = null;
  }
  function hutWalk(x, cb) {
    var rx = hutRx();
    hj.tx = clamp(x, rx + 10, rx + Hut.ROOM_W - 10); hj.cb = cb || null; hj.mode = 'walk'; hj.t = 0; hj.vel = 0;
    if (Math.abs(hj.tx - hj.x) < 1) { hj.mode = 'idle'; var c = hj.cb; hj.cb = null; if (c) c(); }
  }
  function hutAct(act) {
    hj.mode = 'act'; hj.act = act || pick(['sit', 'jump', 'dance']); hj.t = 0; hj.dur = ACTS[hj.act];
    if (hj.act === 'dance') wishEvent('dance');
    if (hj.act === 'jump') sfx(function (t) { tone(400, t, 0.08, 'sine', 0.04, 700); });
  }
  function hutLook(line, sec) { hj.mode = 'look'; hj.t = 0; hj.dur = sec || 2.6; hheart(hj.x, Hut.FLOOR - 30); if (line) hutSay(line); }

  function onHutDown(wx, wy) {
    var rx = hutRx(), lx = wx - rx, S = Hut.SPOTS;
    function inside(s) { return lx >= s.x0 && lx <= s.x1 && wy >= s.y0 - 6 && wy <= s.y1 + 8; }
    if (Math.hypot(wx - hd.x, wy - (Hut.FLOOR - 6)) < 14) { hd.hop = 0.5; hheart(hd.x, Hut.FLOOR - 16); hheart(hd.x + 4, Hut.FLOOR - 20, -0.15); sfx(function (t) { tone(900, t, 0.07, 'square', 0.04, 1300); tone(1000, t + 0.1, 0.08, 'square', 0.04, 1400); }); return; }
    if (hj.mode === 'sleep') { hj.mode = 'idle'; hj.t = 0; hj.x = rx + S.bed.stand; hutSay(LINES.hut.wake, hj); return; }
    if (hj.mode === 'cook' || hj.mode === 'eat') return;
    if (inside(S.door)) { hutWalk(rx + S.door.stand, function () { doFade(leaveHut); }); return; }
    if (inside(S.stove)) { hutWalk(rx + STOVE_X, function () { hj.dir = 1; openCook(); }); return; }
    if (inside(S.counter)) { hutWalk(rx + S.counter.stand, function () { hutLook(pick(LINES.hut.counter)); }); return; }
    if (inside(S.table) || (lx >= 146 && lx <= 162 && wy >= 148)) { hutWalk(rx + CHAIR_X, function () { hj.dir = 1; hj.mode = 'chair'; hj.t = 0; }); return; }
    if (inside(S.bed)) { hutWalk(rx + S.bed.stand, function () { hj.mode = 'sleep'; hj.t = 0; hj.zT = 0; hj.dir = -1; hutSay(pick(LINES.hut.bed)); }); return; }
    if (inside(S.shelf)) { hutWalk(rx + S.shelf.stand, function () { hj.dir = -1; hutLook(pick(LINES.hut.shelf).replace('{n}', ST.goodies.length)); }); return; }
    if (inside(S.window)) { hutWalk(rx + S.window.stand, function () { hj.dir = -1; hutLook(LINES.hut.window[slot]); }); return; }
    if (inside(S.plant)) { hutWalk(rx + S.plant.stand, function () { hutLook(pick(LINES.hut.plant)); }); return; }
    if (inside(S.picture)) { hutWalk(rx + S.picture.stand, function () { hutLook(pick(LINES.hut.picture)); }); return; }
    if (Math.abs(wx - hj.x) < 12 && wy > 140) { hutAct(); return; }
    if (wy > 100) { hutWalk(wx, function () { hutAct(); }); }
  }

  function updateHut(dt) {
    var rx = hutRx(), S = Hut.SPOTS;
    hj.t += dt; hd.t += dt; if (hd.hop > 0) hd.hop -= dt;
    if (hj.mode === 'walk') {
      var dx = hj.tx - hj.x;
      hj.vel = (hj.vel || 0) + (34 - (hj.vel || 0)) * Math.min(1, dt * 7);
      var st = Math.max(4, hj.vel) * dt;
      if (Math.abs(dx) <= st) { hj.x = hj.tx; hj.mv = false; hj.vel = 0; hj.mode = 'idle'; hj.t = 0; var cb = hj.cb; hj.cb = null; if (cb) cb(); }
      else { hj.x += Math.sign(dx) * st; hj.dir = dx < 0 ? -1 : 1; hj.mv = true; }
    } else hj.mv = false;
    if (hj.mode === 'act' && hj.t > hj.dur) { hj.mode = 'idle'; hj.t = 0; }
    if (hj.mode === 'act' && hj.act === 'dance' && Math.random() < dt * 3) hheart(hj.x + rnd(-10, 10), Hut.FLOOR - 26 - rnd(0, 10), 0, true);
    if (hj.mode === 'look' && hj.t > hj.dur) { hj.mode = 'idle'; hj.t = 0; }
    if (hj.mode === 'chair' && hj.t > 3.5) { hj.mode = 'idle'; hj.t = 0; }
    if (hj.mode === 'sleep') { hj.zT += dt; if (hj.zT > 1.2) { hj.zT = 0; zees.push({ x: rx + 18 - hcam - ox, y: Hut.FLOOR - 28, t: 0 }); } if (hj.t > 25) { hj.mode = 'idle'; hj.t = 0; } }
    if (hj.mode === 'cook') {
      steam.push({ x: rx + 219 + rnd(-2, 2), y: Hut.FLOOR - 28, t: 0 }); if (steam.length > 30) steam.shift();
      if (Math.floor(hj.t * 6) !== Math.floor((hj.t - dt) * 6)) sfx(function (t) { tone(rnd(900, 1500), t, 0.02, 'square', 0.01); });
      if (hj.t > 4.5) { hj.phase = 'carry'; hutWalk(rx + CHAIR_X, function () { hj.dir = 1; hj.mode = 'eat'; hj.t = 0; }); }
    }
    if (hj.mode === 'eat') {
      if (Math.random() < dt * 2) hsp(rx + 176, Hut.FLOOR - 24);
      if (hj.t > 5) finishCook();
    }
    // the puppy: curls up on its bed when June sleeps, otherwise tags along
    var dTarget = hj.mode === 'sleep' ? rx + S.dogbed.x0 + 11 : clamp(hj.x - hj.dir * 16, rx + 12, rx + Hut.ROOM_W - 12), dd = dTarget - hd.x;
    if (Math.abs(dd) > 3) { hd.x += Math.sign(dd) * 40 * dt; hd.dir = dd < 0 ? -1 : 1; hd.mv = true; hd.mode = 'walk'; }
    else { hd.mv = false; hd.mode = hj.mode === 'sleep' ? 'sleep' : 'sit'; if (hj.mode !== 'sleep' && !hj.mv) hd.dir = hj.dir; }
    puffT -= dt; if (puffT <= 0) { puffT = 1.1; puffs.push({ x: rx + 232, y: hutPeakY() + 2, t: 0 }); }
    var i;
    for (i = puffs.length - 1; i >= 0; i--) { puffs[i].t += dt; puffs[i].y -= 6 * dt; puffs[i].x += 3 * dt; if (puffs[i].t > 3.5) puffs.splice(i, 1); }
    for (i = steam.length - 1; i >= 0; i--) { steam[i].t += dt; steam[i].y -= 10 * dt; if (steam[i].t > 1.2) steam.splice(i, 1); }
    for (i = 0; i < clouds.length; i++) { clouds[i].x += clouds[i].sp * dt; if (clouds[i].x > lw + 4) clouds[i].x = -40; }
    var tx = clamp(hj.x - lw / 2, 0, HW - lw); hcam += (tx - hcam) * (1 - Math.pow(0.002, dt));
  }

  /* ---------- cooking ---------- */
  function openCook() {
    var list = $('cookList'); list.innerHTML = '';
    $('cookTitle').textContent = LINES.cook.title; $('cookNote').textContent = LINES.cook.note;
    var any = false;
    Hut.RECIPES.forEach(function (r) {
      var ok = haveNeeds(r.needs), row = document.createElement('div'), ic = document.createElement('canvas'), nm = document.createElement('div'), chips = document.createElement('div'), btn = document.createElement('button');
      any = any || ok;
      row.className = 'cookrow' + (ok ? '' : ' no');
      ic.width = 10; ic.height = 10; ic.getContext('2d').drawImage(dishSpr[r.id], 0, 0); ic.className = 'dishic';
      nm.className = 'dishname'; nm.textContent = LINES.dishes[r.id];
      chips.className = 'chips';
      Object.keys(r.needs).forEach(function (k) {
        var chip = document.createElement('span'), c2 = document.createElement('canvas');
        c2.width = 12; c2.height = 12; paint(c2, k); chip.appendChild(c2);
        var have = ST.inv[k] || 0, t = document.createElement('b'); t.textContent = Math.min(have, r.needs[k]) + '/' + r.needs[k]; if (have < r.needs[k]) t.className = 'low'; chip.appendChild(t); chips.appendChild(chip);
      });
      btn.type = 'button'; btn.textContent = ok ? LINES.ui.cook : LINES.ui.find;
      btn.addEventListener('click', function () { $('cookOverlay').classList.remove('open'); if (ok) startCook(r.id); else startQuest(r.id); });
      var mid = document.createElement('div'); mid.className = 'cookmid'; mid.appendChild(nm); mid.appendChild(chips);
      row.appendChild(ic); row.appendChild(mid); row.appendChild(btn); list.appendChild(row);
    });
    $('cookOverlay').classList.add('open');
    if (!any) hutSay(LINES.cook.none);
  }
  $('cookOverlay').addEventListener('click', function (e) { if (e.target === $('cookOverlay')) $('cookOverlay').classList.remove('open'); });
  function startCook(id) {
    var r = Hut.RECIPES.filter(function (x) { return x.id === id; })[0], k;
    if (!r || !haveNeeds(r.needs) || scene !== 'hut') return;
    for (k in r.needs) ST.inv[k] = Math.max(0, (ST.inv[k] || 0) - r.needs[k]);
    if (ST.quest && ST.quest.id === id) ST.quest = null;
    save();
    hj.dish = id; hj.mode = 'cook'; hj.t = 0; hj.dir = 1;
    hutSay(pick(LINES.cook.start));
  }
  function finishCook() {
    var id = hj.dish, rx = hutRx();
    hj.mode = 'idle'; hj.t = 0; hj.dish = '';
    for (var i = 0; i < 4; i++) hheart(rx + 170 + rnd(-10, 10), Hut.FLOOR - 28 - rnd(0, 10), -i * 0.1);
    sCollect(); wishEvent('cook');
    if (!ST.cooked[id]) { ST.cooked[id] = true; ST.diamonds++; save(); hutSay(LINES.cook.first, hd); }
    else hutSay(pick(LINES.cook.done), hd);
  }

  function renderHut() {
    var rx = hutRx(), S = Hut.SPOTS, F = furn, FL = Hut.FLOOR, cx = Math.round(hcam), i;
    if (hbgDirty) {
      hbg.width = HW; hbg.height = lh;
      Hut.paintRoom(hbg.getContext('2d'), { P: cur, HW: HW, lw: lw, lh: lh, oy: oy, rx: rx });
      hbgDirty = false;
    }
    ctx.drawImage(hbg, cx, 0, lw, lh, 0, 0, lw, lh);
    // drifting clouds above the roof
    var cs2 = cloudSet(), peak = hutPeakY();
    ctx.globalAlpha = clamp(1.05 - cur.star * 0.92, 0.14, 0.95);
    for (i = 0; i < clouds.length; i++) { var cy2 = 4 + (clouds[i].y * 7) % Math.max(8, peak - 22); ctx.drawImage(cs2[clouds[i].c], Math.round(clouds[i].x), Math.round(cy2)); }
    ctx.globalAlpha = 1;
    function put(f, x, y) { ctx.drawImage(f.c, Math.round(x - cx), Math.round(oy + y)); }
    for (i = 0; i < puffs.length; i++) { ctx.globalAlpha = clamp(0.5 - puffs[i].t / 7, 0, 0.5); ctx.fillStyle = '#e6e9ef'; var pz = 2 + Math.floor(puffs[i].t); ctx.fillRect(Math.round(puffs[i].x - cx), Math.round(puffs[i].y), pz, pz); }
    ctx.globalAlpha = 1;
    // wall things: picture, jars, the hat on its hook, and the shelf of everything she has found
    put(F.picture, rx + 173, 117); put(F.jars, rx + 212, FL - 52); put(F.hook, rx + 262, 126);
    if (hasHat()) ctx.drawImage(spr('goose_hat', 0).c, Math.round(rx + 260 - cx), Math.round(oy + 119));
    var bx = Math.round(rx + 16 - cx);
    Hut.SHELF_BOARDS.forEach(function (by) { ctx.fillStyle = '#7a4d28'; ctx.fillRect(bx, Math.round(oy + by), 72, 3); ctx.fillStyle = '#a8723f'; ctx.fillRect(bx, Math.round(oy + by), 72, 1); });
    GOODIES.forEach(function (d, gi) { if (has(d.id) && Hut.SHELF_SLOTS[gi]) ctx.drawImage(goodieSpr[d.id], Math.round(rx + Hut.SHELF_SLOTS[gi][0] - cx), Math.round(oy + Hut.SHELF_SLOTS[gi][1])); });
    // furniture, all sized for June
    put(F.rug, rx + 148, FL - 4); put(F.bed, rx + 10, FL - 18); put(F.plant, rx + 90, FL - 16); put(F.dogbed, rx + 128, FL - 8);
    put(F.lamp, rx + 70, FL - 28); put(F.stove, rx + 212, FL - 22); put(F.kettle, rx + 214, FL - 24); put(F.counter, rx + 240, FL - 17);
    put(F.chair, rx + 148, FL - 18);
    // the puppy
    var df = hd.mode === 'sleep' ? spr('dog_sleep', 0) : hd.mode === 'walk' ? spr('dog_walk', Math.floor(T * 6) % 2) : spr('dog_sit', Math.floor(T * 4) % 2);
    var dh = hd.hop > 0 ? Math.abs(Math.sin(hd.hop / 0.5 * Math.PI * 2)) * 4 : 0, dy0 = hd.mode === 'sleep' ? FL - 6 : FL + 1;
    if (hd.mode !== 'sleep') drawShadow(hd.x - cx, oy + FL + 1, 10);
    ctx.drawImage(hd.dir > 0 ? df.f : df.c, Math.round(hd.x - cx - df.w / 2), Math.round(oy + dy0 - df.h + 2 - dh));
    // June
    var jx = hj.x - cx, jf = oy + FL + 3, fr;
    if (hj.mode === 'sleep') { fr = spr('june_sleep', 0); ctx.drawImage(fr.c, Math.round(rx + 14 - cx), Math.round(oy + FL - 17)); }
    else if (hj.mode === 'act') drawJuneAct(jx, jf, hj.act, hj.t, hj.dir);
    else if (hj.mode === 'eat' || hj.mode === 'chair') {
      drawShadow(jx, jf, 14);
      fr = spr(hj.mode === 'eat' && Math.floor(hj.t * 1.5) % 2 ? 'june_smile' : 'june_idle', 0);
      ctx.drawImage(fr.f, Math.round(jx - fr.w / 2), Math.round(jf - fr.h));
    }
    else if (hj.mode === 'cook') { drawShadow(jx, jf, 12); fr = spr('june_toss', Math.floor(hj.t * 4) % 2); ctx.drawImage(hj.dir > 0 ? fr.f : fr.c, Math.round(jx - fr.w / 2), Math.round(jf - fr.h)); }
    else {
      var s2 = hj.mv ? Math.floor(T * 6) % 2 : 1;
      drawShadow(jx, jf, 12);
      fr = spr('june_walk', s2);
      ctx.drawImage(hj.dir > 0 ? fr.f : fr.c, Math.round(jx - fr.w / 2), Math.round(jf - fr.h - (hj.mv && s2 ? 1 : 0)));
      if (hj.phase === 'carry' && hj.dish && hj.mode === 'walk') ctx.drawImage(dishSpr[hj.dish], Math.round(jx - 5 + hj.dir * -6), Math.round(jf - fr.h + 8));
    }
    // the table is in front of whoever sits at it, and the dish sits on the table
    put(F.table, rx + 162, FL - 16);
    if (hj.mode === 'eat' && hj.dish) ctx.drawImage(dishSpr[hj.dish], Math.round(rx + 176 - cx), Math.round(oy + FL - 25));
    for (i = 0; i < steam.length; i++) { ctx.globalAlpha = clamp(0.7 - steam[i].t, 0, 0.7); ctx.fillStyle = '#fff'; ctx.fillRect(Math.round(steam[i].x - cx + Math.sin(steam[i].t * 6 + i) * 1.5), Math.round(steam[i].y), 2, 2); }
    ctx.globalAlpha = 1;
    // sunlight through the window by day, lamp and stove glow at night
    if (cur.star < 0.5) {
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.07 * (1 - cur.star * 2);
      ctx.fillStyle = '#fff2b0'; ctx.beginPath();
      ctx.moveTo(rx + S.window.x0 - cx, oy + S.window.y0 + 4); ctx.lineTo(rx + S.window.x1 - cx, oy + S.window.y0 + 4); ctx.lineTo(rx + S.window.x1 + 34 - cx, oy + FL); ctx.lineTo(rx + S.window.x0 + 18 - cx, oy + FL); ctx.closePath(); ctx.fill();
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    }
    var tn = cur.tint, ta = tn[3] * 0.5;
    if (ta > 0.005) { ctx.fillStyle = 'rgba(' + (tn[0] | 0) + ',' + (tn[1] | 0) + ',' + (tn[2] | 0) + ',' + ta.toFixed(3) + ')'; ctx.fillRect(0, 0, lw, lh); }
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = clamp(0.35 + cur.star * 0.45, 0, 0.85); ctx.drawImage(glowC, Math.round(rx + 75 - 24 - cx), Math.round(oy + FL - 52), 48, 48);
    if (hj.mode === 'cook') { ctx.globalAlpha = 0.55 + 0.15 * Math.sin(T * 10); ctx.drawImage(glowC, Math.round(rx + 224 - 22 - cx), Math.round(oy + FL - 34), 44, 34); }
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    for (i = 0; i < sparkles.length; i++) {
      var sp = sparkles[i]; if (sp.t < 0) continue;
      var ss = spr('sparkle', Math.min(2, Math.floor(sp.t / 0.27)));
      ctx.globalAlpha = clamp(1 - sp.t / 0.8, 0, 1); blit(ss, sp.x - Math.floor(ss.w / 2), sp.y - Math.floor(ss.h / 2));
    }
    for (i = 0; i < hearts.length; i++) {
      var ht = hearts[i]; if (ht.t < 0) continue;
      var hs = ht.note ? spr('note', 0) : spr('heart', 0);
      ctx.globalAlpha = clamp(1 - ht.t, 0, 1); ctx.drawImage(hs.c, Math.round(ht.x + ox - 3), Math.round(ht.y + oy), ht.note ? hs.w : 6, ht.note ? hs.h : 4);
    }
    for (i = 0; i < zees.length; i++) { var zz = zees[i]; ctx.globalAlpha = clamp(Math.min(zz.t * 2, (2.4 - zz.t) / 1.2), 0, 1); blit(spr('zee', 0), zz.x, zz.y); }
    ctx.globalAlpha = 1;
    flyList.forEach(function (f2) {
      if (f2.t < 0) return;
      var u = f2.t / 0.7, e = u * u * (3 - 2 * u), fx = lerp(f2.sx, f2.ex, e), fy = lerp(f2.sy, f2.ey, e) - Math.sin(u * Math.PI) * f2.arc;
      var fs2 = f2.kind === 'diamond' ? spr('diamond', 0).c : itemCanvas(f2.id), sz = lerp(10, 5, e);
      ctx.drawImage(fs2, Math.round(fx + ox - sz / 2), Math.round(fy + oy - sz / 2), Math.round(sz), Math.round(sz));
    });
  }
  function updateHutFx(dt) {
    for (var i = zees.length - 1; i >= 0; i--) { var z = zees[i]; z.t += dt; z.y -= 6 * dt; if (z.t > 2.4) zees.splice(i, 1); }
  }

  /* ---------- effects ---------- */
  function updateEffects(dt) {
    var i;
    for (i = ripples.length - 1; i >= 0; i--) { ripples[i].t += dt; if (ripples[i].t > 1.3) ripples.splice(i, 1); }
    for (i = sparkles.length - 1; i >= 0; i--) { sparkles[i].t += dt; if (sparkles[i].t > 0.8) sparkles.splice(i, 1); }
    for (i = zees.length - 1; i >= 0; i--) { var z = zees[i]; z.t += dt; z.y -= 6 * dt; z.x += Math.sin(z.t * 2) * 4 * dt; if (z.t > 2.4) zees.splice(i, 1); }
    ground.forEach(function (gd) { gd.fx -= dt; if (gd.fx <= 0) { gd.fx = rnd(2, 3.5); sparkles.push({ x: gd.x + rnd(-3, 3), y: gd.y - rnd(5, 9), t: 0 }); } });
    for (i = flyList.length - 1; i >= 0; i--) {
      var fl2 = flyList[i]; fl2.t += dt;
      if (fl2.t >= 0.7) {
        flyList.splice(i, 1);
        var pb = $('pouchBtn'); pb.classList.remove('bump'); void pb.offsetWidth; pb.classList.add('bump');
        if (fl2.kind === 'goodie') checkFinale();
      }
    }
    updateFinale(dt);
    updateDog(dt); updateFish(dt); updateStones(dt); updateMounds(dt); updateTrip(dt); updateBuild(dt); updateSmores(dt); updateBirds(dt); updateVisitor(dt); updateSky(dt);
    for (i = hearts.length - 1; i >= 0; i--) { hearts[i].t += dt; hearts[i].y -= 12 * dt; if (hearts[i].t > 1) hearts.splice(i, 1); }
    clouds.forEach(function (c) { c.x += c.sp * dt; if (c.x > lw + 4) c.x = -40; });
    bflies.forEach(function (f) {
      f.t -= dt;
      if (f.t <= 0) { f.t = rnd(0.4, 1.2); f.vx = rnd(-14, 14); f.vy = rnd(-9, 9); }
      f.x += f.vx * dt; f.y += f.vy * dt;
      if (f.x < 6 || f.x > sw - 6) f.vx = -f.vx;
      if (f.y < 150 || f.y > 192) f.vy = -f.vy;
    });
    var gm = Math.hypot(goose.x - (goose.lx || goose.x), goose.y - (goose.ly || goose.y));
    goose.lx = goose.x; goose.ly = goose.y; trailT -= dt;
    if (gm > 0.05 && goose.y <= BANK_Y && goose.state !== 'sleep' && trailT <= 0) { trailT = 0.32; ripples.push({ x: goose.x - goose.dir * 8, y: goose.y + 1, t: 0, mini: true }); }
    if (cur.fly > 0.02) flies.forEach(function (f) {
      f.t -= dt;
      if (f.t <= 0) { f.t = rnd(0.6, 1.6); f.vx = rnd(-8, 8); f.vy = rnd(-5, 5); }
      f.x += f.vx * dt; f.y += f.vy * dt;
      if (f.x < 0 || f.x > sw) f.vx = -f.vx;
      if (f.y < 96 || f.y > 180) f.vy = -f.vy;
    });
  }

  /* ---------- drawing ---------- */
  function gooseFrame() {
    var g = goose, water = g.y <= BANK_Y, k = Math.floor(T * 6);
    switch (g.state) {
      case 'sleep': return spr(gp('sleep'), Math.floor(T / 0.9) % 2);
      case 'wakeAnim': return [null, spr(gp('groggy'), 0), spr(gp('annoyed'), 0), spr(gp('confused'), Math.floor(T * 3) % 2), spr(gp('stretch'), 0)][g.variant];
      case 'wakeEnd': return g.t < 0.9 ? spr(gp('stretch'), 0) : spr(gp('honk'), Math.floor(T * 5) % 2);
      case 'eat': return spr(gp('eat'), Math.floor(g.t * 4) % 2);
      case 'honk': return spr(gp('honk'), g.t < 0.5 ? 0 : 1);
    }
    if (g.placing && g.state === 'wait') return spr(gp('eat'), 0);
    if (water) return (hungerLevel() >= 2 && g.state === 'idle') ? spr(gp('groggy'), 0) : spr(gp('swim'), Math.floor(T * 2.5) % 2);
    if (g.state === 'path') return spr(gp('waddle'), k % 2);
    return spr(gp('stand'), 0);
  }
  function drawGoose() {
    var g = goose, fr = gooseFrame(), water = g.y <= BANK_Y, flipX = g.dir < 0;
    var h = water ? Math.min(fr.h, fr.wl || 13) : fr.h, HAT = spr(gp('hat'), 0);
    var bob = water && g.state !== 'eat' ? (Math.sin(T * 2.2) > 0.6 ? -1 : 0) : 0;
    var top = Math.round(g.y - h + bob), left = Math.round(g.x - fr.w / 2);
    g.topH = h + 5;
    ctx.drawImage(flipX ? fr.f : fr.c, 0, 0, fr.w, h, left + ox, top + oy, fr.w, h);
    if (hasHat() && fr.hat) {
      var hx = flipX ? fr.w - fr.hat[0] - HAT.w : fr.hat[0];
      ctx.drawImage(flipX ? HAT.f : HAT.c, left + hx + ox, top + fr.hat[1] + oy);
    }
    if (goose.carry) { var cs = goodieSprO[goose.carry]; ctx.drawImage(cs, Math.round(g.x + g.dir * 11 - 6 + ox), Math.round(top + 2 + oy)); }
    if (g.state === 'wakeAnim' && g.variant === 3) {
      var qm = spr('qmark', 0); ctx.drawImage(qm.c, Math.round(g.x + g.dir * 3 - 2 + ox), Math.round(top - 9 + oy));
    }
    if (water) {
      ctx.fillStyle = rgb(mixc(cur.wD, cur.wL, 0.4)); ctx.globalAlpha = 0.7;
      var hw = Math.round(fr.w * 0.55);
      ctx.fillRect(Math.round(g.x - hw + ox), Math.round(g.y - 1 + oy), hw * 2, 3);
      ctx.globalAlpha = 0.5; ctx.fillStyle = '#fff';
      ctx.fillRect(Math.round(g.x - 11 + ox + Math.sin(T * 3) * 1), Math.round(g.y + 1 + oy), 6, 1);
      ctx.fillRect(Math.round(g.x + 5 + ox), Math.round(g.y + oy), 6, 1);
      ctx.globalAlpha = 1;
    }
  }

  var PADS = [[0.22, 0.2], [0.7, 0.05], [0.46, 0.7], [0.88, 0.55], [0.1, 0.8]];
  var REEDS = [[0.05, 148], [0.1, 150], [0.95, 149], [0.9, 150], [0.33, 90], [0.64, 89], [0.82, 91]];

  function render() {
    if (scene === 'forest') { renderForest(); drawFade(); present(); return; }
    if (scene === 'hut') { renderHut(); drawFade(); present(); return; }
    if (bgDirty) renderBG();
    ctx.drawImage(bg, 0, 0);
    var i, a;
    if (cur.star > 0.02) {
      ctx.fillStyle = '#fff';
      for (i = 0; i < stars.length; i++) {
        var s = stars[i]; a = cur.star * (0.45 + 0.55 * Math.sin(T * s.sp + s.ph));
        if (a <= 0) continue;
        ctx.globalAlpha = Math.min(1, a);
        if (s.big) { ctx.drawImage(spr('star', 0).c, s.x - 1, s.y - 1); } else ctx.fillRect(s.x, s.y, 1, 1);
      }
      var moon = spr('moon', 0), mx = ox + Math.round(sw * 0.78), my = oy + 18;
      ctx.globalAlpha = clamp((cur.star - 0.2) / 0.8, 0, 1);
      ctx.drawImage(moon.c, mx, my);
      ctx.fillStyle = '#fff3c4';
      for (i = 0; i < 7; i++) { ctx.globalAlpha *= 0.82; ctx.fillRect(mx + 3 + (i % 2) * 2 + Math.round(Math.sin(T + i)), oy + 90 + i * 7, 5 - (i % 3), 1); }
      ctx.globalAlpha = 1;
    }
    if (cur.star > 0.75 && oy > 20) {
      ctx.globalCompositeOperation = 'lighter';
      for (var ax = 0; ax < lw; ax += 3) {
        var ay = 8 + oy * 0.3 + Math.sin(ax * 0.045 + T * 0.35) * 7 + Math.sin(ax * 0.02 + T * 0.2) * 5;
        ctx.globalAlpha = (0.05 + 0.04 * Math.sin(ax * 0.03 + T * 0.5)) * clamp((cur.star - 0.75) * 4, 0, 1);
        ctx.fillStyle = (ax / 3) % 2 ? '#5affb0' : '#7affd8'; ctx.fillRect(ax, ay, 3, 22 + Math.sin(ax * 0.05 + T * 0.4) * 6);
      }
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    }
    var sunU = (hourF - 6) / 12.5, sunA = clamp(Math.sin(Math.PI * sunU) * 2, 0, 1) * clamp(1 - cur.star * 1.5, 0, 1);
    if (sunU > 0 && sunU < 1 && sunA > 0.02) {
      var sx = ox + sw * (0.12 + 0.76 * sunU), sy = oy + 52 - 40 * Math.sin(Math.PI * sunU);
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.4 * sunA; ctx.drawImage(glowC, sx - 26, sy - 26, 52, 52);
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = sunA; ctx.drawImage(SUNC, Math.round(sx - 6), Math.round(sy - 6));
    }
    var cs2 = cloudSet(), cA = clamp(1.05 - cur.star * 0.92, 0.14, 0.95);
    ctx.globalAlpha = cA;
    for (i = 0; i < clouds.length; i++) ctx.drawImage(cs2[clouds[i].c], Math.round(clouds[i].x), Math.round(clouds[i].y));
    ctx.globalAlpha = 1;
    drawSkyLife();
    for (i = 0; i < shimmer.length; i++) {
      var sh = shimmer[i]; a = 0.12 + 0.16 * Math.max(0, Math.sin(T * 1.2 + sh.ph));
      if (cur.star > 0.5) a *= 0.5;
      ctx.globalAlpha = a; ctx.fillStyle = '#fff'; ctx.fillRect(Math.round(sh.x + Math.sin(T * 0.4 + sh.ph) * 2), Math.round(sh.y), sh.w, 1);
    }
    ctx.globalAlpha = 1;

    drawFish();
    for (i = 0; i < PADS.length; i++) {
      var px = PADS[i][0] * sw, py = 94 + PADS[i][1] * 50, bobp = Math.sin(T * 0.7 + i) > 0.8 ? 1 : 0;
      blit(spr('pad', 0), px - 5, py + bobp);
      if (i === 1 || i === 3) blit(spr('padflower', 0), px - 2, py - 3 + bobp);
    }
    extras.pads.forEach(function (pd, pi) { blit(spr('pad', 0), pd.x - 5, pd.y + (Math.sin(T * 0.7 + pi) > 0.8 ? 1 : 0)); });
    extras.reeds.forEach(function (rd, ri) { blit(spr('reed', Math.sin(T * 1.1 + ri * 1.7) > 0.2 ? 1 : 0), rd.x - 4, rd.y - 16); });
    for (i = 0; i < REEDS.length; i++) {
      var rp = REEDS[i];
      blit(spr('reed', Math.sin(T * 1.1 + i * 1.7) > 0.2 ? 1 : 0), rp[0] * sw - 4, rp[1] - 16);
    }
    for (i = 0; i < ripples.length; i++) {
      var rr = ripples[i], fi = Math.min(rr.mini ? 1 : 2, Math.floor(rr.t / 0.4)), rs = spr('ripple', fi);
      ctx.globalAlpha = clamp(1 - rr.t / 1.3, 0, 0.8) * (rr.mini ? 0.55 : 1);
      blit(rs, rr.x - rs.w / 2, rr.y - rs.h / 2);
    }
    ctx.globalAlpha = 1;
    for (i = 0; i < breads.length; i++) {
      var b = breads[i];
      if (b.state === 'fly' && b.t < 0) continue;
      blitO(spr('bread', 0), b.x - 3, b.y - 2 + (b.state === 'float' ? (Math.sin(T * 2 + i) > 0.5 ? 1 : 0) : 0));
    }

    var items = [];
    items.push({ y: L.lampY, f: function () { blitO(spr('lamp', 0), L.lampX - 3, L.lampY - 25); } });
    items.push({ y: L.benchY, f: function () {
      blitO(spr('bench', 0), L.benchL, L.benchY - 14);
      if (!juneAway()) blitO(juneFrame(), L.juneL, L.juneT);
    } });
    items.push({ y: L.hutY, f: function () {
      var hs = spr('hut', 0), top = L.hutY - (hs.h - 2);
      blitO(hs, L.hutL, top);
      if (june.mode === 'hutSleep') {
        var sl = spr('june_sleep', 0), d = hs.door;
        ctx.save(); ctx.beginPath(); ctx.rect(ox + L.hutL + d[0], oy + top + d[1], d[2], d[3]); ctx.clip();
        blitO(sl, L.hutL + d[0] + 1, top + d[1] + d[3] - (sl.h - 2));
        ctx.restore();
      }
    } });
    if (juneAway() && june.mode !== 'hutSleep' && june.mode !== 'tripBoat') items.push({ y: june.wy, f: function () {
      if (june.mode === 'grassAct') { drawJuneAct(june.wx + ox, june.wy + 3 + oy, june.act, june.t, june.fdir); return; }
      if (june.mode === 'hutEnter' && Math.abs(june.wx - L.hutCX) < 2) return;
      drawJuneWalk();
      if (june.mode === 'smoresRoast' && smores) drawStick();
    } });
    if (ST.boat || (building && building.id === 'boat')) items.push({ y: (trip && trip.phase === 'row' ? trip.by : BANK_Y - 3) + 4, f: function () { drawBoat(buildAlpha('boat')); } });
    if (ST.fire || (building && building.id === 'fire')) items.push({ y: L.fireY, f: function () { drawFire(buildAlpha('fire')); } });
    if (ST.feeder || (building && building.id === 'feeder')) items.push({ y: L.feederY, f: function () { drawFeeder(buildAlpha('feeder')); } });
    gifts.forEach(function (gf) { items.push({ y: gf.y, f: function () { blitC(itemCanvas(gf.id), gf.x - 5, gf.y - 10 + (Math.floor(T * 1.6) % 2)); } }); });
    birds.forEach(function (bd) { items.push({ y: bd.state === 'perch' ? L.feederY + 1 : bd.y, f: function () { drawBird(bd); } }); });
    if (visitor) items.push({ y: visitor.y, f: drawVisitor });
    drawMounds().forEach(function (it) { items.push(it); });
    if (june.mode !== 'tripBoat') items.push({ y: dog.y, f: drawDog });
    ground.forEach(function (gd, idx) {
      items.push({ y: gd.y, f: function () { blitC(goodieSprO[gd.id], gd.x - 6, gd.y - 11 + (Math.floor(T * 1.6 + idx) % 2)); } });
    });
    items.push({ y: goose.y, f: drawGoose });
    items.sort(function (p, q) { return p.y - q.y; });
    for (i = 0; i < items.length; i++) items[i].f();
    drawStones();
    if (cur.star < 0.2 && cur.fly < 0.2 && hourF > 7.5 && hourF < 18) {
      for (i = 0; i < bflies.length; i++) {
        var bf = bflies[i], bs = spr('bf_' + bf.col, Math.floor(T * 7 + bf.ph) % 2);
        ctx.drawImage(bs.c, Math.round(bf.x + ox - 2), Math.round(bf.y + oy - 2 + Math.sin(T * 3 + bf.ph) * 2));
      }
    }

    var tn = cur.tint;
    if (tn[3] > 0.005) { ctx.fillStyle = 'rgba(' + (tn[0] | 0) + ',' + (tn[1] | 0) + ',' + (tn[2] | 0) + ',' + tn[3].toFixed(3) + ')'; ctx.fillRect(0, 0, lw, lh); }

    if (finale) drawFinale();
    if (cur.lamp > 0.02) {
      var fl = 0.88 + 0.12 * Math.sin(T * 6.3) * Math.sin(T * 2.1);
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = clamp(cur.lamp * fl, 0, 1);
      ctx.drawImage(glowC, ox + L.lampX - 32, oy + L.lampY - 50, 64, 64);
      ctx.globalAlpha *= 0.7; ctx.drawImage(glowC, ox + L.lampX - 30, oy + L.lampY - 8, 60, 22);
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    }
    if (fireLit()) {
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = clamp(0.55 + 0.15 * Math.sin(T * 9) * Math.sin(T * 3.1), 0, 1);
      ctx.drawImage(glowC, ox + L.fireX - 28, oy + L.fireY - 34, 56, 56);
      ctx.globalAlpha *= 0.7; ctx.drawImage(glowC, ox + L.fireX - 34, oy + L.fireY - 10, 68, 24);
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    }
    if (cur.lamp > 0.05 || june.mode === 'hutSleep') {
      var ga = Math.max(cur.lamp, june.mode === 'hutSleep' ? 0.5 : 0);
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = clamp(ga * 0.8, 0, 1);
      ctx.drawImage(glowC, ox + L.hutCX + 6 - 18, oy + L.hutY - 12 - 18, 36, 36);
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    }
    if (cur.fly > 0.02) {
      for (i = 0; i < flies.length; i++) {
        var f = flies[i], tw = 0.5 + 0.5 * Math.sin(T * 2.4 + f.ph);
        ctx.globalAlpha = cur.fly * tw;
        ctx.drawImage(spr('firefly', tw > 0.55 ? 0 : 1).c, Math.round(f.x + ox - 1), Math.round(f.y + oy - 1));
      }
      ctx.globalAlpha = 1;
    }
    for (i = 0; i < sparkles.length; i++) {
      var sp = sparkles[i], ss = spr('sparkle', Math.min(2, Math.floor(sp.t / 0.27)));
      ctx.globalAlpha = clamp(1 - sp.t / 0.8, 0, 1);
      blit(ss, sp.x - Math.floor(ss.w / 2), sp.y - Math.floor(ss.h / 2));
    }
    for (i = 0; i < hearts.length; i++) {
      var ht = hearts[i]; if (ht.t < 0) continue;
      ctx.globalAlpha = clamp(1 - ht.t, 0, 1);
      { var hs0 = ht.note ? spr('note', 0) : spr('heart', 0); ctx.drawImage(hs0.c, Math.round(ht.x + ox - 3), Math.round(ht.y + oy), ht.note ? hs0.w : 6, ht.note ? hs0.h : 4); }
    }
    ctx.globalAlpha = 1;
    for (i = 0; i < zees.length; i++) {
      var zz = zees[i]; ctx.globalAlpha = clamp(Math.min(zz.t * 2, (2.4 - zz.t) / 1.2), 0, 1);
      blit(spr('zee', 0), zz.x, zz.y);
    }
    ctx.globalAlpha = 1;
    flyList.forEach(function (f) {
      if (f.t < 0) return;
      var u = f.t / 0.7, e = u * u * (3 - 2 * u), fx = lerp(f.sx, f.ex, e), fy = lerp(f.sy, f.ey, e) - Math.sin(u * Math.PI) * f.arc;
      var fs = f.kind === 'diamond' ? spr('diamond', 0).c : itemCanvas(f.id), sz = lerp(10, 5, e);
      ctx.drawImage(fs, Math.round(fx + ox - sz / 2), Math.round(fy + oy - sz / 2), Math.round(sz), Math.round(sz));
    });

    drawFade(); present();
  }

  /* ---------- the surprise: fireworks and a note, once everything is collected ---------- */
  var FIRE = ['#ffd75a', '#f48fb1', '#a9dcf0', '#fffaf0', '#a88ae0', '#8de58f'];
  function checkFinale() {
    if (ST.finaleDone) return;
    if (GOODIES.every(function (d) { return has(d.id); })) { ST.finaleDone = true; save(); startFinale(); }
  }
  function startFinale() {
    finale = { t: 0, nextBurst: 0.4, line: 0 };
    hideBubble(); sHonk();
  }
  function burst() {
    var cx = rnd(ox + 14, ox + sw - 14), cy = rnd(12, oy + 56), col = pick(FIRE), n = 30;
    for (var i = 0; i < n; i++) {
      var a = i / n * 6.283, sp = rnd(16, 38);
      sparks.push({ x: cx, y: cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, t: 0, life: rnd(0.9, 1.5), col: col });
    }
    sfx(function (t) { tone(rnd(500, 1300), t, 0.25, 'sine', 0.03); });
  }
  function updateFinale(dt) {
    var i;
    for (i = sparks.length - 1; i >= 0; i--) {
      var s = sparks[i]; s.t += dt; s.vy += 26 * dt; s.x += s.vx * dt; s.y += s.vy * dt;
      s.vx *= 0.985;
      if (s.t > s.life) sparks.splice(i, 1);
    }
    if (!finale) return;
    finale.t += dt;
    if (finale.t < 19 && finale.t >= finale.nextBurst) { burst(); finale.nextBurst += rnd(0.35, 0.7); }
    var notes = LINES.finale, starts = [2.5, 11.5];
    if (finale.line < notes.length && finale.t >= starts[finale.line]) {
      showBubble(notes[finale.line], { dur: 8.5 }); finale.line++;
    }
    if (finale.t > 22) finale = null;
  }
  function drawFinale() {
    var f = finale, a = Math.min(1, f.t / 1.5, (22 - f.t) / 2) * (cur.star > 0.5 ? 0.18 : 0.5);
    if (a > 0) { ctx.fillStyle = 'rgba(6,10,40,' + a.toFixed(3) + ')'; ctx.fillRect(0, 0, lw, lh); }
    ctx.globalCompositeOperation = 'lighter';
    sparks.forEach(function (s) {
      ctx.globalAlpha = clamp(1 - s.t / s.life, 0, 1); ctx.fillStyle = s.col;
      ctx.fillRect(Math.round(s.x), Math.round(s.y), s.t < s.life * 0.5 ? 2 : 1, s.t < s.life * 0.5 ? 2 : 1);
    });
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  }

  /* ---------- input ---------- */
  function onDown(e) {
    if (e.isPrimary === false) return;
    e.preventDefault(); unlockAudio();
    if ($('pouchOverlay').classList.contains('open')) return;
    var rx = e.clientX / scale - ox, ry = e.clientY / scale - oy, hr = 26 / scale, i;
    if (scene === 'forest') { onForestDown(e.clientX / scale + cam.x, e.clientY / scale + cam.y, hr); return; }
    if (scene === 'hut') { onHutDown(e.clientX / scale + hcam, e.clientY / scale - oy); return; }
    if (tapSky(rx, ry, hr)) return;
    for (i = gifts.length - 1; i >= 0; i--) { if (Math.hypot(rx - gifts[i].x, ry - (gifts[i].y - 5)) < Math.max(10, hr)) { collectGift(gifts[i]); return; } }
    if (visitor && Math.hypot(rx - visitor.x, ry - (visitor.y - 4)) < Math.max(12, hr)) { petVisitor(); return; }
    for (i = birds.length - 1; i >= 0; i--) { if (Math.hypot(rx - birds[i].x, ry - (birds[i].y - 3)) < Math.max(10, hr)) { petBird(birds[i]); return; } }
    if (ST.feeder && !building && Math.hypot(rx - L.feederX, ry - (L.feederY - 8)) < Math.max(14, hr)) { tapFeeder(); return; }
    if (ST.fire && !building && Math.hypot(rx - L.fireX, ry - (L.fireY - 4)) < Math.max(14, hr)) { askFire(); return; }
    for (i = mounds.length - 1; i >= 0; i--) { if (Math.hypot(rx - mounds[i].x, ry - (mounds[i].y - 2)) < Math.max(10, hr)) { digUp(mounds[i]); return; } }
    if (ST.boat && !trip && Math.abs(rx - L.boatX) < Math.max(20, hr) && ry > BANK_Y - 22 && ry < BANK_Y + 10) { askRow(); return; }
    for (i = ground.length - 1; i >= 0; i--) {
      if (Math.hypot(rx - ground[i].x, ry - (ground[i].y - 5)) < Math.max(10, hr)) { collectGoodie(ground[i]); return; }
    }
    if ((goose.state === 'sleep' || goose.state === 'wakeAnim') && Math.hypot(rx - goose.x, ry - (goose.y - 6)) < Math.max(15, hr)) { tapGoose(); return; }
    if (goose.state === 'idle' && !talk && Math.hypot(rx - goose.x, ry - (goose.y - 6)) < Math.max(11, hr * 0.8)) { openFreeTalk(); return; }
    if (Math.hypot(rx - dog.x, ry - (dog.y - 5)) < Math.max(11, hr)) { petDog(); return; }
    if (june.mode === 'hutSleep' && rx > L.hutL && rx < L.hutL + 30 && ry > L.hutY - 30 && ry < L.hutY + 4) { june.nap = 0; return; }
    if (rx > L.hutL && rx < L.hutL + 30 && ry > L.hutY - 30 && ry < L.hutY + 4 && !juneAway()) { startHutEnter(); return; }
    if (juneAway()) { /* her seat is empty */ } else
    if (rx > L.benchL - 6 && rx < L.benchL + 32 && ry > L.juneT - 6 && ry < 192 || Math.hypot(rx - (L.juneL + 8), ry - (L.juneT + 12)) < hr) {
      wishEvent('wave');
      if (Math.random() < 0.5 && breadCount() < 5) juneToss(rnd(20, sw - 20), rnd(96, 138)); else juneWave();
      return;
    }
    press = { x: e.clientX, y: e.clientY, t: performance.now(), rx: rx, ry: ry, water: ry > 84 && ry < BANK_Y, id: e.pointerId };
  }
  cv.addEventListener('pointerdown', onDown, { passive: false });
  ['gesturestart', 'gesturechange', 'gestureend'].forEach(function (n) { document.addEventListener(n, function (e) { e.preventDefault(); }); });
  document.addEventListener('touchmove', function (e) { if (!(e.target.closest && e.target.closest('#talk, #craftPanel'))) e.preventDefault(); }, { passive: false });
  ['pointerdown', 'pointerup', 'touchend', 'click'].forEach(function (n) { window.addEventListener(n, unlockAudio, true); });
  document.addEventListener('contextmenu', function (e) { e.preventDefault(); });

  /* ---------- pouch and mute UI ---------- */
  var pouchOverlay = $('pouchOverlay'), pouchGrid = $('pouchGrid');
  function iconInto(btn, name) {
    var c = btn.querySelector('canvas'), s = spr(name, 0);
    c.width = s.w; c.height = s.h; var x = c.getContext('2d'); x.clearRect(0, 0, s.w, s.h); x.drawImage(s.c, 0, 0);
  }
  var cells = {}, badges = {};
  GOODIES.forEach(function (d) {
    var cell = document.createElement('div'); cell.className = 'cell';
    var c = document.createElement('canvas'); c.width = 12; c.height = 12; cell.appendChild(c);
    var bd = document.createElement('span'); bd.className = 'count'; cell.appendChild(bd); badges[d.id] = bd;
    pouchGrid.appendChild(cell); cells[d.id] = c;
  });
  function fillPouch() {
    $('diamondCount').textContent = ST.diamonds;
    $('replayBtn').hidden = !ST.finaleDone;
    GOODIES.forEach(function (d) { badges[d.id].textContent = (ST.inv[d.id] || 0) > 1 ? ST.inv[d.id] : ''; });
    var pg = $('packGrid'), extra = Object.keys(ST.inv).filter(function (id) { return ST.inv[id] > 0 && !goodieDef[id]; });
    pg.innerHTML = ''; $('packTitle').textContent = extra.length ? LINES.ui.packTitle : '';
    extra.forEach(function (id) {
      var cell = document.createElement('div'), c = document.createElement('canvas'), n = document.createElement('span');
      cell.className = 'cell'; paint(c, id); cell.appendChild(c); n.className = 'count'; n.textContent = ST.inv[id] > 1 ? ST.inv[id] : ''; cell.appendChild(n);
      pg.appendChild(cell);
    });
    GOODIES.forEach(function (d) {
      var c = cells[d.id], x = c.getContext('2d'); x.clearRect(0, 0, 12, 12);
      if (has(d.id)) x.drawImage(goodieSpr[d.id], 1, 1);
      else x.drawImage(SPR.outline(goodieSpr[d.id], 'rgba(120,110,140,0.35)'), 0, 0);
    });
  }
  function openPouch() { fillPouch(); pouchOverlay.classList.add('open'); }
  function closePouch() { pouchOverlay.classList.remove('open'); }
  $('pouchBtn').addEventListener('click', function () { unlockAudio(); openPouch(); });
  $('replayBtn').addEventListener('click', function () { closePouch(); startFinale(); });
  pouchOverlay.addEventListener('click', function (e) { if (e.target === pouchOverlay) closePouch(); });
  function updateMuteIcon() { iconInto($('muteBtn'), ST.mute ? 'speaker_off' : 'speaker'); }
  $('muteBtn').addEventListener('click', function () {
    unlockAudio(); ST.mute = !ST.mute; save();
    if (master) master.gain.value = ST.mute ? 0 : 0.9;
    updateMuteIcon();
  });
  $('pouchBtn').setAttribute('aria-label', LINES.ui.pouchLabel);
  $('muteBtn').setAttribute('aria-label', LINES.ui.muteLabel);

  /* ---------- main loop and lifecycle ---------- */
  var raf = 0, lastT = 0, hiddenAt = 0;
  function frame(now) {
    raf = requestAnimationFrame(frame);
    var dt = Math.min(0.05, Math.max(0, (now - lastT) / 1000)); lastT = now;
    T += dt; playTime += dt;
    if (greetT > 0) { greetT -= dt; if (greetT <= 0) showGreeting(); }
    if (!talk && !bub.on && greetT <= 0 && goose.state === 'idle' && !finale) {
      if (!ST.hintSkip && playTime > 50) { ST.hintSkip = true; save(); showBubble({ text: LINES.hints.skip }, { noCount: true }); }
      else if (!ST.hintWish && playTime > 110) { ST.hintWish = true; save(); showBubble({ text: LINES.hints.wish }, { noCount: true }); }
    }
    if (buildPending && greetT <= 0 && !bub.on && !talk && !finale && goose.state === 'idle' && scene === 'pond' && !trip) startBuild(buildPending);
    if (growPending && !bub.on && greetT <= 0 && goose.state === 'idle' && !finale && !talk) growMoment();
    updateFade(dt);
    if (scene === 'forest') { updateForest(dt); tickFx(dt); updateBubble(dt); }
    else if (scene === 'hut') { updateHut(dt); updateHutFx(dt); tickFx(dt); updateBubble(dt); }
    else { updateJune(dt); updateBreads(dt); updateGoose(dt); updateEffects(dt); updateBubble(dt); hungerTick(dt);
      muttT -= dt;
      if (muttT <= 0) { muttT = rnd(240, 420); if (!bub.on && !talk && !finale && goose.state === 'idle' && greetT <= 0 && !trip && !building && !smores) speak('goose', goose); }
    }
    render();
  }
  function newSession() {
    hideBubble(); breads.length = 0; june.pending = null; juneIdle();
    if (goose.state !== 'idle') { goose.x = clamp(goose.x, 14, sw - 14); goose.y = 120; toIdle(); }
    napEpoch = playTime; napDelay = rint(60, 120); firstNap = true; june.nappedOnce = false; hungerShown = 0;
    startSession();
  }
  function pause() {
    cancelAnimationFrame(raf); raf = 0; hiddenAt = Date.now();
    if (AC && AC.state === 'running') { try { AC.suspend(); } catch (e) { /* ignore */ } }
  }
  function resume() {
    if (raf) return;
    readClock();
    if (ymd(new Date()) !== ST.last || Date.now() - hiddenAt > 30 * 60000) newSession();
    if (AC && !ST.mute) { try { AC.resume(); } catch (e) { /* ignore */ } }
    flushQueue();
    lastT = performance.now(); raf = requestAnimationFrame(frame);
  }
  document.addEventListener('visibilitychange', function () { if (document.hidden) pause(); else resume(); });
  window.addEventListener('pageshow', function (e) { if (e.persisted) resume(); });
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', function () { setTimeout(resize, 250); });
  setInterval(function () { if (!document.hidden) readClock(); }, 60000);

  /* ---------- boot ---------- */
  function boot() {
    loadState();
    if (!ST.lastFed) ST.lastFed = Date.now();
    ST.goodies.forEach(function (id) { if (!ST.inv[id]) ST.inv[id] = 1; });
    if (Q.get('world') === '1') {
      ST.boat = ST.fire = ST.feeder = true; ST.seeds = 6; ST.feeds = Math.max(ST.feeds || 0, 40);
      ['marshmallow', 'chocolate', 'cracker', 'twig', 'pebble', 'pinecone'].forEach(function (id) { ST.inv[id] = Math.max(ST.inv[id] || 0, 3); });
    }
    try {
      var lk = document.createElement('link'); lk.rel = 'apple-touch-icon'; lk.href = SPR.iconURL(); document.head.appendChild(lk);
    } catch (e) { /* icon is optional */ }
    var root = document.documentElement.style;
        root.setProperty('--tail', 'url("' + SPR.tailURL() + '")');
    iconInto($('pouchBtn'), 'pouch');
    iconInto($('replayBtn'), 'heart');
    $('wishBtn').querySelector('canvas').getContext('2d').drawImage(goodieSpr.star, 0, 0);
    $('wishBtn').setAttribute('aria-label', LINES.wishes.title);
    $('replayBtn').setAttribute('aria-label', LINES.ui.replayLabel);
    var dc = $('diamondIcon'), dg = dc.getContext('2d'); dg.drawImage(spr('diamond', 0).c, 0, 0);
    if (!isNaN(forcedStage)) ST.stage = computeStage();
    if (Q.get('finale') === '1') setTimeout(startFinale, 1500);
    if (Q.get('hut') === '1') setTimeout(function () {
      ['berry', 'berry', 'mushroom', 'mushroom', 'pinecone', 'flower', 'clover', 'chocolate', 'marshmallow', 'acorn', 'acorn'].forEach(function (id) { ST.inv[id] = (ST.inv[id] || 0) + 1; });
      enterHut();
    }, 600);
    if (Q.get('hut') === '2') setTimeout(function () { ST.inv = {}; ST.boat = true; ST.quest = null; enterHut(); }, 600);
    if (Q.get('forest') === '1') setTimeout(function () { ST.boat = true; enterForest(); }, 600);
    updateMuteIcon();
    readClock(); resize();
    flushQueue();
    dog.x = dogHome().x; dog.y = dogHome().y; dog.trickT = 80;
    june.wx = L.juneL + 8; june.wy = 182; june.fdir = -1; june.strollAt = 45;    goose.x = sw * 0.4; goose.y = 118;
    napDelay = rint(60, 120);
    startSession();
    ST.pending.forEach(function (id, i) { if (goodieDef[id] && i < 3) placeGoodie(id, i, false); });
    lastT = performance.now(); raf = requestAnimationFrame(frame);
    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
      window.addEventListener('load', function () { try { navigator.serviceWorker.register('sw.js').catch(function () {}); } catch (e) { /* offline play is optional */ } });
    }
  }
  boot();
})();
