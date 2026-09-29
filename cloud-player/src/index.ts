import { Hono } from "hono";
import { cors } from "hono/cors";

type Bindings = {
  DB: D1Database;
  NOQUIT_BUCKET: R2Bucket;
  AI: Ai;
};

const app = new Hono<{ Bindings: Bindings }>();
const MAX_UPLOAD = 100 * 1024 * 1024; // 100 MB

app.use("*", cors({ origin: "*", allowMethods: ["GET", "POST", "OPTIONS"], allowHeaders: ["Content-Type", "Range"], exposeHeaders: ["Content-Range", "Content-Length", "Accept-Ranges"] }));

app.get("/", (c) => c.html(PAGE));
app.get("/health", (c) => c.json({ ok: true, worker: "noquitai" }));

/* ---------- Chat (Workers AI) ---------- */
app.post("/api/chat", async (c) => {
  const body = await c.req.json<{ message?: string; history?: { role: string; content: string }[] }>().catch(() => ({} as { message?: string; history?: { role: string; content: string }[] }));
  const message = String(body.message ?? "").trim().slice(0, 4000);
  if (!message) return c.json({ error: "message required" }, 400);

  const history = Array.isArray(body.history) ? body.history.slice(-10) : [];
  const messages = [
    { role: "system", content: "You are NO QUIT AI, a short, helpful assistant." },
    ...history.filter((m) => m.role === "user" || m.role === "assistant").map((m) => ({ role: m.role, content: String(m.content).slice(0, 4000) })),
    { role: "user", content: message },
  ];

  try {
    const result = (await c.env.AI.run("@cf/meta/llama-3-8b-instruct" as keyof AiModels, { messages } as never)) as { response?: string };
    const answer = result.response ?? "";
    c.executionCtx.waitUntil(
      c.env.DB.prepare("INSERT INTO chats (question, answer) VALUES (?, ?)").bind(message, answer).run().catch(() => undefined),
    );
    return c.json({ reply: answer });
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : "AI error" }, 500);
  }
});

