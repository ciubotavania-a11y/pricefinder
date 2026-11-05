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
6. Creează fișierul `.env.local` în rădăcina proiectului, după modelul `.env.example`:
   - `NEXT_PUBLIC_SUPABASE_URL=...`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY=...`
   - `ADMIN_EMAIL=emailul_tău`
7. În Supabase Authentication → Users, creează utilizatorul administrator cu acel email și o parolă puternică.
8. În terminal, în folderul proiectului, execută:
   ```bash
   npm install
   npm run dev
   ```
9. Deschide http://localhost:3000. Panoul este la `/admin/login`.

## Notă de securitate înainte de producție
- Nu publica niciodată `SUPABASE_SERVICE_ROLE_KEY` în browser sau în codul client.
- Politicile RLS trebuie verificate în proiectul Supabase înainte de activarea scrierilor în producție. Configurează o politică admin cu o metodă sigură, de exemplu o funcție SQL/rol dedicat sau un tabel de administratori; nu te baza doar pe ascunderea paginii.
- Setarea `ADMIN_EMAIL` din server protejează ruta UI, dar pentru producție trebuie aplicată și la nivel de bază de date. În schema de pornire, politica admin este intenționat un punct de configurare și trebuie adaptată la proiectul Supabase înainte de publicare.
- Adaugă validare URL, protecție anti-spam, limitare de cereri și jurnal de audit înainte de lansare.

## Importuri comercianți
Fiecare comerciant se activează separat:
- API: documentație și chei oferite de comerciant;
- XML/CSV/JSON: feed oficial și program de sincronizare;
- manual: introducere în panoul admin.
Nu extrage automat cataloage sau anunțuri fără drept/permisiune. Pentru 999.md și Makler.md trebuie verificate condițiile API și permisiunile de utilizare.

## Următoarele etape
1. Finalizarea politicilor RLS și a rolurilor de admin.
2. Importator CSV/XML și jurnal de sincronizare.
3. Integrarea API-urilor comercianților care aprobă accesul.
4. Istoricul prețurilor și alerte.
5. Conturi utilizatori, favorite și dashboard comercianți.
6. Domeniu `pricefinder.md`, hosting și indexare Google.
