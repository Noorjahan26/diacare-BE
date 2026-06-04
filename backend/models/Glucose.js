const mongoose = require("mongoose");

const GlucoseSchema = new mongoose.Schema({
  patient_id: { type: mongoose.Schema.Types.ObjectId, ref: "Patient", required: true },
  value: { type: Number, required: true },
  time_of_day: { type: String, enum: ["Before Breakfast", "After Breakfast", "Before Lunch", "Lunch", "Before Dinner", "After Dinner", "Bedtime", "Other"], default: "Other" },
  notes: { type: String },
  logged_at: { type: Date, default: Date.now },
}, { timestamps: true });

// The || check prevents "OverwriteModelError" if the file is required multiple times
module.exports = mongoose.models.Glucose || mongoose.model("Glucose", GlucoseSchema);