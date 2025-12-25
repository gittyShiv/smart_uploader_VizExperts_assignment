import axios from "axios";
import { useState } from "react";

const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_CONCURRENT = 3;
const BACKEND_URL = "http://localhost:5000";

export default function Uploader() {
  const [progress, setProgress] = useState(0);
  const [chunkStatus, setChunkStatus] = useState([]);
  const [speed, setSpeed] = useState(0);
  const [eta, setEta] = useState(0);

  const uploadFile = async (file) => {
    if (!file) return;

    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

    /* ==============================
       🔑 STABLE FILE ID (for refresh)
    ============================== */
    const fileKey = `${file.name}_${file.size}`;

    /* ==============================
       1️⃣ HANDSHAKE / RESUME
    ============================== */
    const initRes = await axios.post(`${BACKEND_URL}/upload/init`, {
      filename: file.name,
      totalSize: file.size,
      totalChunks,
    });

    const { uploadId, receivedChunks = [] } = initRes.data;

    // persist upload session for refresh
    localStorage.setItem(fileKey, uploadId);

    /* ==============================
       2️⃣ INIT STATE (RESTORE UI)
    ============================== */
    let completed = receivedChunks.length;
    let active = 0;
    const startTime = Date.now();

    const statusArr = Array(totalChunks).fill("PENDING");
    receivedChunks.forEach((i) => (statusArr[i] = "SUCCESS"));

    setChunkStatus([...statusArr]);
    setProgress(Math.floor((completed / totalChunks) * 100));

    // upload only missing chunks
    const queue = [...Array(totalChunks).keys()].filter(
      (i) => !receivedChunks.includes(i)
    );

    /* ==============================
       3️⃣ UPLOAD SINGLE CHUNK
    ============================== */
    const uploadChunk = async (index) => {
      let retries = 0;

      setChunkStatus((s) => {
        const copy = [...s];
        copy[index] = "UPLOADING";
        return copy;
      });

      const blob = file.slice(
        index * CHUNK_SIZE,
        (index + 1) * CHUNK_SIZE
      );

      const form = new FormData();
      form.append("chunk", blob);
      form.append("uploadId", uploadId);
      form.append("chunkIndex", index);

      while (retries < 3) {
        try {
          await axios.post(`${BACKEND_URL}/upload/chunk`, form);

          completed++;

          /* ===== Progress ===== */
          setProgress(
            Math.floor((completed / totalChunks) * 100)
          );

          /* ===== Speed + ETA ===== */
          const elapsed = (Date.now() - startTime) / 1000;
          const uploadedMB =
            (completed * CHUNK_SIZE) / (1024 * 1024);
          const currentSpeed =
            elapsed > 0 ? uploadedMB / elapsed : 0;

          setSpeed(currentSpeed.toFixed(2));

          const remainingMB =
            ((totalChunks - completed) * CHUNK_SIZE) /
            (1024 * 1024);
          setEta(
            currentSpeed > 0
              ? (remainingMB / currentSpeed).toFixed(1)
              : 0
          );

          setChunkStatus((s) => {
            const copy = [...s];
            copy[index] = "SUCCESS";
            return copy;
          });

          return;
        } catch {
          retries++;
          await new Promise((r) =>
            setTimeout(r, 2 ** retries * 1000)
          );
        }
      }

      setChunkStatus((s) => {
        const copy = [...s];
        copy[index] = "ERROR";
        return copy;
      });
    };

    /* ==============================
       4️⃣ CONCURRENCY CONTROLLER
    ============================== */
    await new Promise((resolve) => {
      const next = () => {
        if (!queue.length && active === 0) resolve();

        while (active < MAX_CONCURRENT && queue.length) {
          const index = queue.shift();
          active++;

          uploadChunk(index).finally(() => {
            active--;
            next();
          });
        }
      };
      next();
    });

    /* ==============================
       5️⃣ FINALIZE UPLOAD
    ============================== */
    await axios.post(
      `${BACKEND_URL}/upload/finalize/${uploadId}`
    );

    // cleanup after success
    localStorage.removeItem(fileKey);
  };

  return (
    <div>
      <input
        type="file"
        onChange={(e) => uploadFile(e.target.files[0])}
      />

      <br />
      <br />

      <progress
        value={progress}
        max="100"
        style={{ width: "100%" }}
      />
      <p>{progress}%</p>

      <p>Speed: {speed} MB/s</p>
      <p>ETA: {eta} seconds</p>

      <h4>Chunk Status Grid</h4>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(10, 1fr)",
          gap: 4,
        }}
      >
        {chunkStatus.map((s, i) => (
          <div
            key={i}
            style={{
              padding: 6,
              fontSize: 10,
              textAlign: "center",
              background:
                s === "SUCCESS"
                  ? "green"
                  : s === "UPLOADING"
                  ? "orange"
                  : s === "ERROR"
                  ? "red"
                  : "#ccc",
              color: "white",
            }}
          >
            {i}
          </div>
        ))}
      </div>
    </div>
  );
}

