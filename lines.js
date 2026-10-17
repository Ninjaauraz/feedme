/* All the words June reads live in this file. Edit freely.

   Each line: { id, text, ...optional flags }
   - firstSession: true  -> shown once, as the 3rd bubble of her very first session
   - day2: true          -> shown once, the first time she visits on a later date;
                            after that it joins the normal rotation
   - slot: 'morning' | 'afternoon' | 'evening' | 'night'  (timeOfDay lines only)
   - date: 'MM-DD'       -> only ever appears on that day (once per year)

   Keep ids unique. Changing a line's text keeps its "already seen" status;
   changing its id makes it count as new.
*/
window.LINES = {
  ui: {
    dayLabel: 'Day {n} together at the pond',
    pouchLabel: 'Open pouch',
    muteLabel: 'Sound on or off',
    replayLabel: 'Replay the surprise',
    talkNote: 'What you write or record here is sent to me, your goose. Only I can read and hear it.',
    talkPlaceholder: 'Type here...',
    talkSend: 'Send',
    talkSkip: 'Not now',
    more: 'Tell me more',
    voiceStart: 'Record a voice message',
    voiceStop: 'Stop',
    voiceAgain: 'Record again',
    voiceSend: 'Send voice',
    voiceSending: 'Sending...',
    voiceFail: "Couldn't send it just now. Try again in a bit.",
    voiceDenied: "I can't hear you yet. Allow the microphone for this page, then try again."
  },

  appreciate: [
    { id: 'a1', text: "You showed up. That's my favourite part of today." },
    { id: 'a2', text: "Thank you for feeding me. And for everything else." },
    { id: 'a3', text: "You make this pond feel like home." },
    { id: 'a4', text: "I'd rather be a goose with you than anything without you." },
    { id: 'a5', text: "You're the best thing that's ever fallen into my pond." },
    { id: 'a6', text: "Whatever the day was, you handled it. Proud of you." },
    { id: 'a7', text: "You're smarter, kinder and funnier than you give yourself credit for." },
    { id: 'a8', text: "I think about you more than bread. That's saying a lot." }
  ],

  ask: [
    { id: 'k1', text: "Text me when you're done here? I want to hear from you." },
    { id: 'k2', text: "Call me later. I'll even do the honk voice." },
    { id: 'k3', text: "If you're thinking about me, send a message. I think about you anyway." },
    { id: 'k4', text: "Send me a photo of your day. I'll send a goose face back." },
    { id: 'k5', text: "Tell me one thing that made you smile today, by text." },
    { id: 'k6', text: "Call me before you sleep? Even a short one." }
  ],

  // Shown at most once per session.
  waiting: [
    { id: 'w1', text: "I waited for you. Worth every minute." },
    { id: 'w2', text: "I kept the pond warm for you." },
    { id: 'w3', text: "I checked the shore three times today. It was just a duck." },
    { id: 'w4', text: "I was getting worried. I'm glad you're here." },
    { id: 'w5', text: "It was quiet without you, and I didn't like it." },
    { id: 'w6', text: "I missed you. That's it. That's the line." }
  ],

  timeOfDay: [
    { id: 't1', slot: 'morning',   text: "Good morning, June. The pond looks nice because you're in it." },
    { id: 't2', slot: 'morning',   text: "Early bread is the best bread. Thank you." },
    { id: 't3', slot: 'afternoon', text: "Lunch break? I'll take a snack too." },
    { id: 't4', slot: 'afternoon', text: "The sun's out and you're here. Perfect." },
    { id: 't5', slot: 'evening',   text: "The sky's doing its thing for you tonight." },
    { id: 't6', slot: 'evening',   text: "Dinner for me, then a quiet pond with you." },
    { id: 't7', slot: 'night',     text: "The stars are out. So are the fireflies. Stay a bit?" },
    { id: 't8', slot: 'night',     text: "Shh, the pond is sleepy. We can be quiet together." }
  ],

  // Used for the greeting when she opens the game.
  welcome: [
    { id: 'h1', text: "Hi June. I saved you the best spot." },
    { id: 'h2', text: "You're back. Honk of joy." },
    { id: 'h3', text: "Hello, my favourite human." },
    { id: 'h4', text: "Right on time. Almost." }
  ],

  apology: [
    { id: 'p1', firstSession: true, text: "I'm sorry for how our misunderstanding made you feel. I never want you to feel unheard." },
    { id: 'p2', day2: true, text: "I'm sorry about the fight. I'd rather start over with you than win anything." }
  ],

  // Said when the goose grows. growth[0] = gosling to young goose, growth[1] = young goose to grown goose.
  growth: [
    { id: 'gr1', text: "June, look. I'm bigger. Your bread is working." },
    { id: 'gr2', text: "All grown up, and still weak for your bread." }
  ],

  // Conversations. Once in each part of the day the goose asks how she is. She can also tap the goose any time to talk.
  // She types (or records a voice message) and the goose answers what she said, using the topics in `replies` below.
  talk: {
    ask: {
      morning:   "Good morning, June. How did you sleep, and how are you feeling today?",
      afternoon: "How's your day going so far?",
      evening:   "How was your day today? Tell me anything.",
      night:     "How was your day, June? Tell me anything. I've got all night."
    },
    // Opening line when she taps the goose or hits Tell me more. One is picked at random.
    free: [
      "You make this pond better just by being here. What's on your mind?",
      "I'm so glad you came to talk to me. You're one of my favourite people.",
      "You're kind, you're brave, and you always show up. Tell me anything.",
      "Honestly, you're the best part of my day. Say whatever you like.",
      "I think you're wonderful, June. What would you like to tell me?",
      "Proud of you, always. Go on, I'm all ears. Well, ear holes. Geese are weird."
    ],
    skip: "No pressure. I'm here whenever you want to talk.",
    voice: [
      "I got your voice. I'm keeping it forever, even the breathing.",
      "Your voice just made my whole pond better. Thank you.",
      "I'm smiling with my whole beak. Thank you for that."
    ]
  },

  // What the goose says back. The first topic with a matching word wins (keep the order: gentle topics first).
  // words: whole words, or a stem ending in * (tired* matches tired, tiredness). mood is a rough tag for the reply (sad | happy | calm).
  replies: [
    { topic: 'sick', mood: 'calm',
      words: ['sick*', 'ill', 'headache*', 'migraine*', 'cramp*', 'pain*', 'fever*', 'cough*', 'nausea*', 'unwell'],
      lines: [
        "Oh no. Water, rest, something warm. Please look after yourself, June.",
        "Sending you every bit of healing I have. It's mostly honk energy, but it's strong.",
        "If it's bad, please see someone. If it's just ugh, blanket mode. Doctor Goose insists."
      ] },
    { topic: 'sad', mood: 'sad',
      words: ['sad*', 'cry*', 'cried', 'rough', 'terrible', 'awful', 'horrible', 'worst', 'depress*', '~down', 'upset*', 'hurt*', 'heavy', 'miserable', '~hard', 'ugh', 'drained', 'bad', '~low', 'meh'],
      lines: [
        "Rough days happen to the best humans. I'm sorry, June. I'm right here, and you're allowed to just float for a while.",
        "Ugh. I wish I could fight the day for you. I'd lose, but I'd honk at it very loudly.",
        "Come here. I'm a goose, so imagine a warm, slightly feathery hug.",
        "That sounds heavy. You don't have to explain it to me. I'll just sit next to you."
      ] },
    { topic: 'stressed', mood: 'calm',
      words: ['stress*', 'anxious', 'anxiety', 'worried', 'worry', 'overwhelm*', '~busy', 'deadline*', 'exam*', '~study*', '~work', 'panic*', 'pressure', 'nervous'],
      lines: [
        "Deep breath with me. In, hold, honk. You don't have to do it all at once.",
        "One thing at a time. And if the thing is too big, we'll find a smaller thing.",
        "You've handled harder days than this. I've seen it. I was there, mostly floating."
      ] },
    { topic: 'lonely', mood: 'sad',
      words: ['lonely', 'alone', 'miss*'],
      lines: [
        "I miss you when you're gone too. I stare at the shore like it's a dramatic movie.",
        "You're not alone. You've got a goose, and he is extremely loyal.",
        "Missing someone means there's love in the room. I'm sending a little of mine your way."
      ] },
    { topic: 'angry', mood: 'calm',
      words: ['angry', 'mad', 'annoy*', 'furious', 'irritat*', 'frustrat*', 'hate*', 'rage*', 'pissed'],
      lines: [
        "Who do I need to honk at? Give me a name. Or a rough direction.",
        "Okay, valid. Be mad for a bit. Then maybe a snack, then maybe a breath.",
        "Annoying things are the worst. Let me hiss at them on your behalf. Hssss."
      ] },
    { topic: 'tired', mood: 'calm',
      words: ['tired*', 'sleep*', 'exhaust*', 'nap*', 'yawn*', 'drowsy'],
      lines: [
        "Sleepy June. Blanket, water, maybe a nap. I'll guard the pond while you rest.",
        "Tired is your body asking for kindness. Be nice to it tonight.",
        "I fall asleep in the grass all the time. No shame. Highly recommend."
      ] },
    { topic: 'hungry', mood: 'happy',
      words: ['hungry', 'starving', 'starv*', '~food', '~eat', '~ate', '~lunch', '~dinner', '~breakfast', 'snack*', 'pizza', 'hungry*'],
      lines: [
        "Hungry? Go eat something right now. I can't help, bread isn't on the human menu. Mostly.",
        "Emergency! Human low on snacks. Go fix that, then come back and tell me what you ate.",
        "A hungry June is a grumpy June. Feed yourself first. I'll keep the pond warm."
      ] },
    { topic: 'bored', mood: 'happy',
      words: ['bored*', 'boring'],
      lines: [
        "Bored? Throw bread. It's the only entertainment I'm qualified to provide.",
        "Watch the goose. Honk at the goose. That's all my activities. Both are great.",
        "Boredom is your brain asking for a snack, a nap, or a goose. I'm the goose."
      ] },
    { topic: 'happy', mood: 'happy',
      words: ['happy*', 'good', 'great', 'amazing', 'awesome', 'fun', 'wonderful', 'excited', 'proud', 'best', 'yay', 'celebrat*', 'smil*', 'lovely', 'perfect', '~fine', 'nice'],
      lines: [
        "That makes my whole beak smile. Tell me everything. Slowly. With details.",
        "Yes! More of that, please. You deserve every bit of it.",
        "Honk of joy! I knew today had good stuff in it for you."
      ] },
    { topic: 'laugh', mood: 'happy',
      words: ['laugh*', 'funny', 'lol', 'haha*', 'hehe*', 'joke*'],
      lines: [
        "Ha! Save some of that for me.",
        "Your laugh is my favourite sound, after bread hitting water.",
        "I'm laughing too. It sounds like a honk, but the feeling is the same."
      ] },
    { topic: 'love', mood: 'happy',
      words: ['love', 'luv', 'adore*'],
      lines: [
        "I love you more than bread. That's the biggest number I know.",
        "Honk. That's goose for 'I love you too, a ridiculous amount.'",
        "Careful, I might float away. Love you, June."
      ] },
    { topic: 'hello', mood: 'calm',
      words: ['hi', 'hello', 'hey', 'heyy', 'yo'],
      lines: [
        "Hi June. Perfect timing, I was just thinking about you.",
        "Hello, you. The pond just got better."
      ] },
    { topic: 'thanks', mood: 'happy',
      words: ['thanks', 'thank*', 'thx', 'ty'],
      lines: [
        "Always. You never have to thank me. Just keep showing up.",
        "Anytime. That's a goose promise."
      ] }
  ],

  // Used when nothing above matches. mood comes from a rough read of her words.
  replyDefault: [
    "Thank you for telling me. I read it twice, once for the words and once for you.",
    "I hear you. Tell me more whenever you want. I'm not going anywhere. Geese are very stationary.",
    "Noted, saved and loved. In that order."
  ],

  // Tomorrow's greeting, based on how she answered "how was your day" last time.
  followUp: {
    good: { id: 'f1', text: "Yesterday sounded good. Let's make today good too." },
    meh:  { id: 'f2', text: "Yesterday was just okay. I hope today is a little brighter." },
    low:  { id: 'f3', text: "I thought about you after yesterday. Is today a bit lighter?" }
  },

  // Plays when she has collected every goodie. Shown one after another during the fireworks.
  finale: [
    { id: 'fn1', text: "You found every single one. The whole pond's treasure, and you found it." },
    { id: 'fn2', text: "I'd give you more if I had it. All I really have is me. Happy to be yours, June." }
  ],

  // Things the goose remembers about her. {x} is filled in.
  memory: {
    event: [
      "How did {x} go? I've been thinking about it.",
      "Did {x} happen yet? I want to hear everything.",
      "I kept {x} in my head all day. How was it?"
    ],
    like: [
      "I'm still thinking about {x}. You have excellent taste.",
      "You said you love {x}. I remembered. Geese do that."
    ],
    person: [
      "Say hi to {x} for me.",
      "How's {x} doing these days?"
    ]
  },

  // Tiny daily wishes: three are picked each day. target = how many times. Rewards a diamond each. No streaks, nothing lost.
  wishes: {
    title: "Today's tiny wishes",
    note: "No pressure. They're just for fun.",
    allDone: "All three, June. The pond is very proud of you.",
    done: ["Wish granted! A diamond for you.", "One wish down. Here's a diamond."],
    pool: [
      { id: 'pet', text: 'Pet the puppy', target: 1 },
      { id: 'feed', text: 'Feed the goose 5 pieces of bread', target: 5 },
      { id: 'skip', text: 'Skip a stone 3 times or more', target: 1 },
      { id: 'stones', text: 'Skip 5 stones', target: 5 },
      { id: 'talk', text: 'Tell the goose how you are', target: 1 },
      { id: 'wave', text: 'Give June a little tap', target: 1 },
      { id: 'collect', text: 'Collect a goodie', target: 1 },
      { id: 'fish', text: 'Watch a fish leap', target: 1 },
      { id: 'hut', text: 'See June rest in the hut', target: 1 }
    ]
  },

  stone: {
    nice: ["Look at that. The fish are impressed.", "That's a pro skip. I'm telling everyone.", "Six skips. I'm putting that in the pond records."]
  },

  hints: {
    skip: "Try flicking your finger across the water. I think June can skip a stone.",
    wish: "See the little star up there? It has three tiny wishes for today. No pressure."
  },

  // Optional dated lines. Uncomment and edit; they only appear on that day.
  special: [
    // { id: 'bday1',  date: '03-14', text: "Happy birthday, June. Best day to be your goose." },
    // { id: 'anniv1', date: '09-21', text: "Happy anniversary. Another year of bread and you." }
  ]
};
