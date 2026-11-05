import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { addOffer, signOut, updateRetailerFeed } from "./actions";
import { importOffersFromFile } from "./import-actions";

type RetailerOption = { id: string; name: string };
type AdminOffer = {
  id: string; title: string; price: number; currency: string;
  condition: string; verified: boolean; active: boolean;
  retailers: { name: string } | null;
};

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ added?: string; imported?: string; retailerUpdated?: string }> }) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.email !== process.env.ADMIN_EMAIL) redirect("/admin/login");

  const [{ data: retailers }, { data: retailerFeeds }, { data: offers }] = await Promise.all([
    supabase.from("retailers").select("id,name").eq("enabled", true).order("name"),
    supabase.from("retailers").select("id,name,website,feed_url,feed_format,feed_authorized,feed_authorization_note,last_sync_at,last_sync_status,last_sync_message").order("name"),
    supabase.from("offers").select("id,title,price,currency,condition,verified,active,retailers(name)").order("created_at", { ascending: false }).limit(30),
  ]);
  const retailerOptions = (retailers ?? []) as RetailerOption[];
  const recentOffers = (offers ?? []) as unknown as AdminOffer[];
  const verifiedCount = recentOffers.filter((offer) => offer.verified).length;

  return <main className="admin-shell">
    <header className="admin-header">
      <div><Link href="/" className="brand"><span className="brand-mark">P</span><span>PriceFinder<span className="brand-domain">.md</span></span></Link><span className="admin-header-label">ADMIN</span></div>
      <div className="admin-header-actions"><Link href="/" className="admin-back">← Vezi site-ul</Link><form action={signOut}><button className="admin-logout" type="submit">Ieșire</button></form></div>
    </header>
    <div className="admin-content">
      <div className="admin-welcome"><div><span className="section-kicker">SPAȚIU DE LUCRU</span><h1>Panou de administrare</h1><p>Gestionează ofertele și produsele PriceFinder.md.</p></div><div className="admin-user"><span className="admin-avatar">A</span><span><strong>Administrator</strong><small>{user.email}</small></span></div></div>

      {params.added && <p className="notice">✓ Oferta a fost adăugată. Va apărea ca neverificată până la confirmarea prețului.</p>}
      {params.imported !== undefined && <p className="notice">✓ Import finalizat: {params.imported} produse importate cu succes. Produsele sunt marcate ca neverificate.</p>}\n      {params.retailerUpdated && <p className="notice">✓ Setările feed-ului au fost salvate.</p>}

      <section className="admin-stats">
        <article><span className="stat-label">Oferte recente</span><strong>{recentOffers.length}</strong><small>Produse în lista recentă</small></article>
        <article><span className="stat-label">Prețuri verificate</span><strong>{verifiedCount}</strong><small>Din ultimele 30 de oferte</small></article>
        <article><span className="stat-label">Surse active</span><strong>{retailerOptions.length}</strong><small>Magazine disponibile</small></article>
      </section>

      <div className="admin-columns">
        <section className="panel admin-panel">
          <div className="admin-panel-heading"><div><span className="section-kicker">CATALOG</span><h2>Adaugă o ofertă</h2></div><span className="admin-panel-icon">＋</span></div>
          <p className="muted admin-description">Completează informațiile produsului și linkul către comerciant.</p>
          <form action={addOffer} className="admin-form">
            <label>Numele produsului *<input name="title" required placeholder="Ex. iPhone 17 Pro Max 256 GB"/></label>
            <div className="admin-form-row"><label>Preț în MDL *<input name="price" type="number" min="0.01" step="0.01" required placeholder="0.00"/></label><label>Stare<select name="condition"><option value="new">Nou</option><option value="used">Second-hand</option></select></label></div>
            <div className="admin-form-row"><label>Categoria *<input name="category" required placeholder="telefoane"/></label><label>Magazin *<select name="retailer_id" required><option value="">Alege sursa</option>{retailerOptions.map((r)=><option key={r.id} value={r.id}>{r.name}</option>)}</select></label></div>
            <label>Link direct către produs *<input name="product_url" type="url" required placeholder="https://magazin.md/produs"/></label>
            <label>Descriere<textarea name="description" rows={3} placeholder="Detalii suplimentare despre produs..."/></label>
            <button type="submit" className="admin-submit">Adaugă oferta <span>→</span></button>
          </form>
        </section>

        <section className="panel admin-panel">
          <div className="admin-panel-heading"><div><span className="section-kicker">IMPORT ÎN MASĂ</span><h2>Importă din fișier</h2></div><span className="admin-panel-icon">⇧</span></div>
          <p className="muted admin-description">Încarcă un catalog în format CSV, XML sau JSON. Dimensiune maximă: 5 MB.</p>
          <form action={importOffersFromFile} className="admin-form">
            <label>Magazin / platformă<select name="retailer_id" required><option value="">Alege sursa</option>{retailerOptions.map((r)=><option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
            <label>Fișier cu produse<input name="file" type="file" accept=".csv,.xml,.json" required/></label>
            <div className="import-hint"><strong>Coloane recomandate pentru CSV</strong><code>title, price, product_url, image_url, description, category, condition</code></div>
            <button type="submit" className="admin-submit">Importă produsele <span>→</span></button>
          </form>
          <div className="admin-safety-note"><span>✓</span><p>Produsele importate sunt marcate automat ca <strong>neverificate</strong>. Confirmă prețul înainte de a le promova.</p></div>
        </section>
      </div>

      <section className="panel admin-panel admin-table-panel">
        <div className="admin-panel-heading"><div><span className="section-kicker">INTEGRĂRI AUTORIZATE</span><h2>Feed-uri comercianți</h2></div></div>
        <p className="muted admin-description">Configurează numai feed-uri oficiale pentru care există acord scris sau licență API. Sincronizarea rulează la fiecare 30 de minute.</p>
        {(retailerFeeds ?? []).map((retailer) => <form action={updateRetailerFeed} className="admin-form" key={retailer.id}>
          <input type="hidden" name="retailer_id" value={retailer.id}/><strong>{retailer.name}</strong>
          <label>URL feed oficial<input name="feed_url" type="url" defaultValue={retailer.feed_url ?? ""} placeholder="https://magazin.md/feed.xml"/></label>
          <label>Format<select name="feed_format" defaultValue={retailer.feed_format ?? "csv"}><option value="csv">CSV</option><option value="xml">XML</option><option value="json">JSON</option><option value="api">JSON API</option></select></label>
          <label>Referință acord / licență<input name="feed_authorization_note" defaultValue={retailer.feed_authorization_note ?? ""} placeholder="Contract sau permisiune scrisă"/></label>
          <label><input type="checkbox" name="feed_authorized" defaultChecked={Boolean(retailer.feed_authorized)}/> Confirm existența permisiunii scrise sau licenței aplicabile.</label>
          <button type="submit" className="admin-submit">Salvează setările →</button>
        </form>)}
      </section>
      <section className="panel admin-panel admin-table-panel">
        <div className="admin-panel-heading"><div><span className="section-kicker">ACTIVITATE</span><h2>Ultimele produse adăugate</h2></div><span className="result-count">{recentOffers.length} înregistrări</span></div>
        {recentOffers.length === 0 ? <p className="muted">Nu există produse adăugate încă.</p> : <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Produs</th><th>Comerciant</th><th>Preț</th><th>Stare</th><th>Verificare</th></tr></thead><tbody>{recentOffers.map((offer)=><tr key={offer.id}><td><strong>{offer.title}</strong></td><td>{offer.retailers?.name ?? "—"}</td><td>{Number(offer.price).toLocaleString("ro-MD")} {offer.currency}</td><td>{offer.condition === "new" ? "Nou" : "Second-hand"}</td><td><span className={offer.verified ? "admin-status verified" : "admin-status pending"}>{offer.verified ? "Verificat" : "Neverificat"}</span></td></tr>)}</tbody></table></div>}
      </section>
      <p className="admin-footnote">PriceFinder.md · Administrarea catalogului. Importurile automate ale comercianților necesită feed/API autorizat.</p>
    </div>
  </main>;
}
