import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const revalidate = 0;

type PricePoint = { id: number; price: number; currency: string; recorded_at: string };

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: offer, error } = await supabase
    .from("offers")
    .select("id,title,description,category,condition,price,currency,product_url,image_url,specifications,verified,sponsored,last_checked_at,retailers(name,website)")
    .eq("id", id)
    .eq("active", true)
    .maybeSingle();

  if (error || !offer) notFound();

  const { data: historyData } = await supabase
    .from("price_history")
    .select("id,price,currency,recorded_at")
    .eq("offer_id", id)
    .order("recorded_at", { ascending: false })
    .limit(30);
  const history = (historyData ?? []) as PricePoint[];
  const prices = history.map((point) => Number(point.price)).filter(Number.isFinite);
  const lowest = prices.length ? Math.min(...prices) : Number(offer.price);
  const highest = prices.length ? Math.max(...prices) : Number(offer.price);
  const retailerData = offer.retailers as unknown as { name: string; website: string }[] | { name: string; website: string } | null;
  const retailer = Array.isArray(retailerData) ? retailerData[0] ?? null : retailerData;
  const specifications = offer.specifications as Record<string, string> | null;

  return (
    <main className="detail-shell">
      <div className="container">
        <Link href="/" className="detail-back">← Înapoi la oferte</Link>
        <article className="detail-card">
          <div className="detail-image">
            {offer.image_url ? <img src={offer.image_url} alt={offer.title} /> : <span>◇</span>}
          </div>
          <div className="detail-content">
            <div className="product-tags">
              <span className={offer.condition === "new" ? "tag tag-new" : "tag"}>{offer.condition === "new" ? "NOU" : "SECOND-HAND"}</span>
              {offer.verified ? <span className="tag tag-verified">✓ VERIFICAT</span> : <span className="tag tag-unverified">NEVERIFICAT</span>}
              {offer.sponsored && <span className="sponsored-tag">PROMOVAT</span>}
            </div>
            <span className="section-kicker">DETALII PRODUS</span>
            <h1>{offer.title}</h1>
            {offer.description && <p className="detail-description">{offer.description}</p>}
            <div className="detail-price">{Number(offer.price).toLocaleString("ro-MD")} <small>{offer.currency}</small></div>
            <p className="detail-retailer">Comerciant: <strong>{retailer?.name ?? "Magazin"}</strong></p>
            <a className="detail-buy" href={offer.product_url} target="_blank" rel="noopener noreferrer">Verifică oferta la comerciant ↗</a>
            <p className="detail-disclaimer">Prețul și disponibilitatea se pot modifica. Confirmă informația pe site-ul comerciantului.</p>
          </div>
        </article>

        {specifications && Object.keys(specifications).length > 0 && <section className="detail-section">
          <span className="section-kicker">CARACTERISTICI</span>
          <h2>Specificații</h2>
          <dl className="specification-list">
            {Object.entries(specifications).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}
          </dl>
        </section>}

        <section className="detail-section">
          <span className="section-kicker">EVOLUȚIE</span>
          <h2>Istoricul prețului</h2>
          <div className="history-summary">
            <div><small>Preț curent</small><strong>{Number(offer.price).toLocaleString("ro-MD")} {offer.currency}</strong></div>
            <div><small>Cel mai mic înregistrat</small><strong>{lowest.toLocaleString("ro-MD")} {offer.currency}</strong></div>
            <div><small>Cel mai mare înregistrat</small><strong>{highest.toLocaleString("ro-MD")} {offer.currency}</strong></div>
          </div>
          {history.length > 0 ? <div className="history-table-wrap"><table className="history-table">
            <thead><tr><th>Data înregistrării</th><th>Preț</th></tr></thead>
            <tbody>{history.map((point) => <tr key={point.id}><td>{new Date(point.recorded_at).toLocaleString("ro-MD")}</td><td>{Number(point.price).toLocaleString("ro-MD")} {point.currency}</td></tr>)}</tbody>
          </table></div> : <p className="history-empty">Nu există încă suficiente înregistrări pentru istoricul acestui produs. Prețurile vor apărea aici după adăugarea produsului și după modificările ulterioare de preț.</p>}
        </section>
      </div>
    </main>
  );
}
