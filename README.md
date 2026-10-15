# 2handholdem.com

Official business site for **2 Hand Hold’em™** (2 HH, LLC). Static HTML/CSS/JS, no build step. Deploys as-is to GitHub Pages (`CNAME` is set to `2handholdem.com`).

## Run locally

```bash
python3 -m http.server 8080
```

## Files

| File | Role |
|------|------|
| `index.html` | Single-page site: hero, how to play + split demo, side bets, iPhone app, venues, for casinos, about/IP, contact |
| `style.css` | Brand styles: felt green, logo red, brand gold `#d4af37` (same as the iOS app) |
| `main.js` | Mobile nav, scroll reveal, interactive split demo (same dealer rule as the app: best hand using ≤2 of 3 dealer hole cards) |
| `app/privacy/`, `app/terms/`, `app/support/`, `app/terms.pdf` | iOS app legal and support pages, copied word for word from d22soso.com/app/ (same paths, so old URLs redirect 1:1) |
| `app-ads.txt` | AdMob seller declaration (must live at the root of the developer website domain) |
| `assets/img/` | Logo (from d22soso), side-bet mascots (from play2hh), app icon + screenshots (from the iOS project) |

## Sources of truth

- Game facts, patents: `~/d22soso/inventor-author.md`, `wayne-chiang-truth-document.md`
- Venues: the "2hh Locations" Google My Map (embedded on the page; edit the map and the embed updates). Keep the venue cards in `index.html` in sync with it.
- App legal text: `~/Projects/2HandHoldEm/docs/` and d22soso.com/app/
- App copy: `~/Projects/2HandHoldEm/docs/APP_STORE_METADATA.md` (App Store ID `6758915394`)
- Do not publish house edge, licensing rates, or side-bet paytables.
