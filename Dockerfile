# syntax=docker/dockerfile:1.7
FROM node:24-bookworm-slim
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
# One filesystem installation layer also fits VFS-backed local build environments.
# Optional trust mounts are never persisted in the image.
COPY studio-source.zip /tmp/studio-source.zip
RUN --mount=type=secret,id=proxy_ca --mount=type=secret,id=system_ca \
    set -eu; \
    if [ -f /run/secrets/proxy_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/proxy_ca; fi; \
    if [ -f /run/secrets/system_ca ]; then \
      export SSL_CERT_FILE=/run/secrets/system_ca; \
      printf 'Acquire::https::CaInfo "/run/secrets/system_ca";\n' > /etc/apt/apt.conf.d/99-build-ca; \
    fi; \
    apt-get update; \
    apt-get install --yes --no-install-recommends python3 python3-venv ffmpeg git ca-certificates tini util-linux; \
    rm -rf /var/lib/apt/lists/* /etc/apt/apt.conf.d/99-build-ca; \
    python3 -c 'from zipfile import ZipFile; from pathlib import PurePosixPath; z=ZipFile("/tmp/studio-source.zip"); assert all(not PurePosixPath(n).is_absolute() and ".." not in PurePosixPath(n).parts for n in z.namelist()); z.extractall("/app")'; \
    rm /tmp/studio-source.zip; \
    if [ -f /run/secrets/system_ca ]; then export GIT_SSL_CAINFO=/run/secrets/system_ca PIP_CERT=/run/secrets/system_ca; fi; \
    git init /opt/openmontage; \
    git -C /opt/openmontage remote add origin https://github.com/calesthio/OpenMontage.git; \
    git -C /opt/openmontage fetch --depth=1 origin 195eab24478dc9363326aec437aefc3701635ddf; \
    git -C /opt/openmontage checkout --detach FETCH_HEAD; \
    git config --system --add safe.directory /opt/openmontage; \
    test "$(git -C /opt/openmontage rev-parse HEAD)" = 195eab24478dc9363326aec437aefc3701635ddf; \
    python3 -m venv /opt/openmontage/.venv; \
    /opt/openmontage/.venv/bin/pip install --no-cache-dir -r /opt/openmontage/requirements.txt; \
    npm install --global pnpm@11.25.0; \
    pnpm install --frozen-lockfile --ignore-scripts; \
    pnpm build; \
    chown -R node:node /app; \
    rm -rf /root/.npm /root/.cache /root/.local/share/pnpm/store
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 \
    SHIVALI_HOST=0.0.0.0 PORT=10000 \
    SHIVALI_DATA_DIR=/var/data/studio \
    SHIVALI_OPENMONTAGE_ROOT=/opt/openmontage \
    SHIVALI_ENABLE_PAID_GENERATION=false \
    SHIVALI_ENABLE_ADVANCED_GENERATOR=false
EXPOSE 10000
ENTRYPOINT ["/usr/bin/tini", "--"]
# Render mounts the disk after image creation; initialize only its app directory,
# then drop privileges before the Node server and render subprocesses start.
CMD ["/bin/sh", "-c", "mkdir -p /var/data/studio && chown node:node /var/data/studio && exec setpriv --reuid=node --regid=node --init-groups node scripts/start-studio.mjs"]
