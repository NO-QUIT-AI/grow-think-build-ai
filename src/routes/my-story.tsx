import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowUpRight, Bike, Code2, Lightbulb, Sparkles, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LegalFooter } from "@/components/legal/LegalPage";
import { storyVersions, type StoryLanguage } from "@/lib/my-story";
import riderImage from "@/assets/my-story-rider.jpg";

const title = "My Real Story - 10th Pass Bike Rider Built NO QUIT AI | No Quit AI";
const description = "Imran's real story: a 10th-pass bike rider in the UAE who built NO QUIT AI with courage, screenshots and step-by-step AI help. Read in English or Urdu.";

export const Route = createFileRoute("/my-story")({
  head: () => ({
    meta: [
      { title }, { name: "description", content: description },
      { property: "og:title", content: title }, { property: "og:description", content: description },
      { property: "og:type", content: "article" },
      { property: "og:url", content: "https://noquitai.com/my-story" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://noquitai.com/my-story" }],
  }),
  component: MyStory,
});

const icons = [UserRound, Bike, Lightbulb, Code2, Sparkles];
const languages: { id: StoryLanguage; label: string }[] = [
  { id: "en", label: "English" }, { id: "ur", label: "اردو" }, { id: "roman", label: "Roman Urdu" },
];

function MyStory() {
  const [language, setLanguage] = useState<StoryLanguage>("en");
  const story = storyVersions[language];
  return (
    <div className="story-page min-h-screen bg-background text-foreground" dir="ltr">
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-5 md:px-8">
        <Link to="/" className="font-display text-base font-bold">NO QUIT AI<span className="text-primary">.</span></Link>
        <nav className="flex items-center gap-4 text-xs" aria-label="Story navigation">
          <Link to="/my-story" aria-current="page" className="text-primary">My Story</Link>
          <Link to="/how-to-use" className="text-muted-foreground hover:text-primary">Guide</Link>
          <Button asChild variant="outline" size="sm"><Link to="/">Open app <ArrowUpRight /></Link></Button>
        </nav>
      </header>
      <main>
        <section className="relative isolate overflow-hidden border-y border-border">
          <img src={riderImage} alt="Illustrative AI-generated image of a delivery motorcycle in the UAE, not Imran's personal photograph" width={1536} height={1024} className="absolute inset-0 -z-20 h-full w-full object-cover object-center" />
          <div className="story-cover absolute inset-0 -z-10" />
          <div className="mx-auto flex min-h-[440px] max-w-6xl flex-col justify-end px-5 pb-10 pt-20 md:min-h-[520px] md:px-8 md:pb-14">
            <span className="mb-5 w-fit border border-primary/50 bg-background/70 px-3 py-1.5 text-[10px] font-semibold tracking-widest text-primary">REAL STORY - NO FAKE</span>
            <h1 className="max-w-2xl text-4xl font-bold leading-tight md:text-6xl">MY REAL STORY<br /><span className="text-primary">NO QUIT AI</span></h1>
            <p className="mt-5 text-sm text-foreground">Imran · UAE · NO QUIT</p>
          </div>
        </section>
        <div className="mx-auto max-w-3xl px-5 py-8 md:px-8">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-6">
            <span className="text-xs text-muted-foreground">MY STORY / میری کہانی</span>
            <div className="flex gap-1" role="group" aria-label="Story language">
              {languages.map(({ id, label }) => <Button key={id} size="sm" variant={language === id ? "default" : "ghost"} aria-pressed={language === id} onClick={() => setLanguage(id)}>{label}</Button>)}
            </div>
          </div>
          <article dir={language === "ur" ? "rtl" : "ltr"} lang={language === "ur" ? "ur" : "en"} className={language === "ur" ? "story-urdu" : ""} aria-label={story.title}>
            {story.sections.map((paragraphs, index) => {
              const Icon = icons[index];
              if (!Icon) return null;
              return <section key={index} className="border-b border-border py-8 md:py-10">
                <div className="mb-5 flex items-center gap-3">
                  <Icon className="h-5 w-5 shrink-0 text-primary" />
                  <span className="text-xs text-muted-foreground">0{index + 1}</span>
                  <h2 className="text-xl font-semibold md:text-2xl">{story.headings[index]}</h2>
                </div>
                <div className="space-y-5 text-base leading-8 text-muted-foreground">{paragraphs.map((paragraph, i) => <p key={i}>{paragraph}</p>)}</div>
              </section>;
            })}
            <div className="py-12 text-center md:py-16">
              <p className="font-display text-3xl font-bold leading-relaxed text-primary md:text-4xl">{story.quote}</p>
              {language !== "roman" && <p lang="en" dir="ltr" className="mt-4 text-sm text-muted-foreground">Degree nahi, himmat chahiye.</p>}
              <Button asChild size="lg" className="mt-8 h-auto max-w-full whitespace-normal py-3"><Link to="/">Try NO QUIT AI - Free Forever <ArrowUpRight /></Link></Button>
            </div>
          </article>
          <LegalFooter />
        </div>
      </main>
    </div>
  );
}