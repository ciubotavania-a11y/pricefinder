import { createClient } from "@supabase/supabase-js";
import { XMLParser } from "fast-xml-parser";

const BASE = "https://darwin.md";
const USER_AGENT = "PriceFinderBot/1.0 (+https://pricefinder.md; contact: marketing@pricefinder.md)";
const DELAY_MS = 2500;
const MAX_PRODUCT_PAGES = 5000;
const AUTHORIZED = process.env.DARWIN_CRAWL_AUTHORIZED === "true";

if (!AUTHORIZED) {
  console.log("Darwin crawler is installed but disabled. Set DARWIN_CRAWL_AUTHORIZED=true only after Darwin authorizes automated catalog access.");
  process.exit(0);
}

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) throw new Error("Missing Supabase server credentials.");

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const xml = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
function asArray(value) { return value == null ? [] : Array.isArray(value) ? value : [value]; }
function absoluteUrl(value, base = BASE) {
  try {
    const url = new URL(value, base);
    if (url.protocol !== "https:" || url.hostname !== "darwin.md") return null;
    url.hash = "";
    return url.toString();
  } catch { return null; }
}
async function getText(url) {
  const response = await fetch(url, {
    headers: { "user-agent": USER_AGENT, accept: "text/html,application/xml,text/xml,*/*" },
    signal: AbortSignal.timeout(20000),
    redirect: "follow",
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  const finalUrl = new URL(response.url);
  if (finalUrl.hostname !== "darwin.md") throw new Error("Redirect outside darwin.md refused.");
  return { body: await response.text(), type: response.headers.get("content-type") || "" };
}
function robotsRules(text) {
  const groups = [];
  let current = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.split("#")[0].trim();
    if (!line) continue;
    const colon = line.indexOf(":");
    if (colon < 0) continue;
    const key = line.slice(0, colon).trim().toLowerCase();
    const value = line.slice(colon + 1).trim();
    if (key === "user-agent") {
      if (!current || current.hasRules) { current = { agents: [], rules: [], hasRules: false }; groups.push(current); }
      current.agents.push(value.toLowerCase());
    } else if ((key === "allow" || key === "disallow") && current) {
      current.rules.push({ allow: key === "allow", path: value });
      current.hasRules = true;
    }
  }
  const matching = groups.filter(g => g.agents.includes("pricefinderbot"));
  const selected = matching.length ? matching : groups.filter(g => g.agents.includes("*"));
  return selected.flatMap(g => g.rules).filter(r => r.path);
}
function allowedByRobots(url, rules) {
  const path = new URL(url).pathname + new URL(url).search;
  const matches = rules.filter(r => {
    const pattern = r.path.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\$$/, "$");
    try { return new RegExp("^" + pattern).test(path); } catch { return false; }
  }).sort((a, b) => b.path.length - a.path.length);
  return !matches.length || matches[0].allow;
}
async function discoverSitemaps(robotsText) {
  const listed = [...robotsText.matchAll(/^\s*sitemap:\s*(\S+)/gim)].map(m => m[1]);
  return [...new Set([ ...listed, `${BASE}/sitemap.xml` ].map(u => absoluteUrl(u)).filter(Boolean))];
}
async function sitemapUrls(sitemapUrl, seen = new Set()) {
  if (seen.has(sitemapUrl) || seen.size > 30) return [];
  seen.add(sitemapUrl);
  await sleep(DELAY_MS);
  const { body } = await getText(sitemapUrl);
  const parsed = xml.parse(body);
  const index = asArray(parsed?.sitemapindex?.sitemap);
  if (index.length) {
    const nested = index.map(entry => absoluteUrl(entry.loc)).filter(Boolean);
    const results = [];
    for (const child of nested) results.push(...await sitemapUrls(child, seen));
    return results;
  }
  return asArray(parsed?.urlset?.url).map(entry => absoluteUrl(entry.loc)).filter(Boolean);
}
function walkJson(value, found = []) {
  for (const item of asArray(value)) {
    if (!item || typeof item !== "object") continue;
    const type = asArray(item["@type"]).map(x => String(x).toLowerCase());
    if (type.some(x => x === "product" || x.endsWith("/product"))) found.push(item);
    for (const [key, child] of Object.entries(item)) if (key !== "@context") walkJson(child, found);
  }
  return found;
}
function firstText(...values) {
  for (const value of values) {
    if (typeof value === "string" || typeof value === "number") {
      const result = String(value).trim();
      if (result) return result;
    }
  }
  return "";
}
function productFromHtml(html, pageUrl) {
  const scripts = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  for (const match of scripts) {
    try {
      const json = JSON.parse(match[1].trim());
      const products = walkJson(json);
      if (products.length) {
        const p = products[0];
        const offer = asArray(p.offers)[0] || {};
        const price = Number(String(firstText(offer.price, offer.lowPrice, p.price)).replace(/[^\d.,]/g, "").replace(",", "."));
        const title = firstText(p.name, p.headline);
        const rawImage = firstText(asArray(p.image)[0], p.image?.url);
        const image = rawImage ? absoluteUrl(rawImage, pageUrl) : null;
        const url = absoluteUrl(firstText(p.url, pageUrl), pageUrl) || pageUrl;
        if (title && Number.isFinite(price) && price > 0) {
          return {
            title, price, currency: firstText(offer.priceCurrency, p.priceCurrency, "MDL"),
            product_url: url, image_url: image,
            description: firstText(p.description) || null,
            category: firstText(p.category) || "diverse",
            condition: "new", active: true, verified: false, sponsored: false,
            last_checked_at: new Date().toISOString(),
          };
        }
      }
    } catch { /* Ignore malformed structured data and continue. */ }
  }
  return null;
}

