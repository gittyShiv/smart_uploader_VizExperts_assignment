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
  const [selectedName, setSelectedName] = useState("Choose a ZIP to start");

  const uploadFile = async (file) => {
    if (!file) return;
    setSelectedName(file.name);

    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    const fileKey = `${file.name}_${file.size}`;

    const initRes = await axios.post(`${BACKEND_URL}/upload/init`, {
      filename: file.name,
      totalSize: file.size,
      totalChunks,
    });

    const { uploadId, receivedChunks = [] } = initRes.data;
    localStorage.setItem(fileKey, uploadId);

    let completed = receivedChunks.length;
    let active = 0;
    const startTime = Date.now();

    const statusArr = Array(totalChunks).fill("PENDING");
    receivedChunks.forEach((i) => (statusArr[i] = "SUCCESS"));

    setChunkStatus([...statusArr]);
    setProgress(Math.floor((completed / totalChunks) * 100));

    const queue = [...Array(totalChunks).keys()].filter(
      (i) => !receivedChunks.includes(i)
    );

    const uploadChunk = async (index) => {
      let retries = 0;

      setChunkStatus((s) => {
        const copy = [...s];
        copy[index] = "UPLOADING";
        return copy;
      });

      const blob = file.slice(index * CHUNK_SIZE, (index + 1) * CHUNK_SIZE);
      const form = new FormData();
      form.append("chunk", blob);
      form.append("uploadId", uploadId);
      form.append("chunkIndex", index);

      while (retries < 3) {
        try {
          await axios.post(`${BACKEND_URL}/upload/chunk`, form);

          completed++;
          setProgress(Math.floor((completed / totalChunks) * 100));

          const elapsed = (Date.now() - startTime) / 1000;
          const uploadedMB = (completed * CHUNK_SIZE) / (1024 * 1024);
          const currentSpeed = elapsed > 0 ? uploadedMB / elapsed : 0;

          setSpeed(currentSpeed.toFixed(2));

          const remainingMB =
            ((totalChunks - completed) * CHUNK_SIZE) / (1024 * 1024);
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
          await new Promise((r) => setTimeout(r, 2 ** retries * 1000));
        }
      }

      setChunkStatus((s) => {
        const copy = [...s];
        copy[index] = "ERROR";
        return copy;
      });
    };

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

    await axios.post(`${BACKEND_URL}/upload/finalize/${uploadId}`);

    localStorage.removeItem(fileKey);
  };

  const statusClass = (s) => {
    switch (s) {
      case "UPLOADING":
        return "tile uploading";
      case "SUCCESS":
        return "tile success";
      case "ERROR":
        return "tile error";
      default:
        return "tile pending";
    }
  };

  return (
    <div className="app-layout">
      <header className="hero">
        <div>
          <p className="eyebrow">Smart Upload</p>
          <h1>Large ZIP Chunk Uploader</h1>
          <p className="subtitle">
            Resumable, concurrent, chunked uploads with live feedback.
          </p>
        </div>
        <label className="file-picker">
          <input
            type="file"
            accept=".zip"
            onChange={(e) => uploadFile(e.target.files[0])}
          />
          <div className="file-chip">
            <span className="chip-label">Choose File</span>
            <span className="chip-name" title={selectedName}>
              {selectedName}
            </span>
          </div>
        </label>
      </header>

      <div className="dashboard">
        <section className="analytics glass">
          <div
            className="progress-ring"
            style={{ "--percentage": progress }}
          >
            <div className="progress-ring__inner">
              <div className="progress-value">{progress}%</div>
              <div className="progress-label">Uploaded</div>
              <div className="progress-sub">Speed: {speed} MB/s</div>
              <div className="progress-sub">ETA: {eta} s</div>
            </div>
          </div>

          <div className="metric-row">
            <div className="metric-card">
              <p className="metric-label">Speed</p>
              <p className="metric-value">
                {speed}
                <span className="metric-unit">MB/s</span>
              </p>
            </div>
            <div className="metric-card">
              <p className="metric-label">ETA</p>
              <p className="metric-value">
                {eta}
                <span className="metric-unit">seconds</span>
              </p>
            </div>
          </div>
        </section>

        <section className="grid-panel glass">
          <div className="panel-top">
            <div>
              <p className="eyebrow">Chunk Status Grid</p>
              <h3>Live micro-animations</h3>
            </div>
            <div className="pill">Chunks: {chunkStatus.length || 0}</div>
          </div>

          <div className="status-grid">
            {chunkStatus.map((s, i) => (
              <div key={i} className={statusClass(s)}>
                <span className="tile-number">{i}</span>
                <span className="tile-status">{s}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}