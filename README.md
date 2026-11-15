# PriceFinder.md — versiunea cu bază de date și administrare

Acesta este un starter funcțional pentru dezvoltarea PriceFinder.md. Include:
- catalog public cu căutare după nume, filtre categorie/stare și sortare după preț;
- oferte noi și second-hand;
- comerciant, link direct, preț, data verificării și eticheta „verificat/neverificat”;
- panou de administrare protejat prin autentificare Supabase;
- formular pentru adăugarea ofertelor;
- schemă PostgreSQL și surse inițiale.

## Important
Proiectul nu este încă publicat. Proiectul Supabase a fost creat, iar conectarea efectivă a aplicației și a workerului depinde de configurarea variabilelor de mediu și a secretelor GitHub Actions. Nu presupune că există deja prețuri reale importate automat: magazinele inițiale sunt doar surse înregistrate în director. Pentru import automat este necesar un API, feed de produse sau acord/permisiune de la fiecare comerciant. Nu elimina eticheta de verificare fără confirmarea prețului.

## De ce ai nevoie
1. Un calculator Windows sau Mac (configurarea este mult mai simplă decât pe telefon).
2. Node.js LTS: https://nodejs.org/
3. Un proiect gratuit Supabase: https://supabase.com/
4. Ulterior, un serviciu de hosting precum Vercel: https://vercel.com/

## Configurare
1. Descarcă și dezarhivează proiectul.
2. Deschide folderul `PriceFinder-Platform` în Visual Studio Code.
3. Creează un proiect Supabase și deschide SQL Editor.
4. Copiază tot conținutul din `supabase/schema.sql` în SQL Editor și apasă Run.
5. În Supabase: Project Settings → API. Copiază Project URL și anon/public key.
6. Creează utilizatorul administrator în Supabase Authentication → Users, folosind emailul care va fi setat în `ADMIN_EMAIL`.
7. Deschide `supabase/admin-security.sql`, înlocuiește `ADMIN_EMAIL_HERE` cu emailul administratorului și rulează tot SQL-ul în Supabase → SQL Editor. Acesta înregistrează administratorul și configurează politicile RLS pentru scriere.
8. Creează fișierul `.env.local` în rădăcina proiectului, după modelul `.env.example`:
   - `NEXT_PUBLIC_SUPABASE_URL=...`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY=...`
   - `ADMIN_EMAIL=emailul_tău`
9. În terminal, în folderul proiectului, execută:
   ```bash
   npm install
   npm run dev
   ```
9. Deschide http://localhost:3000. Panoul este la `/admin/login`.

## Notă de securitate înainte de producție
- Nu publica niciodată `SUPABASE_SERVICE_ROLE_KEY` în browser sau în codul client.
- Rulează `supabase/admin-security.sql` după schema principală și după crearea utilizatorului Auth administrator. Fără acest pas, adăugarea/importul ofertelor poate fi refuzat de RLS.
- `ADMIN_EMAIL` protejează ruta UI, iar tabelul `admin_users` și funcția `is_pricefinder_admin()` protejează operațiile la nivelul bazei de date. Nu te baza doar pe ascunderea paginii.
- Adaugă validare URL, protecție anti-spam, limitare de cereri și jurnal de audit înainte de lansare.

## Importuri comercianți
Fiecare comerciant se activează separat:
- API: documentație și chei oferite de comerciant;
- XML/CSV/JSON: feed oficial și program de sincronizare;
- manual: introducere în panoul admin.
Nu extrage automat cataloage sau anunțuri fără drept/permisiune. Pentru 999.md și Makler.md trebuie verificate condițiile API și permisiunile de utilizare.


## Sincronizare automată și configurarea Supabase

PriceFinder are două căi separate de colectare:
- `scripts/sync-feeds.mjs`: importă feed-uri CSV, XML sau JSON/API furnizate sau autorizate de comerciant;
- `scripts/sync-public-catalog.mjs`: descoperă produse publice numai pentru magazine activate explicit, după verificarea condițiilor de acces și a regulilor `robots.txt`.

Ambele sunt programate în GitHub Actions la fiecare 30 de minute. O rulare reușită a workflow-ului nu înseamnă automat că s-au importat produse: dacă nu există surse activate, workerul se încheie fără colectare.

### Ordinea migrărilor SQL

În Supabase → SQL Editor, verifică dacă schema de bază există deja. Dacă baza este nouă, rulează fișierele în ordinea următoare, fiecare separat:

1. `supabase/schema.sql`
2. Creează utilizatorul administrator în Supabase Authentication → Users.
3. `supabase/admin-security.sql` — înlocuiește `ADMIN_EMAIL_HERE` cu adresa exactă a utilizatorului administrator înainte de rulare.
4. `supabase/legal-feed-authorization.sql`
5. `supabase/product-identifiers.sql`
6. `supabase/product-specifications.sql`
7. `supabase/automatic-sync.sql`
8. `supabase/public-catalog-discovery.sql`
9. `supabase/public-crawl-authorization-note.sql`
10. `supabase/public-price-history.sql` — opțional, pentru citirea publică a istoricului prețurilor ofertelor active.

Dacă schema de bază și unele migrări au fost deja aplicate, nu este necesar să le rulezi din nou decât dacă fișierul este idempotent și știi ce efect are; verifică mai întâi coloanele, tabelele și politicile existente. Nu rula `schema.sql` peste o bază de producție fără să verifici politicile și structura deja existente.

### Secrete GitHub Actions

În GitHub → repository → Settings → Secrets and variables → Actions, configurează:

- `SUPABASE_URL`: Project URL din Supabase.
- `SUPABASE_SERVICE_ROLE_KEY`: cheia service-role, păstrată exclusiv ca secret GitHub Actions.

Nu publica cheia service-role în cod, în browser, în fișierele `.env` comise în Git sau în conversații. Workerul o folosește numai în execuțiile server-side GitHub Actions.

### Activarea unui feed autorizat

Completează `feed_url`, `feed_format` și `field_mapping` pentru magazinul care a furnizat feed-ul ori a acordat permisiunea. Apoi setează `feed_authorized = true` numai după ce permisiunea a fost verificată și documentată.

Exemplu de configurare (înlocuiește URL-ul cu feed-ul real primit de la comerciant):

```sql
update public.retailers
set feed_url = 'https://merchant.example/feed.xml',
    feed_format = 'xml',
    integration_type = 'xml',
    feed_authorized = true,
    feed_authorization_note = 'Referință internă la acordul/permisiunea verificată'
