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
      mem: { events: [], likes: [], people: [], lastMem: '' }, wishes: { date: '', ids: [], prog: {}, done: {} }, hintSkip: false, hintWish: false };
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
    cur = c; bgDirty = true;
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
  var stars = [], shimmer = [], flies = [], clouds = [], bflies = [], pxK = 1, trailT = 0;
  var glowC = null;

  function layout() {
    L.benchCX = Math.round(sw * 0.74); L.benchL = L.benchCX - 12; L.benchY = 176;
    L.juneL = L.benchL + 6; L.juneT = 154;
    L.lampX = Math.round(sw * 0.13); L.lampY = 172;
    L.hutCX = Math.round(sw * 0.27); L.hutL = L.hutCX - 15; L.hutY = 181;
    L.napDayX = Math.round(sw * 0.52); L.napDayY = 178;
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
    clouds = [];
    for (i = 0; i < 4 + Math.floor(lw / 120); i++) clouds.push({ x: r() * lw, y: 6 + r() * Math.max(30, oy + 46), c: i % 3, sp: 1.5 + r() * 3 });
    if (!bflies.length) for (i = 0; i < 3; i++) bflies.push({ x: rnd(10, 140), y: rnd(150, 185), vx: 0, vy: 0, t: 0, ph: rnd(0, 6), col: i });
    bgDirty = true;
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
    if (goose.state === 'idle' || goose.state === 'chase') { goose.x = clamp(goose.x, 8, sw - 8); }
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
    if (juneAway()) { spawnBread(clamp(tx, 10, sw - 10), clamp(ty, 92, 143)); return; }
    june.mode = 'toss'; june.t = 0; june.awakeT = 8;
    june.pending = { x: clamp(tx, 10, sw - 10), y: clamp(ty, 92, 143) };
  }
  function breadCount() { return breads.length + (june.pending ? 1 : 0); }
  function juneMove(tx, ty, sp, dt) {
    var dx = tx - june.wx, dy = ty - june.wy, d = Math.hypot(dx, dy);
    if (d <= 0.8) return true;
    var st = Math.min(d, sp * dt);
    june.wx += dx / d * st; june.wy += dy / d * st;
    if (Math.abs(dx) > 0.3) june.fdir = dx < 0 ? -1 : 1;
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
    var s = Math.min(d, sp * dt);
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
        if (!g.wp || g.wait <= 0) { g.wp = { x: rnd(14, sw - 14), y: rnd(104, 136) }; g.wait = rnd(2.5, 6); }
        if (moveTo(g.wp.x, g.wp.y, 12, dt, 1)) { g.wp = null; g.wait = Math.min(g.wait, rnd(1, 3)); }
        g.x = clamp(g.x, 8, sw - 8);
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
          if (eatenSinceRoll >= nextRollAt) { eatenSinceRoll = 0; nextRollAt = rint(4, 6); rollPending = true; }
          save();
        }
        if (g.t > 0.95) { g.state = 'honk'; g.t = 0; sHonk(); }
        break;
      case 'honk':
        if (g.t > 0.75) {
          toIdle();
          if (rollPending) { rollPending = false; doRoll(); }
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
    wishEvent('collect');
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
  var bub = { on: false, t: 0, w: 0, h: 0, tw: 0 };
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
    var gx = (goose.x + ox) * scale, gy = (goose.y + oy - (goose.topH || 20)) * scale;
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
    checkGrowth(); ensureWishes();
    greetT = 1.2; save(); updateDayLabel();
  }
  function showGreeting() { var gl = greetingLine(); showBubble(gl, moreAction(gl)); }

  /* ---------- the puppy, the fish and the hut ---------- */
  var dog = { x: 0, y: 189, dir: -1, state: 'sit', t: 0, wp: null, wait: 4, hop: 0, awakeT: 0 };
  var fishes = [], hearts = [];
  function juneAway() { var m = june.mode; return m === 'walkOut' || m === 'hutSleep' || m === 'walkBack' || m === 'strollOut' || m === 'strollIdle' || m === 'strollBack'; }
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
    if (june.mode.indexOf('stroll') === 0) {
      d.state = dogMove(clamp(june.wx + 11, 12, sw - 12), clamp(june.wy + 3, 160, 194), 21, dt) ? 'sit' : 'walk';
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
    sfx(function (t) { tone(900, t, 0.07, 'square', 0.04, 1300); tone(1000, t + 0.1, 0.08, 'square', 0.04, 1400); });
  }
  function drawDog() {
    var d = dog, fr = d.state === 'sleep' ? spr('dog_sleep', 0) : d.state === 'walk' ? spr('dog_walk', Math.floor(T * 6) % 2) : spr('dog_sit', Math.floor(T * 4) % 2);
    var hop = d.hop > 0 ? Math.abs(Math.sin(d.hop / 0.5 * Math.PI * 2)) * 4 : 0;
    ctx.drawImage(d.dir > 0 ? fr.f : fr.c, Math.round(d.x - fr.w / 2 + ox), Math.round(d.y - fr.h + 2 - hop + oy));
  }

  function initFish() {
    fishes = [];
    for (var i = 0; i < 5; i++) fishes.push({ x: rnd(12, sw - 12), y: rnd(100, 138), dir: Math.random() < 0.5 ? -1 : 1, sp: rnd(5, 11), col: i % 4, ph: rnd(0, 6), jump: 0, jt: rnd(4, 14) });
  }
  function updateFish(dt) {
    if (!fishes.length) initFish();
    fishes.forEach(function (f) {
      f.x += f.dir * f.sp * dt;
      if (f.x < 8) { f.x = 8; f.dir = 1; } else if (f.x > sw - 8) { f.x = sw - 8; f.dir = -1; }
      f.y = clamp(f.y + Math.sin(T * 0.7 + f.ph) * 3 * dt, 98, 140);
      f.jt -= dt;
      if (f.jump <= 0 && f.jt <= 0) { f.jump = 0.0001; f.jt = rnd(8, 20); addRipple(f.x, f.y); wishEvent('fish'); }
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
    updateDog(dt); updateFish(dt); updateStones(dt);
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
    if (water) return spr(gp('swim'), Math.floor(T * 2.5) % 2);
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
    if (juneAway() && june.mode !== 'hutSleep') items.push({ y: june.wy, f: function () {
      var wf = spr('june_walk', june.mode === 'strollIdle' ? 1 : Math.floor(T * 6) % 2);
      blitO(wf, june.wx - 8, june.wy + 3 - wf.h, june.fdir > 0);
    } });
    items.push({ y: dog.y, f: drawDog });
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
      ctx.drawImage(spr('heart', 0).c, Math.round(ht.x + ox - 3), Math.round(ht.y + oy), 6, 4);
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
      var fs = f.kind === 'diamond' ? spr('diamond', 0).c : goodieSpr[f.id], sz = lerp(10, 5, e);
      ctx.drawImage(fs, Math.round(fx + ox - sz / 2), Math.round(fy + oy - sz / 2), Math.round(sz), Math.round(sz));
    });

    vctx.clearRect(0, 0, cv.width, cv.height);
    vctx.drawImage(lc, 0, 0, lw, lh, 0, 0, lw * pxK, lh * pxK);
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
    for (i = ground.length - 1; i >= 0; i--) {
      if (Math.hypot(rx - ground[i].x, ry - (ground[i].y - 5)) < Math.max(10, hr)) { collectGoodie(ground[i]); return; }
    }
    if ((goose.state === 'sleep' || goose.state === 'wakeAnim') && Math.hypot(rx - goose.x, ry - (goose.y - 6)) < Math.max(15, hr)) { tapGoose(); return; }
    if (goose.state === 'idle' && !talk && Math.hypot(rx - goose.x, ry - (goose.y - 6)) < Math.max(11, hr * 0.8)) { openFreeTalk(); return; }
    if (Math.hypot(rx - dog.x, ry - (dog.y - 5)) < Math.max(11, hr)) { petDog(); return; }
    if (june.mode === 'hutSleep' && rx > L.hutL && rx < L.hutL + 30 && ry > L.hutY - 30 && ry < L.hutY + 4) { june.nap = 0; return; }
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
  document.addEventListener('touchmove', function (e) { if (!(e.target.closest && e.target.closest('#talk'))) e.preventDefault(); }, { passive: false });
  ['pointerdown', 'pointerup', 'touchend', 'click'].forEach(function (n) { window.addEventListener(n, unlockAudio, true); });
  document.addEventListener('contextmenu', function (e) { e.preventDefault(); });

  /* ---------- pouch and mute UI ---------- */
  var pouchOverlay = $('pouchOverlay'), pouchGrid = $('pouchGrid');
  function iconInto(btn, name) {
    var c = btn.querySelector('canvas'), s = spr(name, 0);
    c.width = s.w; c.height = s.h; var x = c.getContext('2d'); x.clearRect(0, 0, s.w, s.h); x.drawImage(s.c, 0, 0);
  }
  var cells = {};
  GOODIES.forEach(function (d) {
    var cell = document.createElement('div'); cell.className = 'cell';
    var c = document.createElement('canvas'); c.width = 12; c.height = 12; cell.appendChild(c);
    pouchGrid.appendChild(cell); cells[d.id] = c;
  });
  function fillPouch() {
    $('diamondCount').textContent = ST.diamonds;
    $('replayBtn').hidden = !ST.finaleDone;
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
    if (growPending && !bub.on && greetT <= 0 && goose.state === 'idle' && !finale && !talk) growMoment();
    updateJune(dt); updateBreads(dt); updateGoose(dt); updateEffects(dt); updateBubble(dt);
    render();
  }
  function newSession() {
    hideBubble(); breads.length = 0; june.pending = null; juneIdle();
    if (goose.state !== 'idle') { goose.x = clamp(goose.x, 14, sw - 14); goose.y = 120; toIdle(); }
    napEpoch = playTime; napDelay = rint(60, 120); firstNap = true; june.nappedOnce = false;
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
    updateMuteIcon();
    readClock(); resize();
    flushQueue();
    dog.x = dogHome().x; dog.y = dogHome().y;
    june.wx = L.juneL + 8; june.wy = 182; june.fdir = -1; june.strollAt = 45;
    goose.x = sw * 0.4; goose.y = 118;
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
