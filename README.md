# RECUP STATION // GOD TERMINAL  (v2 · Ascension Model)

```
index.html            HUB: start here
intake-ig.html        PHASE 1 · "Recup Station: The Diagnostic" (IG link in bio)
intake-ipad.html      PHASE 2 · Roadside iPad (staff mode)
intake-ipad.html?src=qr   QR stand: same check-in on the runner's own phone
terminal.html         GOD TERMINAL dashboard
member.html           Runner's Ascension card (5-cup ladder)
repair-manual.html    The Runner's Repair Manual (the free PDF, as a link)
Runners-Repair-Manual.pdf  Same manual as a PDF file
playbook.html         Partner training guide (INTERNAL: booth script, protocols, jugs)
poster.html           Poster A (menu, A3) + Poster B (QR stand)
assets/recup-core.js  ALL SETTINGS: prices, ladder, regions, questions, links
supabase/recup_station.sql  Shared database (Supabase): one table + security rules
story.html            Story builder: layouts + own photo → Instagram Story
assets/brand.css      Warm RECUP.STN colours for every page runners see
assets/squat-demo.svg Animated Patterson Squat demo (The Diagnostic, step 1)
```

## The flow
1. **Phase 1:** IG hook video → The Diagnostic → Grade + member code + **reserved Protocol**.
2. **Phase 2:** at the booth, the partner asks "Did you do the online diagnostic?"
   - **YES** → iPad finds their code → pour the reserved Protocol → POUR CUP 1
   - **NO** → iPad check-in (name, region, frequency, what hurts, PDF delivery) → POUR CUP 1
   - **I'M BACK** → find them → POUR CUP N → iPad asks that rung's question
3. **Ascension:** every cup moves them up the ladder. The runner sees it on `member.html`.

## Same questions on both forms
Core (both): name · contact (optional) · region · running frequency · what hurts most.
The Diagnostic also asks: squat test · runner personality · current fuel (→ Grade).

## Phone number is optional
The Diagnostic asks for WhatsApp or Instagram DM. At the booth iPad, runners can also pick **"Just show me the QR"**.
Everyone gets a member code (RS-XXXX), which is what tracks their cups.

## Getting the PDF to runners
Nothing is sent automatically on WhatsApp; that needs the paid WhatsApp Business API.
- **WhatsApp:** the partner taps SEND PDF ON WHATSAPP. The message with the manual link is pre-written; press send.
- **Instagram:** the partner taps DM LINK in the terminal (copies the manual link) and sends it as a DM.
- **QR only (iPad):** they scan the QR on the iPad and the manual opens on their phone.
- **Free automation:** set `BUSINESS_WA`, and put the manual link in your WhatsApp Business **Greeting message**.
  Runners who tap "Get it on WhatsApp" then get the link back automatically.

## To go live
1. Supabase → SQL Editor → run `supabase/recup_station.sql` (safe to re-run).
2. Supabase → Authentication → Users → **Add user** with your email + password, tick **Auto Confirm**.
   The email must be in `recup_staff` (joeytqw@gmail.com already is).
3. Log in once on the God Terminal and once on the booth iPad (staff mode). Both stay logged in.
4. In `assets/recup-core.js` set `BUSINESS_WA`, `DISCOUNT_CODE` and any TBC prices.
5. Push to GitHub: the site at `SITE_URL` updates in about a minute.

## Who can see what
- Public pages (anon key) can only **add** a runner and open **one** member card by its exact code (first name, cups, grade; never contact details).
- Only staff emails in `recup_staff`, logged in, can list, search and update runners.

## Preview without installing anything
Double-click `index.html`. For the terminal, click LOAD DEMO DATA, then CLEAR LOCAL when you're done.
