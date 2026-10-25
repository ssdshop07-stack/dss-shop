#!/usr/bin/env node
/**
 * DSS Shop SEO build.
 * Generates static product/category pages and sitemap from active Supabase products.
 * Cloudflare Pages: Build command: node build-seo.mjs
 * Build output directory: .
 * Optional: SITE_URL=https://dss-shop.pages.dev
 */
import { readFile, writeFile, mkdir, rm, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";

const SITE = (process.env.SITE_URL || "https://dss-shop.pages.dev").replace(/\/+$/, "");
const WHATSAPP = "355684398803";
const TITLE = "DSS Shop | Kamera sigurie, DVR/NVR, alarme dhe rrjetëzim në Shqipëri";
const DESC = "DSS Shop — dyqan online për kamera sigurie, kamera IP dhe Wi‑Fi, DVR/NVR, alarme, rrjetëzim, kontroll aksesi dhe pajisje teknologjie me porosi online në Shqipëri.";

const esc = (s = "") => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const jsonForHtml = (v) => JSON.stringify(v).replace(/</g, "\\u003c");
const slugify = (s) => String(s || "").toLowerCase().replace(/ë/g, "e").replace(/ç/g, "c").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/&/g, " dhe ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 70).replace(/-+$/g, "");
const money = (n) => Number(n || 0).toFixed(2);
const priceOf = (p) => Number(p.sale_price || p.price || 0);
const bullets = (desc) => {
  const lines = String(desc || "").replace(/\r/g, "").split(/\n|•|●/).map(x => x.replace(/^[-–\s]+/, "").trim()).filter(Boolean);
  return { intro: lines[0] || "", items: lines.length > 1 ? lines.slice(1) : [] };
};

async function loadProducts() {
  const cfg = await readFile("config.js", "utf8").catch(() => "");
  const url = (cfg.match(/DSS_SUPABASE_URL\s*=\s*['"]([^'"]+)['"]/) || [])[1] || "";
  const key = (cfg.match(/DSS_SUPABASE_KEY\s*=\s*['"]([^'"]+)['"]/) || [])[1] || "";
  if (!url || !key) throw new Error("Nuk u gjetën DSS_SUPABASE_URL / DSS_SUPABASE_KEY në config.js.");
  const query = "select=id,sku,name,category,description,price,sale_price,image_url,stock,product_condition,updated_at&active=eq.true&order=id.asc";
  const response = await fetch(`${url}/rest/v1/products?${query}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` }
  });
  if (!response.ok) throw new Error(`Supabase ktheu HTTP ${response.status}. Build u ndal për të mos publikuar katalog të vjetër.`);
  const data = await response.json();
  if (!Array.isArray(data) || data.length === 0) throw new Error("Supabase nuk ktheu produkte aktive. Build u ndal për të mos publikuar sitemap bosh.");
  console.log(`✔ ${data.length} produkte aktive nga Supabase`);
  return data;
}

