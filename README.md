# Goose Pond

A cozy daily-visit pixel pond for June, from the goose. iPhone and iPad Safari (iOS 16+).
Vanilla HTML/CSS/JS. No build step, no image files. The only network request is saving her typed answers to Supabase (see below); the game plays fine offline and with that switched off.

## Editing the words

Everything June reads lives in `lines.js` (bubble lines, the "Day N together at the pond" label, button labels).
Each line is `{ id, text }`. Optional flags: `firstSession`, `day2`, `slot`, `date: 'MM-DD'`.
There are commented examples for her birthday and your anniversary at the bottom of the file.
Keep ids unique; changing an id makes the line count as unseen.

## Run it locally

Any static server works. From this folder:

```bash
npx http-server -p 8123
```

then open `http://localhost:8123/`. (Service workers only run on https or localhost.)

### Test helpers (URL query only)

| Query | Effect |
|---|---|
| `?hour=22` | Force the hour (decimals work, `?hour=18.5`) |
| `?reset=1` | Clear saved data on load |
| `?bubble=1` | The next roll is a bubble |
| `?goodie=1` | The next roll is a goodie drop |

| `?stage=0` / `1` / `2` | Show the gosling, young goose or grown goose |
| `?chat=1` | The next roll is a typed conversation |
| `?finale=1` | Play the collect-everything surprise right away |
| `?hungry=0` to `3` | Show how the goose looks when hungry |
| `?forest=1` | Jump straight to the forest (and give her the boat) |
| `?boat=1` | The goose builds the boat when the game opens |
| `?world=1` | Unlock everything: boat, fire pit, bird feeder, lots of feeds and a full set of materials |

Rolls happen after every 4 to 6 pieces eaten, so toss 4 to 6 breads. Combine freely: `/?reset=1&hour=22&goodie=1`.

## How it behaves (decisions worth knowing)

- **Greeting** on open is a welcome line or a time-of-day line. It counts as the first bubble of the session.
- **`firstSession` line** (apology p1) is the third bubble of her very first session. If she leaves before that, it shows in a later session that same day; once a new date arrives without it having shown, it is skipped for good.
- **`day2` line** (apology p2) shows as the greeting on the first new date she visits, once. After that it joins the normal rotation.
- **First roll of each local day is always a goodie drop.** Never two goodie drops in a row. If three goodies are already waiting at her feet, a roll becomes a bubble.
- **Unclaimed goodies** stay at her feet and survive closing the app.
- **Rare goodies** (golden crumb, star, toy ring): at most one per 7 local days, counted from when it drops.
- **Naps:** the first nap comes 60 to 120 s into play (exactly 60 s at night). After he is woken, the next nap is 5 to 8 minutes later, so he does not keep going back to sleep. Five taps wake him.
- **Coming back from the Home Screen:** iOS often resumes the app instead of reloading it. If the date changed, or it was in the background for over 30 minutes, the game starts a fresh session (new greeting, new day count, daily goodie).
- **Portrait phones:** the scene is 150 logical px wide, so extra sky is added above it (stars and moon fill it at night). Wide screens get extra pond and grass at the sides.
- **Speech bubbles** are real text (crisp at any size) on a pixel-art cloud drawn in code.
- **Saved data** is in `localStorage` under `goosepond.v1`. If storage is unavailable the game just plays without saving.

## How it looks

Still all drawn in code, but sharper and fuller: every art pixel is an exact whole number of screen pixels (no shimmering edges), sprites have soft coloured outlines, and the scenery has a sun that crosses the sky, drifting clouds, layered hills and round-topped trees mirrored in the water, a foamy shoreline with rocks, flowers and grass tufts, foreground bushes, daytime butterflies, and a small wake behind the swimming goose. If it looks a little smaller on some phones in landscape, that is the whole-pixel scaling; tell me if you would rather trade crispness for size.

## More friends at the pond

- **A puppy** (not a cat) keeps June company on the grass: it sits and wags, wanders now and then, and sleeps by the hut at night. Tap it for a yip and a few hearts.
- **Fish** swim in the pond (orange, white, yellow and blue) and now and then leap with a splash.
- **A little hut** on the grass is where June goes to doze off. When she tells the goose she is tired, a few seconds after his reply she walks to the hut and naps (about 35 s) with the puppy curled up outside. At night she also takes one nap per visit after a couple of minutes of play. Tap the hut to wake her and she walks back to her bench. While she is away, bread still gets thrown for the goose.

