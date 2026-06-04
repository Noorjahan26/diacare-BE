const mongoose = require("mongoose");

// Patient "have to" ECG (1:N — one patient, many ECG logs)
const ECGSchema = new mongoose.Schema({
  patient_id: { type: mongoose.Schema.Types.ObjectId, ref: "Patient", required: true },
  type:       { type: String },   // e.g., "resting", "stress"
  value:      { type: String },   // raw signal value or reading
  logged_at:  { type: Date, default: Date.now }
});

module.exports = mongoose.model("ECG", ECGSchema);
