const express = require("express");
const fs = require("fs");
const path = require("path");
const unzipper = require("unzipper");

const router = express.Router();

router.get("/peek/:uploadId", async (req, res) => {
  try {
    const filePath = path.join(
      __dirname,
      "../uploads/temp",
      req.params.uploadId
    );

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "File not found" });
    }

    const filenames = [];

    const stream = fs
      .createReadStream(filePath)
      .pipe(unzipper.Parse());

    stream.on("entry", (entry) => {
      // only top-level entries
      if (!entry.path.includes("/")) {
        filenames.push(entry.path);
      }
      entry.autodrain();
    });

    stream.on("close", () => {
      res.json({ files: filenames });
    });

    stream.on("error", (err) => {
      // THIS FIXES CRASH
      res.status(400).json({
        error: "File is not a valid ZIP archive",
        details: err.message,
      });
    });
  } catch (err) {
    res.status(500).json({ error: "Peek failed", details: err.message });
  }
});

module.exports = router;