## Remembering her, wishes, stone skipping, strolls

- **Remembering her:** when she writes about something coming up (an exam, interview, trip, appointment, deadline, party, birthday), the goose asks how it went on a later day, with a "Tell me more" button. He also remembers things she says she loves ("I love iced coffee") and friends or family she names ("my friend Maya"), and brings them up now and then. This is simple word matching, not understanding, so it will miss some things and occasionally pick up an odd phrase. What he remembers is stored on her phone (and her original messages are in your table). The wording is in `memory` in `lines.js`.
- **Tiny daily wishes:** the star button in the corner shows three wishes picked for the day (pet the puppy, feed 5 bread, skip a stone 3+ times, tell the goose how she is, and so on). Each one she finishes gives a diamond. No streaks, nothing is lost if she skips them. Edit the list under `wishes` in `lines.js`.
- **Stone skipping:** a quick **flick** across the water (up and across, like skipping a stone) makes June throw a stone. A faster flick makes more skips, up to 9, with a ripple and a little plop each time. A plain tap still throws bread. Big skips make the goose honk and say something. A hint appears once in the first minute.
- **June walks around:** every minute or so she gets up, strolls to the shore or across the grass with the puppy trotting after her, sometimes skips a stone herself, and walks back to her bench. Tapping the bench still waves or throws bread; bread thrown while she is away comes from wherever she is.

## The boat and the forest

- **Hunger:** if the goose is not fed for a long while he slows down (after about 12 hours a little, after 30 hours more, after 3 days he is weak and droopy). He says so gently, never blaming her. One piece of bread and he is back to normal at once, with a thank-you. The timing is in `hungerLevel()` in `game.js`.
- **The goose builds the boat himself.** Once she has collected 4 different goodies, the next time she opens the game the goose and the puppy are hammering away by the water, and a little rowboat appears with a message. There is no crafting to do. (More things the goose can build later are listed in `BUILDS` in `forest.js`.)
- **Rowing across:** tap the boat, then Row there. June and the puppy sit in the boat and row across the pond (the goose swims after them), and they land in the forest.
- **The goose joins, or not:** on arrival the goose asks if he can come. If she says Come along, he follows June and guides her to hidden things. If she says Not this time, he waits by the boat and the puppy, who always follows June, leads the way instead. No penalty either way.
- **The forest is seen from above** and is much bigger than the screen: a dense forest of about 200 trees with dirt trails, six glades in the corners and edges, boulders, ferns and flowers, drifting leaves and sunbeams. The camera follows June. Tap anywhere and she finds her own way around the trees (she will not walk through them).
- **Hidden things:** the puppy hides 6 things a day (new places each day) in the bushes, logs, rocks, stumps, burrows, flower patches and mushroom rings, spread out toward the corners so she has to explore. Tap a hiding place and June walks over; the guide runs ahead and honks or barks, and the spot glints, if something is there. Finds go into the backpack in the pouch. Tap the boat at the shore to row home.
- **Wildlife:** snakes slither along the trails (they startle June for a moment, and the goose or puppy reacts, but nothing bad ever happens and they slip away), frogs hop about, squirrels dash up trees, birds chirp by day. Tap a snake to shoo it.
- **The puppy digs by the pond:** every minute or two in daytime it buries something and leaves a little mound that glints. Tap the mound to dig it up.
- **Backpack:** finds show under the goodies in the pouch, with a small count when she has more than one.

## Fire pit, s'mores, bird feeder, birds and visitors

