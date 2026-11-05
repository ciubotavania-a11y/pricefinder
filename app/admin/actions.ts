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
