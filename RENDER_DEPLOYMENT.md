# Render deployment candidate

This repository prepares a **new** `shivali-studio-codex` Docker web service in
**My Workspace** (`tea-dbjc0im7bikc73f0sohg`). It must not modify the existing
`shivali-studio` service, its private source repository, environment, or disk.
The source is `https://github.com/sagagogia/Shivali-Studio`, branch
`codex/marketing-rewrite`. The Blueprint must be committed and pushed there
before Render can read it. No service or disk is created by these local files.

The proposed smallest paid compute plan is `0.5c-512mb` (0.5 CPU, 512 MB), with
one 1 GB disk mounted at `/var/data`, in the Singapore region. The estimate is **$7.25/month**: $7 compute
plus $0.25 disk, excluding tax, egress, and any model usage. Video rendering on
512 MB has not been benchmarked. If it exceeds memory or time limits, review a
`1c-2g` plan (approximately $25/month compute) before changing resources; this
configuration does not automatically scale or upgrade.

## Container

Build from the repository root:

```bash
docker build --platform linux/amd64 -t shivali-studio:review .
```

The single-stage image builds Next.js with Node 24 and pnpm 11.25.0; dependency installation disables lifecycle scripts. Its runtime installs
Python, FFmpeg/ffprobe, Git, tini, and OpenMontage commit
`195eab24478dc9363326aec437aefc3701635ddf` under `/opt/openmontage`, including
that checkout's complete Python requirements in `.venv`. Git trusts only this exact root-owned checkout through a system `safe.directory` entry, allowing the unprivileged worker to verify the pinned commit. The OpenMontage source
is pinned; its upstream Python requirements use version ranges, so the full
transitive dependency set is not reproducibly locked. Browser, GPU, and Piper
installations are not required by the restricted local preview adapter.

Local corporate proxy environments may supply optional BuildKit secrets
`proxy_ca` (Node extra CA) and `system_ca` (complete system CA bundle for
apt/Git/pip). Supply these with `--secret id=proxy_ca,src=...` and
`--secret id=system_ca,src=...` only when needed. The build mounts these for
network operations and does not bake their contents or proxy environment
variables into the image. Standard Render builds need neither secret.

Installation and compilation share one filesystem layer to avoid duplicating large runtime snapshots in local VFS Docker storage. Development dependencies remain installed for build reliability; no production pruning is assumed.

The container initializes `/var/data/studio` on the mounted disk as root, then
uses `setpriv` to run Node and render subprocesses as the unprivileged `node`
user. `tini` forwards signals and reaps processes. The application binds
`0.0.0.0:$PORT` through `SHIVALI_HOST`; Render's proposed port is 10000.
The health check is `/api/health`, which must remain accessible without login
and must not disclose credentials. Shutdown grace is 210 seconds, above the
180-second preview worker timeout.

## Secrets and defaults

During initial Blueprint creation, provide `SHIVALI_AUTH_PASSWORD` of at least
16 characters. Render generates `SHIVALI_SESSION_SECRET` using
`generateValue: true`; retain it across deploys so sessions remain valid.
Never commit either value. `sync: false` prompts only when the service is first
created and does not update a password during later Blueprint syncs.

`SHIVALI_DATA_DIR=/var/data/studio` keeps the application database and uploaded
or rendered assets on the persistent disk. Files elsewhere remain ephemeral.
The disk is attached to one instance and disables zero-downtime deploys;
expect a short interruption during deployment. Back up application state and
assets before migrations. A disk snapshot is not an application-consistent
SQLite backup and is not an individual-file restore mechanism.

Both paid generation and the advanced generator default to `false`. No
`FAL_KEY`, OpenAI key, or other provider secret is included. Configure any
provider and explicitly enable paid generation only as separately authorized.

## Review and launch

1. Review the pushed branch and container build/smoke results.
2. In the confirmed Render workspace, create a **new Blueprint**, selecting
   this repository and branch. Verify the preview lists only the new
   `shivali-studio-codex` service and its 1 GB disk, with the expected price.
3. Supply the password securely in Render and review the generated session
   secret entry. Confirm `autoDeployTrigger: off` and the Docker runtime.
4. After the creation/deployment action is authorized, monitor the new deploy
   until `live`. Verify health, unauthenticated access restrictions, login,
   upload/render/export, and persistence across a controlled restart. Inspect
   logs for startup or rendering errors without printing secrets.

The old service is outside this Blueprint. Current live Render documentation
allows runtime changes for some services, but this candidate intentionally
uses a new service rather than altering the existing one.

## Validation scope and references

The local Blueprint was validated with Python `jsonschema` against the fetched
[public Render JSON Schema](https://render.com/schema/render.yaml.json).
The Render CLI was not installed, so platform-aware validation has not run.
When CLI v2.7.0+ is available, run:

```bash
render blueprints validate render.yaml
```

Schema validation does not establish resource availability, account billing,
remote branch existence, successful image builds, or a live deployment.

Current Render documentation retrieved and read for this candidate:
[Blueprint specification](https://render.com/docs/blueprint-spec),
[compute plans](https://render.com/docs/compute-plans),
[persistent disks](https://render.com/docs/disks),
[environment variables](https://render.com/docs/configure-environment-variables),
[deploy lifecycle](https://render.com/docs/deploys), and
[health checks](https://render.com/docs/health-checks).
Pricing must be reconfirmed in the creation preview before provisioning.

## Authentication verification

Owner login is server-side, HMAC-signed for eight hours, with secure/httpOnly/sameSite=strict cookies. Hosted binding or Render deployment cannot bypass login by claiming a localhost hostname. API endpoints, private assets and server actions pass through the same proxy gate. Unconfigured hosted access fails closed. Local loopback without either secret remains available for development. Public health exposes only `{ok:true}`.

`RENDER_EXTERNAL_URL` is the trusted canonical origin behind Render's HTTP proxy, avoiding redirects to internal localhost addresses. Browser `Host` is preserved for local loopback tests. Logout clears the current cookie; rotate the signing secret for global session revocation. Per-process login failure caps reset on restart and are not a distributed auth service.

## Local verification result

On 2 November 2026, the production build, TypeScript, 33 automated tests, mobile browser login, protected API checks and full local campaign/render/export smoke passed. The Render Blueprint passed the current published JSON Schema. The Docker image built successfully with the pinned OpenMontage checkout and Python 3.11 / FFmpeg 5.1 from Debian bookworm (local image SHA256 8c0fd27408166c4c66419fd68ec82e7c05f6bb1851b35bec87e18dcc4cc58431).

The attempted 512MB container runtime/persistence smoke could not start: Docker's VFS container snapshot exhausted this executor's disk. Only task-created Docker build cache and its test image were removed afterward. No production data or repository source was deleted. This is NOT a verified 512MB capacity result. Actual hosted login, persistence, preview rendering, memory and restart behavior must be checked on staging before any production replacement. The supplied smoke-container.py performs that local workload when enough Docker disk capacity exists.
