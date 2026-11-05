import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { addOffer, signOut } from "./actions";
import { importOffersFromFile } from "./import-actions";

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ added?: string }> }) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.email !== process.env.ADMIN_EMAIL) redirect("/admin/login");
  const { data: retailers } = await supabase.from("retailers").select("id,name").eq("enabled", true).order("name");
  const { data: offers } = await supabase.from("offers").select("id,title,price,currency,condition,verified,active,retailers(name)").order("created_at",{ascending:false}).limit(30);
  return <main className="container">
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:28}}><div><h1>Panou de administrare</h1><p className="muted">Autentificat: {user.email}</p></div><form action={signOut}><button type="submit">Ieșire</button></form></div>
    {params.added && <p className="notice">Oferta a fost adăugată. Este marcată ca neverificată până la confirmarea prețului.</p>}
    
<section className="panel">
  <h2>Importă produse din fișier</h2>
  <p className="muted">Formate acceptate: CSV, XML și JSON. Maximum 5 MB.</p>
  <form action={importOffersFromFile}>
    <label>Magazin / platformă
      <select name="retailer_id" required>
        <option value="">Alege sursa</option>
        {(retailers ?? []).map((r: any) => (
          <option key={r.id} value={r.id}>{r.name}</option>
        ))}
      </select>
    </label>
    <label>Fișier cu produse
      <input name="file" type="file" accept=".csv,.xml,.json" required />
    </label>
    <button type="submit">Importă produsele</button>
  </form>
</section>

<section className="panel"><h2>Adaugă ofertă</h2>
      <form action={addOffer} className="formgrid">
        <label>Numele produsului *<input name="title" required placeholder="iPhone 17 Pro Max 256 GB"/></label>
        <label>Preț în MDL *<input name="price" type="number" min="0.01" step="0.01" required/></label>
        <label>Categoria *<input name="category" required placeholder="telefoane"/></label>
        <label>Starea<select name="condition"><option value="new">Nou</option><option value="used">Second-hand</option></select></label>
        <label>Magazin / platformă *<select name="retailer_id" required><option value="">Alege sursa</option>{(retailers??[]).map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
        <label>Link direct către produs *<input name="product_url" type="url" required placeholder="https://..."/></label>
        <label style={{gridColumn:"1/-1"}}>Descriere<textarea name="description" rows={2}/></label>
        <div><button type="submit">Adaugă oferta</button></div>
      </form>
    </section>
    <section className="panel"><h2>Ultimele oferte</h2>
      <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:14}}><thead><tr><th align="left">Produs</th><th align="left">Preț</th><th align="left">Sursă</th><th align="left">Stare</th><th align="left">Verificare</th></tr></thead>
      <tbody>{(offers??[]).map((o:any)=><tr key={o.id} style={{borderTop:"1px solid #e5e9ef"}}><td style={{padding:"10px 4px"}}>{o.title}</td><td>{o.price} {o.currency}</td><td>{o.retailers?.name}</td><td>{o.condition}</td><td>{o.verified?"Verificat":"Neverificat"}</td></tr>)}</tbody></table></div>
    </section>
    <p className="small">Această versiune oferă administrare manuală. Importurile automate se activează separat pentru fiecare comerciant, după obținerea unui API/feed sau acord.</p>
  </main>;
}
