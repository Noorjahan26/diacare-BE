const mongoose = require("mongoose");

const HealthLogSchema = new mongoose.Schema({
  patient_id: { type: mongoose.Schema.Types.ObjectId, ref: "Patient", required: true },
  blood_glucose: { type: Number },
  blood_pressure_systolic: { type: Number },
  blood_pressure_diastolic: { type: Number },
  heart_rate: { type: Number },
  weight: { type: Number },
  notes: { type: String },
  logged_at: { type: Date, default: Date.now },
}, { timestamps: true });

module.exports = mongoose.model("HealthLog", HealthLogSchema);
