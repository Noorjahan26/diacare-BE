const mongoose = require("mongoose");

// HEALTH_ALERT
// - patient_id (FK)
// - Admin "receives" alerts (1:N — one admin receives many alerts)
// - "belongs to" USER_AUTH (1:1 linkage)
const AlertSchema = new mongoose.Schema({
  patient_id:  { type: mongoose.Schema.Types.ObjectId, ref: "Patient", required: true },
  message:     { type: String },
  summary:     { type: String },
  is_resolved: { type: Boolean, default: false },

  // Admin receives this alert
  admin_id:    { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },

  // "belongs to" USER_AUTH
  auth_id:     { type: mongoose.Schema.Types.ObjectId, ref: "Auth" }
}, { timestamps: true });

module.exports = mongoose.model("Alert", AlertSchema);
