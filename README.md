# Múlẹ̀ — Research Platform

**Múlẹ̀** (*Moo-leh*, Yoruba: “confirmed”) is a Next.js research implementation of a **3-tiered AI system** for authenticating medicines tagged with QR/barcodes. It follows the study method: visual capture → product recognition & geospatial checks → temporal/frequency analysis → hedged AI remarks.

This is a **research artefact**, not a regulatory certification product. AI and rule outputs are advisory; final judgment rests with users and regulators.

## Method mapping

| Manuscript layer | Implementation |
| --- | --- |
| Tier 1 — QR capture, visual integrity, geolocation | [`/verify`](src/app/verify/page.tsx) + [`QrScanner`](src/components/QrScanner.tsx) + Layer 1 in [`pipeline.ts`](src/lib/verification/pipeline.ts) |
| Tier 2 — Registry recognition + distance vs last scan (X miles) | Layer 2 in `pipeline.ts` + Azure vision/remarks via [`openai.ts`](src/lib/openai.ts) |
| Tier 3 — Time (Y hours) + scan frequency (n) | Layer 3 in `pipeline.ts` |
| Dashboard / hotspots (Fig. 9) | [`/dashboard`](src/app/dashboard/page.tsx) |
| Regulatory engagement recommendation | “Report for regulatory review” on verify + dashboard |

Default thresholds (editable in the dashboard):

- **X** = 50 miles  
- **Y** = 2 hours  
- **n** = 25 scans  

## Stack

- Next.js (App Router) — UI + REST API
- MongoDB + Mongoose — products, scans, thresholds
- Azure OpenAI Responses API (`gpt-5.4`) — packaging analysis & remarks
- html5-qrcode — camera + upload decode
- Leaflet — geospatial hotspot map

## Setup

```bash
npm install
npm run db:seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) (or the port Next.js prints if 3000 is busy).

Credentials (MongoDB + Azure OpenAI) live in [`src/lib/config.ts`](src/lib/config.ts) — no `.env` required for this private repo.

## Reproducing evaluation scenarios

Seeded fixtures (`npm run db:seed`):

1. **Authentic cluster** — Lagos / Ibadan / PH / Abuja plausible scans for several products  
2. **Impossible travel baseline** — `MUL-CIP-006` last seen in Lagos ~1h ago (pair with a far-away verify location to exercise Layer 2)  
3. **High-frequency reprint** — `MUL-REP-010` with 28 prior scans (exceeds `n=25`)  
4. **Unrecognised payload** — use Verify → “Demo: unrecognised code”

On `/verify`:

- **Snap photo** (camera) or **upload** any image — analysis runs automatically  
- AI first answers: is this a medicine/drug pack?  
- Then observes name, spelling, print, packaging, logo  
- If a QR/barcode is found, Layers 2–3 (registry, distance, frequency) also run  
- Photo-only path still returns a visual verdict without a code  

On `/dashboard`:

- Inspect scan log + layer pass/fail  
- Adjust X / Y / n and re-run verifies  
- Export CSV for offline analysis  
- Mark reports for regulatory-style escalation  

## API

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/api/verify` | Run full pipeline; persist `ScanEvent` + `VerificationRun` |
| `GET` | `/api/scans` | Dashboard scan history |
| `PATCH` | `/api/scans` | Toggle `reported` |
| `GET` | `/api/hotspots` | Geo buckets for map |
| `GET`/`PATCH` | `/api/thresholds` | Read/update X, Y, n |
| `GET` | `/api/products` | Medicine registry |
| `POST` | `/api/ai/analyze` | Standalone image analysis |

## Research caveats

- Limited synthetic registry (IP of real branded packs not disclosed, per manuscript)  
- AI language is intentionally hedged (“no clear signs”, “more thorough verification needed”)  
- Real NAFDAC/SON integration is out of scope; report flags are workflow stubs  
- Dataset grows with live scans — suitable for iterative method evaluation  

## Scripts

```bash
npm run dev          # development server
npm run build        # next build
npm run db:seed      # reset research fixtures in MongoDB
```
