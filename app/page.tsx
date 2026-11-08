import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Offer } from "@/lib/types";

export const revalidate = 0;

const categoryIcons: Record<string, string> = {
  telefoane: "📱", calculatoare: "💻", televizoare: "📺", electrocasnice: "🏠",
  auto: "🚗", mobilier: "🛋️", moda: "👟", sport: "⚽", copii: "🧸", diverse: "✨",
};

export default async function Home({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q : "";
  const condition = typeof params.condition === "string" ? params.condition : "all";
  const category = typeof params.category === "string" ? params.category : "all";
  const sort = typeof params.sort === "string" ? params.sort : "price";
  const supabase = await createClient();

  let query = supabase.from("offers").select("id,title,description,category,condition,price,currency,product_url,image_url,specifications,retailer_id,last_checked_at,verified,sponsored,retailers(name)").eq("active", true);
  if (q) query = query.ilike("title", `%${q}%`);
  if (condition !== "all") query = query.eq("condition", condition);
  if (category !== "all") query = query.eq("category", category);
  query = sort === "newest" ? query.order("created_at", { ascending: false }) : query.order("price", { ascending: true });
  const { data, error } = await query.limit(100);
  const offers = (data ?? []) as unknown as (Offer & { retailers: { name: string } | null })[];
  const { data: categoriesData } = await supabase.from("categories").select("slug,name").order("name");
  const categories = categoriesData ?? [];

  // Grupăm ofertele cu denumiri identice pentru comparația între comercianți.
  const comparisonGroups = new Map<string, typeof offers>();
  for (const offer of offers) {
    const key = offer.title.toLocaleLowerCase("ro")
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, " ").trim();
    if (!key) continue;
    const group = comparisonGroups.get(key) ?? [];
    group.push(offer);
    comparisonGroups.set(key, group);
  }
  const comparableProducts = [...comparisonGroups.values()]
    .map((group) => [...new Map(group.map((offer) => [offer.retailer_id, offer])).values()]
      .sort((a, b) => Number(a.price) - Number(b.price)))
    .filter((group) => group.length > 1)
    .sort((a, b) => Number(a[0].price) - Number(b[0].price))
    .slice(0, 8);

  return <>
    <header className="site-header">
      <div className="container header-inner">
        <Link href="/" className="brand" aria-label="PriceFinder pagina principală"><span className="brand-mark">P</span><span>PriceFinder<span className="brand-domain">.md</span></span></Link>
        <nav className="header-nav"><a href="#categorii">Categorii</a><a href="#oferte">Oferte</a><Link href="/admin/login" className="admin-link">Administrare <span>↗</span></Link></nav>
      </div>
    </header>

    <main>
      <section className="hero-section">
        <div className="container hero-content">
          <div className="eyebrow"><span className="live-dot"/> COMPARĂ PREȚURI DIN MOLDOVA</div>
          <h1>Cumpără mai inteligent.<br/><span>Plătește prețul corect.</span></h1>
          <p className="hero-copy">Descoperă și compară ofertele magazinelor din Republica Moldova. Mai multă claritate înainte de fiecare cumpărătură.</p>
          <form className="searchbar" action="/" role="search">
            <span className="search-icon" aria-hidden="true">⌕</span>
            <input name="q" defaultValue={q} placeholder="Ce produs cauți astăzi?" aria-label="Caută produse"/>
            <button type="submit">Caută <span>→</span></button>
          </form>
          <div className="hero-footnote"><span>✓</span> Compari ofertele într-un singur loc <span className="footnote-separator">·</span> Prețuri afișate în MDL</div>
        </div>
        <div className="hero-decoration" aria-hidden="true"><div className="deco-circle circle-one"/><div className="deco-circle circle-two"/></div>
      </section>

      <section className="trust-strip"><div className="container trust-inner">
        <div><span className="trust-icon">⌕</span><span><strong>Caută rapid</strong><small>Produse din mai multe surse</small></span></div>
        <div><span className="trust-icon">⇅</span><span><strong>Compară prețuri</strong><small>Vezi ofertele una lângă alta</small></span></div>
        <div><span className="trust-icon">✓</span><span><strong>Verifică informația</strong><small>Ofertele verificate sunt marcate</small></span></div>
      </div></section>

      <div className="container main-content">
        <section id="categorii" className="category-section">
          <div className="section-heading"><div><span className="section-kicker">EXPLOREAZĂ</span><h2>Categorii populare</h2></div><span className="section-aside">Alege ce te interesează</span></div>
          <div className="category-list">
            <Link href="/?category=all" className={category === "all" ? "category-chip selected" : "category-chip"}><span>✦</span> Toate</Link>
            {categories.map(c=><Link key={c.slug} href={`/?category=${encodeURIComponent(c.slug)}`} className={category === c.slug ? "category-chip selected" : "category-chip"}><span>{categoryIcons[c.slug] ?? "◇"}</span>{c.name}</Link>)}
          </div>
        </section>

        {comparableProducts.length > 0 && <section className="comparison-section">
          <div className="section-heading"><div><span className="section-kicker">COMPARĂ INTELIGENT</span><h2>Același produs, prețuri diferite</h2></div><span className="result-count">{comparableProducts.length} comparații</span></div>
          <div className="comparison-grid">{comparableProducts.map((group) => <article className="comparison-card" key={group[0].title}>
            <h3>{group[0].title}</h3>
            <p className="comparison-subtitle">{group.length} comercianți comparați</p>
            <div className="comparison-rows">{group.map((offer, index) => <div className="comparison-row" key={offer.id}>
              <span className="comparison-rank">{index === 0 ? "Cel mai mic" : offer.retailers?.name ?? "Magazin"}</span>
              <strong>{Number(offer.price).toLocaleString("ro-MD")} {offer.currency}</strong>
              <a href={offer.product_url} target="_blank" rel="noopener noreferrer" aria-label={`Vezi oferta de la ${offer.retailers?.name ?? "comerciant"}`}>↗</a>
            </div>)}</div>
            <small>Prețurile trebuie confirmate pe site-ul comerciantului.</small>
          </article>)}</div>
        </section>}

        <section id="oferte" className="offers-section">
          <div className="section-heading offers-heading"><div><span className="section-kicker">DESCOPERĂ</span><h2>{q ? `Rezultate pentru „${q}”` : "Oferte disponibile"}</h2></div><span className="result-count">{offers.length} {offers.length === 1 ? "ofertă" : "oferte"}</span></div>
          <form className="filter-bar" action="/">
            {q && <input type="hidden" name="q" value={q}/>}
            <label><span>Categorie</span><select name="category" defaultValue={category}><option value="all">Toate categoriile</option>{categories.map(c=><option key={c.slug} value={c.slug}>{c.name}</option>)}</select></label>
            <label><span>Starea produsului</span><select name="condition" defaultValue={condition}><option value="all">Toate produsele</option><option value="new">Noi</option><option value="used">Second-hand</option></select></label>
            <label><span>Sortare</span><select name="sort" defaultValue={sort}><option value="price">Preț: mic la mare</option><option value="newest">Cele mai noi</option></select></label>
            <button type="submit" className="filter-button">Aplică filtre</button>
            {(q || category !== "all" || condition !== "all" || sort !== "price") && <Link href="/" className="reset-link">Resetează</Link>}
          </form>

          {error ? <div className="empty-state"><div className="empty-icon">!</div><h3>Catalogul nu este disponibil momentan</h3><p>Nu am putut încărca ofertele. Te rugăm să revii puțin mai târziu.</p></div> :
          offers.length === 0 ? <div className="empty-state"><div className="empty-icon">⌕</div><h3>Nu am găsit oferte</h3><p>Încearcă altă căutare sau modifică filtrele. Catalogul va afișa ofertele pe măsură ce sunt adăugate.</p><Link href="/" className="reset-button">Vezi toate ofertele</Link></div> :
          <div className="product-grid">{offers.map(o=><article className="product-card" key={o.id}>
            <a className="product-visual" href={o.product_url} target="_blank" rel="noopener noreferrer" aria-label={`Vezi ${o.title} la comerciant`}>
              {o.image_url ? <img src={o.image_url} alt={o.title} loading="lazy"/> : <span className="image-placeholder">◇</span>}
              {o.sponsored && <span className="sponsored-tag">PROMOVAT</span>}
            </a>
            <div className="product-info">
              <div className="product-tags"><span className={o.condition === "new" ? "tag tag-new" : "tag"}>{o.condition === "new" ? "NOU" : "SECOND-HAND"}</span>{o.verified ? <span className="tag tag-verified">✓ VERIFICAT</span> : <span className="tag tag-unverified">NEVERIFICAT</span>}</div>
              <h3><Link href={`/produs/${o.id}`}>{o.title}</Link></h3>
              {o.specifications && Object.keys(o.specifications).length > 0 && <ul className="product-specifications">{Object.entries(o.specifications).slice(0, 6).map(([key, value]) => <li key={key}><strong>{key}:</strong> {value}</li>)}</ul>}
              <div className="product-price">{Number(o.price).toLocaleString("ro-MD")} <small>{o.currency}</small></div>
              <div className="product-meta"><span>{o.retailers?.name ?? "Comerciant"}</span><span>{o.last_checked_at ? new Date(o.last_checked_at).toLocaleDateString("ro-MD") : "Data indisponibilă"}</span></div>
              <a className="offer-link" href={o.product_url} target="_blank" rel="noopener noreferrer">Vezi oferta <span>↗</span></a>
            </div>
          </article>)}</div>}
        </section>
      </div>
    </main>
    <footer className="site-footer"><div className="container footer-inner"><Link href="/" className="brand footer-brand"><span className="brand-mark">P</span><span>PriceFinder<span className="brand-domain">.md</span></span></Link><p>Compară informat. Cumpără inspirat.</p><small>Prețurile și disponibilitatea se confirmă pe site-ul comerciantului. Ofertele promovate sunt marcate.</small><span className="copyright">© {new Date().getFullYear()} PriceFinder.md</span></div></footer>
  </>;
}
