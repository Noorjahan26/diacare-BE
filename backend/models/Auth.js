const mongoose = require("mongoose");

// USER_AUTH — polymorphic: links to Patient, Doctor, or Admin
// "belongs to" Health Alert (inverse side stored on Alert)
const AuthSchema = new mongoose.Schema({
  // The ID of the Patient / Doctor / Admin this auth record belongs to
  entity_id:   { type: mongoose.Schema.Types.ObjectId, required: true },
  // Discriminator so we know which collection entity_id points to
  entity_type: { type: String, enum: ["Patient", "Doctor", "Admin"], required: true },
  role:          { type: String, enum: ["patient", "doctor", "admin"], required: true },
  password_hash: { type: String, required: true },
  session_token: { type: String },
  status:        { type: String, enum: ["pending", "approved"], default: "approved" }
}, { timestamps: true });

module.exports = mongoose.model("Auth", AuthSchema);
