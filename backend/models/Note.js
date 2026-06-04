const mongoose = require("mongoose");

// Doctor "Writes" ClinicalNote (M:N → stored as a join-like document)
const NoteSchema = new mongoose.Schema({
  patient_id: { type: mongoose.Schema.Types.ObjectId, ref: "Patient", required: true },
  doctor_id:  { type: mongoose.Schema.Types.ObjectId, ref: "Doctor",  required: true },
  note_text:  { type: String, required: true },
  created_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Note", NoteSchema);
