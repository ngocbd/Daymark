# Daymark

Offline-first attendance app. Clock in and out, live location, on-device face check-in, working hours, leave, absence, on-site visits, and shift requests.

Attendance data stays in the browser (IndexedDB). The server only serves the app. Nothing is uploaded.

## Requirements

- Node.js 22, or Docker
- Port **7001** free on the host if you run the container

## Local development

```bash
npm install
npm run dev
```

Open http://localhost:8080

The dev server stays on port 8080. Production Docker uses host port 7001.

## Build and run with Docker

The image builds a Node server and listens on port 7001 inside the container. The host publishes the same port, so a domain can point at this machine on **7001**.

```bash
chmod +x scripts/docker.sh
./scripts/docker.sh
```

Or with Compose:

```bash
docker compose up -d --build
```

Then open http://127.0.0.1:7001

Point a domain at this host and forward it to port 7001. Example with Caddy on the same machine:

```
your.domain {
  reverse_proxy 127.0.0.1:7001
}
```

If the reverse proxy is on another machine, allow inbound TCP 7001 and use this host's address.

### Stop

```bash
docker rm -f daymark
```

Compose:

```bash
docker compose down
```

### Logs

```bash
docker logs -f daymark
```

### Change the host port

Default is 7001. To publish a different host port while the app still listens on 7001 in the container:

```bash
HOST_PORT=8080 ./scripts/docker.sh
```

Or edit the `ports` line in `docker-compose.yml`.

## Production build without Docker

```bash
NITRO_PRESET=node-server npm run build
PORT=7001 HOST=0.0.0.0 node .output/server/index.mjs
```

`npm run build` without `NITRO_PRESET` keeps the Vercel preset.
