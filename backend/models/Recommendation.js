const mongoose = require("mongoose");

const RecommendationSchema = new mongoose.Schema({
  patient_id: { type: mongoose.Schema.Types.ObjectId, ref: "Patient", required: true },
  doctor_id: { type: mongoose.Schema.Types.ObjectId, ref: "Doctor" },
  title: { type: String, required: false },
  category: { type: String, enum: ["Diet", "Exercise", "Medication", "Lifestyle", "General", "other"], default: "other" },
  timestamp: { type: Date, default: Date.now },
  message: { type: String },
}, { timestamps: true });

module.exports = mongoose.model("Recommendation", RecommendationSchema);
