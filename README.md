# Daymark

Offline-first attendance PWA. Clock in and out, live location, on-device face check-in, working hours, leave, absence, on-site visits, and shift requests.

Attendance data stays in the browser (IndexedDB). Nothing is uploaded.

## Run

```bash
npm install
npm run dev
```

Open http://localhost:8080

## Production

```bash
npm run build
```

This app is a TanStack Start server app. Deploy it to a Node or Vercel host. GitHub Pages only serves static files, so it will not run this build.
