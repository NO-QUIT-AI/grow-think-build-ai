export type BlogSection = { h: string; p: string[] };
export type BlogPost = {
  slug: string;
  title: string;
  description: string;
  date: string;
  readMinutes: number;
  sections: BlogSection[];
};

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: "build-a-website-with-ai-chat",
    title: "How to Build a Website With AI Chat — A Step-by-Step Guide for Beginners",
    description:
      "Learn how to turn a simple idea into a working website by chatting with an AI assistant: planning, prompting, previewing, improving and sharing.",
    date: "14 October 2026",
    readMinutes: 6,
    sections: [
      {
        h: "Why building with chat changes everything",
        p: [
          "For most of the history of the web, making a website meant learning HTML, CSS and JavaScript, choosing a framework, buying hosting and spending weeks fixing small layout problems. That barrier kept millions of good ideas from ever going online. A small shop owner, a student with a portfolio, or a teacher who wants a class page usually does not have the time to learn all of that.",
          "AI chat builders remove most of that barrier. Instead of writing code line by line, you describe what you want in plain language, and the assistant writes the code for you. You can then look at a live preview, ask for changes, and repeat until the result matches what you had in mind. On NO QUIT AI you can do this in English or in Roman Urdu, which makes the process natural for people who think in more than one language.",
          "This guide walks through the whole process, from the first idea to a page you can share with friends or customers. The steps work for almost any simple site: a personal portfolio, a landing page for a product, a restaurant menu, an event invitation, or a small business profile.",
        ],
      },
      {
        h: "Step 1: Decide what the website is for",
        p: [
          "Before you type anything, spend two minutes answering three questions. Who will visit this page? What should they understand within five seconds? What is the one action you want them to take — call you, send a WhatsApp message, fill a form, or simply read your story?",
          "Writing these answers down sounds basic, but it is the single biggest difference between a confusing page and a clear one. An AI assistant can write beautiful code, but it cannot guess your goal. When your goal is clear, your prompt becomes clear, and the result improves immediately.",
        ],
      },
      {
        h: "Step 2: Write a strong first prompt",
        p: [
          "Your first message should describe the type of site, the audience, the sections you need and the style you like. A weak prompt is: \"make me a website\". A strong prompt is: \"Make a one-page website for my home bakery in Lahore. Sections: a welcome header with the name Sweet Crumbs, a menu with six cakes and prices, customer reviews, and a big WhatsApp order button. Warm colours, friendly tone, mobile first.\"",
          "Notice what the strong prompt includes: the business, the location, the exact sections, the main action and the visual mood. You do not need technical words. Saying \"mobile first\" is helpful because most visitors in Pakistan, India and the Gulf open links on their phones, but even \"it should look good on phones\" is enough.",
          "If you are not sure about the content yet, ask the assistant to use clear placeholder text and mark it so you can replace it later. Never publish invented phone numbers, addresses or reviews — always replace them with real information before you share the page.",
        ],
      },
      {
        h: "Step 3: Review the live preview",
        p: [
          "Once the assistant finishes, the Studio shows a live preview of your site. Look at it the way a visitor would. Open it on your phone if you can. Read the headline out loud. Is it obvious what the page is about? Is the main button easy to find? Is any text too small or too long?",
          "Make a short list of what you want to change. It is better to ask for two or three specific changes at a time than to send one huge message with twenty requests. Small, focused changes are easier for the assistant to get right and easier for you to check.",
        ],
      },
      {
        h: "Step 4: Improve it version by version",
        p: [
          "Good websites are rarely perfect on the first try. Treat each message as a new version. For example: \"Make the menu prices bigger and add a short line under each cake describing the flavour.\" Then: \"Move the reviews above the menu and use a softer cream background.\"",
          "NO QUIT AI remembers your builds, so you can come back tomorrow and continue where you stopped. This is useful when you need to collect real photos, confirm prices with your family, or get feedback from a friend before finishing.",
          "When something looks wrong, describe what you see rather than what you think the code should be. \"The button is hidden behind the picture on my phone\" is more useful than guessing at technical causes. The assistant can work out the fix from a clear description.",
        ],
      },
      {
        h: "Step 5: Add real content and check the details",
        p: [
          "Before you share your site, replace every placeholder with real information. Check that phone numbers, email addresses and links actually work. Make sure your business name is spelled the same way everywhere. If you use photos, use your own or images you have the right to use.",
          "Also read the page once for tone. Is it friendly and honest? Does it avoid promises you cannot keep? Visitors trust simple, specific statements far more than exaggerated marketing language. \"Fresh cakes baked to order, delivered in Gulberg within 3 hours\" is stronger than \"the best cakes in the world\".",
        ],
      },
      {
        h: "Step 6: Share and learn from visitors",
        p: [
          "When you are happy with the result, download it or copy the share link and send it to the people it was made for. Post it in your WhatsApp status, add it to your Instagram bio, or share it in the NO QUIT AI community feed to get feedback from other builders.",
          "Pay attention to the questions people ask you after visiting. If several people ask the same thing — delivery areas, opening hours, sizes — that information belongs on the page. Go back to the chat and add it. A website is a living tool, not a one-time project.",
        ],
      },
      {
        h: "Common mistakes to avoid",
        p: [
          "The most common mistake is trying to include everything. A focused page with one clear message beats a crowded page with ten. The second mistake is ignoring mobile: always check the phone view before sharing. The third is publishing unchecked AI text. AI output can be inaccurate, so read every sentence and make sure it is true for your situation.",
          "Finally, do not give up after the first attempt. The whole idea behind NO QUIT AI is in the name — keep improving, one version at a time, and you will end up with a website you are proud of, without writing a single line of code yourself.",
        ],
      },
    ],
  },
  {
    slug: "make-a-professional-cv-online",
    title: "How to Make a Professional CV Online for Free — Complete 2026 Guide",
    description:
      "A practical guide to writing a CV that gets interviews: structure, wording, photos, common mistakes and how to export a clean PDF.",
    date: "12 October 2026",
    readMinutes: 6,
    sections: [
      {
        h: "Why your CV still matters",
        p: [
          "Even in a world of LinkedIn profiles and online portfolios, the CV is still the first document most employers ask for. Recruiters often spend less than ten seconds on a first look. In those seconds they decide whether to read further or move on to the next candidate. A clear, well-organised CV does not guarantee a job, but a messy one can stop you from ever getting an interview.",
          "The good news is that a strong CV is mostly about structure and honesty, not fancy design. This guide explains what to include, how to write each section, and how to use the free CV Maker inside NO QUIT AI to produce a polished PDF in minutes.",
        ],
      },
      {
        h: "The basic structure of a strong CV",
        p: [
          "Most successful CVs follow the same order: contact details, a short professional summary, work experience, education, skills, and optional sections such as projects, certifications, languages or volunteer work. Keeping this familiar order helps recruiters find information quickly.",
          "For people early in their career, one page is usually enough. Experienced professionals can use two pages, but every line should earn its place. If a detail does not help the reader understand why you fit the job, remove it.",
        ],
      },
      {
        h: "Contact details and photo",
        p: [
          "At the top, include your full name, a professional email address, a phone number with country code, your city and, if relevant, a LinkedIn or portfolio link. Avoid email addresses that look unprofessional — a simple combination of your first and last name works best.",
          "Whether to add a photo depends on the country. Many employers in Pakistan, the Gulf and parts of Europe still expect one, while employers in the United States and the United Kingdom usually prefer CVs without photos. If you add a photo, use a clear, recent headshot with a plain background and good light. The NO QUIT AI CV Maker lets you upload a photo and place it neatly in the header.",
        ],
      },
      {
        h: "Writing a professional summary",
        p: [
          "The summary is two to four sentences that tell the reader who you are, what you are good at and what you are looking for. Think of it as the answer to \"tell me about yourself\" written in the shortest possible form.",
          "A weak summary says: \"Hardworking person looking for a good opportunity.\" A strong summary says: \"Customer support specialist with three years of experience handling 60+ daily tickets for an e-commerce brand. Fluent in English and Urdu. Looking to grow into a team lead role in a fast-moving company.\" The second version is specific, measurable and shows direction.",
        ],
      },
      {
        h: "Describing your work experience",
        p: [
          "List your jobs from most recent to oldest. For each role, include the job title, the company name, the city and the dates. Under each one, write three to five bullet points that describe achievements rather than duties.",
          "Start each bullet with an action verb such as managed, built, reduced, trained or launched. Where possible, add numbers: \"Reduced order processing time by 30% by creating a shared tracking sheet\" is far more convincing than \"Responsible for orders\". Numbers give the reader a sense of scale and impact.",
          "If you are a student or fresh graduate with little formal experience, include internships, part-time jobs, freelance work, university projects and volunteering. Employers understand that everyone starts somewhere; they want to see initiative and the ability to finish things.",
        ],
      },
      {
        h: "Education and skills",
        p: [
          "For education, list your degree, institution, city and graduation year. Add your grade only if it is strong. Recent graduates can mention relevant courses, final-year projects or awards.",
          "The skills section should be honest and relevant. Separate technical skills (for example Excel, Canva, Python, AutoCAD) from soft skills and languages. Do not list every program you have ever opened — focus on those you could confidently use on the first day of the job.",
        ],
      },
      {
        h: "Using AI to polish your wording",
        p: [
          "AI is excellent at improving grammar, tightening long sentences and suggesting stronger verbs. In the NO QUIT AI CV Maker you can write your experience in simple words, even in Roman Urdu, and use the AI polish feature to turn it into clear professional English.",
          "However, always review the result. AI may exaggerate or add details that are not true. Your CV must describe what you actually did. Interviewers often ask about specific bullet points, and being unable to explain something on your own CV damages trust immediately.",
        ],
      },
      {
        h: "Design, themes and exporting to PDF",
        p: [
          "A professional CV uses one or two fonts, consistent spacing and a clear hierarchy of headings. Avoid bright colours across the whole page, tables that break when copied, and decorative graphics that distract from content. A simple accent colour for headings is enough.",
          "Always send your CV as a PDF so the layout stays the same on every device. The CV Maker offers several themes and a live preview, and the Download PDF button saves a file named after you, which makes it easy for recruiters to find in their downloads folder.",
        ],
      },
      {
        h: "Final checklist before you apply",
        p: [
          "Read your CV out loud once to catch mistakes. Check that dates are consistent and there are no unexplained gaps without context. Make sure your phone number and email work. Tailor the summary and top skills slightly for each job you apply to, using words from the job description where they honestly apply to you.",
          "A good CV is a living document. Update it every few months with new achievements, even when you are not job hunting. When the right opportunity appears, you will be ready to apply the same day.",
        ],
      },
    ],
  },
  {
    slug: "prompt-writing-tips-for-better-ai-results",
    title: "Prompt Writing Tips: How to Get Better Results From AI Assistants",
    description:
      "Simple, practical techniques for writing prompts that give clearer, more accurate and more useful answers from any AI assistant.",
    date: "10 October 2026",
    readMinutes: 6,
    sections: [
      {
        h: "Why prompts matter",
        p: [
          "AI assistants are powerful, but they respond to exactly what you give them. Two people can ask about the same topic and receive very different answers because one wrote a vague request and the other wrote a clear one. Learning to write good prompts is one of the most valuable digital skills today, and it takes only a few minutes to improve.",
          "In this article we share techniques that work well in NO QUIT AI and in almost every other AI tool. You do not need technical knowledge — just a habit of being clear about what you want.",
        ],
      },
      {
        h: "1. Give context first",
        p: [
          "The assistant does not know who you are, what you are working on or why you are asking. A sentence or two of context changes the answer completely. Compare \"write a caption\" with \"I run a small clothing brand for university students in Karachi. Write an Instagram caption for our new winter hoodies, friendly and slightly funny.\"",
          "Good context includes who the result is for, where it will be used and any limits such as length, language or tone. When building websites, mention the type of business, the audience and the main action you want visitors to take.",
        ],
      },
      {
        h: "2. Be specific about the output",
        p: [
          "Tell the assistant what shape the answer should have. Do you want a list, a table, a short paragraph, an email, code, or step-by-step instructions? How long should it be? Should it be in English, Urdu, Hindi or Arabic?",
          "For example: \"Give me five bullet points, each under fifteen words\" produces a very different result from \"tell me about it\". Specific instructions save time because you do not need to ask for a rewrite.",
        ],
      },
      {
        h: "3. Break big tasks into steps",
        p: [
          "Large requests often produce average results. If you want a business plan, first ask for an outline, then expand each section one by one. If you want an app, start with the main screen, check it, then add features.",
          "This step-by-step approach also helps you catch mistakes early. It is much easier to fix a small problem in the outline than to rewrite a long finished document. NO QUIT AI is designed for this style of working: build, preview, improve, repeat.",
        ],
      },
      {
        h: "4. Show an example",
        p: [
          "If you have a style in mind, show it. Paste a short sample of writing you like, or describe a website you admire and what you like about it. Examples communicate tone and structure better than adjectives. \"Write it like this example\" is often more effective than \"make it professional but friendly\".",
          "Be careful not to paste private information such as passwords, bank details or other people's personal data into any AI tool. Use only what you are comfortable sharing.",
        ],
      },
      {
        h: "5. Ask the assistant to ask you questions",
        p: [
          "When you are unsure what details matter, add a line such as: \"Before you start, ask me up to three questions that would help you do this better.\" The assistant will point out missing information — budget, audience, deadline — that you may not have thought about.",
          "This turns a one-way request into a short conversation and usually leads to a far more useful final answer.",
        ],
      },
      {
        h: "6. Give feedback, not just a new request",
        p: [
          "When the first answer is not quite right, explain what to keep and what to change. \"Keep the structure, but make the tone more casual and cut the length in half\" is better than starting over. The assistant builds on what already works.",
          "Describe problems in terms of results. \"The headline does not explain what we sell\" is clearer than \"make it better\". Specific feedback gives specific improvements.",
        ],
      },
      {
        h: "7. Always verify important facts",
        p: [
          "AI assistants can sound confident even when they are wrong. They may mix up dates, invent statistics or misunderstand local rules. For anything important — health, money, legal matters, official documents — check the information with reliable sources or a qualified person.",
          "A good habit is to ask: \"Which parts of this answer should I double-check?\" The assistant can often point out where it is less certain. Treat AI as a smart helper that speeds up your work, not as a final authority.",
        ],
      },
      {
        h: "8. Use your own language",
        p: [
          "You do not have to write perfect English. NO QUIT AI understands Roman Urdu, Hindi and Arabic as well, so you can explain ideas in the way you naturally think. Mixing languages is fine. What matters is clarity, not grammar.",
          "If you need the final result in a different language from your prompt, just say so: \"Explain in Roman Urdu, but write the website text in English.\"",
        ],
      },
      {
        h: "A simple prompt template",
        p: [
          "When in doubt, use this pattern: Context (who you are and what this is for), Task (what you want created), Format (length, structure, language), and Style (tone, examples). For example: \"I am a math tutor in Islamabad. Create a one-page website advertising my O-level classes. Include timings, fees placeholder, and a WhatsApp button. Clean, trustworthy, blue and white.\"",
          "With a little practice these habits become automatic, and you will find that AI saves you hours every week — whether you are building a website, writing a CV or planning your next idea.",
        ],
      },
    ],
  },
];

export function getPost(slug: string) {
  return BLOG_POSTS.find((p) => p.slug === slug);
}
