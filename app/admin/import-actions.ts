"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { XMLParser } from "fast-xml-parser";

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || user.email !== process.env.ADMIN_EMAIL) {
    redirect("/admin/login");
  }

  return supabase;
}

function parseCSV(text: string): Record<string, unknown>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (char === '"' && quoted && text[i + 1] === '"') {
      cell += '"';
      i++;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(cell.trim());
      cell = "";
    } else if ((char === "
" || char === "\r") && !quoted) {
      if (char === "\r" && text[i + 1] === "
") i++;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);

  const headers = (rows.shift() || []).map((h) =>
    h.trim().toLowerCase().replace(/^\uFEFF/, "")
  );

  return rows.map((values) =>
    Object.fromEntries(headers.map((header, i) => [header, values[i] ?? ""]))
  );
}

function extractProducts(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) {
    return data.filter(
      (item): item is Record<string, unknown> =>
        typeof item === "object" && item !== null && !Array.isArray(item)
    );
  }
  if (!data || typeof data !== "object") return [];

  const record = data as Record<string, unknown>;
  for (const key of ["products", "product", "items", "item", "offers", "offer"]) {
    if (record[key] !== undefined) {
      const result = extractProducts(record[key]);
      if (result.length) return result;
    }
  }

  return [record];
}

function field(item: Record<string, unknown>, names: string[]) {
  const key = Object.keys(item).find((k) =>
    names.includes(k.toLowerCase().trim())
  );
  const value = key ? item[key] : "";
  return typeof value === "string" || typeof value === "number"
    ? String(value).trim()
    : "";
}

export async function importOffersFromFile(formData: FormData) {
  const supabase = await requireAdmin();
  const file = formData.get("file");
  const retailerId = String(formData.get("retailer_id") || "");

  if (!(file instanceof File) || !file.size || !retailerId) {
    throw new Error("Alege un fișier și un magazin.");
  }

  if (file.size > 5 * 1024 * 1024) {
    throw new Error("Fișierul nu poate depăși 5 MB.");
  }

  const filename = file.name.toLowerCase();
  const content = await file.text();
  let products: Record<string, unknown>[] = [];

  if (filename.endsWith(".csv")) {
    products = parseCSV(content);
  } else if (filename.endsWith(".json")) {
    products = extractProducts(JSON.parse(content));
  } else if (filename.endsWith(".xml")) {
    const parser = new XMLParser({ ignoreAttributes: false });
    products = extractProducts(parser.parse(content));
  } else {
    throw new Error("Format acceptat: CSV, XML sau JSON.");
  }

  if (!products.length) {
    throw new Error("Fișierul nu conține produse.");
  }

  const { data: retailer } = await supabase
    .from("retailers")
    .select("id")
    .eq("id", retailerId)
    .eq("enabled", true)
    .maybeSingle();

  if (!retailer) throw new Error("Magazinul selectat nu este valid.");

  let imported = 0;

  for (const product of products) {
    const title = field(product, ["title", "name", "product_name"]);
    const price = Number(
      field(product, ["price", "sale_price", "current_price"]).replace(",", ".")
    );
    const productUrl = field(product, ["product_url", "url", "link"]);
    const imageUrl = field(product, ["image_url", "image", "picture"]);
    const description = field(product, ["description"]);
    const brand = field(product, ["brand", "manufacturer"]);
    const sku = field(product, ["sku", "id", "product_id", "mpn"]);
    const gtin = field(product, ["gtin", "gtin13", "ean", "barcode", "upc"]);
    const category = field(product, ["category"]) || "diverse";
    const condition = field(product, ["condition"]) || "new";

    if (
      !title ||
      !Number.isFinite(price) ||
      price <= 0 ||
      !productUrl ||
      !["new", "used"].includes(condition)
    ) {
      continue;
    }

    let validUrl: URL;
    try {
      validUrl = new URL(productUrl);
      if (!["http:", "https:"].includes(validUrl.protocol)) continue;
    } catch {
      continue;
    }

    const row = {
      retailer_id: retailerId,
      title,
      price,
      currency: "MDL",
      product_url: validUrl.toString(),
      image_url: imageUrl || null,
      description: description || null,
      category,
      condition,
      verified: false,
      sponsored: false,
      active: true,
      last_checked_at: new Date().toISOString(),
    };

    const { data: existing } = await supabase
      .from("offers")
      .select("id")
      .eq("retailer_id", retailerId)
      .eq("product_url", row.product_url)
      .maybeSingle();

    const result = existing
      ? await supabase.from("offers").update(row).eq("id", existing.id)
      : await supabase.from("offers").insert(row);

    if (!result.error) imported++;
  }

  revalidatePath("/");
  revalidatePath("/admin");
  redirect(`/admin?imported=${imported}`);
}
