/* Goodies: small pixel sprites + rarity. Letters refer to the palette in sprites.js.
   rarity: common | uncommon | rare
   night:  only drops between 20:00 and 05:00 local
   once:   stops dropping once collected (the hat is worn by the goose from then on) */
window.GOODIES = [
  { id: 'berry', rarity: 'common', art: [
    "...gGg....",
    "..gGGGg...",
    "..rrrrrr..",
    ".rrrqrrrr.",
    ".rrrrrqrr.",
    ".rrqrrrrR.",
    "..rrrrrR..",
    "..rrqrRR..",
    "...rRRR...",
    "....RR...."
  ]},
  { id: 'flower', rarity: 'common', art: [
    "..p.pp.p..",
    "..pppppp..",
    "..pPpppP..",
    "...pppp...",
    "....gg....",
    "....g.....",
    "..g.g.g...",
    "...ggg....",
    "....g.....",
    "....g....."
  ]},
  { id: 'shell', rarity: 'common', art: [
    "..........",
    "...zzzz...",
    "..zPzzPz..",
    ".zzPzzPzz.",
    "zzzPzzPzzz",
    "zPzPzzPzPz",
    ".zzPzzPzz.",
    "..zzzzzz..",
    "...tTTt...",
    "....tt...."
  ]},
  { id: 'pebble', rarity: 'common', art: [
    "..........",
    "..........",
    "...xxxx...",
    "..xxlxxx..",
    ".xxlxxxxX.",
    ".xxxxxxxXX",
    ".xxxxxxXXX",
    "..xxxXXXX.",
    "...XXXXX..",
    ".........."
  ]},
  { id: 'acorn', rarity: 'uncommon', art: [
    "....nn....",
    "..NNNNNN..",
    ".NnNnNnNN.",
    ".NNNNNNNN.",
    "..tttttt..",
    "..ttTttt..",
    "..ttTttt..",
    "...tTtt...",
    "....tt....",
    "....T....."
  ]},
  { id: 'jar', rarity: 'uncommon', night: true, art: [
    "..NNNNNN..",
    "..nnnnnn..",
    ".UaaaaaaU.",
    "UaaqaaqaaU",
    "UaaaaaaaaU",
    "UaqaaaaqaU",
    "UaaaqaaaaU",
    "UaaaaaqaaU",
    ".UaaaaaaU.",
    "..UUUUUU.."
  ]},
  { id: 'hat', rarity: 'uncommon', once: true, art: [
    "..........",
    "...VVVV...",
    "...VVVV...",
    "...VVVV...",
    "...qqqq...",
    "...VVVV...",
    ".VVVVVVVV.",
    ".VVVVVVVV.",
    "..........",
    ".........."
  ]},
  { id: 'crumb', rarity: 'rare', art: [
    "......z...",
    "....q.zzz.",
    "...qQq.z..",
    "..qqqqQ...",
    ".qqQqqqQ..",
    ".qqqqqQQ..",
    "..qQqQQ...",
    "...QQQ....",
    "..........",
    ".........."
  ]},
  { id: 'star', rarity: 'rare', art: [
    "....qq....",
    "....qq....",
    "...qqqq...",
    "qqqqQQqqqq",
    ".qqqQQqqq.",
    "..qqQQqq..",
    "..qqqqqq..",
    ".qqq..qqq.",
    ".qq....qq.",
    ".........."
  ]},
  { id: 'ring', rarity: 'rare', art: [
    "....pp....",
    "...pzpP...",
    "....PP....",
    "...qqqq...",
    "..qQ..Qq..",
    ".qQ....Qq.",
    ".qQ....Qq.",
    ".qQ....Qq.",
    "..qQ..Qq..",
    "...qqqq..."
  ]}
];

window.GOODIE_WEIGHTS = { common: 10, uncommon: 4, rare: 3 };
