# Shivali AI Marketing Studio

An internal fashion-production workbench for Shivali Iconic Trends Pvt. Ltd. Built on OpenHiggsfield's Next.js studio, with Hallmark interface guidance and a pinned OpenMontage local preview worker.

This release is a working local production foundation, not an unattended advertising agency. Garment intake, campaign batches, offline creative drafts, editable copy, private assets, technical decoding, human approvals, budgets, source evidence, OpenMontage previews and export work locally. Paid model imagery requires an explicitly enabled fal integration. Live trend discovery, automatic model-motion generation, LLM creative direction and Instagram publishing are not enabled.

## Start

Requires Node.js 24+, pnpm, FFmpeg and FFprobe. From this directory:

```bash
pnpm install --frozen-lockfile --ignore-scripts
pnpm build
pnpm start
```

Open `http://127.0.0.1:3001` on the machine running the app. In a remote development environment this address needs the environment's supported port forwarding; it is not a public URL. `pnpm dev` starts development mode on the same local port. `PORT` can override the port. For hosted access, use the password-protected Render candidate in docs/RENDER_DEPLOYMENT.md. It provides a single-owner session gate, not employee SSO or multi-user roles. Keep it separate from the existing production app until reviewed.

`pnpm studio:check` reports safe runtime readiness, never secret values. `pnpm test` runs unit and real local rendering tests. `pnpm typecheck` checks TypeScript. `node scripts/smoke-studio.mjs` runs the isolated API/browser workflow against an existing production build, with temporary records and synthetic fixture media; no provider calls.

## First garment

MF03162 is seeded with the confirmed metadata: metallic blue silk, necklace and dupatta included. No assets or approvals are fabricated. Photographs attached in chat were visually reviewed but are not available as files in this checkout: upload them through the app.

1. In Studio, upload photographs as **Original reference**; use front/back/embroidery detail views when available.
2. Enter a creative direction and save; create the offline brief. The Creative desk provides rule-based direction, shot structure, draft copy and preservation checks.
3. Upload model images as **Campaign image**, or configure fal and explicitly authorize one image request. Neither path guarantees exact garment fidelity.
4. Review each image. The app verifies decoding, dimensions and hash; a person must inspect fabric, embroidery, color, neckline, silhouette, necklace and dupatta. Reject distorted results.
5. Finalize copy and assets, then approve the current concept and assets in Approvals. Any revision or additional asset invalidates earlier version approvals.
6. Optionally upload WAV/MP3 music. Record license evidence and explicitly confirm commercial/social/advertising rights; the app cannot establish those rights for you.
7. Render the source-image preview. OpenMontage stitches approved still holds into 27 seconds at 1080 × 1920, 30fps, H.264. It is not generated model movement, and does not imply the draft shot plan or camera moves were physically realized. With a verified music declaration, the selected audio is trimmed, faded and encoded to AAC; otherwise the preview is silent.
8. Review and approve the current render before downloading the JSON handoff and MP4. Nothing is published.

## Private records and recovery

SQLite records, original uploads, generated assets, worker packets, reports and history live under ignored `.studio-data/`, or an absolute `SHIVALI_DATA_DIR`. Never put this directory under `public/`. Copy the complete directory when the server is stopped to make a consistent backup. `pnpm start` uses a local process lock; interrupted jobs become failed on restart and uncertain paid reservations stay reserved. It never automatically retries a paid call. Inspect provider job IDs in Activity/job records and the provider dashboard before retrying.

This is single-machine/single-instance software. Jobs execute after the response in the long-lived Next.js process, not a distributed queue. Multi-instance hosting, a real queue, employee identity/roles, application-consistent backups and monitoring remain future production work. The staging container adds owner-password sessions and uses Render HTTPS.

## Provider configuration

No secrets are shipped. Paid generation is off by default. See [docs/PROVIDERS.md](docs/PROVIDERS.md) for fal's image-edit model, reference handling, limits and terms. Configure environment variables through a private process environment or an ignored local environment file:

- `FAL_KEY`: private fal credential; never paste into chat or client code.
- `SHIVALI_ENABLE_PAID_GENERATION=true`: explicit paid-generation enablement. Each request still needs a current approved concept, reference images, available budget and a final confirmation in the UI.
- `SHIVALI_OPENMONTAGE_ROOT`: the installed OpenMontage checkout with `.venv/bin/python`. The default points to this session's audited checkout; set it when moving machines.
- `SHIVALI_ENABLE_ADVANCED_GENERATOR`: leave unset. The original OpenHiggsfield interface is preserved at `/generate` but enabling it is an advanced separate path without Shivali's campaign budget gates. It should remain disabled for production work.

The image bridge currently estimates 15 US cents per 2K image. This is not a provider-enforced quote or invoice. Recorded spend is estimated; remote rate changes cannot be enforced by the local ledger. Uncertain submitted requests retain their reservation. The default campaign experiment budget is $5. Reconfirm pricing and terms before enabling paid operation.

## Repositories

| Component | Pinned source | Purpose |
|---|---|---|
| OpenHiggsfield | `wide-trace/open-higgsfield` at `b16a0efe4d7e2707b56f8ccb02387fd2a9d2eddf` | Next.js/React foundation and optional model catalog |
| OpenMontage | `calesthio/OpenMontage` at `195eab24478dc9363326aec437aefc3701635ddf` | Local `video_stitch` and verification |
| Hallmark | `Nutlope/hallmark` at `4f6a46c6dc325d40ab268c93e25c7b96676ebccd` | Atelier app styling and interface checks |

Hallmark is MIT; OpenMontage is AGPLv3. No license file was found in the inspected OpenHiggsfield revision. This internal work follows the user's instruction to proceed and does not resolve the upstream rights ambiguity. Generated content, music and provider services have independent terms.

See [architecture](docs/ARCHITECTURE.md), [roadmap](docs/ROADMAP.md), [OpenMontage integration](docs/OPENMONTAGE.md) and [verification](docs/VERIFICATION.md).

## Protected Render candidate

Source target: `sagagogia/Shivali-Studio`, development branch `codex/marketing-rewrite`. The new repository began empty. This is the separately built studio; it is not the current production server source and does not migrate that app's database. The existing Render service is unchanged.

See [Render deployment](docs/RENDER_DEPLOYMENT.md) for the exact staging proposal, estimated hosting cost, persistent disk and private configuration. Set a strong `SHIVALI_AUTH_PASSWORD` and a separately generated `SHIVALI_SESSION_SECRET` only in Render's private environment settings. No credentials belong in source or chat. `RENDER_EXTERNAL_URL` supplies the canonical HTTPS origin for login and same-origin requests behind the platform proxy; optional `SHIVALI_PUBLIC_ORIGIN` can override it for a verified custom domain.

Logging out clears this browser's cookie; it does not revoke a copied session. Password changes alone do not revoke existing sessions. Rotate `SHIVALI_SESSION_SECRET` to invalidate all sessions. Login rate limits are per process and reset on restart. Do not enable the original advanced-generator route for budget-governed production.