const CSS = `
:root{color-scheme:dark;--bg:#080808;--panel:#191919;--red:#e50914;--text:#f5f5f5;--muted:#aaa}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font-family:Arial,sans-serif;line-height:1.55}
a{color:#fff}header{background:#090909;border-bottom:1px solid #292929}
.wrap{width:min(1100px,94%);margin:auto}.nav{display:flex;align-items:center;justify-content:space-between;min-height:64px;gap:12px}
.brand img{height:40px;display:block;max-width:180px}.nav a.shop{background:var(--red);color:#fff;text-decoration:none;padding:9px 16px;border-radius:22px;font-size:14px}
.crumbs{font-size:13px;color:var(--muted);padding:16px 0}.crumbs a{color:var(--muted)}
.product{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:28px;padding-bottom:32px}
.pic{background:#fff;border-radius:12px;display:flex;align-items:center;justify-content:center;min-height:280px;overflow:hidden}.pic img{width:100%;max-height:460px;object-fit:contain}
h1{font-size:26px;margin:0 0 10px}.price{font-size:30px;font-weight:bold;margin:12px 0}.meta{color:var(--muted);font-size:14px}
.badge{display:inline-block;padding:3px 10px;border-radius:12px;font-size:12px;margin:0 6px 6px 0;background:#222;border:1px solid #444}.ok{color:#4ade80}.no{color:#f87171}
.btn{display:inline-block;margin:8px 8px 0 0;padding:13px 22px;border-radius:10px;background:var(--red);color:#fff;text-decoration:none;font-weight:bold}
.btn.wa{background:#25d366;color:#071b0e}.btn.ghost{background:transparent;border:1px solid #555}
ul.spec{padding-left:20px}h2{font-size:20px;margin:28px 0 10px}
.grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;padding:0;list-style:none}
.grid li{background:var(--panel);border:1px solid #303030;border-radius:12px;padding:10px;min-width:0}.grid a{text-decoration:none;display:block}
.grid .t{background:#fff;border-radius:8px;height:130px;display:flex;align-items:center;justify-content:center;overflow:hidden;margin-bottom:8px}.grid img{width:100%;height:100%;object-fit:contain}
.grid b{font-size:13px;display:block;line-height:1.35}.grid span{color:var(--muted);font-size:13px}
.seo-catalog{border-top:1px solid #303030;margin-top:24px;padding:12px 0 24px;color:var(--muted);font-size:13px}.seo-catalog a{color:var(--muted)}
footer{border-top:1px solid #292929;margin-top:40px;padding:22px 0;color:var(--muted);font-size:13px}
@media(max-width:800px){.product{grid-template-columns:1fr}.grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
`;

function head({ title, desc, path, image, extra = "" }) {
  return `<!doctype html>
<html lang="sq"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title><meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${SITE}${path}">
<meta name="robots" content="index,follow,max-image-preview:large"><meta name="theme-color" content="#080808">
<link rel="icon" href="/favicon.png"><meta property="og:site_name" content="DSS Shop">
<meta property="og:type" content="product"><meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}"><meta property="og:url" content="${SITE}${path}">
<meta property="og:image" content="${esc(image || SITE + "/icon-512.png")}">
<meta name="twitter:card" content="summary_large_image"><style>${CSS}</style>${extra}
</head><body>
<header><div class="wrap nav"><a class="brand" href="/"><img src="/logo-dss-shop.svg" alt="DSS Shop"></a><a class="shop" href="/#products">Hap dyqanin</a></div></header>`;
}
const foot = `<footer><div class="wrap">© DSS Shop — Security &amp; Technology · <a href="/">Kryesore</a> · <a href="https://wa.me/${WHATSAPP}" rel="noopener">WhatsApp +${WHATSAPP}</a></div></footer></body></html>`;

const card = (p) => `<li><a href="/p/${p._slug}.html"><div class="t">${p.image_url ? `<img src="${esc(p.image_url)}" alt="${esc(p.name)}" loading="lazy">` : ""}</div><b>${esc(p.name)}</b><span>€${money(priceOf(p))}</span></a></li>`;

