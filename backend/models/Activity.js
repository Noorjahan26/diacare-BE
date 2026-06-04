const mongoose = require("mongoose");

const ActivitySchema = new mongoose.Schema({
  patient_id: { type: mongoose.Schema.Types.ObjectId, ref: "Patient", required: true },
  type: { type: String, required: true },
  duration_minutes: { type: Number },
  intensity: { type: String, enum: ["Light", "Moderate", "Vigorous"], default: "Moderate" },
  calories_burned: { type: Number },
  steps_estimated: { type: Number, default: 0 },
  water_cups: { type: Number, default: 0 },
  blood_sugar: { type: Number },
  notes: { type: String },
  logged_at: { type: Date, default: Date.now },
}, { timestamps: true });

module.exports = mongoose.models.Activity || mongoose.model("Activity", ActivitySchema);