const robotsUrl = `${BASE}/robots.txt`;
const { body: robotsText } = await getText(robotsUrl);
const rules = robotsRules(robotsText);
const sitemapList = await discoverSitemaps(robotsText);
if (!sitemapList.length) throw new Error("No sitemap declared or standard sitemap available; stopping safely.");

const allUrls = new Set();
for (const sitemap of sitemapList) {
  try {
    for (const url of await sitemapUrls(sitemap)) allUrls.add(url);
  } catch (error) {
    console.warn(`Sitemap skipped: ${sitemap}: ${error.message}`);
  }
}
const productUrls = [...allUrls]
  .filter(url => allowedByRobots(url, rules))
  .filter(url => !/[?&](?:sort|filter|page|search)=/i.test(url))
  .slice(0, MAX_PRODUCT_PAGES);

const { data: retailer, error: retailerError } = await supabase
  .from("retailers").select("id,name").eq("name", "Darwin").single();
if (retailerError) throw retailerError;

const { data: run, error: runError } = await supabase
  .from("sync_runs").insert({ retailer_id: retailer.id, status: "running" }).select("id").single();
if (runError) throw runError;

let imported = 0, updated = 0, skipped = 0, checked = 0;
try {
  for (const url of productUrls) {
    checked++;
    try {
      await sleep(DELAY_MS);
      const { body, type } = await getText(url);
      if (!type.includes("text/html") && !/<html[\s>]/i.test(body.slice(0, 1000))) { skipped++; continue; }
      const product = productFromHtml(body, url);
      if (!product) { skipped++; continue; }
      const { data: existing, error: lookupError } = await supabase.from("offers")
        .select("id").eq("retailer_id", retailer.id).eq("product_url", product.product_url).maybeSingle();
      if (lookupError) throw lookupError;
      const { error: upsertError } = await supabase.from("offers")
        .upsert({ ...product, retailer_id: retailer.id }, { onConflict: "retailer_id,product_url" });
      if (upsertError) throw upsertError;
      if (existing) updated++; else imported++;
    } catch (error) {
      skipped++;
      console.warn(`Page skipped ${url}: ${error.message}`);
      if (/HTTP 403|HTTP 429|HTTP 503/i.test(error.message)) {
        console.warn("Access restriction or rate limit detected; stopping the crawl.");
        break;
      }
    }
  }
  const status = skipped ? "partial" : "success";
  await supabase.from("sync_runs").update({
    status, finished_at: new Date().toISOString(),
    imported_count: imported, updated_count: updated, skipped_count: skipped,
    error_message: `Pagini verificate: ${checked}; URL-uri sitemap permise: ${productUrls.length}`,
  }).eq("id", run.id);
  await supabase.from("retailers").update({
    last_sync_at: new Date().toISOString(), last_sync_status: status,
    last_sync_message: `Pagini: ${checked}; noi: ${imported}; actualizate: ${updated}; ignorate: ${skipped}`,
  }).eq("id", retailer.id);
  console.log(`[Darwin] ${status}: pages ${checked}, +${imported}, ~${updated}, skipped ${skipped}`);
} catch (error) {
  await supabase.from("sync_runs").update({
    status: "failed", finished_at: new Date().toISOString(), error_message: String(error).slice(0, 2000),
  }).eq("id", run.id);
  throw error;
}
