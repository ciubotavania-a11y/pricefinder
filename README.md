# PriceFinder.md — versiunea cu bază de date și administrare

Acesta este un starter funcțional pentru dezvoltarea PriceFinder.md. Include:
- catalog public cu căutare după nume, filtre categorie/stare și sortare după preț;
- oferte noi și second-hand;
- comerciant, link direct, preț, data verificării și eticheta „verificat/neverificat”;
- panou de administrare protejat prin autentificare Supabase;
- formular pentru adăugarea ofertelor;
- schemă PostgreSQL și surse inițiale.

## Important
Proiectul NU este încă publicat și NU are încă un cont/bază de date Supabase conectată. Nu conține prețuri reale importate automat. Magazinele inițiale sunt doar surse înregistrate în director. Pentru import automat este necesar un API, feed de produse sau acord/permisiune de la fiecare comerciant. Nu elimina eticheta de verificare fără confirmarea prețului.

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


## Sincronizare automată a feed-urilor (fundație tehnică)

Motorul de sincronizare este în `scripts/sync-feeds.mjs` și poate importa feed-uri autorizate CSV, XML sau JSON/API. Rulează secvențial, validează URL-urile și prețurile, actualizează oferta existentă pe cheia magazin + URL și nu marchează automat ofertele ca verificate.

### Activare

1. Rulează o singură dată `supabase/automatic-sync.sql` în Supabase SQL Editor, după schema principală și `admin-security.sql`.
2. În GitHub → repository Settings → Secrets and variables → Actions, creează:
   - `SUPABASE_URL`: Project URL (fără `/rest/v1/`).
   - `SUPABASE_SERVICE_ROLE_KEY`: cheia secretă server-side din Supabase. Nu o pune în `.env.local` public, în cod sau în browser și nu o trimite în conversație.
3. Pentru fiecare comerciant care a furnizat un feed/API și a permis importul, completează `feed_url` și `feed_format` în tabela `retailers`. Exemplu (înlocuiește numai cu un URL de feed real, autorizat):
   ```sql
   update public.retailers
   set feed_url = 'https://merchant.example/feed.xml',
       feed_format = 'xml',
       integration_type = 'xml'
   where name = 'Numele magazinului';
   ```
4. Dacă denumirile câmpurilor din feed diferă de cele standard, setează `field_mapping` cu căile corespunzătoare, de exemplu:
   ```sql
   update public.retailers
   set field_mapping = '{"title":"product.name","price":"pricing.current","product_url":"url"}'::jsonb
   where name = 'Numele magazinului';
   ```
5. Test manual din Codespaces: `npm run sync:feeds`, cu variabilele de mediu server-side disponibile. Nu afișa și nu copia cheia secretă în terminalul partajat.
6. GitHub Actions este configurat cu un program la fiecare 30 de minute. Programările GitHub Actions rulează automat numai din ramura implicită a repository-ului; pentru activare continuă, această modificare trebuie integrată în `main`. Până atunci se poate folosi workflow_dispatch pe ramura de lucru.

### Comportament și limite

- Magazinele fără `feed_url` sunt ignorate; nu se face scraping arbitrar al site-urilor.
- Feed-urile trebuie să fie oferite sau permise de comerciant și să aibă structură compatibilă ori mapare configurată.
- Ofertele importate rămân `verified = false`; sincronizarea nu certifică disponibilitatea sau corectitudinea comercială.
- Modificările de preț sunt păstrate în `price_history`; execuțiile sunt în `sync_runs`.
- Feed-urile care nu includ toate produsele nu dezactivează automat ofertele absente, pentru a evita ascunderea eronată a produselor.
- Cheia `SUPABASE_SERVICE_ROLE_KEY` este folosită doar în GitHub Actions secrets de către worker și nu trebuie expusă clientului.

## Următoarele etape
1. Finalizarea politicilor RLS și a rolurilor de admin.
2. Importator CSV/XML și jurnal de sincronizare.
3. Integrarea API-urilor comercianților care aprobă accesul.
4. Istoricul prețurilor și alerte.
5. Conturi utilizatori, favorite și dashboard comercianți.
6. Domeniu `pricefinder.md`, hosting și indexare Google.
