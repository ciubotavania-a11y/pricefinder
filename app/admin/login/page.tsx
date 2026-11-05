import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  async function login(formData: FormData) {
    "use server";
    const supabase = await createClient();
    const email = String(formData.get("email") || "").trim();
    const password = String(formData.get("password") || "");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) redirect("/admin/login?error=1");
    redirect("/admin");
  }
  return <main className="login-shell">
    <Link href="/" className="brand login-brand"><span className="brand-mark">P</span><span>PriceFinder<span className="brand-domain">.md</span></span></Link>
    <section className="login-card">
      <span className="section-kicker">ZONĂ RESTRICȚIONATĂ</span>
      <h1>Bine ai revenit.</h1>
      <p className="muted">Autentifică-te pentru a administra catalogul PriceFinder.</p>
      {error && <p className="notice">Autentificarea nu a reușit. Verifică emailul și parola.</p>}
      <form action={login} className="login-form">
        <label>Email<input name="email" type="email" autoComplete="username" required placeholder="admin@exemplu.md"/></label>
        <label>Parolă<input name="password" type="password" autoComplete="current-password" required placeholder="Introdu parola"/></label>
        <button type="submit">Intră în cont <span>→</span></button>
      </form>
      <Link href="/" className="login-back">← Înapoi la pagina principală</Link>
    </section>
    <small className="login-foot">PriceFinder.md · Acces doar pentru administratorii autorizați</small>
  </main>;
}
