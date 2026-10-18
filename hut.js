/* Inside June's hut: a cozy cutaway room with a bed, a small kitchen, a table, a window onto the pond
   and a shelf for everything she has collected. Furniture is sized for June (about 23 pixels tall):
   counters and tables come up to her waist, the door is a little taller than she is. Also the recipes. */
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

  /* ---------- the kitchen: what she can cook (each uses up the ingredients listed) ---------- */
  var RECIPES = [
    { id: 'jam', needs: { berry: 2 } },
    { id: 'soup', needs: { mushroom: 2 } },
    { id: 'tea', needs: { pinecone: 1, flower: 1 } },
    { id: 'salad', needs: { clover: 1, berry: 1 } },
    { id: 'cocoa', needs: { chocolate: 1, marshmallow: 1 } },
    { id: 'porridge', needs: { acorn: 2 } }
  ];
  var DISH = {
    jam: ["..........", "..........", ".tttttttt.", ".tTttttTt.", ".trrrrrrt.", ".trRrrRrt.", ".trrrrrrt.", ".tttttttt.", "..zzzzzz..", ".........."],
    soup: ["..........", "...x..x...", "..........", ".nnnnnnnn.", "nyyyyyyyyn", "nyYyyyYyyn", ".nyyyyyyn.", "..nnnnnn..", "..........", ".........."],
    tea: ["..........", "....x..x..", "..........", ".uuuuuu...", ".uggggu.uu", ".ugGgGu..u", ".uggggu.uu", "..uuuu....", ".uuuuuu...", ".........."],
    salad: ["..........", "..........", ".zzzzzzzz.", "zgggrgggGz", "zgGgggrggz", "zggGgggGgz", ".zgggggz..", "..zzzzzz..", "..........", ".........."],
    cocoa: ["..........", "...x..x...", "..........", ".hhhhhh...", ".hzzzzh.hh", ".hhhhhh..h", ".hhhhhh.hh", "..hhhh....", ".hhhhhh...", ".........."],
    porridge: ["..........", "...x..x...", "..........", ".zzzzzzzz.", "zttttttttz", "zttNtttNtz", ".zttttttz.", "..zzzzzz..", "..........", ".........."]
  };

  /* ---------- where everything is (x from the room's left wall, y = scene height with the floor at 168) ---------- */
  var FLOOR = 168, CEIL = 96, ROOM_W = 300;
  var SPOTS = {
    bed: { x0: 10, x1: 66, y0: 150, y1: 168, stand: 72 },
    shelf: { x0: 16, x1: 86, y0: 108, y1: 140, stand: 52 },
    window: { x0: 98, x1: 126, y0: 110, y1: 136, stand: 112 },
    plant: { x0: 90, x1: 106, y0: 152, y1: 168, stand: 84 },
    dogbed: { x0: 130, x1: 152, y0: 160, y1: 168 },
    table: { x0: 164, x1: 202, y0: 152, y1: 168, stand: 150 },
    picture: { x0: 174, x1: 190, y0: 118, y1: 132, stand: 182 },
    stove: { x0: 212, x1: 238, y0: 146, y1: 168, stand: 224 },
    counter: { x0: 240, x1: 268, y0: 150, y1: 168, stand: 254 },
    door: { x0: 272, x1: 298, y0: 128, y1: 168, stand: 286 }
  };
  // shelf slots (x from the wall, y of the top of a 10x10 item): two rows over the bed
  var SHELF_SLOTS = [[22, 126], [34, 126], [46, 126], [58, 126], [70, 126], [22, 108], [34, 108], [46, 108], [58, 108], [70, 108]];
  var SHELF_BOARDS = [136, 118];

  /* ---------- the furniture, pre-rendered once ---------- */
  function box(g, x, y, w, h, c) { g.fillStyle = c; g.fillRect(x, y, w, h); }
  function makeFurniture() {
    var F = {}, c, g, i;
    // bed with a patchwork quilt (height about waist-high on June)
    c = cv(56, 18); g = c.getContext('2d');
    box(g, 0, 1, 3, 17, '#7a4d28'); box(g, 0, 0, 3, 2, '#a8723f'); box(g, 53, 8, 3, 10, '#7a4d28');
    box(g, 3, 10, 50, 3, '#a8723f'); box(g, 3, 14, 50, 4, '#7a4d28');
    box(g, 3, 6, 50, 5, '#fffaf0'); box(g, 4, 3, 11, 5, '#fff3c4'); box(g, 4, 3, 11, 1, '#fffaf0');
    box(g, 16, 6, 37, 6, '#e8707a');
    for (i = 0; i < 6; i++) { box(g, 17 + i * 6, 7, 3, 2, '#f6a8ae'); box(g, 20 + i * 6, 9, 3, 2, '#c4515e'); }
    box(g, 16, 12, 37, 1, '#c4515e');
    F.bed = { c: SPR.outlined(c), w: 58, h: 20 };
    // iron stove with a pipe
    c = cv(26, 22); g = c.getContext('2d');
    box(g, 1, 8, 24, 14, '#4a4f5a'); box(g, 1, 8, 24, 2, '#6c727c'); box(g, 3, 12, 20, 8, '#2f333c'); box(g, 5, 14, 16, 4, '#3d424d');
    box(g, 6, 15, 3, 1, '#9aa0a8'); box(g, 2, 20, 3, 2, '#2f333c'); box(g, 21, 20, 3, 2, '#2f333c');
    box(g, 19, 0, 4, 9, '#4a4f5a'); box(g, 18, 0, 6, 2, '#6c727c');
    F.stove = { c: SPR.outlined(c), w: 28, h: 24 };
    // kettle (steam is drawn live)
    c = cv(9, 8); g = c.getContext('2d');
    box(g, 1, 3, 7, 5, '#9aa0a8'); box(g, 1, 3, 7, 1, '#d8dde6'); box(g, 3, 1, 3, 2, '#6c727c'); box(g, 8, 4, 1, 2, '#9aa0a8');
    F.kettle = { c: SPR.outlined(c), w: 11, h: 10 };
    // counter with a sink and cupboards
    c = cv(28, 17); g = c.getContext('2d');
    box(g, 0, 4, 28, 13, '#a8723f'); box(g, 0, 2, 28, 3, '#d9b38c'); box(g, 2, 7, 10, 9, '#8a5a30'); box(g, 15, 7, 10, 9, '#8a5a30');
    box(g, 10, 10, 2, 2, '#d9b38c'); box(g, 15, 10, 2, 2, '#d9b38c');
    box(g, 17, 0, 7, 3, '#8fcbe6'); box(g, 17, 0, 7, 1, '#d8eeff'); box(g, 21, 0, 1, 3, '#9aa0a8');
    F.counter = { c: SPR.outlined(c), w: 30, h: 19 };
    // wall shelf with jars
    c = cv(38, 14); g = c.getContext('2d');
    box(g, 0, 11, 38, 3, '#7a4d28'); box(g, 0, 11, 38, 1, '#a8723f');
    [['#d94a4a', 2], ['#f0c477', 11], ['#5fb55c', 20], ['#a88ae0', 29]].forEach(function (j) { box(g, j[1], 4, 7, 7, j[0]); box(g, j[1], 2, 7, 2, '#d8eeff'); box(g, j[1] + 1, 5, 1, 3, 'rgba(255,255,255,0.5)'); });
    F.jars = { c: SPR.outlined(c), w: 40, h: 16 };
    // table (waist height) with a runner
    c = cv(38, 16); g = c.getContext('2d');
    box(g, 0, 2, 38, 3, '#c98f4e'); box(g, 0, 2, 38, 1, '#e6b97a'); box(g, 0, 5, 38, 2, '#8a5a30'); box(g, 11, 3, 16, 1, '#e8707a');
    box(g, 3, 7, 3, 9, '#7a4d28'); box(g, 32, 7, 3, 9, '#7a4d28');
    F.table = { c: SPR.outlined(c), w: 40, h: 18 };
    // chair: the back is on the LEFT so the seat faces the table to its right
    c = cv(13, 18); g = c.getContext('2d');
    box(g, 0, 0, 3, 18, '#8a5a30'); box(g, 0, 0, 3, 2, '#a8723f');
    box(g, 3, 9, 10, 3, '#a8723f'); box(g, 3, 9, 10, 1, '#c98f4e');
    box(g, 4, 12, 2, 6, '#7a4d28'); box(g, 10, 12, 2, 6, '#7a4d28');
    F.chair = { c: SPR.outlined(c), w: 15, h: 20 };
    // round rug
    c = cv(46, 5); g = c.getContext('2d');
    box(g, 3, 1, 40, 3, '#c4515e'); box(g, 1, 2, 44, 2, '#c4515e'); box(g, 6, 1, 34, 3, '#f6a8ae'); box(g, 11, 2, 24, 1, '#c4515e');
    F.rug = { c: c, w: 46, h: 5 };
    // floor lamp
    c = cv(10, 28); g = c.getContext('2d');
    box(g, 4, 8, 2, 18, '#7a4d28'); box(g, 1, 26, 8, 2, '#7a4d28'); box(g, 0, 2, 10, 7, '#ffd75a'); box(g, 2, 1, 6, 2, '#e0a526'); box(g, 1, 3, 8, 2, '#fff3c4');
    F.lamp = { c: SPR.outlined(c), w: 12, h: 30 };
    // potted plant
    c = cv(12, 16); g = c.getContext('2d');
    box(g, 3, 9, 7, 7, '#c4515e'); box(g, 2, 8, 9, 2, '#e8707a');
    [[6, 1, 2, 8], [2, 4, 3, 3], [8, 3, 3, 3], [1, 6, 3, 3], [9, 6, 3, 3]].forEach(function (l) { box(g, l[0], l[1], l[2], l[3], '#5fb55c'); });
    box(g, 6, 3, 1, 6, '#3d8a45');
    F.plant = { c: SPR.outlined(c), w: 14, h: 18 };
    // the puppy's bed
    c = cv(22, 7); g = c.getContext('2d');
    box(g, 1, 2, 20, 5, '#7a4d28'); box(g, 3, 0, 16, 4, '#9a6a3c'); box(g, 4, 1, 14, 3, '#c9a27a');
    F.dogbed = { c: SPR.outlined(c), w: 24, h: 9 };
    // a framed picture of the goose
    c = cv(16, 14); g = c.getContext('2d');
    box(g, 0, 0, 16, 14, '#7a4d28'); box(g, 2, 2, 12, 10, '#bfe8f5'); box(g, 2, 9, 12, 3, '#7ec0e0');
    box(g, 5, 4, 5, 4, '#fbf8f0'); box(g, 8, 3, 3, 3, '#fbf8f0'); box(g, 10, 4, 2, 1, '#f29a2e'); box(g, 9, 4, 1, 1, '#1e1b2e');
    F.picture = { c: SPR.outlined(c), w: 18, h: 16 };
    // a hook for the tiny hat
    c = cv(8, 7); g = c.getContext('2d');
    box(g, 3, 0, 2, 4, '#6c727c'); box(g, 2, 3, 4, 2, '#9aa0a8'); box(g, 1, 2, 2, 2, '#9aa0a8');
    F.hook = { c: c, w: 8, h: 7 };
    return F;
  }

  /* ---------- the room, roof, sky and garden, drawn once into a canvas ---------- */
  function paintRoom(g, o) {
    var P = o.P, HW = o.HW, lh = o.lh, oy = o.oy, rx = o.rx, r = mulberry(555), x, y, k;
    var ceilY = oy + CEIL, floorY = oy + FLOOR;
    g.imageSmoothingEnabled = false; g.globalAlpha = 1;
    for (y = 0; y < floorY + 20; y += 4) { g.fillStyle = rgb(mixc(P.skyT, P.skyB, Math.min(1, y / (floorY + 20)))); g.fillRect(0, y, HW, 4); }
    // distant mountains, hills and trees behind the hut
    [[0.7, 34, 0.014, 0.7], [0.55, 22, 0.03, 2.1]].forEach(function (mt, li) {
      g.fillStyle = rgb(mixc(P.far, P.skyB, mt[0]));
      for (x = 0; x < HW; x++) {
        var nz = Math.abs(Math.sin(x * mt[2] + mt[3]) + 0.6 * Math.sin(x * mt[2] * 2.3 + 1.1)) / 1.6, hh = Math.round(mt[1] * (0.35 + 0.65 * nz));
        g.fillRect(x, floorY + 6 - 26 - hh, 1, hh + 26);
      }
    });
    g.fillStyle = rgb(mixc(P.far, P.skyB, 0.4));
    for (x = 0; x < HW; x++) { var h1 = Math.round(18 + 8 * Math.sin(x * 0.03 + 1) + 4 * Math.sin(x * 0.09)); g.fillRect(x, floorY + 6 - h1, 1, h1 + 1); }
    g.fillStyle = rgb(P.far);
    for (x = 0; x < HW; x += 5 + Math.floor(r() * 5)) { var th = 8 + Math.floor(r() * 10); g.fillRect(x, floorY + 8 - th, 4, th); g.fillRect(x + 1, floorY + 6 - th, 2, 2); }
    g.fillStyle = rgb(mixc(P.gr, [20, 60, 25], 0.1)); g.fillRect(0, floorY + 8, HW, lh - floorY);
    for (k = 0; k < HW * 0.5; k++) { g.fillStyle = r() < 0.5 ? rgb(P.gr2) : rgb(mixc(P.gr, [255, 255, 255], 0.14)); g.fillRect(Math.floor(r() * HW), floorY + 12 + Math.floor(r() * Math.max(1, lh - floorY - 14)), 2, 1); }
    // roof: a big gable with shingles and a chimney over the stove
    var peakY = ceilY - Math.max(18, Math.min(54, ceilY - 6)), roofL = rx - 14, roofR = rx + ROOM_W + 14, mid = rx + ROOM_W / 2, row = 0;
    for (y = peakY; y < ceilY; y += 3, row++) {
      var half = (roofR - roofL) / 2 * ((y - peakY) / (ceilY - peakY));
      g.fillStyle = rgb(mixc([176, 60, 56], P.gr2, 0.1 + (row & 1) * 0.08)); g.fillRect(mid - half, y, half * 2, 3);
      g.fillStyle = rgb(mixc([120, 36, 40], P.gr2, 0.1)); for (x = mid - half + (row & 1) * 3; x < mid + half; x += 6) g.fillRect(x, y + 2, 5, 1);
    }
    g.fillStyle = '#5a3a1e'; g.fillRect(roofL, ceilY - 1, roofR - roofL, 4);
    g.fillStyle = '#6c727c'; g.fillRect(rx + 226, peakY + 6, 12, ceilY - peakY - 4); g.fillStyle = '#9aa0a8'; g.fillRect(rx + 224, peakY + 4, 16, 4);
    // the room
    var wall = [214, 168, 112];
    for (x = rx; x < rx + ROOM_W; x += 1) { g.fillStyle = rgb(mixc(wall, [60, 30, 10], x % 12 === 0 ? 0.18 : 0)); g.fillRect(x, ceilY + 4, 1, floorY - ceilY - 4); }
    g.fillStyle = rgb(mixc(wall, [60, 30, 10], 0.22)); g.fillRect(rx, floorY - 10, ROOM_W, 10);
    g.fillStyle = rgb(mixc(wall, [255, 240, 200], 0.2)); g.fillRect(rx, floorY - 11, ROOM_W, 1);
    g.fillStyle = '#7a4d28'; g.fillRect(rx, ceilY + 4, ROOM_W, 5); g.fillStyle = '#a8723f'; g.fillRect(rx, ceilY + 4, ROOM_W, 1);
    for (x = rx + 30; x < rx + ROOM_W; x += 70) { g.fillStyle = '#7a4d28'; g.fillRect(x, ceilY + 9, 4, 6); }
    g.fillStyle = '#7a4d28'; g.fillRect(rx - 8, ceilY, 8, floorY + 10 - ceilY); g.fillRect(rx + ROOM_W, ceilY, 8, floorY + 10 - ceilY);
    g.fillStyle = '#a8723f'; g.fillRect(rx - 8, ceilY, 2, floorY + 10 - ceilY); g.fillRect(rx + ROOM_W, ceilY, 2, floorY + 10 - ceilY);
    for (x = rx; x < rx + ROOM_W; x++) { g.fillStyle = rgb(mixc([166, 116, 68], [60, 30, 10], x % 18 === 0 ? 0.25 : 0)); g.fillRect(x, floorY, 1, 8); }
    g.fillStyle = '#8a5a30'; g.fillRect(rx - 8, floorY + 8, ROOM_W + 16, 3);
    g.fillStyle = rgb(mixc([120, 126, 136], P.gr, 0.2));
    for (x = rx - 8; x < rx + ROOM_W + 8; x += 9) g.fillRect(x, floorY + 11, 8, 4);
    // the window with a view of the pond
    var wx = rx + SPOTS.window.x0, wy = oy + SPOTS.window.y0, ww = SPOTS.window.x1 - SPOTS.window.x0, wh = SPOTS.window.y1 - SPOTS.window.y0;
    for (y = 0; y < wh; y += 2) { g.fillStyle = rgb(mixc(P.skyT, P.skyB, y / wh)); g.fillRect(wx, wy + y, ww, 2); }
    if (P.star > 0.4) {
      g.fillStyle = '#fff'; for (k = 0; k < 7; k++) g.fillRect(wx + 2 + Math.floor(r() * (ww - 4)), wy + 2 + Math.floor(r() * (wh * 0.5)), 1, 1);
      g.fillStyle = '#fff3c4'; g.fillRect(wx + ww - 9, wy + 4, 4, 4); g.fillStyle = rgb(P.skyT); g.fillRect(wx + ww - 8, wy + 3, 3, 3);
    }
    g.fillStyle = rgb(mixc(P.far, P.skyB, 0.4)); for (x = 0; x < ww; x++) { var h2 = Math.round(5 + 2 * Math.sin(x * 0.3 + 1)); g.fillRect(wx + x, wy + wh * 0.62 - h2 + 3, 1, h2); }
    g.fillStyle = rgb(P.far); for (x = 0; x < ww; x += 4) g.fillRect(wx + x, wy + wh * 0.62, 3, 4);
    g.fillStyle = rgb(mixc(P.wL, P.wD, 0.3)); g.fillRect(wx, wy + wh * 0.74, ww, wh * 0.26);
    g.fillStyle = '#fff'; g.globalAlpha = 0.3; g.fillRect(wx + 3, wy + wh * 0.82, 7, 1); g.fillRect(wx + 15, wy + wh * 0.9, 8, 1); g.globalAlpha = 1;
    g.fillStyle = '#7a4d28'; g.fillRect(wx - 2, wy - 2, ww + 4, 2); g.fillRect(wx - 2, wy + wh, ww + 4, 3); g.fillRect(wx - 2, wy - 2, 2, wh + 5); g.fillRect(wx + ww, wy - 2, 2, wh + 5);
    g.fillRect(wx + ww / 2 - 1, wy, 2, wh); g.fillRect(wx, wy + wh / 2 - 1, ww, 2);
    g.fillStyle = '#e8707a'; g.fillRect(wx - 4, wy - 2, 4, wh + 5); g.fillRect(wx + ww, wy - 2, 4, wh + 5);
    // the door on the right, a little taller than June
    var dx0 = rx + SPOTS.door.x0 + 2, dy0 = oy + SPOTS.door.y0, dw = SPOTS.door.x1 - SPOTS.door.x0 - 4;
    g.fillStyle = '#7a4d28'; g.fillRect(dx0 - 2, dy0 - 2, dw + 4, floorY - dy0 + 2);
    g.fillStyle = '#a8723f'; g.fillRect(dx0, dy0, dw, floorY - dy0);
    g.fillStyle = '#8a5a30'; for (x = dx0 + 5; x < dx0 + dw; x += 6) g.fillRect(x, dy0, 1, floorY - dy0);
    g.fillStyle = '#ffd75a'; g.fillRect(dx0 + 3, dy0 + 20, 3, 3);
    g.fillStyle = '#c4515e'; g.fillRect(dx0 - 2, floorY, dw + 4, 3);
  }

  window.Hut = {
    RECIPES: RECIPES, DISH: DISH, SPOTS: SPOTS, SHELF_SLOTS: SHELF_SLOTS, SHELF_BOARDS: SHELF_BOARDS, FLOOR: FLOOR, CEIL: CEIL, ROOM_W: ROOM_W,
    makeFurniture: makeFurniture, paintRoom: paintRoom
  };
})();
