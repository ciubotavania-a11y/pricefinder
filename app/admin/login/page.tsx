import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  async function login(formData: FormData) {
    "use server";
    const supabase = await createClient();
    const email = String(formData.get("email") || "");
    const password = String(formData.get("password") || "");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) console.error("Supabase login error:", error.message);
    if (error) redirect("/admin/login?error=1");
    redirect("/admin");
  }
  return <main className="container"><div className="panel" style={{maxWidth:460,margin:"70px auto"}}>
    <h1>Administrare PriceFinder</h1><p className="muted">Autentificare administrator</p>
    {error && <p className="notice">Autentificarea nu a reușit. Verifică datele.</p>}
    <form action={login} className="formgrid" style={{gridTemplateColumns:"1fr"}}>
      <label>Email<input name="email" type="email" required /></label>
      <label>Parolă<input name="password" type="password" required /></label>
      <button type="submit">Intră în cont</button>
    </form>
  </div></main>;
}
