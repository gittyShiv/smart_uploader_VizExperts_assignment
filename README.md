# Smart Uploader (Chunked ZIP Uploads)

A resumable, concurrent ZIP chunk uploader with a “Luminous” neon/glassmorphism UI, live chunk grid, speed/ETA analytics, and MongoDB persistence.

## Features
- Chunked, concurrent uploads with retry
- Resume support (server remembers received chunks)
- Live speed (MB/s) and ETA
- Neon “Luminous” grid with micro-animations
- Circular analytics ring for progress/speed/ETA
- MongoDB persistence (Atlas)
- Zip peek endpoint (top-level entries)

## Frontend
- React + Vite
- Files: `frontend/src/App.jsx`, `frontend/src/uploader.jsx`, `frontend/src/styles.css`
- Preview port: `4173` (Vite preview)

## Backend
- Node.js + Express + MongoDB (Mongoose)
- Key routes:
  - `POST /upload/init`
  - `POST /upload/chunk`
  - `POST /upload/finalize/:uploadId`
  - `GET /peek/:uploadId`
- Port: `5000`

## Quick Start (Docker, Atlas)
1. Create `backend/.env` (not committed, see .env.example):
   ```env
   MONGO_URI=mongodb+srv://<user>:<pass>@<cluster-host>/<db-name>?retryWrites=true&w=majority
   PORT=5000
   ```
2. Build & run:
   ```bash
   docker-compose up --build
   ```
3. Frontend: http://localhost:4173  
   Backend API: http://localhost:5000

> Without `MONGO_URI`, backend will fail to connect—by design to avoid leaking credentials.

4. The "Peek" Requirement: to list the top-level filenames inside the ZIP without extracting the whole archive to disk. 
```bash
   http://localhost:5000/upload/peek/<upload_id>
   ```

## Scripts (inside containers or locally)
- Backend: `npm start`
- Frontend dev: `npm run dev`
- Frontend build: `npm run build`
- Frontend preview (used in Dockerfile): `npm run preview -- --host --port 4173`

## Environment Variables
- `MONGO_URI` (required): Mongo connection string (Atlas or local).
- `PORT` (optional, default 5000).
- `BACKEND_URL` (frontend, set via compose to `http://backend:5000`).

## File Picking & Chunk Grid
- Choose a ZIP; chunks upload concurrently(3).
- Grid colors & micro-animations:
  - Uploading: neon gradient pulse
  - Success: green glow
  - Error: red shake
  - Pending: subtle glass tile


