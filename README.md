# Padel Ladder

Mobile-first web app for managing padel ladder competitions.

## Stack

- Backend: Node.js + Express + sql.js (SQLite in WASM, no native build)
- Frontend: React (Vite)
- Server launcher: Java `server.jar` (optional) to start backend via a single JAR

## Quickstart

### Prereqs
- Node.js 18+ (Node 20+ recommended)
- Java 17+ (only if using `server.jar` launcher)

### Backend

```bash
cd "backend"
cp .env.example .env
npm install
npm run migrate
npm start
```

The backend will start on `http://localhost:3001`.

Health check:

```bash
curl http://localhost:3001/health
```

### Frontend

```bash
cd "frontend"
npm install
npm run dev
```

Open `http://localhost:5173`.

Configure the frontend to point to a different API by setting `VITE_API_BASE_URL` in an `.env` file in `frontend/`.

## API Overview

- `POST /auth/register` { email, password, displayName }
- `POST /auth/login` { email, password }
- `GET /courts` (public)
- `POST /courts` (auth) create a court; caller becomes owner
- `GET /ladders?courtId=...` (public)
- `POST /ladders` (auth; only court owner) create a ladder
- `POST /ladders/:ladderId/join` (auth) join ladder
- `GET /ladders/:ladderId/standings` (public)
- `POST /challenges` (auth) issue challenge
- `GET /challenges?ladderId=...` (public)
- `POST /challenges/:challengeId/report` (auth) report winner; swaps ranks if lower beats higher

## server.jar launcher (optional)

If you prefer a single `server.jar` to start the backend (e.g., for Pterodactyl), you can build and run the Java launcher. It installs backend deps, runs migrations, and starts `npm start`.

### Build `server.jar` without Maven

```bash
# Requires Java 17+
cd "server-launcher"
javac -d build src/main/java/com/padel/ServerLauncher.java
printf 'Main-Class: com.padel.ServerLauncher\n' > manifest.mf
cd build && jar cfm ../../server.jar ../manifest.mf com/padel/ServerLauncher.class && cd ../..
```

Run it:

```bash
java -jar server.jar
```

On first run it will create `backend/.env` if missing, run `npm install` and `npm run migrate`, then start the backend.

### Pterodactyl notes

- Allocate a Node.js egg (recommended) and run the backend directly via `npm start` after `npm install` and `npm run migrate`.
- If you must use a Java egg, upload `server.jar` and configure the startup command to `java -jar server.jar`.
- Persistent storage: ensure `backend/data/` is on a persistent volume.
- Set environment variables in panel: `JWT_SECRET`, optionally `DB_PATH`, `PORT`.

## Development tips

- Because we use `sql.js` (WASM), no native compilation is required and it works on environments without build tools.
- The database file is stored at `backend/data/padel.db`. Back it up regularly.
- To reset: stop the server and delete `backend/data/padel.db`, then run `npm run migrate`.
