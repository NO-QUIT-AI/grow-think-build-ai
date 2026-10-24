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
    what: "AI se kuch bhi poochho — website, code, ideas, sab kuch.",
    steps: [
      "Chat tab kholo aur apna sawal ya idea likho.",
      "Enter dabao — AI jawab dega ya kaam shuru kar dega.",
      "Jawab pasand na aaye to dobara explain kar ke bhejo.",
    ],
    tip: "Roman Urdu, English, Hindi ya Arabic — jis language mein likhoge, AI usi mein jawab dega.",
  },
  {
    id: "builds",
    title: "My Builds (Website Builder)",
    icon: "hammer",
    keywords: ["website", "build", "site", "banana", "banani", "page", "landing", "web"],
    route: "/",
    tab: "builds",
    what: "Chat se poori website banao aur publish karo.",
    steps: [
      "Chat mein likho: 'mere liye ek website banao...' aur idea describe karo.",
      "Builds tab mein apni website ki list aur live preview dekho.",
      "Publish kar ke free subdomain link copy karo aur share karo.",
    ],
    tip: "Jitna detail mein idea likhoge (colors, sections, prices), utna behtar result milega.",
  },
  {
    id: "cv",
    title: "My CVs (CV Maker)",
    icon: "file",
    keywords: ["cv", "resume", "job", "naukri", "biodata"],
    route: "/cv",
    what: "Minutes mein professional CV banao aur download karo.",
    steps: [
      "CV page kholo aur apni education, experience aur skills bhariye.",
      "Preview dekho aur zaroori changes karo.",
      "PDF download karo, ZIP lo ya Copy Link se employer ko bhejo.",
    ],
    tip: "Har nayi skill ya project ke baad CV update karo — saved CVs ko edit karna seconds ka kaam hai.",
  },
  {
    id: "domains",
    title: "My Domains (Domain Search)",
    icon: "globe",
    keywords: ["domain", "naam", "name", ".com", "subdomain", "url", "link"],
    route: "/",
    tab: "builds",
    what: "Apne idea ke liye sahi domain name dhundo aur check karo.",
    steps: [
      "Builds mein apni website kholo aur Domain section dekho.",
      "Apna pasandeeda naam search karo — availability foran pata chal jayegi.",
      "Free subdomain se shuru karo; baad mein apna .com connect kar sakte ho.",
    ],
    tip: "Chhota, yaad rehne wala naam lo — jo WhatsApp par bolne mein aasan ho.",
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
      "Chat ke andar Tools menu (side menu) kholo.",
      "Jo tool chahiye us par tap karo — jaise WhatsApp Sender ya Flashlight.",
      "Tool ki screen par instructions follow karo.",
    ],
    tip: "WhatsApp Sender mein number likho aur message seedha WhatsApp mein khul jayega — contact save karne ki zaroorat nahi.",
  },
  {
    id: "jalsa",
    title: "Jalsa Mode (Local Chat)",
    icon: "radio",
    keywords: ["jalsa", "offline", "local chat", "qr", "bluetooth", "nearby", "paas"],
    route: "/jalsa-chat",
    what: "QR code se do phones ko directly connect kar ke private chat karo.",
    steps: [
      "Jalsa Chat page kholo aur apna QR code dikhao.",
      "Doosre phone se QR scan karo — dono connect ho jayenge.",
      "Messages bhejo — offline queue sync ho jati hai jab connection wapas aaye.",
    ],
    tip: "Jalsa chat local connection par chalti hai — internet ke baghair bhi paas wale phone se baat ho sakti hai.",
  },
  {
    id: "ai-tools",
    title: "AI Tools (Image, Video, Research)",
    icon: "sparkles",
    keywords: ["image", "photo", "tasveer", "video", "story", "research", "scout", "generate", "picture"],
    route: "/",
    tab: "chat",
    what: "AI se images banao, story videos render karo, ya kisi topic par research karwao.",
    steps: [
      "Chat mein likho kya chahiye: 'ek image banao...' ya 'is topic par research karo'.",
      "AI tool ka result chat mein hi milega — image ho to download button aayega.",
      "Story video ke liye /auto-video page par script likho aur render karo.",
    ],
    tip: "Image ke liye detail likho — style, colors, mood. 'Sunset over Lahore skyline, cinematic' jaisa prompt best result deta hai.",
  },
  {
    id: "memory",
    title: "Memory",
    icon: "brain",
    keywords: ["memory", "yaad", "remember", "bhool", "forget", "saved"],
    route: "/",
    tab: "memory",
    what: "Dekho AI ne tumhare baare mein kya yaad rakha hai — aur delete karo jo nahi chahiye.",
    steps: [
      "Memory tab kholo — saved preferences aur facts ki list dikhegi.",
      "Kisi bhi item par tap kar ke detail dekho.",
      "Jo cheez bhulani ho usay delete kar do — AI dobara use nahi karega.",
    ],
    tip: "Memory se AI har session mein tumhari pasand yaad rakhta hai — brand colors, naam, style.",
  },
  {
    id: "studio",
    title: "Studio (Code Editor)",
    icon: "code",
    keywords: ["studio", "code", "editor", "edit", "coding", "html", "css"],
    route: "/",
    tab: "studio",
    what: "Apni builds ka code dekho aur Cursor-style editing karo.",
    steps: [
      "Studio tab kholo aur apni build select karo — live preview dikhega.",
      "Code mein koi hissa select kar ke Ctrl+K dabao aur change describe karo.",
      "Diff review karo — Apply ya Undo, tumhari marzi.",
    ],
    tip: "Ctrl+K se chhote targeted changes karo — poora page dobara likhwane se behtar hai.",
  },
  {
    id: "community",
    title: "Community / Feed / Top Builders",
    icon: "users",
    keywords: ["community", "feed", "leaderboard", "top builders", "share", "post", "doston"],
    route: "/community",
    what: "Apne projects share karo, doosre builders se feedback lo, leaderboard par aao.",
    steps: [
      "Community page kholo aur feed dekho.",
      "Apna build share karo — screenshot ya link ke sath.",
      "Doosron ke projects par feedback do — Top Builders leaderboard par oopar jao.",
    ],
    tip: "Regular helpful feedback dene wale builders leaderboard par sab se oopar hote hain.",
  },
  {
    id: "mining",
    title: "Earn (Mining & Points)",
    icon: "coins",
    keywords: ["mining", "earn", "points", "coins", "nqai", "reward", "kamai", "paise"],
    route: "/earn",
    what: "Rozana activity se NQAI points kamao aur invites se speed badhao.",
    steps: [
      "Earn page kholo aur mining session start karo.",
      "Session 24 ghante chalta hai — 0.5 coin/ghanta milta hai.",
      "Dost invite karo — har invite se +10 points aur mining speed +0.1 badhti hai.",
    ],
    tip: "Apna unique referral code WhatsApp groups mein share karo — jitne zyada invites, utni tez mining.",
  },
  {
    id: "messages",
    title: "Messages (Friends Chat)",
    icon: "mail",
    keywords: ["message", "inbox", "friend", "dost", "chat karna", "private"],
    route: "/messages",
    what: "Sirf accepted friends ke sath private messaging — strangers nahi.",
    steps: [
      "Messages page kholo aur apne friends ki list dekho.",
      "Friend select karo aur message bhejo.",
      "Naye friend ke liye pehle invite accept karna zaroori hai — privacy lock laga hai.",
    ],
    tip: "Koi stranger message nahi kar sakta jab tak tum invite accept na karo — tumhari privacy tumhare haath mein.",
  },
  {
    id: "guide",
    title: "How to Use Guide",
    icon: "book",
    keywords: ["guide", "kaise", "how to", "sikhao", "tutorial", "features"],
    route: "/how-to-use",
    what: "Har feature ki detail guide — search ke sath.",
    steps: [
      "How to Use page kholo.",
      "Upar search box mein apna feature likho.",
      "Card kholo aur Step 1-2-3 follow karo.",
    ],
    tip: "Left side Table of Contents se seedha kisi bhi section par jump karo.",
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
