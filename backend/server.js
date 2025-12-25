require("dotenv").config();
const express = require("express");
const fs = require("fs");
const path = require("path");
const cors = require("cors");


const connectDB = require("./config/db");
const uploadRoutes = require("./routes/uploadRoutes");
const peekRoutes = require("./routes/peekRoutes");

const Upload = require("./models/Upload");

const app = express();

/* ==============================
   CONNECT TO MONGODB ATLAS
================================ */
connectDB();

/* ==============================
   MIDDLEWARE
================================ */
app.use(express.json());
app.use(cors({
  origin: "http://localhost:5173"
}));

/* ==============================
   ROUTES
================================ */
app.use("/upload", uploadRoutes);
app.use("/upload", peekRoutes);

/* ==============================
   CLEANUP ORPHANED UPLOADS
   - runs every 1 hour
   - removes uploads stuck in UPLOADING
================================ */
const TEMP_DIR = path.join(__dirname, "uploads/temp");

setInterval(async () => {
  try {
    const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours

    const staleUploads = await Upload.find({
      status: "UPLOADING",
      createdAt: { $lt: cutoffTime },
    });

    for (const upload of staleUploads) {
      const filePath = path.join(TEMP_DIR, upload._id.toString());

      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      await Upload.deleteOne({ _id: upload._id });
    }

    if (staleUploads.length > 0) {
      console.log(`🧹 Cleaned ${staleUploads.length} orphaned uploads`);
    }
  } catch (err) {
    console.error("Cleanup job failed:", err.message);
  }
}, 60 * 60 * 1000); // every hour

/* ==============================
   SERVER START
================================ */
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
