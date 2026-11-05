# PriceFinder — reguli de colectare a datelor

PriceFinder importă automat date despre produse numai din feed-uri/API-uri configurate și aprobate explicit.

## Regula de activare
- `retailers.feed_authorized` trebuie să fie `true`.
- Înainte de activare trebuie păstrată o dovadă verificabilă: acord scris, contract sau termeni oficiali ai feed-ului/API-ului care permit utilizarea planificată.
- Un site public, un sitemap sau un fișier `robots.txt` nu constituie singur o licență pentru extragerea și reutilizarea catalogului.
- Nu se folosesc crawlere pentru cataloage fără autorizare.
- Nu se ocolesc autentificări, CAPTCHA, paywall-uri, rate limits sau alte măsuri tehnice.

## Date importate
Implicit se păstrează denumirea produsului, prețul, moneda, categoria și URL-ul produsului din feed-ul autorizat. Fotografiile și descrierile nu se copiază automat. Se activează numai dacă permisiunea feed-ului acoperă explicit aceste câmpuri.

## Operare
- Se respectă limitele de frecvență și condițiile tehnice stabilite de furnizor.
- Feed-urile trebuie să folosească HTTPS; redirecturile sunt refuzate.
- O autorizare retrasă înseamnă dezactivarea imediată a feed-ului și oprirea importurilor.
- Se păstrează sursa și momentul ultimei verificări a prețului; prețurile trebuie prezentate ca informații orientative și confirmate pe site-ul comerciantului.

## Limită
Aceste reguli și controale tehnice reduc riscurile, dar nu reprezintă o certificare juridică. Condițiile fiecărui contract, drepturile asupra bazelor de date și legislația aplicabilă trebuie verificate înainte de lansare comercială.
