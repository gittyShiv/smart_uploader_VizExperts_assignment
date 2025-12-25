const mongoose = require("mongoose");

const chunkSchema = new mongoose.Schema({
  upload_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Upload",
  },
  chunk_index: Number,
  status: {
    type: String,
    default: "RECEIVED",
  },
  received_at: {
    type: Date,
    default: Date.now,
  },
});

chunkSchema.index({ upload_id: 1, chunk_index: 1 }, { unique: true });

module.exports = mongoose.model("Chunk", chunkSchema);