where name = 'Numele magazinului';
```

Dacă structura feed-ului diferă de denumirile standard, configurează maparea:

```sql
update public.retailers
set field_mapping = '{"title":"product.name","price":"pricing.current","product_url":"url"}'::jsonb
where name = 'Numele magazinului';
```

### Activarea descoperirii paginilor publice

Nu activa `public_crawl_enabled` doar pentru că un site este accesibil public. Verifică mai întâi termenii comerciantului, `robots.txt` și orice restricții relevante. Înregistrează referința verificării în `public_crawl_authorization_note`, apoi activează numai magazinul permis:

```sql
update public.retailers
set public_crawl_enabled = true,
    public_crawl_authorization_note = 'Referință internă la verificarea termenilor și robots.txt'
where name = 'Numele magazinului';
```

Crawlerul folosește HTTPS, verifică `robots.txt`, limitează numărul de pagini și respectă un interval minim între cereri. Dacă `robots.txt` nu poate fi citit, magazinul este ignorat. Nu ocolește autentificări, paywall-uri, CAPTCHA sau alte controale de acces. Nota internă nu reprezintă ea însăși o permisiune.

### Testare și interpretarea rezultatelor

- Pornește manual workflow-ul din GitHub Actions pentru a testa sincronizarea după configurarea secretelor și a surselor.
- Verifică `retailers.last_sync_status`, `retailers.last_sync_message`, tabelul `sync_runs` și `price_history`.
- `No explicitly authorized retailer feeds are enabled` înseamnă că nu există feed activ autorizat.
- `No stores have public crawling enabled` înseamnă că nu există magazin activat pentru descoperire publică.
- Ofertele importate rămân `verified = false`; importul nu confirmă automat prețul sau disponibilitatea.
- Lipsa unui produs dintr-un feed nu dezactivează automat oferta existentă.

## Următoarele etape
1. Finalizarea politicilor RLS și a rolurilor de admin.
2. Importator CSV/XML și jurnal de sincronizare.
3. Integrarea API-urilor comercianților care aprobă accesul.
4. Istoricul prețurilor și alerte.
5. Conturi utilizatori, favorite și dashboard comercianți.
6. Domeniu `pricefinder.md`, hosting și indexare Google.