- **The goose builds more things himself** when she has gathered what he needs, checked each time the game opens (in this order): the boat (4 different goodies), a fire pit (3 twigs and 3 pebbles), then a bird feeder (2 twigs and a pinecone). What he uses is taken from her backpack. The twigs, pebbles and pinecones come from the forest and from what the puppy digs up. Edit the requirements in `BUILDS` in `forest.js`.
- **The fire pit** glows in the evening and at night, with a soft crackle. Tap it for **s'mores**: if she has a marshmallow, a piece of chocolate and a cracker (all found in the forest or dug up by the puppy), June walks over, roasts a marshmallow on a stick while the goose and the puppy gather round, and eats it. That uses the three ingredients and gives a diamond. Without them the goose says what is missing.
- **The bird feeder:** tap it to fill it with seeds (it holds 6 visits). In the daytime birds fly in, perch on the tray or peck at the ground, then fly off. Four kinds come, in this order as time goes on: sparrow, bluebird, robin, cardinal. Every 5th visit from a kind, that bird leaves a small gift by the feeder (feather, berry, flower, shell, acorn, button, ribbon or pearl). Tap the gift to collect it. Tap a bird for a chirp and hearts.
- **Visitors:** the more the birds have been fed, the more animals drop by, at the right time of day: a bunny (morning and evening, after 6 feeds), a hedgehog (at night, after 15) and a fox kit (dawn and dusk, after 30). They wander in from the edge of the screen, stay a minute or two, then leave. Tap one for hearts; pet it three times and it may leave a gift. The goose points out each kind the first time it comes.
- New daily wishes: roast s'mores, fill the bird feeder, pet a visitor.
- Everything above is drawn in code; nothing needs an image file.

## Personalities and a fuller screen

Every animal now behaves like someone. Tap one and it says something in its own voice (all in `animals` in `lines.js`):

- **The goose:** sincere and a bit dramatic; now and then he mutters something to himself.
- **The puppy:** eager and easily distracted. It has zoomies, chases butterflies, and sometimes fetches a stick and drops it at June's feet (tap the stick to collect it). It also starts zoomies when the fox kit pounces about.
- **Sparrow:** cheeky, in and out quickly, hopping about. **Bluebird:** shy, and bolts if the puppy or goose comes near. **Robin:** cheerful, sings while it stays. **Cardinal:** proud, stays long and leaves fancier gifts (ribbon, pearl, feather).
- **Bunny:** shy and gentle; freezes and bolts if the goose or puppy gets close, then slowly trusts her. **Hedgehog:** grumpy but sweet; curls into a ball when others come near, and uncurls once it has been petted three times. **Fox kit:** mischievous; pounces around, plays with the puppy, and gifts after two pets.
- **Fish:** the orange one is bold and nibbles at floating bread, the white one is lazy, the yellow one shows off and jumps a lot, the blue one is shy and darts away from splashes.

