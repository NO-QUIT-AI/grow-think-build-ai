import { supabase } from "@/integrations/supabase/client";
import { downloadHtmlAsPdf } from "@/lib/html-pdf";
import type { Lang } from "@/i18n/translations";

export type CvExperience = { role: string; company: string; period: string; points: string };
export type CvEducation = { degree: string; school: string; period: string };

export type CvData = {
  name: string;
  role: string;
  email: string;
  phone: string;
  location: string;
  links: string;
  photo: string;
  summary: string;
  experience: CvExperience[];
  education: CvEducation[];
  skills: string;
  languages: string;
  accent: string;
};

export type CvRecord = {
  id: string;
  title: string;
  data: CvData;
  updated_at: string;
};

export const ACCENTS = ["#10b981", "#2563eb", "#7c3aed", "#e11d48", "#0f172a"];

export function emptyCv(): CvData {
  return {
    name: "",
    role: "",
    email: "",
    phone: "",
    location: "",
    links: "",
    photo: "",
    summary: "",
    experience: [{ role: "", company: "", period: "", points: "" }],
    education: [{ degree: "", school: "", period: "" }],
    skills: "",
    languages: "",
    accent: ACCENTS[0]!,
  };
}

/** Purane ya adhoore records ko safe shape me le aata hai. */
export function normalizeCv(raw: unknown): CvData {
  const base = emptyCv();
  const data = (raw ?? {}) as Partial<CvData>;
  return {
    ...base,
    ...data,
    experience: Array.isArray(data.experience) && data.experience.length ? data.experience : base.experience,
    education: Array.isArray(data.education) && data.education.length ? data.education : base.education,
    accent: data.accent || base.accent,
  };
}

