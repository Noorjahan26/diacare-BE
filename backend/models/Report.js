const mongoose = require("mongoose");

const ReportSchema = new mongoose.Schema({
  patient_id: { type: mongoose.Schema.Types.ObjectId, ref: "Patient", required: false },
  title: { type: String, required: true },
  doctor: { type: String, required: true },
  date: { type: Date, required: true },
  fileUrl: { type: String, required: true },
  fileType: { type: String, required: true },
  uploaded_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Report", ReportSchema);
