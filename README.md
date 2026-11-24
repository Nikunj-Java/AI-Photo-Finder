# Find My Photos – selfie → your photos from Google Drive

## Files
| File | Purpose |
|---|---|
| `index.html` | Public page. Visitor uploads a selfie, sees matching photos, downloads them. |
| `admin.html` | Private tool for you. Reads the Drive folder, detects faces, produces `index.json`. |
| `qr.html` | QR code maker + printable poster (PNG / SVG download). |
| `go.html` | The page the QR points to; redirects to `index.html` (change `TARGET` inside to redirect elsewhere without reprinting). |
| `qrcode.js` | Offline QR generator used by `qr.html` (no internet needed). |
| `serve.py` | Local test server reachable from your phone over Wi-Fi. |
| `common.js`  | Shared settings (`CONFIG`: title, threshold) and face-matching code. |
| `index.json` | **You generate this** with `admin.html`. Put it next to `index.html`. |

## One-time setup
1. **Share the Drive folder**: Share → General access → *Anyone with the link* → Viewer.
2. **Get a Google API key** (free): console.cloud.google.com → new project → *APIs & Services → Library* → enable **Google Drive API** → *Credentials → Create API key*. (Optional: restrict it to the Drive API.)
3. **Run locally** (needs http, not double-click): in VS Code use *Live Server*, or `npx serve` in this folder, then open `http://localhost:xxxx/admin.html`.
4. Paste the folder link + API key → **Start indexing**. Keep the tab open (≈0.5–1 s per photo). You can Stop, download the partial `index.json`, and continue later by loading it back in.
5. Click **Download index.json**, put it in this folder.
6. **Deploy**: drag the folder to Netlify (or push to GitHub). Share the site URL with guests.
   - Tip: delete or password-protect `admin.html` after indexing (Netlify → Site settings → Access control), or just don't upload it.

## Adding more photos later
Open `admin.html`, load your existing `index.json` under “Continue from an existing index”, Start — only new photos are processed. Re-upload the new `index.json`.

## Tuning
- `CONFIG.threshold` in `common.js` (0.45 strict · 0.5 balanced · 0.6 loose). Guests can also switch Strict/Balanced/Loose on the page.
- Analysis size in admin: larger = finds small faces in big group photos, but slower.

## Notes
- Selfie is processed **in the visitor's browser**; it is never uploaded.
- `index.json` contains face descriptors (numeric biometric data) for everyone in your photos and is publicly fetchable on a public site. Tell attendees photos are searchable by face, and consider a passcode on the site if the event is private.
- “Download all” fires one download per photo (browser may ask permission). Drive can show a virus-scan page for files over ~25 MB.
- Drive thumbnails/downloads count against Google's per-file bandwidth limits if thousands of people hit the same files.
- HEIC photos aren't supported by browsers; convert to JPG first.

## QR code: test locally, then Netlify
**Local test (phone + computer on the same Wi-Fi)**
1. `python3 serve.py` in this folder. It prints a Wi-Fi address like `http://192.168.1.23:8080/qr.html`.
2. Open **that address** (not localhost) on your computer. The QR code appears.
3. Scan it with your phone. It opens `go.html`, which redirects to the photo page.
(If a firewall prompt appears, allow Python on private networks.)

**Netlify**
1. Deploy the folder, then open `https://YOUR-SITE.netlify.app/qr.html`. The QR code now contains your real site address automatically.
2. Click **Print poster** (or Download PNG/SVG) and use that. Test-scan the printed copy once.
3. A QR made from a local address will NOT work after the event: always regenerate it from the live Netlify page.

## Deploy to Netlify (drag & drop)
1. Finish indexing locally so that `index.json` sits in this folder next to `index.html`.
2. Go to https://app.netlify.com/drop and log in (free account).
3. Drag this whole folder onto the page. Netlify gives you a link like `https://random-name.netlify.app`.
4. Site configuration -> Change site name -> pick something nice, e.g. `sneh-snamelan-2026`.
5. Open `https://YOUR-SITE.netlify.app/qr.html`, click Print poster. Scan the printed copy once to test.
6. Updating later (new photos / edits): Netlify -> your site -> Deploys -> drag the updated folder onto the deploy box.
`admin.html`, `serve.py` and `README.md` are blocked on the live site by `_redirects` (they still work locally).