function productPage(p, related) {
  const path = `/p/${p._slug}.html`;
  const price = priceOf(p);
  const inStock = p.stock === null || p.stock === undefined ? true : Number(p.stock) > 0;
  const condition = p.product_condition === "used" ? "used" : "new";
  const { intro, items } = bullets(p.description);
  const desc = (`${p.name} — ${p.category}. Çmimi €${money(price)}.` + (intro ? ` ${intro}` : "")).slice(0, 158);
  const ld = { "@context":"https://schema.org","@type":"Product",name:p.name,sku:p.sku || String(p.id),category:p.category,description:String(p.description || p.name).replace(/\s+/g," ").slice(0,500),...(p.image_url ? {image:[p.image_url]} : {}),brand:{"@type":"Brand",name:"DSS Shop"},offers:{"@type":"Offer",url:SITE+path,priceCurrency:"EUR",price:money(price),availability:inStock?"https://schema.org/InStock":"https://schema.org/OutOfStock",itemCondition:condition==="used"?"https://schema.org/UsedCondition":"https://schema.org/NewCondition",seller:{"@type":"Organization",name:"DSS Shop"}}};
  const crumbs = {"@context":"https://schema.org","@type":"BreadcrumbList",itemListElement:[{"@type":"ListItem",position:1,name:"Kryesore",item:SITE+"/"},{"@type":"ListItem",position:2,name:p.category,item:SITE+`/k/${p._cslug}.html`},{"@type":"ListItem",position:3,name:p.name,item:SITE+path}]};
  const extra = `<script type="application/ld+json">${jsonForHtml(ld)}</script><script type="application/ld+json">${jsonForHtml(crumbs)}</script>`;
  const waText = encodeURIComponent(`Përshëndetje, dua të porosis: ${p.name} (${p.sku || p.id}) — €${money(price)}`);
  return head({title:`${p.name} | DSS Shop`,desc,path,image:p.image_url,extra})+`
<main class="wrap"><div class="crumbs"><a href="/">Kryesore</a> › <a href="/k/${p._cslug}.html">${esc(p.category)}</a> › ${esc(p.name)}</div>
<div class="product"><div class="pic">${p.image_url ? `<img src="${esc(p.image_url)}" alt="${esc(p.name)}">` : ""}</div><div>
<h1>${esc(p.name)}</h1><div class="meta"><span class="badge">${esc(p.category)}</span><span class="badge">${condition==="used"?"I përdorur":"I ri"}</span>${p.sku?`<span class="badge">SKU: ${esc(p.sku)}</span>`:""}</div>
<div class="price">€${money(price)}</div><div class="${inStock?"ok":"no"}">${inStock?"● Në stok":"● Jo në stok"}</div>
<p><a class="btn wa" href="https://wa.me/${WHATSAPP}?text=${waText}" rel="noopener">Porosit në WhatsApp</a> <a class="btn ghost" href="/#products">Shiko dyqanin</a></p>
${intro?`<h2>Përshkrimi</h2><p>${esc(intro)}</p>`:""}${items.length?`<h2>Karakteristika</h2><ul class="spec">${items.map(i=>`<li>${esc(i)}</li>`).join("")}</ul>`:""}
</div></div>${related.length?`<h2>Produkte të ngjashme</h2><ul class="grid">${related.map(card).join("")}</ul>`:""}</main>${foot}`;
}

function categoryPage(cat, list) {
  const path = `/k/${list[0]._cslug}.html`;
  const ld = {"@context":"https://schema.org","@type":"CollectionPage",name:cat,url:SITE+path,mainEntity:{"@type":"ItemList",itemListElement:list.map((p,i)=>({"@type":"ListItem",position:i+1,url:SITE+`/p/${p._slug}.html`,name:p.name}))}};
  return head({title:`${cat} — çmime dhe oferta | DSS Shop`,desc:`${cat} në DSS Shop: ${list.length} produkte me porosi online në Shqipëri. Shiko çmimet dhe porosit me WhatsApp.`,path,image:list.find(p=>p.image_url)?.image_url,extra:`<script type="application/ld+json">${jsonForHtml(ld)}</script>`})+`
<main class="wrap"><div class="crumbs"><a href="/">Kryesore</a> › ${esc(cat)}</div><h1>${esc(cat)}</h1><ul class="grid">${list.map(card).join("")}</ul></main>${foot}`;
}

function setMeta(html, attribute, value, tagName = "meta") {
  const attr = attribute.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`<${tagName}\\b(?=[^>]*\\b${attr}=["'])[^>]*>`, "gi");
  const tag = tagName === "link" ? `<link rel="${attribute}" href="${esc(value)}">` : `<meta ${attribute}="${esc(value)}">`;
  if (re.test(html)) {
    let first = true;
    html = html.replace(re, () => { if (first) { first = false; return tag; } return ""; });
  } else html = html.replace(/<\/head>/i, `  ${tag}\n</head>`);
  return html;
}

