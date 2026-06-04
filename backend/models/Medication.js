const mongoose = require("mongoose");

const MedicationSchema = new mongoose.Schema({
  patient_id: { type: mongoose.Schema.Types.ObjectId, ref: "Patient", required: false },
  name: { type: String, required: true },
  dosage: { type: String },
  frequency: { type: String },
  time: { type: String },
  notes: { type: String },
  is_active: { type: Boolean, default: true },
  status: { type: String, default: "active" }
}, { timestamps: true });

module.exports = mongoose.model("Medication", MedicationSchema);
