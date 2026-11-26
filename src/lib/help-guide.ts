/**
 * Help Assistant guide data.
 * Har entry ek app feature hai: keywords se user ki baat match hoti hai,
 * phir assistant us page par navigate kar ke step-by-step guide dikhata hai.
 * Copy Roman Urdu + English mix mein hai (app ki tone ke mutabiq).
 */

export type HelpEntry = {
  id: string;
  title: string;
  icon: string; // lucide icon name key, mapped in component
  /** Lowercase keywords (Roman Urdu + English) used for matching. */
  keywords: string[];
  /** Route to open, e.g. "/cv". Home tabs use "/" + tab. */
  route: string;
  /** Home tab to activate after navigating to "/" (chat, memory, builds, studio, mind). */
  tab?: string;
  what: string;
  steps: [string, string, string];
  tip: string;
};

export const HELP_ENTRIES: HelpEntry[] = [
  {
    id: "chat",
    title: "Quick Chat (AI Assistant)",
    icon: "message",
    keywords: ["chat", "baat", "ai se", "sawal", "question", "poochna", "help", "madad", "assistant", "talk"],
    route: "/",
    tab: "chat",
    what: "Ask the AI anything — websites, code, ideas and more.",
    steps: [
      "Open the Chat tab and type your question or idea.",
      "Press Enter — the AI will answer or start working.",
      "If you don't like the answer, explain again and resend.",
    ],
    tip: "Pick your language from the language menu — the AI replies in that language.",
  },
  {
    id: "builds",
    title: "My Builds (Website Builder)",
    icon: "hammer",
    keywords: ["website", "build", "site", "banana", "banani", "page", "landing", "web"],
    route: "/",
    tab: "builds",
    what: "Build a full website from chat and publish it.",
    steps: [
      "In chat, type: 'Build me a website...' and describe your idea.",
      "See your websites and live previews in the Builds tab.",
      "Publish, then copy and share your free subdomain link.",
    ],
    tip: "The more detail you give (colors, sections, prices), the better the result.",
  },
  {
    id: "cv",
    title: "My CVs (CV Maker)",
    icon: "file",
    keywords: ["cv", "resume", "job", "naukri", "biodata"],
    route: "/cv",
    what: "Create and download a professional CV in minutes.",
    steps: [
      "Open the CV page and fill in your education, experience and skills.",
      "Check the preview and make any changes.",
      "Download a PDF, get a ZIP, or send it to an employer with Copy Link.",
    ],
    tip: "Update your CV after every new skill or project — editing saved CVs takes seconds.",
  },
  {
    id: "domains",
    title: "My Domains (Domain Search)",
    icon: "globe",
    keywords: ["domain", "naam", "name", ".com", "subdomain", "url", "link"],
    route: "/",
    tab: "builds",
    what: "Find and check the right domain name for your idea.",
    steps: [
      "Open your website in Builds and go to the Domain section.",
      "Search for the name you want — you'll see availability instantly.",
      "Start with a free subdomain; you can connect your own .com later.",
    ],
    tip: "Pick a short, memorable name that's easy to say out loud.",
  },
  {
    id: "phone-tools",
    title: "Phone Tools",
    icon: "phone",
    keywords: ["whatsapp", "call", "dialer", "music", "flashlight", "camera", "instagram", "phone", "tools"],
    route: "/",
    tab: "chat",
    what: "WhatsApp Sender, Call Dialer, Music, Flashlight, Camera, Instagram — sab ek jagah.",
    steps: [
      "Open the Tools menu (side menu) in chat.",
      "Tap the tool you need — like WhatsApp Sender or Flashlight.",
      "Follow the instructions on the tool's screen.",
    ],
    tip: "Enter a number in WhatsApp Sender and the message opens in WhatsApp — no need to save the contact.",
  },
  {
    id: "jalsa",
    title: "Jalsa Mode (Local Chat)",
    icon: "radio",
    keywords: ["jalsa", "offline", "local chat", "qr", "bluetooth", "nearby", "paas"],
    route: "/jalsa-chat",
    what: "Connect two phones directly with a QR code and chat privately.",
    steps: [
      "Open the Jalsa Chat page and show your QR code.",
      "Scan the QR from the other phone — both will connect.",
      "Send messages — the offline queue syncs when the connection returns.",
    ],
    tip: "Jalsa chat runs on a local connection — you can chat with a nearby phone even without internet.",
  },
  {
    id: "scott-coach",
    title: "Scott Coach & Scout Research",
    icon: "sparkles",
    keywords: ["scott", "scot", "coach", "motivation", "quit", "scout", "research", "client", "idea"],
    route: "/scout",
    what: "Scott keeps you motivated; Scout Research finds ideas, plans and clients.",
    steps: [
      "Open the Scott Coach page (All Tools menu or /scout).",
      "Type in the Scott Coach tab, or choose the Scout Research tab.",
      "Replies and past conversations are saved there.",
    ],
    tip: "Feel like quitting? Message Scott right away.",
  },
  {
    id: "ai-tools",
    title: "AI Tools (Image, Video, Research)",
    icon: "sparkles",
    keywords: ["image", "photo", "tasveer", "video", "story", "research", "scout", "generate", "picture"],
    route: "/",
    tab: "chat",
    what: "Create images, render story videos, or research any topic with AI.",
    steps: [
      "Tell chat what you need: 'Create an image...' or 'Research this topic'.",
      "Results appear right in chat — images come with a download button.",
      "For a story video, write a script on the /auto-video page and render it.",
    ],
    tip: "Describe style, colors and mood. A prompt like 'Sunset over Lahore skyline, cinematic' works best.",
  },
  {
    id: "memory",
    title: "Memory",
    icon: "brain",
    keywords: ["memory", "yaad", "remember", "bhool", "forget", "saved"],
    route: "/",
    tab: "memory",
    what: "See what the AI remembers about you — and delete anything you don't want.",
    steps: [
      "Open the Memory tab to see saved preferences and facts.",
      "Tap any item to see details.",
      "Delete anything you want forgotten — the AI won't use it again.",
    ],
    tip: "Memory lets the AI remember your preferences across sessions — brand colors, name, style.",
  },
  {
    id: "studio",
    title: "Studio (Code Editor)",
    icon: "code",
    keywords: ["studio", "code", "editor", "edit", "coding", "html", "css"],
    route: "/",
    tab: "studio",
    what: "View your builds' code and edit it Cursor-style.",
    steps: [
      "Open the Studio tab and select a build to see its live preview.",
      "Select part of the code, press Ctrl+K and describe the change.",
      "Review the diff — Apply or Undo, your choice.",
    ],
    tip: "Use Ctrl+K for small targeted changes — better than rewriting the whole page.",
  },
  {
    id: "community",
    title: "Community / Feed / Top Builders",
    icon: "users",
    keywords: ["community", "feed", "leaderboard", "top builders", "share", "post", "doston"],
    route: "/community",
    what: "Share your projects, get feedback from other builders and climb the leaderboard.",
    steps: [
      "Open the Community page and browse the feed.",
      "Share your build with a screenshot or link.",
      "Give feedback on others' projects to rise on the Top Builders leaderboard.",
    ],
    tip: "Builders who give helpful feedback regularly rank highest.",
  },
  {
    id: "mining",
    title: "Earn (Mining & Points)",
    icon: "coins",
    keywords: ["mining", "earn", "points", "coins", "nqai", "reward", "kamai", "paise"],
    route: "/earn",
    what: "Earn NQAI points with daily activity and boost your speed with invites.",
    steps: [
      "Open the Earn page and start a mining session.",
      "A session lasts 24 hours and earns 0.5 coin per hour.",
      "Invite friends — each invite gives +10 points and +0.1 mining speed.",
    ],
    tip: "Share your referral code — more invites mean faster mining.",
  },
  {
    id: "messages",
    title: "Messages (Friends Chat)",
    icon: "mail",
    keywords: ["message", "inbox", "friend", "dost", "chat karna", "private"],
    route: "/messages",
    what: "Private messaging with accepted friends only — no strangers.",
    steps: [
      "Open the Messages page to see your friends list.",
      "Select a friend and send a message.",
      "New friends must accept an invite first — your privacy is protected.",
    ],
    tip: "No stranger can message you until you accept their invite — your privacy is in your hands.",
  },
  {
    id: "guide",
    title: "How to Use Guide",
    icon: "book",
    keywords: ["guide", "how to use", "sikhao", "tutorial", "features"],
    route: "/how-to-use",
    what: "A detailed, searchable guide to every feature.",
    steps: [
      "Open the How to Use page.",
      "Type a feature name in the search box at the top.",
      "Open a card and follow steps 1-2-3.",
    ],
    tip: "Jump to any section from the table of contents on the left.",
  },
];

/** Simple keyword scorer: counts how many entry keywords appear in the query. */
export function matchHelpEntry(query: string): HelpEntry | null {
  const q = query.toLowerCase();
  let best: HelpEntry | null = null;
  let bestScore = 0;
  for (const entry of HELP_ENTRIES) {
    let score = 0;
    for (const kw of entry.keywords) {
      if (q.includes(kw)) score += kw.length > 3 ? 2 : 1;
    }
    if (score > bestScore) {
      bestScore = score;
      best = entry;
    }
  }
  return bestScore > 0 ? best : null;
}
