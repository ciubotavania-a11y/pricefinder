import { createClient } from "@supabase/supabase-js";
import { XMLParser } from "fast-xml-parser";

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Missing SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY.");
}
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const aliases = {
  title: ["title", "name", "product_name", "productname"],
  price: ["price", "sale_price", "current_price", "amount"],
  product_url: ["product_url", "url", "link", "product_link"],
  image_url: ["image_url", "image", "picture", "image_link"],
  description: ["description", "summary"],
  category: ["category", "category_name"],
  condition: ["condition", "state"],
  currency: ["currency", "currency_code"],
  external_id: ["id", "sku", "product_id", "offer_id"],
};

function getPath(value, path) {
  return String(path).split(".").reduce((current, key) => {
    if (current && typeof current === "object") return current[key];
    return undefined;
  }, value);
}
function getField(item, mapping, fieldName) {
  const configured = mapping?.[fieldName];
  const candidates = configured ? [configured] : aliases[fieldName];
  for (const candidate of candidates) {
    const value = configured ? getPath(item, candidate) : item?.[candidate] ??
      Object.entries(item ?? {}).find(([key]) => key.toLowerCase() === candidate)?.[1];
    if (typeof value === "string" || typeof value === "number") {
      const result = String(value).trim();
      if (result) return result;
    }
  }
  return "";
}
function getSpecifications(item, mapping) {
  const configured = mapping?.specifications;
  const raw = configured ? getPath(item, configured) :
    item?.specifications ?? item?.attributes ?? item?.characteristics ?? item?.features;
  if (!raw || typeof raw !== "object") return {};
  const entries = Array.isArray(raw)
    ? raw.map((entry) => [entry?.name ?? entry?.key ?? entry?.label, entry?.value])
    : Object.entries(raw);
  return Object.fromEntries(entries
    .filter(([key, value]) => typeof key === "string" && key.trim() && (typeof value === "string" || typeof value === "number" || typeof value === "boolean"))
    .slice(0, 20)
    .map(([key, value]) => [key.trim().slice(0, 80), String(value).trim().slice(0, 160)])
    .filter(([, value]) => value));
}
function parseCsv(input) {
  const rows = [];
  let row = [], cell = "", quoted = false;
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (c === '"' && quoted && input[i + 1] === '"') { cell += '"'; i++; }
    else if (c === '"') quoted = !quoted;
    else if (c === "," && !quoted) { row.push(cell.trim()); cell = ""; }
    else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && input[i + 1] === "\n") i++;
      row.push(cell.trim()); if (row.some(Boolean)) rows.push(row);
      row = []; cell = "";
    } else cell += c;
  }
  row.push(cell.trim()); if (row.some(Boolean)) rows.push(row);
  const headers = (rows.shift() || []).map(x => x.toLowerCase().replace(/^\uFEFF/, ""));
  return rows.map(values => Object.fromEntries(headers.map((h, i) => [h, values[i] ?? ""])));
}
function extractItems(data) {
  if (Array.isArray(data)) return data.filter(x => x && typeof x === "object" && !Array.isArray(x));
  if (!data || typeof data !== "object") return [];
  for (const key of ["products", "items", "offers", "product", "item", "offer"]) {
    if (data[key] !== undefined) {
      const found = extractItems(data[key]);
      if (found.length) return found;
    }
  }
  return [data];
}
function validateFeedUrl(raw) {
  let url;
  try { url = new URL(raw); } catch { throw new Error("Feed URL is invalid."); }
  if (url.protocol !== "https:") throw new Error("Only HTTPS feed URLs are allowed.");
  if (url.username || url.password) throw new Error("Feed URLs must not contain embedded credentials.");
  const host = url.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") ||
      /^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host) ||
      /^169\.254\./.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
      host === "::1" || host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe80:")) {
    throw new Error("Private or local feed hosts are not allowed.");
  }
  return url.toString();
}
async function fetchFeed(retailer) {
  const feedUrl = validateFeedUrl(retailer.feed_url);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);
  try {
    const response = await fetch(feedUrl, {
      signal: controller.signal,
      redirect: "error",
      headers: { "user-agent": "PriceFinderFeedBot/1.0 (+https://pricefinder.md)", accept: "application/json, application/xml, text/xml, text/csv" },
    });
    if (!response.ok) throw new Error(`Feed returned HTTP ${response.status}`);
    const body = await response.text();
    const format = retailer.feed_format || retailer.integration_type;
    if (format === "csv") return parseCsv(body);
    if (format === "xml") return extractItems(new XMLParser({ ignoreAttributes: false }).parse(body));
    if (format === "json" || format === "api") return extractItems(JSON.parse(body));
    throw new Error("Unsupported feed format. Set feed_format to csv, xml, json or api.");
  } finally { clearTimeout(timeout); }
}
async function syncRetailer(retailer) {
  const { data: run, error: runError } = await supabase.from("sync_runs")
    .insert({ retailer_id: retailer.id, status: "running" }).select("id").single();
  if (runError) throw runError;
  let imported = 0, updated = 0, skipped = 0;
  try {
    const items = await fetchFeed(retailer);
    if (!items.length) throw new Error("Feed returned no product records.");
    for (const item of items) {
      const mapping = retailer.field_mapping || {};
      const title = getField(item, mapping, "title");
      const rawPrice = getField(item, mapping, "price").replace(/\s/g, "").replace(",", ".");
      const price = Number(rawPrice);
      const productUrl = getField(item, mapping, "product_url");
      const conditionRaw = getField(item, mapping, "condition").toLowerCase();
      const condition = ["used", "second hand", "second-hand", "preowned"].includes(conditionRaw) ? "used" : "new";
      let url;
      try { url = new URL(productUrl); } catch { skipped++; continue; }
      if (!title || !Number.isFinite(price) || price <= 0 || url.protocol !== "https:") { skipped++; continue; }
      const row = {
        retailer_id: retailer.id, title, price,
        currency: getField(item, mapping, "currency") || "MDL",
        product_url: url.toString(),
        image_url: (() => {
          const raw = getField(item, mapping, "image_url");
          try {
            const image = new URL(raw);
            return image.protocol === "https:" ? image.toString() : null;
          } catch { return null; }
        })(),
        description: getField(item, mapping, "description").slice(0, 2000) || null,
        specifications: getSpecifications(item, mapping),
        category: getField(item, mapping, "category") || "diverse",
        condition, active: true, verified: false, sponsored: false,
        last_checked_at: new Date().toISOString(),
      };
      const { data: existing, error: lookupError } = await supabase.from("offers").select("id")
        .eq("retailer_id", retailer.id).eq("product_url", row.product_url).maybeSingle();
      if (lookupError) throw lookupError;
      const { error } = await supabase.from("offers").upsert(row, { onConflict: "retailer_id,product_url" });
      if (error) throw error;
      if (existing) updated++; else imported++;
    }
    const status = skipped ? "partial" : "success";
    await supabase.from("sync_runs").update({
      status, finished_at: new Date().toISOString(), imported_count: imported,
      updated_count: updated, skipped_count: skipped,
    }).eq("id", run.id);
    await supabase.from("retailers").update({
      last_sync_at: new Date().toISOString(), last_sync_status: status,
      last_sync_message: `Importate: ${imported}; actualizate: ${updated}; ignorate: ${skipped}`,
    }).eq("id", retailer.id);
    console.log(`[${retailer.name}] ${status}: +${imported}, ~${updated}, skipped ${skipped}`);
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await supabase.from("sync_runs").update({
      status: "failed", finished_at: new Date().toISOString(), error_message: message,
    }).eq("id", run.id);
    await supabase.from("retailers").update({
      last_sync_at: new Date().toISOString(), last_sync_status: "failed",
      last_sync_message: message.slice(0, 1000),
    }).eq("id", retailer.id);
    console.error(`[${retailer.name}] FAILED: ${message}`);
    return false;
  }
}

const { data: retailers, error } = await supabase.from("retailers")
  .select("id,name,feed_url,feed_format,integration_type,field_mapping")
  .eq("enabled", true)
  .eq("feed_authorized", true)
  .not("feed_url", "is", null)
  .order("name");
if (error) throw error;
if (!retailers?.length) {
  console.log("No explicitly authorized retailer feeds are enabled. No websites were scraped.");
  process.exit(0);
}
let failedRetailers = 0;
for (const retailer of retailers) {
  const succeeded = await syncRetailer(retailer);
  if (!succeeded) failedRetailers++;
}
if (failedRetailers > 0) {
  console.error(`Feed sync failed for ${failedRetailers} retailer(s).`);
  process.exitCode = 1;
}
