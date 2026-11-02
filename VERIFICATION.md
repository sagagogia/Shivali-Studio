# Verification — 2 November 2026

- `pnpm test`: 22 tests passed. Includes real OpenMontage 27-second H.264 previews, with and without synthetic audio. No paid model calls.
- `pnpm typecheck`: passed.
- `pnpm build`: production build passed, including TypeScript.
- `node scripts/smoke-studio.mjs`: isolated API/browser flow passed. Checked seeded metadata, no fabricated assets, disabled paid provider and cloud uploads, same-origin enforcement, private uploads, real decoding, stale approval rejection, current concept/asset gates, OpenMontage asynchronous render, final approval before export, 1080×1920 / 27 seconds, browser navigation, mobile overflow and browser exceptions. Test data was temporary and removed.
- Hallmark static and rendered sweep: zero failures, zero warnings. One documented Reflex waiver: multi-line campaign selection rows exceed single-action control height. Render sweep captured 1280×800, 1440×900 and 1920×1080 folds, and 1440/375px full pages.
- Independent reviewer found four important approval/race issues: upstream rejection not revoking export, old render reuse after revision, stale paid-job submission and stale generated ingestion. Regression tests were observed failing before fixes. All are fixed with current-gate checks, render-version bindings, atomic reservation/job creation, pre-submit revalidation and transactional expected-version ingestion. Safe provider request IDs and reservation links are retained.
- Review limits: no live paid-provider execution or invoice validation, subjective garment-fidelity certification, music-rights verification, live trend inference, public hosting security or publishing account validation. These are not claimed as completed capabilities.

The photographs attached in chat are not stored in the app. The live local workspace contains MF03162's confirmed metadata and no generated campaign assets or synthetic product approvals.

## Protected staging branch

The deployment branch adds six auth tests, three canonical-origin/proxy tests and two startup-lock tests: 33 tests now pass. Mobile browser sign-in and errors, secure session cookies, protected API/file endpoints, same-origin enforcement, public health and the full source-image render workflow also pass locally. Independent review found a legacy numeric-PID-lock issue; a failing regression test was added and the lock helper now handles it safely. Logout/revocation and per-process rate-limit limitations are documented.

Docker image build passed, but starting a memory-limited test container failed because this executor's VFS Docker storage exhausted disk capacity. No hosted service, data migration or paid-generation call was made. The isolated deployment proposal remains separate from the live Render service.