function patchIndex(html, products, cats) {
  html = html.replace(/<!-- SEO-LINKS-START -->[\s\S]*?<!-- SEO-LINKS-END -->\s*/g, "");
  html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${esc(TITLE)}</title>`);
  html = html.replace(/<meta\s+name=["']description["'][^>]*>/i, `<meta name="description" content="${esc(DESC)}">`);
  // Keep existing JSON-LD on the storefront; avoid inserting duplicate Organization/WebSite schema.
  const links = `<!-- SEO-LINKS-START --><section id="seo-catalog" class="wrap" aria-label="Katalogu i produkteve" style="padding:18px 0 100px;font-size:13px;color:#aaa"><h2>Katalogu i produkteve</h2>${[...cats.entries()].map(([c,list])=>`<p><b><a href="/k/${list[0]._cslug}.html">${esc(c)}</a></b>: ${list.map(p=>`<a href="/p/${p._slug}.html">${esc(p.name)}</a>`).join(" · ")}</p>`).join("\n")} </section><!-- SEO-LINKS-END -->`;
  const endMain = html.toLowerCase().lastIndexOf("</main>");
  if (endMain >= 0) html = html.slice(0,endMain) + links + html.slice(endMain);
  else html = html.replace(/<\/body>/i, links + "\n</body>");
  return html;
}

const raw = await loadProducts();
const used = new Set();
const products = raw.map(p => {
  let slug = `${slugify(p.name) || "produkt"}-${p.id}`.toLowerCase();
  while (used.has(slug)) slug += "x";
  used.add(slug);
  return {...p,_slug:slug,_cslug:slugify(p.category)||"produkte"};
});
const cats = new Map();
for (const p of products) {
  if (!cats.has(p.category)) cats.set(p.category, []);
  cats.get(p.category).push(p);
}
// Ensure distinct category slugs even if category names normalize to the same slug.
const categorySlugs = new Set();
for (const [cat,list] of cats) {
  let base = slugify(cat) || "produkte";
  if (categorySlugs.has(base)) base = `${base}-${list[0].id}`;
  categorySlugs.add(base);
  for (const p of list) p._cslug = base;
}

for (const dir of ["p","k"]) {
  if (existsSync(dir)) await rm(dir,{recursive:true,force:true});
  await mkdir(dir,{recursive:true});
}
for (const p of products) {
  const related = (cats.get(p.category)||[]).filter(x=>x.id!==p.id).slice(0,4);
  await writeFile(`p/${p._slug}.html`,productPage(p,related));
}
for (const [cat,list] of cats) await writeFile(`k/${list[0]._cslug}.html`,categoryPage(cat,list));

const today = new Date().toISOString().slice(0,10);
const xml = (s) => String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
const urlEntry = (loc,lastmod,freq,priority) => `  <url><loc>${xml(loc)}</loc><lastmod>${String(lastmod||today).slice(0,10)}</lastmod><changefreq>${freq}</changefreq><priority>${priority}</priority></url>`;
const entries = [urlEntry(SITE+"/",today,"daily","1.0"),...[...cats.values()].map(list=>urlEntry(`${SITE}/k/${list[0]._cslug}.html`,today,"weekly","0.8")),...products.map(p=>urlEntry(`${SITE}/p/${p._slug}.html`,p.updated_at||today,"weekly","0.7"))];
await writeFile("sitemap.xml",`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join("\n")}\n</urlset>\n`);
await writeFile("robots.txt",`User-agent: *\nAllow: /\nDisallow: /admin.html\nDisallow: /admin.js\nDisallow: /account.html\n\nSitemap: ${SITE}/sitemap.xml\n`);
if (existsSync("index.html")) await writeFile("index.html",patchIndex(await readFile("index.html","utf8"),products,cats));
console.log(`✔ U gjeneruan ${products.length} faqe produktesh, ${cats.size} kategori dhe sitemap me ${entries.length} URL.`);
console.log(`  Domain: ${SITE}`);
