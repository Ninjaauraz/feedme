/* The forest across the pond, seen from above: world layout, scenery art, walking paths,
   top-down characters, hidden-item data and the things the goose builds. All drawn in code. */
(function () {
  'use strict';
  var SPR = window.Sprites;

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
  function cv(w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

  /* ---------- things she can find ---------- */
  var ITEMS = {
    twig: [
      "..........", "........N.", ".......Nn.", "......Nn..", ".....Nn...", "...N.n....", "....Nn....", "...nN.....", "..nN......", ".........."],
    mushroom: [
      "...rrrr...", "..rrzrrr..", ".rrrrrzrr.", ".rzrrrrrr.", "..RRRRRR..", "...zzzz...", "...zzzz...", "...zzzz...", "..........", ".........."],
    pinecone: [
      "....nn....", "...nNnN...", "..nNnNnN..", "..NnNnNn..", "..nNnNnN..", "...NnNn...", "...nNnN...", "....NnN...", ".....N....", ".........."],
    feather: [
      "........ww", ".......www", "......wwws", ".....wwws.", "....wwws..", "...wwws...", "..wwws....", ".Nwws.....", "N.........", ".........."],
    clover: [
      "..gg.gg...", ".gggggggg.", ".gggGgggg.", "..gggGgg..", ".gggGgggg.", ".gggggggg.", "..gg.gg...", "....G.....", "....G.....", ".........."],
    marshmallow: [
      "..........", ".zzz..zzz.", "zzzzzzzzzz", "zszzzzzszz", "zzzzzzzzzz", ".zzz..zzz.", "..........", "..........", "..........", ".........."],
    chocolate: [
      "..........", ".hhhhhhhh.", ".hHhhHhhH.", ".hhhhhhhh.", ".hHhhHhhH.", ".hhhhhhhh.", ".HHHHHHHH.", "..........", "..........", ".........."],
    cracker: [
      "..........", ".tttttttt.", ".tTttTttt.", ".tttttttt.", ".ttTttTtt.", ".tttttttt.", ".TTTTTTTT.", "..........", "..........", ".........."],
    button: [
      "..........", "...uuuu...", "..uUUUUu..", ".uUluuUUu.", ".uUuuluUu.", "..uUUUUu..", "...uuuu...", "..........", "..........", ".........."],
    ribbon: [
      "..........", ".pp....pp.", "pppp..pppp", "pPpppppPp.", "pppPPPppp.", ".ppPPPpp..", ".pp.PP.pp.", "..p.PP.p..", "..........", ".........."],
    pearl: [
      "..........", "...zzzz...", "..zlzzzz..", ".zlzzzzzs.", ".zzzzzzzs.", "..zzzzss..", "...ssss...", "..........", "..........", ".........."]
  };

  /* What the puppy hides in the forest (weights), and what it digs up by the pond. */
  var FOREST_POOL = [
    { id: 'twig', w: 4 }, { id: 'mushroom', w: 3 }, { id: 'pinecone', w: 3 }, { id: 'feather', w: 2 }, { id: 'clover', w: 1 },
    { id: 'marshmallow', w: 2 }, { id: 'chocolate', w: 2 }, { id: 'cracker', w: 2 }, { id: 'acorn', w: 2 }, { id: 'pebble', w: 2 }, { id: 'shell', w: 1 }, { id: 'flower', w: 2 }, { id: 'berry', w: 2 }
  ];
  var DIG_POOL = [
    { id: 'pebble', w: 4 }, { id: 'shell', w: 4 }, { id: 'flower', w: 4 }, { id: 'berry', w: 3 }, { id: 'acorn', w: 3 },
    { id: 'twig', w: 2 }, { id: 'mushroom', w: 1 }, { id: 'feather', w: 1 },
    { id: 'marshmallow', w: 1 }, { id: 'chocolate', w: 1 }, { id: 'cracker', w: 1 }
  ];

  /* Things the goose builds by himself once she has collected enough. Each opening of the game checks. */
  var BUILDS = [
    { id: 'boat', goodies: 4 },
    { id: 'fire', needs: { twig: 3, pebble: 3 } },
    { id: 'feeder', needs: { twig: 2, pinecone: 1 } }
  ];

  /* What birds and visitors leave as gifts (weights). */
  var GIFT_POOL = [
    { id: 'feather', w: 3 }, { id: 'berry', w: 3 }, { id: 'flower', w: 3 }, { id: 'shell', w: 2 }, { id: 'acorn', w: 2 },
    { id: 'button', w: 2 }, { id: 'ribbon', w: 1 }, { id: 'pearl', w: 1 }
  ];
  /* Which birds come (after this many feeder visits in total) and which animals visit (and when). */
  var BIRDS = [
    { id: 'sparrow', feeds: 0, w: 4, stay: [3, 5], gift: 5 },               // cheeky: quick in and out
    { id: 'blue', feeds: 3, w: 3, stay: [4, 7], gift: 5, shy: 28 },        // shy: bolts if the puppy or goose come close
    { id: 'robin', feeds: 8, w: 2, stay: [8, 14], gift: 5, sing: true },   // cheerful: sings while it stays
    { id: 'red', feeds: 15, w: 1, stay: [10, 16], gift: 4 }                // proud cardinal: stays long, leaves fancier gifts
  ];
  var VISITORS = [
    { id: 'bunny', feeds: 6, hours: [[5, 10], [16, 20]] },
    { id: 'hedgehog', feeds: 15, hours: [[20, 24], [0, 5]] },
    { id: 'fox', feeds: 30, hours: [[17, 20], [5, 8]] }
  ];

  /* ---------- the world ---------- */
  var SPOT_TYPES = ['bush', 'log', 'rock', 'stump', 'burrow', 'flowers', 'mush'];

  function distToSeg(px, py, ax, ay, bx, by) {
    var dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy, t = l2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2)) : 0;
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
  }

  function build(WW, WH) {
    var r = mulberry(777), shoreY = WH - 36, i, j, k;
    var W = { WW: WW, WH: WH, shoreY: shoreY, trees: [], rocks: [], trails: [], glades: [], spots: [] };
    W.landing = { x: Math.round(WW / 2), y: shoreY - 6 };
    W.boat = { x: W.landing.x, y: WH - 12 };
    var hub = { x: WW * 0.5, y: WH * 0.52, r: 22, n: 'hub' };
    W.glades = [
      hub,
      { x: WW * 0.18, y: WH * 0.13, r: 28, n: 'nw' }, { x: WW * 0.84, y: WH * 0.15, r: 28, n: 'ne' },
      { x: WW * 0.13, y: WH * 0.55, r: 24, n: 'w' }, { x: WW * 0.88, y: WH * 0.57, r: 24, n: 'e' },
      { x: WW * 0.17, y: WH * 0.83, r: 26, n: 'sw' }, { x: WW * 0.85, y: WH * 0.81, r: 26, n: 'se' }
    ];
    // trails: landing -> hub, hub -> each glade (bent through a midpoint)
    function trail(pts) { W.trails.push(pts); }
    trail([[W.landing.x, W.landing.y + 6], [WW * 0.5, WH * 0.76], [WW * 0.46, WH * 0.64], [hub.x, hub.y]]);
    W.glades.slice(1).forEach(function (gl) {
      var mx = (hub.x + gl.x) / 2 + (r() - 0.5) * 40, my = (hub.y + gl.y) / 2 + (r() - 0.5) * 30;
      trail([[hub.x, hub.y], [mx, my], [gl.x, gl.y]]);
    });
    trail([[WW * 0.17, WH * 0.83], [WW * 0.34, WH * 0.8], [WW * 0.46, WH * 0.76]]);
    trail([[WW * 0.85, WH * 0.81], [WW * 0.66, WH * 0.79], [WW * 0.5, WH * 0.76]]);
    // sample the trails into points for quick distance tests
    var tp = [];
    W.trails.forEach(function (t) {
      for (i = 0; i < t.length - 1; i++) {
        var a = t[i], b = t[i + 1], n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 4));
        for (j = 0; j <= n; j++) tp.push([a[0] + (b[0] - a[0]) * j / n, a[1] + (b[1] - a[1]) * j / n]);
      }
    });
    W.trailPts = tp;
    function nearTrail(x, y, m) { for (var q = 0; q < tp.length; q++) if (Math.hypot(x - tp[q][0], y - tp[q][1]) < m) return true; return false; }
    function inGlade(x, y, pad) { for (var q = 0; q < W.glades.length; q++) if (Math.hypot(x - W.glades[q].x, y - W.glades[q].y) < W.glades[q].r + pad) return true; return false; }

    // hiding places: two in most glades, one by the hub, one on the main trail
    var typeI = 0;
    W.glades.forEach(function (gl) {
      var n = gl.n === 'hub' ? 1 : (gl.n === 'w' || gl.n === 'e') ? 1 : 2;
      for (k = 0; k < n; k++) {
        var ang = r() * 6.283 + k * 3.1, rad = gl.r * ((gl.n === 'hub' ? 0.45 : 0.7) + r() * (gl.n === 'hub' ? 0.25 : 0.2));
        W.spots.push({ id: W.spots.length, type: SPOT_TYPES[typeI++ % SPOT_TYPES.length], x: Math.round(gl.x + Math.cos(ang) * rad), y: Math.round(gl.y + Math.sin(ang) * rad), glade: gl.n });
      }
    });
    W.spots.push({ id: W.spots.length, type: SPOT_TYPES[typeI++ % SPOT_TYPES.length], x: Math.round(WW * 0.5 + 14), y: Math.round(WH * 0.69), glade: 'trail' });
    // the six places to play, one in the middle of each outer glade
    var gm = {}; W.glades.forEach(function (q) { gm[q.n] = q; });
    W.pois = [['ring', 'nw'], ['leaves', 'ne'], ['log', 'w'], ['hammock', 'e'], ['picnic', 'sw'], ['pond', 'se']].map(function (p) {
      return { id: p[0], x: Math.round(gm[p[1]].x), y: Math.round(gm[p[1]].y) };
    });
    // boulders
    for (i = 0; i < 40 && W.rocks.length < 14; i++) {
      var rx = 10 + r() * (WW - 20), ry = 10 + r() * (shoreY - 20), rr = 4 + Math.floor(r() * 3);
      if (!nearTrail(rx, ry, rr + 6) && !inGlade(rx, ry, rr + 2)) W.rocks.push({ x: Math.round(rx), y: Math.round(ry), r: rr });
    }
    // a dense forest of trees that leaves the trails and glades open
    for (i = 0; i < 2600 && W.trees.length < 230; i++) {
      var tx = 4 + r() * (WW - 8), ty = 4 + r() * (shoreY - 2), tr = 6 + Math.floor(r() * 8);
      if (nearTrail(tx, ty, tr * 0.55 + 6) || inGlade(tx, ty, tr * 0.35) || Math.hypot(tx - W.landing.x, ty - W.landing.y) < tr + 18) continue;
      var ok = true;
      for (j = 0; j < W.trees.length; j++) { var o = W.trees[j]; if (Math.hypot(tx - o.x, ty - o.y) < (tr + o.r) * 0.62) { ok = false; break; } }
      if (ok) W.trees.push({ x: Math.round(tx), y: Math.round(ty), r: tr, tone: Math.floor(r() * 3) });
    }
    W.trees.sort(function (a, b) { return a.y - b.y; });
    return W;
  }

  /* ---------- walking: A* on a coarse grid, around trees and boulders ---------- */
  function makeNav(W) {
    var C = 6, gw = Math.ceil(W.WW / C), gh = Math.ceil(W.WH / C), blocked = new Uint8Array(gw * gh), i, j;
    function circle(cx, cy, rad) {
      for (var gy = Math.max(0, Math.floor((cy - rad) / C)); gy <= Math.min(gh - 1, Math.floor((cy + rad) / C)); gy++)
        for (var gx = Math.max(0, Math.floor((cx - rad) / C)); gx <= Math.min(gw - 1, Math.floor((cx + rad) / C)); gx++)
          if (Math.hypot(gx * C + C / 2 - cx, gy * C + C / 2 - cy) <= rad) blocked[gy * gw + gx] = 1;
    }
    for (i = 0; i < gw; i++) for (j = 0; j < gh; j++) {
      if (i === 0 || j === 0 || i === gw - 1 || (j * C > W.shoreY + 12)) blocked[j * gw + i] = 1;
    }
    W.trees.forEach(function (t) { circle(t.x, t.y, t.r * 0.72); });
    W.rocks.forEach(function (t) { circle(t.x, t.y, t.r + 1); });
    W.spots.forEach(function (s) { circle(s.x, s.y, 3.5); });
    function cell(v, n) { return Math.max(0, Math.min(n - 1, Math.floor(v / C))); }
    function nearestFree(cx, cy) {
      if (!blocked[cy * gw + cx]) return [cx, cy];
      for (var rad = 1; rad < 14; rad++) {
        for (var dy = -rad; dy <= rad; dy++) for (var dx = -rad; dx <= rad; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== rad) continue;
          var x = cx + dx, y = cy + dy;
          if (x >= 0 && y >= 0 && x < gw && y < gh && !blocked[y * gw + x]) return [x, y];
        }
      }
      return null;
    }
    function path(fx, fy, tx, ty) {
      var s = nearestFree(cell(fx, gw), cell(fy, gh)), e = nearestFree(cell(tx, gw), cell(ty, gh));
      if (!s || !e) return [];
      var N = gw * gh, g = new Float32Array(N).fill(1e9), par = new Int32Array(N).fill(-1), closed = new Uint8Array(N), heap = [], si = s[1] * gw + s[0], ei = e[1] * gw + e[0];
      function h(idx) { var x = idx % gw, y = (idx / gw) | 0; return Math.hypot(x - e[0], y - e[1]); }
      function push(idx, f) { heap.push([f, idx]); var n = heap.length - 1; while (n > 0) { var p = (n - 1) >> 1; if (heap[p][0] <= heap[n][0]) break; var t = heap[p]; heap[p] = heap[n]; heap[n] = t; n = p; } }
      function pop() { var top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; var n = 0; for (;;) { var l = 2 * n + 1, rr = l + 1, m = n; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (rr < heap.length && heap[rr][0] < heap[m][0]) m = rr; if (m === n) break; var t = heap[m]; heap[m] = heap[n]; heap[n] = t; n = m; } } return top; }
      g[si] = 0; push(si, h(si));
      var D = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [-1, 1, 1.414], [1, -1, 1.414], [-1, -1, 1.414]], found = false;
      while (heap.length) {
        var cur = pop()[1];
        if (closed[cur]) continue;
        closed[cur] = 1;
        if (cur === ei) { found = true; break; }
        var cx = cur % gw, cy = (cur / gw) | 0;
        for (var d = 0; d < 8; d++) {
          var nx = cx + D[d][0], ny = cy + D[d][1];
          if (nx < 0 || ny < 0 || nx >= gw || ny >= gh || blocked[ny * gw + nx]) continue;
          if (D[d][2] > 1 && (blocked[cy * gw + nx] || blocked[ny * gw + cx])) continue;
          var ni = ny * gw + nx, ng = g[cur] + D[d][2];
          if (ng < g[ni]) { g[ni] = ng; par[ni] = cur; push(ni, ng + h(ni)); }
        }
      }
      if (!found) return [];
      var pts = [], c = ei;
      while (c !== -1) { pts.push({ x: (c % gw) * C + C / 2, y: ((c / gw) | 0) * C + C / 2 }); c = par[c]; }
      pts.reverse(); pts.shift();
      var out = [];
      pts.forEach(function (p, idx) { // drop points on a straight line
        var a = out.length ? out[out.length - 1] : { x: fx, y: fy }, nx2 = pts[idx + 1];
        if (nx2 && Math.abs((p.x - a.x) * (nx2.y - p.y) - (p.y - a.y) * (nx2.x - p.x)) < 0.01) return;
        out.push(p);
      });
      var ex = e[0] === cell(tx, gw) && e[1] === cell(ty, gh);
      if (ex && out.length) out[out.length - 1] = { x: tx, y: ty };
      return out;
    }
    return { path: path, blockedAt: function (x, y) { return !!blocked[cell(y, gh) * gw + cell(x, gw)]; } };
  }

  /* ---------- painting the forest floor, trails and trees ---------- */
  function blobAt(g, cx, cy, rx, ry, col) {
    g.fillStyle = rgb(col);
    for (var y = -Math.ceil(ry); y <= Math.ceil(ry); y++) {
      var half = Math.round(rx * Math.sqrt(Math.max(0, 1 - (y * y) / (ry * ry))));
      g.fillRect(cx - half, cy + y, half * 2 + 1, 1);
    }
  }
  function lobe(g, cx, cy, rad, base, hi, sh) {
    var x, y;
    for (y = -rad; y <= rad; y++) for (x = -rad; x <= rad; x++) {
      var d = Math.hypot(x, y);
      if (d > rad) continue;
      var s = (x + y) / (rad * 1.5);
      g.fillStyle = s < -0.42 ? hi : s > 0.4 ? sh : base;
      g.fillRect(cx + x, cy + y, 1, 1);
    }
  }
  // a tiny hash so the leaf texture is the same every time
  function hsh(x, y) { var h = (x * 374761393 + y * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
  // a tree crown seen from above: four overlapping lobes, lit from the top left, with leaf clumps, scalloped seams and an outline
  function crown(g, cx, cy, rr, C) {
    var L = [[-0.35, 0.15, 0.7], [0.35, 0.1, 0.7], [0, -0.3, 0.72], [0, 0.2, 0.78]].map(function (l) {
      return { x: cx + Math.round(l[0] * rr), y: cy + Math.round(l[1] * rr), r: Math.max(2, Math.round(l[2] * rr)) };
    });
    var x0 = cx - rr - 3, y0 = cy - rr - 3, S = 2 * rr + 7, own = new Int8Array(S * S), i, x, y, px, py;
    for (i = 0; i < own.length; i++) own[i] = -1;
    for (i = 0; i < 4; i++) for (y = -L[i].r; y <= L[i].r; y++) for (x = -L[i].r; x <= L[i].r; x++) {
      if (x * x + y * y > L[i].r * L[i].r + 1) continue;
      px = L[i].x + x - x0; py = L[i].y + y - y0;
      if (px >= 0 && py >= 0 && px < S && py < S) own[py * S + px] = i;
    }
    function ow(a, b) { return a < 0 || b < 0 || a >= S || b >= S ? -1 : own[b * S + a]; }
    for (py = 0; py < S; py++) for (px = 0; px < S; px++) {
      var o = own[py * S + px];
      if (o < 0) continue;
      var lb = L[o], wx = px + x0, wy = py + y0, nx = (wx - lb.x) / lb.r, ny = (wy - lb.y) / lb.r;
      var l = -(0.62 * nx + 0.78 * ny) + (hsh(wx, wy) - 0.5) * 0.5 + (hsh((wx / 3) | 0, (wy / 3) | 0) - 0.5) * 0.4;
      var col = l > 0.62 ? C.hi : l > 0.2 ? C.lit : l > -0.32 ? C.base : C.shade;
      if (ow(px - 1, py) < 0 || ow(px + 1, py) < 0 || ow(px, py - 1) < 0 || ow(px, py + 1) < 0) col = nx + ny < -0.4 ? C.shade : C.dark;
      else { var a = ow(px - 1, py), b = ow(px, py - 1); if ((a >= 0 && a < o) || (b >= 0 && b < o)) col = l > 0.4 ? C.base : C.shade; }
      g.fillStyle = col; g.fillRect(wx, wy, 1, 1);
    }
  }
  function paintWorld(g, W, P) {
    var r = mulberry(31337), WW = W.WW, WH = W.WH, x, y, k, i;
    g.imageSmoothingEnabled = false; g.globalAlpha = 1;
    var grass = mixc(P.gr, [18, 60, 26], 0.42), g2 = mixc(grass, [0, 25, 10], 0.25), g3 = mixc(grass, [140, 190, 80], 0.13);
    g.fillStyle = rgb(grass); g.fillRect(0, 0, WW, WH);
    for (k = 0; k < WW * WH / 220; k++) blobAt(g, Math.floor(r() * WW), Math.floor(r() * WH), 2 + Math.floor(r() * 5), 1 + Math.floor(r() * 3), r() < 0.55 ? g2 : g3);
    // lighter blades and little shadow flecks so the ground is not flat
    for (k = 0; k < WW * WH / 170; k++) {
      var tx = Math.floor(r() * WW), ty = Math.floor(r() * W.shoreY);
      g.fillStyle = rgb(g3); g.fillRect(tx, ty, 1, 2); g.fillRect(tx - 1, ty - 1, 1, 1); g.fillRect(tx + 1, ty - 1, 1, 1);
      g.fillStyle = rgb(g2); g.fillRect(tx, ty + 2, 1, 1);
    }
    // fallen leaves
    var leaf = [[182, 112, 52], [204, 150, 60], [128, 78, 42]];
    for (k = 0; k < WW * WH / 140; k++) { g.fillStyle = rgb(mixc(leaf[k % 3], grass, 0.35)); g.fillRect(Math.floor(r() * WW), Math.floor(r() * W.shoreY), 1 + (k & 1), 1); }
    // clearings are brighter and have flowers
    W.glades.forEach(function (gl) {
      var cx = Math.round(gl.x), cy = Math.round(gl.y);
      blobAt(g, cx, cy, gl.r, gl.r * 0.85, mixc(grass, [150, 200, 90], 0.22));
      blobAt(g, cx, cy, gl.r - 5, (gl.r - 5) * 0.85, mixc(grass, [170, 215, 100], 0.2));
    });
    // dirt trails
    var dirt = mixc([170, 134, 88], grass, 0.22), dirtD = mixc(dirt, [60, 40, 20], 0.3);
    W.trailPts.forEach(function (p) { blobAt(g, Math.round(p[0]), Math.round(p[1]), 6, 5, dirtD); });
    W.trailPts.forEach(function (p) { blobAt(g, Math.round(p[0]), Math.round(p[1]), 5, 4, dirt); });
    W.trailPts.forEach(function (p, idx) { if (idx % 5 === 0) { g.fillStyle = rgb(mixc(dirt, [255, 240, 200], 0.25)); g.fillRect(Math.round(p[0] + (r() - 0.5) * 7), Math.round(p[1] + (r() - 0.5) * 6), 1, 1); } });
    // pebbles and ruts along the trails
    W.trailPts.forEach(function (p, idx) {
      if (idx % 3) return;
      var ex = Math.round(p[0] + (r() < 0.5 ? -1 : 1) * (4 + r() * 2)), ey = Math.round(p[1] + (r() - 0.5) * 6);
      g.fillStyle = rgb(mixc(dirtD, [255, 255, 255], 0.1)); g.fillRect(ex, ey, 2, 1);
      if (r() < 0.4) { g.fillStyle = '#c9ced6'; g.fillRect(Math.round(p[0] + (r() - 0.5) * 8), Math.round(p[1] + (r() - 0.5) * 6), 1, 1); }
    });
    // ferns, moss, grass tufts and flowers
    var fern = mixc(grass, [40, 120, 50], 0.4);
    for (k = 0; k < WW * WH / 500; k++) {
      var fx = Math.floor(r() * WW), fy = Math.floor(r() * W.shoreY);
      g.fillStyle = rgb(fern); g.fillRect(fx, fy, 1, 3); g.fillRect(fx - 2, fy + 1, 5, 1); g.fillRect(fx - 1, fy, 1, 1); g.fillRect(fx + 1, fy, 1, 1);
    }
    var fl = ['#fffaf0', '#f48fb1', '#ffd75a', '#cdb6ff', '#ff9a8a'];
    W.glades.forEach(function (gl) {
      for (k = 0; k < 14; k++) {
        var a = r() * 6.283, d = r() * gl.r * 0.9;
        g.fillStyle = fl[k % fl.length]; g.fillRect(Math.round(gl.x + Math.cos(a) * d), Math.round(gl.y + Math.sin(a) * d * 0.85), 1, 1);
        g.fillStyle = rgb(fern); g.fillRect(Math.round(gl.x + Math.cos(a) * d), Math.round(gl.y + Math.sin(a) * d * 0.85) + 1, 1, 1);
      }
    });
    // the places to play
    var wcol = mixc(P.wL, P.wD, 0.3), tpx = function (x, y, c) { g.fillStyle = c; g.fillRect(x, y, 1, 1); };
    W.pois.forEach(function (p) {
      var x = p.x, y = p.y, a, i2;
      if (p.id === 'ring') {
        blobAt(g, x, y, 9, 7, mixc(grass, [170, 215, 100], 0.3));
        for (i2 = 0; i2 < 9; i2++) {
          a = i2 / 9 * 6.283; var mx = Math.round(x + Math.cos(a) * 10), my = Math.round(y + Math.sin(a) * 8);
          g.fillStyle = '#fffaf0'; g.fillRect(mx, my + 1, 1, 2);
          g.fillStyle = '#a42f3a'; g.fillRect(mx - 2, my - 1, 5, 2); g.fillStyle = '#d94a4a'; g.fillRect(mx - 1, my - 2, 3, 1); g.fillRect(mx - 2, my - 1, 5, 1);
          tpx(mx - 1, my - 1, '#fffaf0'); tpx(mx + 1, my - 1, '#fffaf0');
        }
      } else if (p.id === 'leaves') {
        g.globalAlpha = 0.3; blobAt(g, x + 2, y + 3, 10, 6, [0, 0, 0]); g.globalAlpha = 1;
        blobAt(g, x, y, 10, 7, [150, 74, 36]); blobAt(g, x - 1, y - 1, 8, 5, [190, 110, 44]);
        var lc = ['#d9a441', '#c8873a', '#b2542f', '#e0c25a'];
        for (i2 = 0; i2 < 70; i2++) { var lx = Math.round(x + (r() - 0.5) * 18), ly = Math.round(y + (r() - 0.5) * 12); if (Math.pow((lx - x) / 9, 2) + Math.pow((ly - y) / 6, 2) < 1) { g.fillStyle = lc[i2 % 4]; g.fillRect(lx, ly, 2, 1); } }
      } else if (p.id === 'log') {
        g.globalAlpha = 0.3; g.fillStyle = '#000'; g.fillRect(x - 10, y + 3, 22, 3); g.globalAlpha = 1;
        g.fillStyle = '#5a3a1e'; g.fillRect(x - 11, y - 3, 22, 7); g.fillStyle = '#8a5a30'; g.fillRect(x - 11, y - 3, 22, 5); g.fillStyle = '#a8723f'; g.fillRect(x - 11, y - 3, 22, 2);
        g.fillStyle = '#5a3a1e'; for (i2 = 0; i2 < 5; i2++) g.fillRect(x - 8 + i2 * 4, y - 2 + (i2 & 1), 1, 3);
        g.fillStyle = '#4a8a3f'; g.fillRect(x - 6, y - 3, 4, 1); g.fillRect(x + 2, y + 2, 3, 1);
        blobAt(g, x + 11, y, 2, 3, [217, 179, 140]); tpx(x + 11, y, '#a9825a');
        g.fillStyle = '#7a4d28'; g.fillRect(x - 3, y + 4, 4, 2); g.fillRect(x - 12, y + 3, 3, 3);
      } else if (p.id === 'hammock') {
        [-13, 13].forEach(function (dx) { blobAt(g, x + dx, y, 3, 3, [90, 58, 30]); blobAt(g, x + dx - 1, y - 1, 2, 2, [138, 90, 48]); });
        g.fillStyle = '#e8d9a0'; g.fillRect(x - 10, y - 4, 20, 8); g.fillStyle = '#6aa9e0';
        for (i2 = 0; i2 < 20; i2 += 4) g.fillRect(x - 10 + i2, y - 4, 2, 8);
        g.fillStyle = '#7a4d28'; g.fillRect(x - 10, y - 5, 20, 1); g.fillRect(x - 10, y + 4, 20, 1);
        g.fillStyle = '#d9b38c'; g.fillRect(x - 12, y - 1, 2, 1); g.fillRect(x + 10, y - 1, 2, 1);
      } else if (p.id === 'picnic') {
        g.globalAlpha = 0.28; g.fillStyle = '#000'; g.fillRect(x - 10, y - 6, 24, 18); g.globalAlpha = 1;
        for (var by = 0; by < 16; by += 4) for (var bx = 0; bx < 22; bx += 4) { g.fillStyle = ((bx + by) / 4) % 2 ? '#fffaf0' : '#d94a4a'; g.fillRect(x - 11 + bx, y - 8 + by, 4, 4); }
        g.fillStyle = '#7a4d28'; g.fillRect(x + 4, y - 7, 6, 5); g.fillStyle = '#a8723f'; g.fillRect(x + 4, y - 7, 6, 2); g.fillStyle = '#5a3a1e'; g.fillRect(x + 5, y - 9, 4, 1);
        g.fillStyle = '#fffaf0'; g.fillRect(x - 8, y + 3, 4, 3); g.fillRect(x + 2, y + 3, 4, 3); tpx(x - 7, y + 4, '#d94a4a'); tpx(x + 3, y + 4, '#ffd75a');
      } else if (p.id === 'pond') {
        blobAt(g, x, y, 14, 9, [92, 92, 100]); blobAt(g, x, y, 12, 8, [74, 120, 90]);
        blobAt(g, x, y, 11, 7, wcol); blobAt(g, x + 1, y + 1, 8, 5, mixc(wcol, [0, 20, 50], 0.18));
        for (i2 = 0; i2 < 16; i2++) { a = i2 / 16 * 6.283; g.fillStyle = i2 % 3 ? '#9aa0a8' : '#c9ced6'; g.fillRect(Math.round(x + Math.cos(a) * 13), Math.round(y + Math.sin(a) * 8.5), 2, 2); }
        [[-5, -2], [3, 2], [6, -3]].forEach(function (pd) { blobAt(g, x + pd[0], y + pd[1], 2, 1, [61, 138, 69]); });
        tpx(x - 5, y - 3, '#f48fb1'); tpx(x + 6, y - 4, '#fffaf0');
        g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(x - 7, y + 1, 4, 1); g.fillRect(x + 1, y - 1, 3, 1);
      }
    });
    // boulders
    W.rocks.forEach(function (rk) {
      g.fillStyle = 'rgba(0,0,0,0.25)'; blobAt(g, rk.x + 2, rk.y + 3, rk.r, rk.r * 0.7, [0, 0, 0]); g.globalAlpha = 1;
      lobe(g, rk.x, rk.y, rk.r, rgb([154, 160, 168]), rgb([201, 206, 214]), rgb([108, 114, 124]));
    });
    // tree shadows first, then crowns, so the crowns overlap like a thick canopy
    var treeBase = [mixc(P.far, [16, 84, 36], 0.55), mixc(P.far, [30, 100, 44], 0.5), mixc(P.far, [10, 70, 40], 0.55)];
    g.globalAlpha = 0.28;
    W.trees.forEach(function (t) { blobAt(g, t.x + 3, t.y + 4, t.r * 0.95, t.r * 0.75, [0, 12, 6]); });
    g.globalAlpha = 1;
    var treeC = {};
    W.trees.forEach(function (t) {
      var b = treeBase[t.tone], C = treeC[t.tone] || (treeC[t.tone] = {
        hi: rgb(mixc(b, [200, 240, 130], 0.4)), lit: rgb(mixc(b, [150, 210, 90], 0.2)), base: rgb(b), shade: rgb(mixc(b, [0, 24, 24], 0.36)), dark: rgb(mixc(b, [0, 14, 18], 0.64))
      });
      crown(g, t.x, t.y, t.r, C);
    });
    // the sandy landing, the pond beyond it, and the moored boat from above
    var sand = mixc([226, 205, 150], P.gr, 0.12);
    g.fillStyle = rgb(sand); g.fillRect(0, W.shoreY, WW, 12);
    g.fillStyle = rgb(mixc(sand, [255, 255, 255], 0.22)); g.fillRect(0, W.shoreY, WW, 1);
    for (y = W.shoreY + 12; y < WH; y += 4) { g.fillStyle = rgb(mixc(P.wL, P.wD, Math.min(1, (y - W.shoreY - 12) / 30))); g.fillRect(0, y, WW, 4); }
    g.fillStyle = '#fff'; g.globalAlpha = 0.3;
    for (x = 0; x < WW; x += 4) g.fillRect(x + ((x >> 2) & 1), W.shoreY + 12, 2, 1);
    g.globalAlpha = 1;
    var bx = W.boat.x, by = W.boat.y;
    g.fillStyle = '#5a3a1e'; blobAt(g, bx, by, 6, 12, [90, 58, 30]);
    blobAt(g, bx, by, 5, 11, [168, 114, 63]); blobAt(g, bx, by, 3, 8, [122, 77, 40]);
    g.fillStyle = '#d9b38c'; g.fillRect(bx - 3, by - 3, 7, 1); g.fillRect(bx - 3, by + 3, 7, 1);
  }

  /* ---------- hiding places, seen from above ---------- */
  function makeSpots(outlined) {
    var D = {}, c, g, x, y;
    function disc(g2, cx, cy, rad, col, hi, sh) { lobe(g2, cx, cy, rad, col, hi, sh); }
    c = cv(18, 16); g = c.getContext('2d');
    disc(g, 9, 8, 7, '#3f8a45', '#7ccd6f', '#2d6a38'); disc(g, 5, 9, 4, '#47974b', '#7ccd6f', '#2d6a38'); disc(g, 13, 9, 4, '#47974b', '#7ccd6f', '#2d6a38');
    g.fillStyle = '#d94a4a'; g.fillRect(6, 6, 1, 1); g.fillRect(11, 8, 1, 1); g.fillRect(9, 11, 1, 1);
    D.bush = { c: outlined(c), w: 20, h: 18 };
    c = cv(24, 10); g = c.getContext('2d');
    g.fillStyle = '#8a5a30'; g.fillRect(1, 1, 20, 8); g.fillStyle = '#a8723f'; g.fillRect(1, 1, 20, 3); g.fillStyle = '#6a4222'; g.fillRect(1, 7, 20, 2);
    g.fillStyle = '#5a3a1e'; g.fillRect(5, 3, 1, 4); g.fillRect(11, 3, 1, 4); g.fillRect(16, 3, 1, 4);
    g.fillStyle = '#d9b38c'; g.fillRect(20, 1, 3, 8); g.fillStyle = '#a9825a'; g.fillRect(21, 3, 1, 4);
    D.log = { c: outlined(c), w: 26, h: 12 };
    c = cv(16, 12); g = c.getContext('2d');
    disc(g, 8, 6, 5, '#9aa0a8', '#d8dde6', '#6c727c'); disc(g, 4, 7, 3, '#aab0b8', '#d8dde6', '#6c727c'); disc(g, 12, 8, 3, '#8f959d', '#c9ced6', '#6c727c');
    D.rock = { c: outlined(c), w: 18, h: 14 };
    c = cv(14, 14); g = c.getContext('2d');
    disc(g, 7, 7, 6, '#8a5a30', '#d9b38c', '#5a3a1e'); g.fillStyle = '#d9b38c'; g.fillRect(3, 3, 8, 8); g.fillStyle = '#a9825a'; g.fillRect(4, 4, 6, 6); g.fillStyle = '#d9b38c'; g.fillRect(5, 5, 4, 4); g.fillStyle = '#a9825a'; g.fillRect(6, 6, 2, 2);
    D.stump = { c: outlined(c), w: 16, h: 16 };
    c = cv(16, 12); g = c.getContext('2d');
    disc(g, 8, 6, 6, '#6a4a2a', '#a08060', '#3a2814'); g.fillStyle = '#1e1b2e'; blobAt(g, 8, 6, 4, 3, [30, 27, 46]);
    g.fillStyle = '#6a4a2a'; g.fillRect(3, 2, 2, 1); g.fillRect(11, 9, 2, 1);
    D.burrow = { c: outlined(c), w: 18, h: 14 };
    c = cv(18, 14); g = c.getContext('2d');
    disc(g, 9, 7, 7, '#3d8a45', '#6cbf62', '#2a6a35');
    [[3, 3, '#f48fb1'], [8, 2, '#fffaf0'], [13, 4, '#ffd75a'], [5, 7, '#cdb6ff'], [10, 8, '#f48fb1'], [14, 9, '#fffaf0'], [7, 11, '#ffd75a']].forEach(function (f) { g.fillStyle = f[2]; g.fillRect(f[0], f[1], 2, 2); });
    D.flowers = { c: outlined(c), w: 20, h: 16 };
    c = cv(18, 14); g = c.getContext('2d');
    [[4, 4, 3], [10, 3, 4], [13, 8, 3], [6, 9, 3]].forEach(function (m) {
      g.fillStyle = '#d94a4a'; blobAt(g, m[0], m[1], m[2], m[2] - 1, [217, 74, 74]);
      g.fillStyle = '#fffaf0'; g.fillRect(m[0] - 1, m[1] - 1, 1, 1); g.fillRect(m[0] + 1, m[1], 1, 1);
    });
    D.mush = { c: outlined(c), w: 20, h: 16 };
    return D;
  }

  /* ---------- top-down characters (drawn facing north; rotated for the other directions) ---------- */
  function G(rows) { return rows.map(function (r) { return r.split(''); }); }
  function rotCW(g) {
    var H = g.length, W = g[0].length, o = [], i, j;
    for (j = 0; j < W; j++) { o.push([]); for (i = 0; i < H; i++) o[j].push(g[H - 1 - i][j]); }
    return o;
  }
  function rotK(g, k) { var o = g; for (var i = 0; i < k; i++) o = rotCW(o); return o; }
  var DIRK = { n: 0, e: 1, s: 2, w: 3 };

  var JUNE_A = G([
    '...fff...', '..hhhhh..', '.hhhhhhh.', '.hhhHhhh.', '.hhhhhhh.', '..hhhhh..', '.ccccccc.', 'fcccCcccf', '.ccccccc.', '..jj.jj..', '..ee.ee..']);
  var JUNE_B = G([
    '...fff...', '..hhhhh..', '.hhhhhhh.', '.hhhHhhh.', '.hhhhhhh.', '..hhhhh..', '.ccccccc.', 'fcccCcccf', '.ccccccc.', '...jjj...', '...eee...']);
  var DOG_A = G([
    '...kk...', '..tttt..', '.NttttN.', '.NttttN.', '..tttt..', '.tttttt.', '.tttttt.', '.tTttTt.', '.tttttt.', '..tttt..', '...Tt...']);
  var DOG_B = G([
    '...kk...', '..tttt..', '.NttttN.', '.NttttN.', '..tttt..', '.tttttt.', '.tttttt.', '.tTttTt.', '.tttttt.', '..tttt..', '..T.t...']);
  var GOOSE_A = G([
    '...oo...', '...ww...', '..kwwk..', '...ww...', '.wwwwww.', 'wwwwwwww', 'wwsswsww', 'wwwwwwww', '.wwwwww.', '..wwww..', '...ww...']);
  var GOOSE_B = G([
    '...oo...', '...ww...', '..kwwk..', '...ww...', '.wwwwww.', 'wwwwwwww', 'wwsswsww', 'wwwwwwww', '.wwwwww.', '.owwwwo.', '...ww...']);
  var HAT_PIX = [[3, 1, 'V'], [4, 1, 'V'], [3, 0, 'q'], [4, 0, 'q']];

  function patch(g, ops) { var o = g.map(function (r) { return r.slice(); }); ops.forEach(function (p) { o[p[1]][p[0]] = p[2]; }); return o; }

  var cache = {};
  function tdSprite(kind, frame, dir, opt) {
    opt = opt || {};
    var key = kind + frame + dir + (opt.stage || '') + (opt.hat ? 'h' : '');
    if (cache[key]) return cache[key];
    var base = kind === 'june' ? [JUNE_A, JUNE_B][frame] : kind === 'dog' ? [DOG_A, DOG_B][frame] : [GOOSE_A, GOOSE_B][frame], pal = null;
    if (kind === 'goose') {
      if (opt.hat) base = patch(base, HAT_PIX);
      var ratio = opt.stage === 0 ? 0.62 : opt.stage === 1 ? 0.82 : 1;
      if (ratio < 1) base = SPR.shrink(base, ratio);
      pal = {}; for (var k in SPR.PAL) pal[k] = SPR.PAL[k];
      if (opt.stage === 0) { pal.w = '#f8e28c'; pal.s = '#dcc064'; } else if (opt.stage === 1) { pal.w = '#e9e2cf'; pal.s = '#bfb49b'; }
    }
    var c = SPR.outlined(SPR.build(rotK(base, DIRK[dir]), pal));
    cache[key] = c; return c;
  }

  /* little animals */
  var FROG = SPR.build(G(['.k...k.', '.ggggg.', 'ggGgGgg', '.ggggg.', 'gg...gg', 'g.....g']));
  var SQUIRREL = SPR.build(G(['..TT....', '.TTTnnn.', '.TTnnnnk', '..nnnnn.', '...n.n..']));
  var EXCL = SPR.build(G(['QQ', 'QQ', 'QQ', '..', 'QQ']));

  window.Forest = {
    ITEMS: ITEMS, FOREST_POOL: FOREST_POOL, DIG_POOL: DIG_POOL, BUILDS: BUILDS, GIFT_POOL: GIFT_POOL, BIRDS: BIRDS, VISITORS: VISITORS,
    build: build, makeNav: makeNav, paintWorld: paintWorld, makeSpots: makeSpots, tdSprite: tdSprite,
    FROG: FROG, SQUIRREL: SQUIRREL, EXCL: EXCL, mixc: mixc, rgb: rgb
  };
})();
