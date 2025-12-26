const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const multer = require("multer");

const Upload = require("../models/Upload");
const Chunk = require("../models/Chunk");

const router = express.Router();

const upload = multer({ storage: multer.memoryStorage() });

const TEMP_DIR = path.join(__dirname, "../uploads/temp");
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

const CHUNK_SIZE = 5 * 1024 * 1024; // MUST MATCH FRONTEND

// INIT / RESUME UPLOAD
// creates upload if not exists,preallocates file,returns received chunks for resume

router.post("/init", async (req, res) => {
  try {
    const { filename, totalSize, totalChunks } = req.body;

    let uploadDoc = await Upload.findOne({
      filename,
      total_size: totalSize,
      status: { $ne: "COMPLETED" },
    });

    // Create new upload if not found
    if (!uploadDoc) {
      uploadDoc = await Upload.create({
        filename,
        total_size: totalSize,
        total_chunks: totalChunks,
      });

      // PRE-ALLOCATE FILE SIZE
      const filePath = path.join(TEMP_DIR, uploadDoc._id.toString());
      const fd = fs.openSync(filePath, "w");
      fs.ftruncateSync(fd, totalSize);
      fs.closeSync(fd);
    }

    // Find already received chunks
    const chunks = await Chunk.find(
      { upload_id: uploadDoc._id },
      { chunk_index: 1, _id: 0 }
    );

    res.json({
      uploadId: uploadDoc._id,
      receivedChunks: chunks.map((c) => c.chunk_index),
    });
  } catch (err) {
    console.error("Init error:", err);
    res.status(500).json({ error: "Upload init failed" });
  }
});

//  UPLOAD CHUNK
//  idempotent,random-access write
 
router.post("/chunk", upload.single("chunk"), async (req, res) => {
  try {
    const { uploadId, chunkIndex } = req.body;
    const index = Number(chunkIndex);

    // Idempotency check
    const exists = await Chunk.findOne({
      upload_id: uploadId,
      chunk_index: index,
    });

    if (exists) {
      return res.json({ message: "Chunk already received" });
    }

    const filePath = path.join(TEMP_DIR, uploadId.toString());

    //RANDOM-ACCESS WRITE
    const writeStream = fs.createWriteStream(filePath, {
      flags: "r+",
      start: index * CHUNK_SIZE,
    });

    writeStream.write(req.file.buffer);
    writeStream.end();

    await Chunk.create({
      upload_id: uploadId,
      chunk_index: index,
    });

    res.json({ message: "Chunk uploaded" });
  } catch (err) {
    console.error("Chunk upload error:", err);
    res.status(500).json({ error: "Chunk upload failed" });
  }
});


// FINALIZE UPLOAD
// calculates SHA-256 via streaming

router.post("/finalize/:uploadId", async (req, res) => {
  try {
    const { uploadId } = req.params;

    const uploadDoc = await Upload.findById(uploadId);
    if (!uploadDoc) {
      return res.status(404).json({ error: "Upload not found" });
    }

    uploadDoc.status = "PROCESSING";
    await uploadDoc.save();

    const filePath = path.join(TEMP_DIR, uploadId);

    const hash = crypto.createHash("sha256");
    const stream = fs.createReadStream(filePath);

    stream.on("data", (data) => hash.update(data));
    stream.on("end", async () => {
      uploadDoc.final_hash = hash.digest("hex");
      uploadDoc.status = "COMPLETED";
      await uploadDoc.save();

      res.json({
        message: "Upload completed",
        sha256: uploadDoc.final_hash,
      });
    });

    stream.on("error", (err) => {
      uploadDoc.status = "FAILED";
      uploadDoc.save();
      res.status(500).json({ error: "Finalization failed" });
    });
  } catch (err) {
    console.error("Finalize error:", err);
    res.status(500).json({ error: "Finalize failed" });
  }
});

module.exports = router;