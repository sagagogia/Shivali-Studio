# Public source and protected staging deployment

User supplied sagagogia/Shivali-Studio as an accessible public replacement repository. It was empty at inspection. This branch contains the separately built studio, not the source or database schema of the existing Render deployment.

The development branch is codex/marketing-rewrite. Publishing this source branch does not change the existing shivali-studio Render service or its /var/data records. The old private repository remains inaccessible to this session, so there is no claimed migration or replacement of its users, schemas or uploads.

Deployment candidate: new password-protected Docker web service shivali-studio-codex, Node 24 + Python + FFmpeg + audited OpenMontage revision, single-instance persistent /var/data/studio. Live paid-generation and advanced-generator switches remain false. Separate staging lets the owner review this new app before considering the existing production service.

Changes: add server-side password and signed-session protection, safe health endpoint, hosted bind-address support, deployment container and Render Blueprint. Passwords and signing secrets are supplied only through Render's private environment settings, never this repository or chat. Test missing/partial config fail-closed, login failures, signed-session tampering/expiry, protected API/files, same-origin enforcement, local bypass only on loopback and no auth configuration. Existing garment workflow and real OpenMontage tests must stay green. Validate Blueprint against Render's current schema; test the container locally if the environment permits.

Render's published minimum paid compute price verified on 2 November 2026 is $7/month for 0.5 CPU / 512 MB, plus $0.25/GB/month persistent disk. Initial staging candidate: 1GB disk, baseline $7.25/month before taxes, additional transfer, model usage and any workspace-plan charges. Resource suitability must be assessed in the container test; do not promise sustained video production on 512MB without workload measurements. No paid resource is to be created before the owner approves the concrete configuration and price.
