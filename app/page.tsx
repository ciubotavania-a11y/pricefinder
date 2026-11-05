import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Offer } from "@/lib/types";

export const revalidate = 0;

export default async function Home({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q : "";
  const condition = typeof params.condition === "string" ? params.condition : "all";
  const category = typeof params.category === "string" ? params.category : "all";
  const sort = typeof params.sort === "string" ? params.sort : "price";
  const supabase = await createClient();

  let query = supabase.from("offers").select("id,title,description,category,condition,price,currency,product_url,image_url,retailer_id,last_checked_at,verified,sponsored,retailers(name)").eq("active", true);
  if (q) query = query.ilike("title", `%${q}%`);
  if (condition !== "all") query = query.eq("condition", condition);
  if (category !== "all") query = query.eq("category", category);
  query = sort === "newest" ? query.order("created_at", { ascending: false }) : query.order("price", { ascending: true });
  const { data } = await query.limit(100);
  const offers = (data ?? []) as unknown as (Offer & { retailers: { name: string } | null })[];
  const { data: categoriesData } = await supabase.from("categories").select("slug,name").order("name");
  const categories = categoriesData ?? [];

  return <>
    <header className="topbar"><div className="container" style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><Link href="/" className="brand">PriceFinder<span>.md</span></Link><Link href="/admin/login" className="small" style={{color:"white"}}>Administrare</Link></div></header>
    <main className="container">
      <section className="hero">
        <div className="pill good">COMPARĂ PREȚURI ÎN MOLDOVA</div>
        <h1>Găsește prețul potrivit.<br/>Compară înainte să cumperi.</h1>
        <p className="muted">Oferte de la magazine și platforme din Republica Moldova, într-un singur loc.</p>
        <form className="searchbar" action="/">
          <input name="q" defaultValue={q} placeholder="Caută iPhone, laptop, televizor..." />
          <button type="submit">Caută produse</button>
        </form>
      </section>
      <form className="filters" action="/">
        <input name="q" value={q} readOnly hidden />
        <select name="category" defaultValue={category}><option value="all">Toate categoriile</option>{categories.map(c=><option key={c.slug} value={c.slug}>{c.name}</option>)}</select>
        <select name="condition" defaultValue={condition}><option value="all">Noi și second-hand</option><option value="new">Doar noi</option><option value="used">Second-hand</option></select>
        <select name="sort" defaultValue={sort}><option value="price">Preț: mic la mare</option><option value="newest">Adăugate recent</option></select>
        <button type="submit">Aplică filtre</button>
      </form>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
        <h2 style={{fontSize:22,margin:0}}>Oferte disponibile</h2><span className="small">{offers.length} rezultate afișate</span>
      </div>
      {offers.length === 0 ? <div className="panel"><h2>Nu am găsit oferte</h2><p className="muted">În acest moment catalogul nu conține oferte publicate pentru căutarea ta. Revino mai târziu sau schimbă filtrele.</p></div> :
      <section className="grid">{offers.map(o=><article className="card" key={o.id}>
        <div className="product-image">{o.image_url ? <img src={o.image_url} alt={o.title} style={{width:"100%",height:"155px",objectFit:"contain"}}/> : "▧"}</div>
        <div className="card-body">
          <div><span className="pill">{o.condition === "new" ? "NOU" : "SECOND-HAND"}</span>{o.verified ? <span className="pill good">PREȚ VERIFICAT</span> : <span className="pill warn">NEVERIFICAT</span>}{o.sponsored && <span className="pill warn">SPONSORIZAT</span>}</div>
          <h3 style={{fontSize:16,minHeight:40}}>{o.title}</h3>
          <div className="price">{Number(o.price).toLocaleString("ro-MD")} {o.currency}</div>
          <div className="small">{o.retailers?.name ?? "Comerciant"}</div>
          <div className="card-footer"><span className="small">{o.last_checked_at ? `Verificat: ${new Date(o.last_checked_at).toLocaleDateString("ro-MD")}` : "Data verificării indisponibilă"}</span><a className="button" href={o.product_url} target="_blank" rel="noopener noreferrer">Vezi oferta ↗</a></div>
        </div>
      </article>)}</section>}
    </main>
    <footer><div className="container">PriceFinder.md — platformă de comparare a ofertelor. Prețurile și disponibilitatea se confirmă pe site-ul comerciantului. Ofertele sponsorizate sunt marcate.</div></footer>
  </>;
}