/* ---------- Upload ---------- */
app.post("/api/upload", async (c) => {
  const form = await c.req.formData().catch(() => null);
  const file = form?.get("file");
  if (!file || typeof file === "string") return c.json({ error: "file required" }, 400);
  if (file.size > MAX_UPLOAD) return c.json({ error: "File too large (max 100MB)" }, 413);

  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80) || "file";
  const key = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}-${safe}`;
  const type = file.type || "application/octet-stream";

  await c.env.NOQUIT_BUCKET.put(key, file.stream(), { httpMetadata: { contentType: type }, customMetadata: { name: file.name } });
  c.executionCtx.waitUntil(
    c.env.DB.prepare("INSERT INTO files (key, name, size, type) VALUES (?, ?, ?, ?)").bind(key, file.name, file.size, type).run().catch(() => undefined),
  );

  const origin = new URL(c.req.url).origin;
  return c.json({ key, name: file.name, size: file.size, type, url: `${origin}/video/${encodeURIComponent(key)}`, share: `${origin}/?v=${encodeURIComponent(key)}` });
});

/* ---------- List ---------- */
app.get("/api/files", async (c) => {
  const list = await c.env.NOQUIT_BUCKET.list({ limit: 100, include: ["httpMetadata", "customMetadata"] } as R2ListOptions);
  const origin = new URL(c.req.url).origin;
  const files = list.objects
    .map((o) => ({
      key: o.key,
      name: o.customMetadata?.name ?? o.key,
      size: o.size,
      type: o.httpMetadata?.contentType ?? "",
      uploaded: o.uploaded.toISOString(),
      url: `${origin}/video/${encodeURIComponent(o.key)}`,
      share: `${origin}/?v=${encodeURIComponent(o.key)}`,
    }))
    .sort((a, b) => b.uploaded.localeCompare(a.uploaded));
  return c.json({ files });
});

/* ---------- Stream (Range support) ---------- */
app.get("/video/:key", async (c) => {
  const key = decodeURIComponent(c.req.param("key"));
  const rangeHeader = c.req.header("range");
  let range: R2Range | undefined;
  const m = rangeHeader?.match(/bytes=(\d*)-(\d*)/);
  if (m) {
    if (m[1]) range = { offset: Number(m[1]), ...(m[2] ? { length: Number(m[2]) - Number(m[1]) + 1 } : {}) };
    else if (m[2]) range = { suffix: Number(m[2]) };
  }

  const obj = await c.env.NOQUIT_BUCKET.get(key, range ? { range } : undefined);
  if (!obj) return c.text("Not found", 404);

  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set("Accept-Ranges", "bytes");
  headers.set("Cache-Control", "public, max-age=86400");
  headers.set("Access-Control-Allow-Origin", "*");

  if (range && "offset" in range && range.offset !== undefined) {
    const start = range.offset;
    const end = range.length ? start + range.length - 1 : obj.size - 1;
    headers.set("Content-Range", `bytes ${start}-${end}/${obj.size}`);
    headers.set("Content-Length", String(end - start + 1));
    return new Response(obj.body, { status: 206, headers });
  }
  if (range && "suffix" in range) {
    const len = Math.min(range.suffix, obj.size);
    headers.set("Content-Range", `bytes ${obj.size - len}-${obj.size - 1}/${obj.size}`);
    headers.set("Content-Length", String(len));
    return new Response(obj.body, { status: 206, headers });
  }
  headers.set("Content-Length", String(obj.size));
  return new Response(obj.body, { headers });
});

export default app;

/* ---------- Player page ---------- */
const PAGE = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>NO QUIT AI — Cloud Player</title>
<meta name="description" content="Upload, stream and share videos with NO QUIT AI Cloud Player."/>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=DM+Sans:wght@400;500&display=swap" rel="stylesheet"/>
<style>
*{box-sizing:border-box}body{margin:0;background:#000;color:#e8fff4;font-family:'DM Sans',sans-serif;min-height:100vh}
h1,h2{font-family:'Space Grotesk',sans-serif;margin:0}
.wrap{max-width:1100px;margin:0 auto;padding:24px 16px}
header{display:flex;align-items:center;justify-content:space-between;margin-bottom:24px}
.logo{font-size:22px;font-weight:700;letter-spacing:.5px}.logo span{color:#00ff88;text-shadow:0 0 18px #00ff8899}
.grid{display:grid;gap:16px;grid-template-columns:2fr 1fr}
@media(max-width:800px){.grid{grid-template-columns:1fr}}
.card{background:#0a0f0c;border:1px solid #00ff8826;border-radius:16px;padding:16px}
video{width:100%;border-radius:12px;background:#050805;aspect-ratio:16/9}
.btn{background:#00ff88;color:#001a0d;border:0;border-radius:12px;padding:12px 18px;font-weight:700;cursor:pointer;box-shadow:0 0 20px #00ff8855;font-size:14px}
.btn:disabled{opacity:.5}.btn.ghost{background:transparent;color:#00ff88;border:1px solid #00ff8866;box-shadow:none}
.drop{border:2px dashed #00ff8855;border-radius:14px;padding:22px;text-align:center;cursor:pointer;color:#9fcfb7}
.drop.on{background:#00ff8810}
.bar{height:6px;background:#0f2a1c;border-radius:6px;overflow:hidden;margin-top:10px}.bar i{display:block;height:100%;width:0;background:#00ff88}
.share{display:flex;gap:8px;margin-top:10px}.share input{flex:1;min-width:0;background:#050805;border:1px solid #00ff8833;color:#e8fff4;border-radius:10px;padding:10px}
ul{list-style:none;padding:0;margin:10px 0 0;max-height:420px;overflow:auto}
li{padding:10px;border-radius:10px;cursor:pointer;font-size:14px;border:1px solid transparent;word-break:break-all}
li:hover,li.act{border-color:#00ff8855;background:#00ff880d}small{color:#7aa892}
.chat{margin-top:16px}.msgs{max-height:260px;overflow:auto;font-size:14px;display:flex;flex-direction:column;gap:8px;margin:10px 0}
.m{padding:8px 12px;border-radius:12px;max-width:85%}.u{align-self:flex-end;background:#00ff88;color:#001a0d}.a{background:#0f1a14}
form{display:flex;gap:8px}form input{flex:1;min-width:0;background:#050805;border:1px solid #00ff8833;color:#e8fff4;border-radius:12px;padding:12px}
</style></head><body><div class="wrap">
<header><div class="logo">NO QUIT <span>AI</span> · Player</div><button class="btn ghost" onclick="load()">Refresh</button></header>
<div class="grid">
 <div class="card"><video id="v" controls playsinline></video><h2 id="t" style="margin-top:12px;font-size:18px">Select or upload a video</h2>
  <div class="share"><input id="sl" readonly placeholder="Share link"/><button class="btn" onclick="copy()">Copy</button></div></div>
 <div class="card"><h2 style="font-size:16px">Upload</h2>
  <label class="drop" id="dz" style="display:block;margin-top:10px">Tap or drop a file here<input id="f" type="file" hidden/></label>
  <div class="bar"><i id="pb"></i></div><small id="st"></small>
  <h2 style="font-size:16px;margin-top:16px">Files</h2><ul id="list"></ul></div>
</div>
<div class="card chat"><h2 style="font-size:16px">Ask NO QUIT AI</h2><div class="msgs" id="msgs"></div>
 <form id="cf"><input id="q" placeholder="Ask anything..." autocomplete="off"/><button class="btn">Send</button></form></div>
</div>
<script>
const $=id=>document.getElementById(id);let files=[],hist=[];
function play(f){$('v').src=f.url;$('t').textContent=f.name;$('sl').value=f.share;history.replaceState(null,'','?v='+encodeURIComponent(f.key));document.querySelectorAll('li').forEach(l=>l.classList.toggle('act',l.dataset.k===f.key))}
async function load(){const r=await fetch('/api/files');const d=await r.json();files=d.files||[];$('list').innerHTML='';
 files.forEach(f=>{const li=document.createElement('li');li.dataset.k=f.key;li.innerHTML='';li.append(f.name);const s=document.createElement('small');s.textContent=' · '+(f.size/1048576).toFixed(1)+' MB';li.append(s);li.onclick=()=>play(f);$('list').append(li)});
 const k=new URLSearchParams(location.search).get('v');if(k){const f=files.find(x=>x.key===k)||{key:k,name:k,url:'/video/'+encodeURIComponent(k),share:location.href};play(f)}}
function upload(file){const fd=new FormData();fd.append('file',file);const x=new XMLHttpRequest();x.open('POST','/api/upload');
 x.upload.onprogress=e=>{if(e.lengthComputable)$('pb').style.width=(e.loaded/e.total*100)+'%'};
 x.onload=()=>{try{const d=JSON.parse(x.responseText);if(x.status>=300)throw new Error(d.error);$('st').textContent='Uploaded!';load().then(()=>play(d))}catch(e){$('st').textContent='Error: '+e.message}};
 x.onerror=()=>$('st').textContent='Upload failed';$('st').textContent='Uploading...';x.send(fd)}
$('f').onchange=e=>e.target.files[0]&&upload(e.target.files[0]);
const dz=$('dz');dz.ondragover=e=>{e.preventDefault();dz.classList.add('on')};dz.ondragleave=()=>dz.classList.remove('on');
dz.ondrop=e=>{e.preventDefault();dz.classList.remove('on');e.dataTransfer.files[0]&&upload(e.dataTransfer.files[0])};
function copy(){if($('sl').value){navigator.clipboard.writeText($('sl').value);$('st').textContent='Link copied!'}}
function add(t,c){const d=document.createElement('div');d.className='m '+c;d.textContent=t;$('msgs').append(d);$('msgs').scrollTop=1e9}
$('cf').onsubmit=async e=>{e.preventDefault();const q=$('q').value.trim();if(!q)return;$('q').value='';add(q,'u');
 const r=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:q,history:hist})});
 const d=await r.json();const a=d.reply||d.error||'...';add(a,'a');hist.push({role:'user',content:q},{role:'assistant',content:a})};
load();
</script></body></html>`;
