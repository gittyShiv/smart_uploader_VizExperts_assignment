const mongoose = require("mongoose");

const uploadSchema = new mongoose.Schema(
  {
    filename: String,
    total_size: Number,
    total_chunks: Number,
    status: {
      type: String,
      enum: ["UPLOADING", "PROCESSING", "COMPLETED", "FAILED"],
      default: "UPLOADING",
    },
    final_hash: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model("Upload", uploadSchema);