function esc(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function bullets(points: string) {
  const list = points
    .split("\n")
    .map((line) => line.replace(/^[-•*]\s*/, "").trim())
    .filter(Boolean);
  if (!list.length) return "";
  return `<ul>${list.map((line) => `<li>${esc(line)}</li>`).join("")}</ul>`;
}

function chips(value: string) {
  const list = value
    .split(/[,\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
  if (!list.length) return "";
  return `<div class="chips">${list.map((item) => `<span>${esc(item)}</span>`).join("")}</div>`;
}

/** CV ka clean, print-ready single-file HTML. */
export function renderCvHtml(data: CvData): string {
  const accent = data.accent || ACCENTS[0]!;
  const contact = [data.email, data.phone, data.location, data.links]
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => `<span>${esc(item)}</span>`)
    .join("");

  const experience = data.experience
    .filter((item) => item.role || item.company || item.points)
    .map(
      (item) => `<article class="item">
        <div class="row"><h3>${esc(item.role)}</h3><span class="period">${esc(item.period)}</span></div>
        ${item.company ? `<p class="org">${esc(item.company)}</p>` : ""}
        ${bullets(item.points)}
      </article>`,
    )
    .join("");

  const education = data.education
    .filter((item) => item.degree || item.school)
    .map(
      (item) => `<article class="item">
        <div class="row"><h3>${esc(item.degree)}</h3><span class="period">${esc(item.period)}</span></div>
        ${item.school ? `<p class="org">${esc(item.school)}</p>` : ""}
      </article>`,
    )
    .join("");

  const section = (title: string, body: string) =>
    body ? `<section><h2>${title}</h2>${body}</section>` : "";

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(data.name || "CV")}</title>
<style>
  *{box-sizing:border-box}
  body{margin:0;background:#f1f5f9;font-family:"Segoe UI",Arial,Helvetica,sans-serif;color:#0f172a}
  .page{max-width:800px;margin:0 auto;background:#fff;padding:36px 40px}
  header{display:flex;gap:20px;align-items:center;border-bottom:3px solid ${accent};padding-bottom:18px}
  header img{width:104px;height:104px;border-radius:14px;object-fit:cover;border:3px solid ${accent}}
  h1{margin:0;font-size:30px;letter-spacing:-0.4px}
  .role{margin:4px 0 8px;color:${accent};font-weight:600;font-size:15px}
  .contact{display:flex;flex-wrap:wrap;gap:6px 14px;font-size:12.5px;color:#475569}
  section{margin-top:22px}
  h2{font-size:13px;text-transform:uppercase;letter-spacing:1.2px;color:${accent};margin:0 0 10px;
     border-bottom:1px solid #e2e8f0;padding-bottom:5px}
  .item{margin-bottom:14px}
  .row{display:flex;justify-content:space-between;gap:12px;align-items:baseline}
  h3{margin:0;font-size:15px}
  .period{font-size:12px;color:#64748b;white-space:nowrap}
  .org{margin:2px 0 6px;font-size:13px;color:#475569}
  ul{margin:0;padding-left:18px}
  li{font-size:13px;line-height:1.55;margin-bottom:3px}
  p.summary{font-size:13.5px;line-height:1.6;margin:0}
  .chips{display:flex;flex-wrap:wrap;gap:6px}
  .chips span{background:#f1f5f9;border:1px solid #e2e8f0;border-radius:999px;padding:4px 10px;font-size:12px}
  @media print{body{background:#fff}.page{padding:0;max-width:none}@page{margin:14mm}}
  @media (max-width:640px){.page{padding:22px 18px}header{flex-direction:column;text-align:center}}
</style></head>
<body><div class="page">
  <header>
    ${data.photo ? `<img src="${data.photo}" alt="${esc(data.name)}" />` : ""}
    <div>
      <h1>${esc(data.name || "Your Name")}</h1>
      ${data.role ? `<p class="role">${esc(data.role)}</p>` : ""}
      <div class="contact">${contact}</div>
    </div>
  </header>
  ${section("Profile", data.summary ? `<p class="summary">${esc(data.summary)}</p>` : "")}
  ${section("Experience", experience)}
  ${section("Education", education)}
  ${section("Skills", chips(data.skills))}
  ${section("Languages", chips(data.languages))}
</div></body></html>`;
}

export function cvFileName(data: CvData) {
  const slug =
    (data.name || "My")
      .replace(/[^a-zA-Z0-9\s-]/g, " ")
      .trim()
      .split(/\s+/)
      .slice(0, 3)
      .join("-") || "My";
  return `${slug}-CV`;
}

/** Seedha PDF download — koi printer dialog nahi. */
export async function downloadCvPdf(data: CvData) {
  await downloadHtmlAsPdf(renderCvHtml(data), `${cvFileName(data)}.pdf`);
}

export function downloadCvHtml(data: CvData) {
  const blob = new Blob([renderCvHtml(data)], { type: "text/html" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${cvFileName(data)}.html`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(link.href), 30_000);
}

/** Photo ko chhota kar ke data URL banata hai (CV me embed hoti hai). */
export function compressPhoto(file: File, maxSide = 600, quality = 0.85): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Image read nahi hui"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Image load nahi hui"));
      img.onload = () => {
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas nahi bana"));
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

/** CV storage ab user ke apne Cloudflare R2 bucket (noquitai-files/database/cvs/) me hai. */
async function r2Fetch(method: string, query = "", body?: unknown) {
  const { data: session } = await supabase.auth.getSession();
  const token = session.session?.access_token;
  const response = await fetch(`/api/cv-store${query}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) throw new Error((await response.text()) || "R2 request failed");
  return response.json();
}

export async function listCvs(_userId: string): Promise<CvRecord[]> {
  try {
    const { cvs } = (await r2Fetch("GET")) as { cvs: CvRecord[] };
    return cvs
      .map((row) => ({
        id: row.id,
        title: row.title ?? "Mera CV",
        data: normalizeCv(row.data),
        updated_at: row.updated_at,
      }))
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  } catch {
    return [];
  }
}

export async function saveCv(_userId: string, id: string | null, data: CvData) {
  const title = data.name ? `${data.name} — CV` : "Mera CV";
  const res = (await r2Fetch("PUT", "", { id, title, data })) as { id: string };
  return res.id;
}

export async function deleteCv(id: string) {
  await r2Fetch("DELETE", `?id=${encodeURIComponent(id)}`);
}

/** AI se summary + experience bullets behtar karwata hai. */
export async function polishCv(data: CvData, lang: Lang): Promise<Partial<CvData>> {
  const { data: session } = await supabase.auth.getSession();
  const token = session.session?.access_token;
  const response = await fetch("/api/cv-polish", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ data: { ...data, photo: "" }, lang }),
  });
  if (!response.ok) throw new Error((await response.text()) || "AI se jawab nahi aaya");
  return (await response.json()) as Partial<CvData>;
}
