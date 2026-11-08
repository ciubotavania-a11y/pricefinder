"use server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.email !== process.env.ADMIN_EMAIL) redirect("/admin/login");
  return supabase;
}

export async function addOffer(formData: FormData) {
  const supabase = await requireAdmin();
  const row = {
    title: String(formData.get("title") || "").trim(),
    category: String(formData.get("category") || "diverse"),
    condition: String(formData.get("condition") || "new"),
    price: Number(formData.get("price")),
    currency: "MDL",
    product_url: String(formData.get("product_url") || "").trim(),
    retailer_id: String(formData.get("retailer_id") || ""),
    description: String(formData.get("description") || ""),
    verified: false,
    sponsored: false,
    active: true
  };
  if (!row.title || !Number.isFinite(row.price) || row.price <= 0 || !row.product_url || !row.retailer_id) throw new Error("Completează câmpurile obligatorii.");
  const { error } = await supabase.from("offers").insert(row);
  if (error) throw new Error(error.message);
  revalidatePath("/");
  revalidatePath("/admin");
  redirect("/admin?added=1");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}


export async function updateRetailerFeed(formData: FormData) {
  const supabase = await requireAdmin();
  const retailerId = String(formData.get("retailer_id") || "").trim();
  const feedUrlInput = String(formData.get("feed_url") || "").trim();
  const feedFormat = String(formData.get("feed_format") || "").trim();
  const authorizationNote = String(formData.get("feed_authorization_note") || "").trim();
  const feedAuthorized = formData.get("feed_authorized") === "on";

  if (!retailerId) throw new Error("Magazinul selectat nu este valid.");
  if (feedUrlInput && !["csv", "xml", "json", "api"].includes(feedFormat)) {
    throw new Error("Alege formatul feed-ului.");
  }
  if (feedAuthorized && !authorizationNote) {
    throw new Error("Adaugă referința acordului sau licenței înainte de activare.");
  }

  const { data: retailer, error: retailerError } = await supabase
    .from("retailers")
    .select("id,website")
    .eq("id", retailerId)
    .maybeSingle();
  if (retailerError || !retailer) throw new Error("Magazinul nu a fost găsit.");

  let feedUrl: string | null = null;
  if (feedUrlInput) {
    let parsed: URL;
    let official: URL;
    try {
      parsed = new URL(feedUrlInput);
      official = new URL(retailer.website);
    } catch {
      throw new Error("Adresa feed-ului sau site-ul comerciantului nu este valid.");
    }
    const host = parsed.hostname.toLowerCase();
    const officialHost = official.hostname.toLowerCase();
    if (
      parsed.protocol !== "https:" ||
      parsed.username ||
      parsed.password ||
      !(host === officialHost || host.endsWith("." + officialHost))
    ) {
      throw new Error("Feed-ul trebuie să folosească HTTPS și domeniul oficial al comerciantului (sau un subdomeniu al acestuia).");
    }
    feedUrl = parsed.toString();
  }

  const { error } = await supabase.from("retailers").update({
    feed_url: feedUrl,
    feed_format: feedUrl ? feedFormat : null,
    integration_type: feedUrl ? feedFormat : "manual",
    feed_authorized: Boolean(feedUrl && feedAuthorized),
    feed_authorization_note: authorizationNote || null,
    feed_authorized_at: feedUrl && feedAuthorized ? new Date().toISOString() : null,
  }).eq("id", retailerId);
  if (error) throw new Error(error.message);

  revalidatePath("/");
  revalidatePath("/admin");
  redirect("/admin?retailerUpdated=1");
}


export async function updatePublicCrawl(formData: FormData) {
  const supabase = await requireAdmin();
  const retailerId = String(formData.get("retailer_id") || "").trim();
  const enabled = formData.get("public_crawl_enabled") === "on";
  const authorizationNote = String(formData.get("public_crawl_authorization_note") || "").trim();

  if (!retailerId) throw new Error("Magazinul selectat nu este valid.");
  if (enabled && !authorizationNote) {
    throw new Error("Adaugă mai întâi referința care confirmă că scanarea publică este permisă.");
  }

  const { error } = await supabase.from("retailers").update({
    public_crawl_enabled: enabled,
    public_crawl_authorization_note: authorizationNote || null,
  }).eq("id", retailerId);
  if (error) throw new Error(error.message);

  revalidatePath("/admin");
  redirect("/admin?retailerUpdated=1");
}
