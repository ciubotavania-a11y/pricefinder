import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Missing Supabase environment variables.");
const db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
const UA = "PriceFinderBot/1.0 (+https://pricefinder.md/bot)";
const MAX_PAGES = 40;
const TIMEOUT_MS = 12000;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function safeUrl(raw, base) {
  try {
    const u = new URL(raw, base);
    if (u.protocol !== "https:" || u.username || u.password) return null;
    return u;
  } catch { return null; }
}
async function getText(target, accept = "text/html,application/xml,text/xml") {
  const initialUrl = safeUrl(target);
  if (!initialUrl) return null;
  const expectedHost = initialUrl.hostname.toLowerCase();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    let currentUrl = initialUrl;
    for (let redirects = 0; redirects <= 5; redirects++) {
      const response = await fetch(currentUrl, { signal: controller.signal, redirect: "manual",
        headers: { "user-agent": UA, accept } });
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get("location");
        if (!location || redirects === 5) return null;
        const nextUrl = safeUrl(location, currentUrl);
        if (!nextUrl || nextUrl.hostname.toLowerCase() !== expectedHost) return null;
        currentUrl = nextUrl;
        continue;
      }
      if (!response.ok) return null;
      const finalUrl = new URL(response.url || currentUrl.toString());
      if (finalUrl.protocol !== "https:" || finalUrl.hostname.toLowerCase() !== expectedHost) return null;
      return { body: await response.text(), contentType: response.headers.get("content-type") || "", url: finalUrl };
    }
    return null;
  } finally { clearTimeout(timer); }
}
function parseRobots(text) {
  const lines = text.split(/\r?
/);
  let applies = false, disallow = [], delay = 2;
  for (const raw of lines) {
    const line = raw.split("#")[0].trim();
    const i = line.indexOf(":");
    if (i < 0) continue;
    const key = line.slice(0, i).trim().toLowerCase(), value = line.slice(i + 1).trim();
    if (key === "user-agent") applies = value === "*" || /pricefinderbot/i.test(value);
    else if (applies && key === "disallow" && value) disallow.push(value);
    else if (applies && key === "crawl-delay") delay = Math.min(10, Math.max(2, Number(value) || 2));
  }
  return { disallow, delay };
}
function allowed(path, rules) {
  return !rules.disallow.some(rule => rule === "/" || (rule && path.startsWith(rule)));
}
function extractProductNodes(html) {
  const found = [];
  const scripts = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi) || [];
  function visit(node) {
    if (!node) return;
    if (Array.isArray(node)) return node.forEach(visit);
    if (typeof node !== "object") return;
    const types = Array.isArray(node["@type"]) ? node["@type"] : [node["@type"]];
    if (types.some(t => String(t).toLowerCase() === "product")) found.push(node);
    if (node["@graph"]) visit(node["@graph"]);
    if (node.itemListElement) visit(node.itemListElement);
    if (node.mainEntity) visit(node.mainEntity);
  }
  for (const tag of scripts) {
    const raw = tag.replace(/^<script[^>]*>/i, "").replace(/<\/script>$/i, "");
    try { visit(JSON.parse(raw)); } catch { /* malformed structured data is ignored */ }
  }
  return found;
}
function priceFrom(product) {
  const offers = Array.isArray(product.offers) ? product.offers[0] : product.offers;
  const raw = offers?.price ?? offers?.priceSpecification?.price;
  const price = Number(String(raw ?? "").replace(/\s/g, "").replace(",", "."));
  if (!Number.isFinite(price) || price <= 0) return null;
  return { price, currency: String(offers?.priceCurrency || "MDL").toUpperCase() };
}
function textValue(value) {
  if (typeof value === "string" || typeof value === "number") return String(value).trim();
  if (value && typeof value === "object") return String(value.name || value.value || "").trim();
  return "";
}
function categoryFrom(product) {
  const raw = textValue(product.category).toLowerCase();
  const name = `${product.name || ""} ${raw}`.toLowerCase();
  if (/phone|iphone|samsung galaxy|smartphone|telefon/.test(name)) return "telefoane";
  if (/laptop|notebook|computer|desktop|pc|monitor|tablet/.test(name)) return "calculatoare";
  if (/tv|television|televizor|oled|qled/.test(name)) return "televizoare";
  if (/fridge|refrigerator|washing machine|vacuum|oven|microwave|frigider|masina de spalat/.test(name)) return "electrocasnice";
  if (/car|auto|anvelop|piese auto/.test(name)) return "auto";
  if (/sofa|chair|table|furniture|canapea|scaun|mobilier/.test(name)) return "mobilier";
  if (/shoe|sneaker|clothing|jacket|pant|shirt|incaltaminte|haine/.test(name)) return "moda";
  if (/sport|fitness|bicycle|bicicleta/.test(name)) return "sport";
  if (/toy|baby|child|jucarie|copil/.test(name)) return "copii";
  return "diverse";
}
function imageFrom(product, base) {
  const raw = Array.isArray(product.image) ? product.image[0] : product.image;
  const u = safeUrl(typeof raw === "string" ? raw : raw?.url, base);
  return u?.toString() || null;
}
async function sitemapUrls(site, robotsText) {
  const candidates = [...robotsText.matchAll(/^\s*Sitemap:\s*(\S+)/gim)].map(m => m[1]);
  if (!candidates.length) candidates.push(new URL("/sitemap.xml", site).toString());
  const urls = [];
  for (const candidate of candidates.slice(0, 3)) {
    const u = safeUrl(candidate, site);
    if (!u || u.hostname !== site.hostname) continue;
    const result = await getText(u);
    if (!result) continue;
    for (const match of result.body.matchAll(/<loc>\s*([^<]+)\s*<\/loc>/gi)) {
      const page = safeUrl(match[1].trim(), site);
      if (page && page.hostname === site.hostname) urls.push(page);
      if (urls.length >= MAX_PAGES) break;
    }
  }
  return [...new Map(urls.map(u => [u.toString(), u])).values()].slice(0, MAX_PAGES);
}
async function syncStore(store) {
  const site = safeUrl(store.website);
  if (!site) throw new Error("Website must be HTTPS.");
  const robotsResult = await getText(new URL("/robots.txt", site), "text/plain");
  if (!robotsResult) throw new Error("robots.txt unavailable; crawler skips this store.");
  const rules = parseRobots(robotsResult.body);
  const pages = await sitemapUrls(site, robotsResult.body);
  let imported = 0, updated = 0, skipped = 0, checked = 0;
  for (const page of pages) {
    if (page.hostname !== site.hostname || !allowed(page.pathname, rules)) { skipped++; continue; }
    await sleep(rules.delay * 1000);
    const result = await getText(page);
    if (!result || result.url.hostname !== site.hostname) { skipped++; continue; }
    checked++;
    for (const product of extractProductNodes(result.body)) {
      const title = typeof product.name === "string" ? product.name.trim() : "";
      const pricing = priceFrom(product);
      const productUrl = safeUrl(product.url || page.toString(), site);
      if (!title || !pricing || !productUrl || productUrl.hostname !== site.hostname) { skipped++; continue; }
      const row = {
        retailer_id: store.id, title: title.slice(0, 300), price: pricing.price,
        currency: pricing.currency, product_url: productUrl.toString(),
        image_url: imageFrom(product, page), description: String(product.description || "").slice(0, 2000) || null,
        category: categoryFrom(product), brand: textValue(product.brand), sku: textValue(product.sku || product.productID || product.mpn), gtin: textValue(product.gtin13 || product.gtin || product.gtin12 || product.gtin14 || product.isbn), condition: "new", active: true, verified: false, sponsored: false,
        last_checked_at: new Date().toISOString()
      };
      const { data: existing, error: lookupError } = await db.from("offers").select("id")
        .eq("retailer_id", store.id).eq("product_url", row.product_url).maybeSingle();
      if (lookupError) throw lookupError;
      const write = existing
        ? await db.from("offers").update(row).eq("id", existing.id)
        : await db.from("offers").insert(row);
      if (write.error) throw write.error;
      if (existing) updated++; else imported++;
    }
  }
  const status = skipped ? "partial" : "success";
  await db.from("retailers").update({ last_sync_at: new Date().toISOString(),
    last_sync_status: status, last_sync_message: `Pagini verificate: ${checked}; noi: ${imported}; actualizate: ${updated}; ignorate: ${skipped}` })
    .eq("id", store.id);
  console.log(`[${store.name}] ${status}: checked ${checked}, +${imported}, ~${updated}, skipped ${skipped}`);
}
const { data: stores, error } = await db.from("retailers")
  .select("id,name,website").eq("enabled", true).eq("public_crawl_enabled", true).order("name");
if (error) throw error;
if (!stores?.length) {
  console.log("No stores have public crawling enabled. Apply the migration and enable only stores whose terms permit automated access.");
  process.exit(0);
}
let failed = 0;
for (const store of stores) {
  try { await syncStore(store); }
  catch (error) {
    failed++;
    const message = error instanceof Error ? error.message : String(error);
    await db.from("retailers").update({ last_sync_at: new Date().toISOString(),
      last_sync_status: "failed", last_sync_message: message.slice(0, 1000) }).eq("id", store.id);
    console.error(`[${store.name}] ${message}`);
  }
}
if (failed) process.exitCode = 1;
