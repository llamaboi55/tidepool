# Store listings

Everything needed to list Tidepool on the two free stores: **Firefox Add-ons (AMO)** and **Microsoft Edge Add-ons**. Both developer accounts are free. Listing there means one-click installs and automatic updates, with no developer mode and no warnings.

Images are in [`docs/store/`](docs/store/). Packages come from `npm run build` (or the latest [release](https://github.com/llamaboi55/tidepool/releases/latest)): `dist/tidepool-firefox-<version>.zip` for AMO and `dist/tidepool-chromium-<version>.zip` for Edge.

## Listing text (both stores)

**Name:** Tidepool: calm new tab

**Summary** (AMO allows 250 characters, Edge's short description allows 132):
> A calm, glass new tab with original wallpapers, weather, search, favorites, tasks, notes and a focus timer. Free, open source, no ads, no account.

**Description:**
> Tidepool replaces your new tab with a quiet dashboard over original landscape art.
>
> • 8 original wallpapers drawn at any resolution, or your own photo, with blur and dim
> • Clock, date and weather (Open-Meteo, no key, you pick the city)
> • Search with DuckDuckGo, Google, Bing, Brave, Startpage, Ecosia, Kagi or your own engine, plus shortcuts like !yt and !gh
> • Favorites dock and unlimited link groups you can drag to reorder
> • Tasks, an autosaving notes pad, and a 25/5 focus timer with a soft chime
> • Calm mode hides everything but the clock
> • Light and dark glass picked from the wallpaper, and it's keyboard friendly (press ? for shortcuts)
>
> Free and open source under the MIT license. No ads, no account, no tracking, no paywall. Your settings stay in your browser.
>
> Source: https://github.com/llamaboi55/tidepool

**Category:** AMO uses "Tabs" (a second choice can be "Appearance"). Edge uses "Productivity".
**Tags (AMO):** new tab, dashboard, productivity, wallpaper, focus
**Homepage and support:** https://github.com/llamaboi55/tidepool (support goes to the repo's Issues page)
**License:** MIT

## Images

| File | Size | Used for |
|---|---|---|
| `docs/store/01-dashboard.png` … `06-search-shortcuts.png` | 1280 × 800 | Screenshots on both stores (Edge accepts 1280 × 800 or 640 × 400, up to 10. AMO accepts any size and shows them at 1.6:1) |
| `docs/store/logo-300.png` | 300 × 300 | Edge store logo (1:1, 128 px minimum, 300 px recommended). AMO uses the 128 px icon from the package |
| `docs/store/promo-440x280.png` | 440 × 280 | Edge small promotional tile (optional) |

Screenshot captions, in order:
1. Your morning at a glance: clock, weather, favorites, tasks and notes
2. Eight original landscapes, including Night Lake
3. Settings: wallpaper, glass, theme, accent and more
4. Edit mode: drag cards, add links and groups
5. Calm mode: just the time
6. Search shortcuts like !yt, !gh and !w

## Privacy and permissions

Both stores ask these questions. The answers are the same for both.

- **Does it collect or transmit personal data?** No. Tidepool has no server, analytics or account. The manifest already declares `data_collection_permissions: none` for Firefox.
- **Where is data stored?** In the browser's own extension storage (`storage.local`, or `storage.sync` if the user turns on sync, which stays inside their browser account).
- **Network requests:** only to Open-Meteo (`api.open-meteo.com`, and `geocoding-api.open-meteo.com` to look up the city name the user types), and only after the user picks a city. Searches go straight to the search engine the user picked, the same as typing in the address bar.
- **`storage` permission:** saves settings, links, tasks and notes.
- **`favicon` permission** (Chromium only): shows site icons from the browser's own icon cache, so no third-party icon service is contacted.
- **New tab override:** this is the extension's single purpose. Chrome and Edge ask the user to confirm it the first time, which is expected.
- **Remote code:** none. All code ships in the package, and the content security policy is `script-src 'self'`.
- **Privacy policy URL** (Edge asks for one when an extension touches user data): `https://github.com/llamaboi55/tidepool#privacy` points to the README's privacy section, which says the same as above.

## Submitting (needs Jimmy's free accounts)

**Firefox Add-ons:** sign in at https://addons.mozilla.org/developers/ with a free Mozilla account, choose "Submit a New Add-on", then "On this site", and upload the Firefox zip. No source upload is needed because the code isn't minified or bundled. Paste the text above, and add the screenshots once the listing exists. Reviews usually take a few days.
- *Optional:* the release workflow already signs an unlisted `.xpi` when the `AMO_JWT_ISSUER` and `AMO_JWT_SECRET` repo secrets are set (the API keys are on the same developer hub, also free). After the first listed version is approved, the workflow can be switched to `--channel listed` so each release updates the store listing by itself.

**Edge Add-ons:** register free at https://partner.microsoft.com/dashboard/microsoftedge/ as an individual, choose "Create new extension", and upload the Chromium zip. Then fill in Availability (public, all markets), Properties (category, privacy policy URL, website) and Store listings (the text and images above). Certification takes up to about a week.

Chrome Web Store is skipped on purpose because it charges a registration fee. Chrome, Brave, Opera and Vivaldi users keep installing from the GitHub release zip.