**Using the whole screen:** on tall portrait screens the empty sky now has distant snowy mountains, drifting clouds, and things to look at: a V of geese (the goose's cousins) flying over, a hot-air balloon that drifts by in the daytime, and at night an aurora and shooting stars. Tap the balloon once a day and it drops a small gift; tap a shooting star once a night to make a wish for a diamond; tap the geese for a honk. On wide screens (iPad, landscape) the extra room at the sides now has more lily pads and reeds, and the fish, goose, birds and visitors use it too.

## Inside the hut, cooking, and tap-to-dance

- **Go inside:** tap the hut and June walks over, the door opens, and the screen fades into a cozy cutaway of the room (roof, chimney smoke and the pond view through the window included). The room is wider than a portrait screen, so the camera follows her as she walks. The puppy tags along and does the talking in here.
- **What is inside:** a bed with a patchwork quilt, a small kitchen (iron stove with a kettle, a counter with a sink, a jar shelf), a table and chair on a rug, a floor lamp, a plant, a framed picture of the goose, a hook for the tiny hat, the puppy's own bed, and a **shelf that shows everything she has collected**. The window shows the real time of day outside (stars at night, a sunbeam by day).
- **Tap to explore:** tap the floor and June walks there, then randomly **sits, jumps or dances**. Tap the bed to sleep (tap again to wake), the table to sit, the window or shelf to look, the plant or picture for a line from the puppy, and the door to go back out.
- **Cooking:** tap the stove for the kitchen list: berry jam toast, mushroom soup, pinecone and flower tea, clover and berry salad, hot cocoa, acorn porridge. A dish is available when she has the ingredients (from the forest and the puppy's digging), and cooking **uses them up**. She stirs at the stove, carries the dish to the table and eats it. Each dish gives a diamond the first time she makes it. Edit the recipes in `hut.js` and the names under `dishes` in `lines.js`.
- **Outside too:** tap the empty grass anywhere and June gets up, walks over and sits, jumps or dances, then goes back to her bench. Water taps still throw bread and flicks still skip stones. New wishes: cook something, dance somewhere.
- **Sized for June:** the furniture and room are scaled to her (about 23 pixels tall): the counter, stove and table come up to her waist, the chair faces the table, the door is a little taller than she is, and the ceiling is low and cozy.
- **Smoother June animation:** she now walks toward and away from you with front and back views as well as side views, with a little bob, a soft shadow, and an easing start. On the grass she sits cross-legged (with blinks), jumps with a crouch and a stretch, and dances with arms up, to the side and swaying, with music notes floating up.
- Test shortcut: `?hut=1` jumps inside with some ingredients.
- Test shortcut: `?hut=2` jumps inside with an empty pantry and the boat built.

## No ingredients? An adventure, and the boat any time

- **Find it:** in the kitchen list, every dish she cannot make yet has a green **Find it** button. Tap it and June says she will go and look, walks out, boards the boat and rows to the forest (the boat trip starts by itself).
- **The quest:** a small card at the top left shows the dish and what is still missing (for example a mushroom 0/2). That day the puppy hides exactly those missing ingredients among the hiding places (plus a few other things), in fresh spots. Tap hiding places as usual; the goose or puppy guides her. When she has them all the guide says so and offers Row home.
- **Back home:** the goose says they have everything. Tap the hut and she walks in, goes to the stove and the kitchen list opens by itself, ready to cook. Cooking that dish ends the quest. If she leaves the forest early the quest stays until she cooks it. Without a boat yet she is told to wait for it. Text is under `quest` in `lines.js`.
- **The boat is tappable at all times** once it is built: while June is strolling, walking to the hut, sleeping in the hut, roasting s'mores or the goose is talking. She drops what she is doing and heads to the boat. If the goose is busy building something, the trip starts the moment he finishes.

## Growing up, diamonds, conversations, the surprise

- **Growth:** he starts as a gosling. He becomes a young goose at 60 bread eaten and 5 days visited, and a grown goose at 180 bread and 14 days (both must be met). The numbers are `computeStage()` in `game.js`. When he grows he honks, sparkles and says a line from `growth` in `lines.js`.
- **Diamonds:** every goodie she collects sends a diamond to the pouch too, even a duplicate. The pouch shows the diamond total. It is the one counter in the game.
- **Conversations:** once in each part of the day (morning, afternoon, evening, night) the goose asks how she is, and she can tap the goose any time to talk. She types, or records a voice message, and the goose answers what she actually said: food jokes when she is hungry, comfort when she is sad, cheering when she is happy, and so on. It is one question and one reply, then a "Tell me more" button if she wants to keep going. The reply topics and jokes are in `lines.js` (`replies`, `replyDefault`). The topic is chosen by matching words she wrote, so it is simple and sometimes will miss; the fallback replies are warm and generic. Tomorrow's greeting follows up on how she said she felt.
- **The surprise:** when all 10 goodies are collected, fireworks go off over the pond and the `finale` notes appear one after another (edit them in `lines.js`; they are placeholders). Afterwards a heart button in the pouch replays it.
- **Pacing:** collecting everything takes weeks. Uncollected goodies are three times as likely to drop, and rare ones (3 of the 10) can only drop once per 7 days, so the soonest possible finish is about 3 weeks.

## Her answers: where they go

Every typed answer is saved to the Supabase project **JUNE**, table `goose_pond_entries` (date, time, time of day, the question, her answer, a rough mood guess; `kind` is `day`, `free` or `voice`). Voice messages go to the **private** Storage bucket `goose-voice` (up to 5 minutes each), and a `voice` row points to the file. The game uses the public publishable key (in `config.js`), which can only **add** rows and files; it cannot read, edit or delete anything. If she is offline, typed answers wait on her phone and send later (a voice message needs a connection when she taps Send).

**She is told.** The box shows "What you write or record here is sent to me, your goose. Only I can read and hear it." (`ui.talkNote` in `lines.js`). You can reword it warmly, but please keep it clear that you read it. Typing private feelings into something that quietly saves them would not be fair to her.

Read them in Supabase: **Table Editor > goose_pond_entries**. Listen to voice messages in **Storage > goose-voice** (open a file to play it). Or use the SQL editor:

```sql
-- everything, newest first
select local_date, local_time, slot, kind, prompt, answer, mood_guess
from goose_pond_entries order by created_at desc;

-- how the days have been going
select local_date, mood_guess, count(*) from goose_pond_entries
where kind = 'day' group by 1, 2 order by 1 desc;
```

To stop saving, empty `url` and `key` in `config.js`.

## Still needs checking on a real iPhone and iPad

I tested the layouts in browser device emulation (iPhone portrait/landscape, iPad portrait/landscape) and the full flow: tossing, eating, bubbles, goodie drop and collect, pouch, nap and wake, day/night, and the day-2 line. These can only be confirmed on real devices:

- [ ] **Touch feel:** taps land where expected, 5 quick tosses are not laggy, tapping the sleeping goose, the goodie, June and the pouch all feel easy to hit.
- [ ] **Audio unlock:** sound starts after the first tap (plop, honk, chimes, night crickets). With the ringer switch on silent, check how it behaves, and that the mute toggle persists after closing.
- [ ] **Pinch / double-tap / rubber-band:** none of them zoom or scroll the page, in Safari and in the installed Home Screen app.
- [ ] **Safe areas:** with the notch / Dynamic Island, landscape side insets, and the home indicator, the day label and the two buttons are not clipped and the bubble stays readable.
- [ ] **Orientation change:** rotating mid-game re-lays out correctly (goose and goodies stay on screen).
- [ ] **Home Screen install:** the goose icon appears (see below), the app opens full screen, and the status bar is readable over the sky.
- [ ] **Service worker / offline:** after one online load, turn on airplane mode and reopen from the Home Screen. Then deploy a change, bump `CACHE` in `sw.js`, and confirm the new version arrives on the second open.
- [ ] **Brightness / performance:** smooth on her actual phone, and the night scene is not too dark outdoors.

**Home Screen icon note:** there is no icon file. The goose icon is drawn by `game.js` at load and set as the `apple-touch-icon`. Safari should read it when she taps Add to Home Screen, but this is the one thing I would verify first on a device. If it comes out blank or generic, tell me and I will switch to a static PNG.

If the service worker ever causes trouble, delete the registration block at the bottom of `game.js` (and `sw.js`). The game works fine without offline support.

## Deploy

Use a long unguessable path, because the pond is a private gift and a static host cannot add a password. Put the files in a folder with a random name and share only that URL, for example `https://yourname.github.io/goose-pond-7f3k9q2xv8mw/`. The meta tag `noindex` is already set so search engines should skip it, but anyone with the link can open it, so do not post it anywhere.

### GitHub Pages

1. Create a new **public** repo with a random name, e.g. `pond-7f3k9q2xv8mw` (Pages on free accounts needs public).
2. Upload all files in this folder to the repo root.
3. Repo **Settings → Pages → Build and deployment**: Source "Deploy from a branch", branch `main`, folder `/ (root)`.
4. After a minute the site is at `https://<your-username>.github.io/<repo-name>/`.

### Cloudflare Pages

1. Dashboard → **Workers & Pages → Create → Pages → Upload assets**.
2. Name the project something random, e.g. `pond-7f3k9q2xv8mw`, drag in this folder, and deploy.
3. The site is at `https://<project-name>.pages.dev/`. (Optionally add Cloudflare Access later if you want a real login.)

### Updating

Edit files, re-upload, and bump `CACHE = 'goose-pond-v1'` in `sw.js` (v2, v3...) so phones refresh their offline copy.

## Install on the Home Screen (iPhone / iPad)

1. Open the link in **Safari** (not an in-app browser).
2. Tap the **Share** button.
3. Tap **Add to Home Screen** (scroll the list if needed), then **Add**.
4. Open it from the Home Screen icon. It runs full screen. Her progress is saved separately for the installed app and for the Safari tab, so pick one and stick with it.

## Files

- `index.html`: page shell, meta tags, buttons, bubble and pouch containers
- `style.css`: layout, safe areas, bubble, pouch overlay
- `game.js`: engine (rendering, day/night, goose and June behavior, rolls, saving, audio, input)
- `sprites.js`: all pixel art as palette grids, the pixel cloud and the Home Screen icon generator
- `goodies.js`: goodie sprites and rarities
- `forest.js`: the forest art, items, recipes and hiding places
- `hut.js`: the inside of the hut (furniture, room, kitchen recipes)
- `lines.js`: every line of text June reads
- `config.js`: Supabase address and public key for saving her answers
- `manifest.webmanifest`: Home Screen app metadata
- `sw.js`: minimal offline service worker
- `README.md`: this file
