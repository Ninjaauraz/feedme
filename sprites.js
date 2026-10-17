/* Goose Pond sprites: palette-indexed string grids, pre-rendered to offscreen canvases.
   Everything is drawn in code; there are no image files. */
(function () {
  'use strict';

  var PAL = {
    w: '#fbf8f0', s: '#d6d0c2', o: '#f29a2e', O: '#c9741a', k: '#1e1b2e', m: '#a8402e',
    h: '#6b3f27', H: '#4a2a1a', f: '#f3c9a5', F: '#dca480', c: '#e8707a', C: '#c4515e',
    j: '#4a6fa8', J: '#35517f', e: '#f6efe3', y: '#f0c477', Y: '#c98f43',
    n: '#a8723f', N: '#7a4d28', g: '#5fb55c', G: '#3d8a45', r: '#d94a4a', R: '#a42f3a',
    p: '#f48fb1', P: '#d4608c', u: '#6aa9e0', U: '#3f78b8', l: '#d8eeff',
    v: '#a88ae0', V: '#6e4fb0', t: '#d9b38c', T: '#a9825a', x: '#9aa0a8', X: '#6c727c',
    q: '#ffd75a', Q: '#e0a526', z: '#fffaf0', d: '#8f9dbd', a: '#a9dcf0',
    M: '#fff3c4', W: '#e6d9a0', D: '#2b2540'
  };

  /* ---------- grid helpers ---------- */
  function G(rows) {
    var w = 0, i;
    for (i = 0; i < rows.length; i++) w = Math.max(w, rows[i].length);
    return rows.map(function (r) { while (r.length < w) r += '.'; return r.split(''); });
  }
  function clone(g) { return g.map(function (r) { return r.slice(); }); }
  function P(g, ops) { // set pixels: [x, y, ch, x, y, ch ...]
    var o = clone(g);
    for (var i = 0; i < ops.length; i += 3) {
      var x = ops[i], y = ops[i + 1];
      if (o[y] && x >= 0 && x < o[y].length) o[y][x] = ops[i + 2];
    }
    return o;
  }
  function MV(g, y0, y1, dx, dy) { // move a block of rows
    var o = clone(g), w = g[0].length, x, y;
    for (y = y0; y <= y1; y++) for (x = 0; x < w; x++) o[y][x] = '.';
    for (y = y0; y <= y1; y++) for (x = 0; x < w; x++) {
      var c = g[y][x];
      if (c !== '.') { var nx = x + dx, ny = y + dy; if (o[ny] && nx >= 0 && nx < w) o[ny][nx] = c; }
    }
    return o;
  }
  function rep(ch, n) { return new Array(n + 1).join(ch); }

  function build(grid, pal) {
    var h = grid.length, w = grid[0].length;
    var c = document.createElement('canvas'); c.width = w; c.height = h;
    var x = c.getContext('2d');
    for (var j = 0; j < h; j++) for (var i = 0; i < w; i++) {
      var ch = grid[j][i];
      if (ch !== '.' && (pal || PAL)[ch]) { x.fillStyle = (pal || PAL)[ch]; x.fillRect(i, j, 1, 1); }
    }
    return c;
  }
  function flip(c) {
    var f = document.createElement('canvas'); f.width = c.width; f.height = c.height;
    var x = f.getContext('2d'); x.translate(c.width, 0); x.scale(-1, 1); x.drawImage(c, 0, 0);
    return f;
  }

  // Selective outline: a 1px border around each sprite, tinted from the darkened colour it touches.
  function outlined(c) {
    var w = c.width + 2, h = c.height + 2, o = document.createElement('canvas'); o.width = w; o.height = h;
    var x = o.getContext('2d'); x.drawImage(c, 1, 1);
    var src = x.getImageData(0, 0, w, h), d = src.data, out = x.createImageData(w, h), od = out.data, i, j, k, n, N = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (j = 0; j < h; j++) for (i = 0; i < w; i++) {
      k = (j * w + i) * 4;
      if (d[k + 3] > 0) { od[k] = d[k]; od[k + 1] = d[k + 1]; od[k + 2] = d[k + 2]; od[k + 3] = d[k + 3]; continue; }
      for (n = 0; n < 4; n++) {
        var ni = i + N[n][0], nj = j + N[n][1];
        if (ni < 0 || nj < 0 || ni >= w || nj >= h) continue;
        var nk = (nj * w + ni) * 4;
        if (d[nk + 3] > 0) {
          od[k] = d[nk] * 0.42 + 12; od[k + 1] = d[nk + 1] * 0.40 + 10; od[k + 2] = d[nk + 2] * 0.46 + 26; od[k + 3] = 255; break;
        }
      }
    }
    x.putImageData(out, 0, 0);
    return o;
  }
  var OUTLINED = /^(goose_|gosling_|juv_|june_|bench$|lamp$|bread$|dog_|hut$)/;
  var sets = {}, srcGrids = {};
  function add(name, grids, hats) {
    srcGrids[name] = grids;
    sets[name] = grids.map(function (g, i) {
      var c = build(g), ol = OUTLINED.test(name);
      if (ol) c = outlined(c);
      return { c: c, f: flip(c), w: c.width, h: c.height, hat: hats ? (hats[i] || hats[0]) : null, wl: ol ? 14 : 13 };
    });
  }

  /* ---------- goose (faces right; the game mirrors it) ---------- */
  var STAND = G([
    ".........www....",
    "........wwwww...",
    "........wwwkwooo",
    "........wwwwwoo.",
    ".......wwwww....",
    "......wwwww.....",
    ".....wwwwwwww...",
    "w...wwwwwwwwww..",
    "ww.wwwwwwwwwww..",
    ".wwwwwwsswwwww..",
    "..wwwwssssswww..",
    "...wwwwwwwwww...",
    "....ssssssss....",
    ".....o....o.....",
    "....oo...oo....."
  ]);
  var BODY = STAND.slice(7, 15); // rows 7..14 (body + legs)
  function withHead(headRows, bodyFrom) { // headRows (7 rows) + body rows from 7
    return headRows.concat(STAND.slice(bodyFrom || 7));
  }
  var H0 = G(["................"]);

  var gStand = STAND;
  var gStandB = P(STAND, [5, 13, '.', 5, 14, '.', 4, 14, '.', 6, 13, 'o', 5, 14, 'o', 6, 14, 'o', 9, 13, '.', 10, 14, '.', 9, 14, '.', 10, 13, 'o', 10, 14, 'o', 11, 14, 'o']);
  var gSwimB = P(STAND, [0, 7, '.', 0, 6, 'w']);

  var gEatA = withHead(G([
    "................",
    "................",
    ".........www....",
    "........wwwww...",
    "........wwwkw...",
    "........wwwwwoo.",
    ".....wwwwwwwwwo."
  ]));
  var gEatB = withHead(G([
    "................",
    "................",
    "................",
    ".........www....",
    "........wwwkw...",
    "........wwwwwo..",
    ".....wwwwwwwwwwo"
  ]));
  var gHonkOpen = withHead(G([
    ".........www....",
    "........wwwwwooo",
    "........wwwkwmm.",
    "........wwwwwooo",
    ".......wwwww....",
    "......wwwww.....",
    ".....wwwwwwww..."
  ]));
  var gGroggy = P(MV(STAND, 0, 3, 0, 1), [10, 3, 'k', 11, 3, 'k']);
  var gAnnoyed = P(STAND, [11, 1, 'k', 12, 1, 'k', 13, 3, 'm', 14, 3, 'm']);
  var gConfusedA = P(STAND, [11, 2, 'w', 10, 2, 'k']);
  var gConfusedB = P(STAND, [11, 2, 'k', 9, 1, 'k']);
  var gStretch = P(STAND, [3, 3, 's', 4, 3, 's', 2, 4, 's', 3, 4, 's', 4, 4, 's', 3, 5, 's', 4, 5, 's', 5, 5, 's',
    4, 6, 's', 5, 6, 's', 12, 8, 's', 13, 8, 's', 14, 8, 's', 14, 9, 's', 15, 9, 's',
    13, 1, 'o', 14, 1, 'o', 15, 1, 'o', 13, 2, 'm', 13, 3, 'o', 14, 3, 'o', 15, 3, 'o']);
  // fix: beak open for the stretch yawn
  gStretch = P(gStretch, [14, 2, 'm', 15, 2, '.']);

  var gSleepA = G([
    "................",
    "................",
    "......wwww......",
    ".....wwwwww.....",
    ".....wkkwwoo....",
    "..wwwwwwwwwwww..",
    ".wwwwwwwwwwwwww.",
    "wwwwwsssswwwwww.",
    ".wwwwwsssswwwww.",
    "..wwwwwwwwwwww..",
    "...ssssssssss..."
  ]);
  var gSleepB = (function () {
    var b = clone(gSleepA);
    b[1] = gSleepA[2].slice(); b[2] = gSleepA[3].slice(); b[3] = gSleepA[4].slice(); b[4] = gSleepA[5].slice();
    return b;
  })();

  add('goose_stand', [gStand]);
  add('goose_swim', [G(STAND.slice(0, 13).map(function (r) { return r.join(''); })), G(gSwimB.slice(0, 13).map(function (r) { return r.join(''); }))],
    [[7, -3]]);
  add('goose_waddle', [gStand, gStandB], [[7, -3]]);
  add('goose_eat', [gEatA, gEatB], [[7, -1], [7, 0]]);
  add('goose_honk', [gHonkOpen, gStand], [[7, -3]]);
  add('goose_sleep', [gSleepA, gSleepB], [[4, -1], [4, -2]]);
  add('goose_groggy', [gGroggy], [[7, -2]]);
  add('goose_annoyed', [gAnnoyed], [[7, -3]]);
  add('goose_confused', [gConfusedA, gConfusedB], [[7, -3]]);
  add('goose_stretch', [gStretch], [[7, -3]]);
  add('goose_hat', [G(["..VV..", "..qq..", "..VV..", "VVVVVV"])]);

  /* growth stages: the same goose, shrunk and recoloured (gosling_ / juv_ / goose_) */
  var PRI = { k: 5, m: 4, o: 3, q: 3, V: 3, s: 2, w: 1 };
  function shrink(g, r) {
    var h = g.length, w = g[0].length, nh = Math.max(1, Math.round(h * r)), nw = Math.max(1, Math.round(w * r)), o = [], i, j, x, y;
    for (j = 0; j < nh; j++) {
      var row = [];
      for (i = 0; i < nw; i++) {
        var x0 = Math.floor(i / r), x1 = Math.max(x0 + 1, Math.floor((i + 1) / r)), y0 = Math.floor(j / r), y1 = Math.max(y0 + 1, Math.floor((j + 1) / r));
        var best = '.', bp = 0, cnt = 0, tot = 0;
        for (y = y0; y < y1 && y < h; y++) for (x = x0; x < x1 && x < w; x++) {
          var c = g[y][x]; tot++;
          if (c !== '.') { cnt++; var p = PRI[c] || 2; if (p > bp) { bp = p; best = c; } }
        }
        row.push(cnt * 2 >= tot || bp >= 3 ? best : '.');
      }
      o.push(row);
    }
    return o;
  }
  function variant(prefix, ratio, over) {
    var pal = {}, k;
    for (k in PAL) pal[k] = PAL[k];
    for (k in over) pal[k] = over[k];
    ['stand', 'swim', 'waddle', 'eat', 'honk', 'sleep', 'groggy', 'annoyed', 'confused', 'stretch', 'hat'].forEach(function (n) {
      var src = srcGrids['goose_' + n];
      sets[prefix + n] = src.map(function (g, i) {
        var c = outlined(build(shrink(g, ratio), pal)), hat = sets['goose_' + n][i].hat;
        return { c: c, f: flip(c), w: c.width, h: c.height, wl: Math.round(13 * ratio) + 1,
          hat: hat ? [Math.round(hat[0] * ratio), Math.round(hat[1] * ratio)] : null };
      });
    });
  }
  variant('gosling_', 0.6, { w: '#f8e28c', s: '#dcc064' });
  variant('juv_', 0.82, { w: '#e9e2cf', s: '#bfb49b' });
  var BFO = G(['pp.pp', 'ppkpp', '.pkp.']), BFC = G(['..p..', '..k..', '..p..']);
  ['#f48fb1', '#ffd75a', '#9ccbff'].forEach(function (col, bi) {
    var pal = {}, kk; for (kk in PAL) pal[kk] = PAL[kk]; pal.p = col;
    sets['bf_' + bi] = [BFO, BFC].map(function (gr) { var c = build(gr, pal); return { c: c, f: flip(c), w: c.width, h: c.height }; });
  });
  add('diamond', [G([
    '..UUUUUU..', '.UllluuuU.', 'UllluuuuuU', 'UUUUUUUUUU', '.UuuuuuuU.', '..UuuuuU..', '...UuuU...', '....UU....'
  ])]);
  add('heart', [G(['.rr..rr.', 'rrrrrrrr', 'rrrrrrrr', '.rrrrrr.', '..rrrr..', '...rr...'])]);

  /* ---------- June (sits on the bench, faces left) ---------- */
  var JB = G([
    ".....hhhhh......",
    "....hhhhhhh.....",
    "...hhhhhhhhh....",
    "...hhffhhhhhh...",
    "...hffffhhhhh...",
    "...fkfffhhhhh...",
    "...ffffhhhhhh...",
    "...ffFfhhhhh....",
    "....ffffhhhh....",
    ".....ffhhhh.....",
    "....ccccchh.....",
    "...cccccccchh...",
    "...cccCccccchh..",
    "...cccCccccchh..",
    "...fccCcccccch..",
    "...ccccccccc....",
    "..jjjjjjjjjjj...",
    "jjjjjjjjjjjjj...",
    "jjJJjjjjjj......",
    "jjj.............",
    "jj..............",
    "jj..............",
    "jj..............",
    "eee............."
  ]);
  var jBlink = P(JB, [4, 5, 'F']);
  var jWaveA = P(JB, [3, 14, 'c', 1, 2, 'f', 2, 2, 'f', 1, 3, 'f', 1, 4, 'c', 1, 5, 'c', 1, 6, 'c', 1, 7, 'c', 2, 8, 'c', 2, 9, 'c', 3, 9, 'c']);
  var jWaveB = P(JB, [3, 14, 'c', 0, 2, 'f', 1, 2, 'f', 0, 3, 'f', 1, 4, 'c', 1, 5, 'c', 1, 6, 'c', 1, 7, 'c', 2, 8, 'c', 2, 9, 'c', 3, 9, 'c']);
  var jTossA = P(JB, [3, 14, 'c', 2, 11, 'c', 2, 12, 'c', 2, 13, 'c', 1, 13, 'f', 1, 12, 'f']);
  var jTossB = P(JB, [3, 14, 'c', 2, 10, 'c', 2, 11, 'c', 1, 10, 'f', 0, 9, 'f', 1, 9, 'f']);
  var jSmile = P(MV(JB, 0, 8, 0, 1), [4, 6, 'F', 3, 8, 'p', 4, 9, 'F']);
  var jDozeA = P(MV(JB, 0, 8, 0, 2), [4, 7, 'F']);
  var jDozeB = P(MV(JB, 0, 8, 0, 3), [4, 8, 'F']);
  add('june_idle', [JB, jBlink]);
  add('june_wave', [jWaveA, jWaveB]);
  add('june_toss', [jTossA, jTossB]);
  add('june_smile', [jSmile]);
  add('june_doze', [jDozeA, jDozeB]);
  add('stone', [G(['.xx.', 'xlxx', '.XX.'])]);

  /* ---------- June standing / sleeping, the hut, the puppy, the fish ---------- */
  var JW_BODY = [
    "....ccccchh.....",
    "....cccccchh....",
    "....cCcccccc....",
    "....cCccccc.....",
    "....cccccc......",
    "....cccccc......"
  ];
  var JW_A = G(JB.slice(0, 10).map(function (r) { return r.join(''); }).concat(JW_BODY, [
    "....jjjjjj......", "....jjjjjj......", "....jj..jj......", "...jj....jj.....", "...jj....jj.....", "...jj....jj.....", "...ee....ee....."]));
  var JW_B = G(JB.slice(0, 10).map(function (r) { return r.join(''); }).concat(JW_BODY, [
    "....jjjjjj......", "....jjjjjj......", "....jjjjjj......", ".....jjjj.......", ".....jjjj.......", ".....jjjj.......", ".....eeee......."]));
  add('june_walk', [JW_A, JW_B]);
  add('june_sleep', [G([".hhhh...", "hhfFcccc", "hhffcccc", ".ccccccC", "..cccCCC"])]);

  function hutRows() {
    var W = 30, rows = [], x, y, r, half;
    function blank() { return rep('.', W).split(''); }
    for (y = 0; y < 9; y++) {
      r = blank(); half = 2 + Math.round(y * 1.5);
      for (x = 15 - half; x < 15 + half; x++) {
        if (x < 0 || x >= W) continue;
        r[x] = (x === 15 - half || x === 15 + half - 1 || y === 8 || y === 0 || (x + y) % 4 === 0) ? 'R' : 'r';
      }
      rows.push(r);
    }
    for (y = 9; y < 24; y++) {
      r = blank();
      for (x = 4; x < 26; x++) r[x] = (x % 4 === 0 || y === 23) ? 'N' : 'n';
      rows.push(r);
    }
    for (y = 12; y < 24; y++) for (x = 10; x < 20; x++) rows[y][x] = (y === 12 || x === 10 || x === 19) ? 'N' : 'D';
    for (y = 12; y < 17; y++) for (x = 5; x < 9; x++) rows[y][x] = (y === 12 || y === 16 || x === 5 || x === 8) ? 'N' : 'a';
    rows[11][21] = 'N'; rows[12][21] = 'q'; rows[13][21] = 'q'; rows[14][21] = 'Q';
    return rows.map(function (q) { return q.join(''); });
  }
  add('hut', [G(hutRows())]);
  sets.hut[0].door = [11, 13, 8, 11];

  var DOG_BASE = [
    "...NN.........",
    "..NNtt........",
    "..NtktT.......",
    ".ktttttT......",
    "..tpttT.......",
    "..wwttttT.....",
    "..wwtttttT....",
    "...ttttttttT..",
    "...tttttttttT.",
    "...tT..tT.tT..",
    "...TT..TT.TT.."
  ];
  var dogG = G(DOG_BASE);
  var dogA = P(dogG, [13, 6, 'T', 13, 7, 'T', 12, 7, 'T']);
  var dogB = P(dogG, [12, 8, 'T', 13, 9, 'T', 13, 8, 'T']);
  var dogW1 = P(dogG, [13, 6, 'T', 13, 7, 'T']);
  var dogW2 = P(dogG, [3, 9, '.', 4, 9, '.', 3, 10, '.', 4, 10, '.', 5, 9, 't', 6, 9, 'T', 5, 10, 'T', 6, 10, 'T', 13, 6, 'T', 13, 7, 'T']);
  add('dog_sit', [dogA, dogB]);
  add('dog_walk', [dogW1, dogW2]);
  add('dog_sleep', [G(["..NNttt.....", ".NtkttttT...", "kttttttttT..", "wttttttttttT", ".TTttttttTTT", "..TTTTTTTT.."])]);

  var FA = G(["...ooo..", "oo.oooko", "oo.ooooo", "...ooo.."]), FB = G(["o..ooo..", ".o.oooko", ".o.ooooo", "o..ooo.."]);
  [['#ff9a3c', '#ff9a3c'], ['#f4f1ea', '#f4f1ea'], ['#ffd75a', '#ffd75a'], ['#7f9cc0', '#7f9cc0']].forEach(function (cc, fi) {
    var pal = {}, kk; for (kk in PAL) pal[kk] = PAL[kk]; pal.o = cc[0];
    sets['fish_' + fi] = [FA, FB].map(function (gr) { var c = build(gr, pal); return { c: c, f: flip(c), w: c.width, h: c.height }; });
  });

  /* ---------- scenery ---------- */
  add('bread', [G(["..YY..", ".YyyY.", "YyyyyY", ".YYYY."])]);
  add('ripple', [
    G([".www.", "w...w", ".www."]),
    G(["..wwwww..", ".w.....w.", "w.......w", ".w.....w.", "..wwwww.."]),
    G(["...wwwwwww...", "..w.......w..", ".w.........w.", "w...........w", ".w.........w.", "..w.......w..", "...wwwwwww..."])
  ]);
  add('pad', [G(["...GGGG...", ".GggggggG.", "GgggggGggG", ".GggggggG.", "...GGGG..."])]);
  add('padflower', [G(["..p..", ".pPp.", "pPqPp", ".ppp."])]);

  var reedA = G([
    "...NN...", "...NN...", "...NN...", "....g...", "....g.g.", "....g.g.", "...gg.g.", "...g.gg.",
    "...g.g..", "..gg.g..", "..g.gg..", "..g.g...", ".gg.g...", ".g.gG...", ".g.G....", "gG.G...."
  ]);
  var reedB = MV(reedA, 0, 7, 1, 0);
  add('reed', [reedA, reedB]);

  var benchRows = [];
  for (var bi = 0; bi < 8; bi++) benchRows.push(rep('.', 21) + 'nN' + '..');
  benchRows.push(rep('n', 24) + '.');
  benchRows.push(rep('N', 24) + '.');
  for (bi = 0; bi < 3; bi++) benchRows.push('.nN' + rep('.', 18) + 'nN..');
  benchRows.push('.NN' + rep('.', 18) + 'NN..');
  add('bench', [G(benchRows)]);

  var lampRows = ["...N...", "..NNN..", ".NqqqN.", ".NqzqN.", ".NqqqN.", "..NNN..", "...N..."];
  for (var li = 0; li < 17; li++) lampRows.push("...N...");
  lampRows.push("..NNN.."); lampRows.push(".NNNNN.");
  add('lamp', [G(lampRows)]);

  function moonRows() {
    var rows = [], x, y, s;
    for (y = 0; y < 11; y++) {
      s = '';
      for (x = 0; x < 11; x++) {
        var d1 = Math.hypot(x + 0.5 - 5.5, y + 0.5 - 5.5);
        var d2 = Math.hypot(x + 0.5 - 8.2, y + 0.5 - 4.2);
        s += (d1 <= 5.3 && d2 > 4.6) ? ((d1 > 4.3) ? 'W' : 'M') : '.';
      }
      rows.push(s);
    }
    return rows;
  }
  add('moon', [G(moonRows())]);
  add('star', [G([".z.", "zzz", ".z."]), G(["...", ".z.", "..."])]);
  add('firefly', [G([".q.", "qQq", ".q."]), G(["...", ".q.", "..."])]);
  add('sparkle', [
    G([".q.", "qzq", ".q."]),
    G(["..q..", "..q..", "qqzqq", "..q..", "..q.."]),
    G(["...q...", "...q...", ".......", "qq.z.qq", ".......", "...q...", "...q..."])
  ]);
  add('pouch', [G([
    "...nn..nn...", "....nnnn....", ".....rr.....", "...nnnnnn...", "..nnnnnnnn..", ".nnnnnnnnnn.",
    ".nnnnnqqnnn.", ".nnnnqQQqnN.", ".nnnnnqqnnN.", ".nnnnnnnnNN.", "..nnnnnNNN..", "...NNNNNN..."
  ])]);
  add('speaker', [G([
    "....z....", "...zz..z.", "zzzzz...z", "zzzzz...z", "zzzzz...z", "...zz..z.", "....z...."
  ])]);
  add('speaker_off', [G([
    "....z....", "...zz.z.z", "zzzzz..z.", "zzzzz.z.z", "zzzzz....", "...zz....", "....z...."
  ])]);
  add('zee', [G(["vvvvv", "...v.", "..v..", ".v...", "vvvvv"])]);
  add('qmark', [G([".QQQ.", "Q...Q", "...Q.", "..Q..", "..Q..", ".....", "..Q.."])]);

  /* ---------- speech cloud: drawn to fit any text size, one canvas pixel = one art pixel ---------- */
  function cloud(wc, hc) {
    var R = 3, M = R + 1, c = document.createElement('canvas'); c.width = wc; c.height = hc;
    var x = c.getContext('2d'), img = x.createImageData(wc, hc), d = img.data;
    var circles = [], i, n, px, py;
    n = Math.max(2, Math.round((wc - 2 * M) / 5));
    for (i = 0; i <= n; i++) { px = M + (wc - 1 - 2 * M) * i / n; circles.push([px, M], [px, hc - 1 - M]); }
    n = Math.max(1, Math.round((hc - 2 * M) / 5));
    for (i = 0; i <= n; i++) { py = M + (hc - 1 - 2 * M) * i / n; circles.push([M, py], [wc - 1 - M, py]); }
    function near(X, Y, r) { for (var k = 0; k < circles.length; k++) { if (Math.hypot(X - circles[k][0], Y - circles[k][1]) <= r) return true; } return false; }
    var fill = [255, 250, 240], line = [143, 157, 189];
    for (py = 0; py < hc; py++) for (px = 0; px < wc; px++) {
      var inner = px >= M && px <= wc - 1 - M && py >= M && py <= hc - 1 - M;
      var outer = px >= M - 1 && px <= wc - M && py >= M - 1 && py <= hc - M;
      var f = inner || near(px, py, R), o = outer || near(px, py, R + 1), k4 = (py * wc + px) * 4, col = f ? fill : (o ? line : null);
      if (col) { d[k4] = col[0]; d[k4 + 1] = col[1]; d[k4 + 2] = col[2]; d[k4 + 3] = 255; }
    }
    x.putImageData(img, 0, 0);
    return c.toDataURL();
  }
  var CP = { z: '#fffaf0', d: '#8f9dbd' };
  function tailURL() {
    return build(G(['zzzzzzz', 'zzzzzzz', 'dzzzzzd', '.dzzzd.', '..dzd..', '...d...']), CP).toDataURL();
  }

  /* ---------- helpers for the game ---------- */
  function outline(c, color) {
    var w = c.width + 2, h = c.height + 2;
    var o = document.createElement('canvas'); o.width = w; o.height = h;
    var x = o.getContext('2d');
    var s = document.createElement('canvas'); s.width = w; s.height = h;
    var sx = s.getContext('2d'); sx.drawImage(c, 1, 1);
    sx.globalCompositeOperation = 'source-in'; sx.fillStyle = color; sx.fillRect(0, 0, w, h);
    [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) { x.drawImage(s, d[0], d[1]); });
    x.globalCompositeOperation = 'destination-out'; x.drawImage(c, 1, 1);
    return o;
  }
  function fromRows(rows) { return build(G(rows)); }

  function iconURL() { // goose on the pond, used for the Home Screen icon
    var S = 180, c = document.createElement('canvas'); c.width = S; c.height = S;
    var x = c.getContext('2d'); x.imageSmoothingEnabled = false;
    var g = x.createLinearGradient(0, 0, 0, S); g.addColorStop(0, '#62b8ee'); g.addColorStop(1, '#d6f0fa');
    x.fillStyle = g; x.fillRect(0, 0, S, S);
    x.fillStyle = '#3f9ad0'; x.fillRect(0, 118, S, 62);
    x.fillStyle = '#5db4e2'; x.fillRect(0, 118, S, 6); x.fillRect(20, 140, 50, 4); x.fillRect(110, 155, 44, 4);
    var gs = sets.goose_swim[0];
    x.drawImage(gs.c, 28, 20, gs.w * 8, gs.h * 8);
    x.fillStyle = 'rgba(63,154,208,0.85)'; x.fillRect(20, 112, 140, 20);
    x.fillStyle = 'rgba(255,255,255,0.5)'; x.fillRect(34, 114, 36, 4); x.fillRect(100, 122, 46, 4);
    var hat = sets.goose_hat[0];
    x.drawImage(hat.c, 28 + 7 * 8, 20 - 3 * 8 + 4, hat.w * 8, hat.h * 8);
    return c.toDataURL('image/png');
  }

  window.Sprites = {
    PAL: PAL, sets: sets, build: build, fromRows: fromRows, outline: outline,
    cloud: cloud, outlined: outlined, tailURL: tailURL, iconURL: iconURL,
    get: function (name, i) { var s = sets[name]; return s[(i || 0) % s.length]; }
  };
})();
