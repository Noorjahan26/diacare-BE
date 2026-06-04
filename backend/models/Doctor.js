const mongoose = require("mongoose");

const DoctorSchema = new mongoose.Schema({
  name:           { type: String, required: true },
  email:          { type: String, unique: true },
  specialisation: { type: String },
  phone:          { 
    type: String,
    validate: {
      validator: (v) => !v || /^[6-9]\d{9}$/.test(v),
      message: "Please enter a valid 10-digit Indian phone number."
    }
  },
  // Managed by one Admin (M:1)
  admin_id: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
  // Consults relationship (M:N with Patient) — mirror side
  patients: [{ type: mongoose.Schema.Types.ObjectId, ref: "Patient" }]
}, { timestamps: true });

module.exports = mongoose.model("Doctor", DoctorSchema);
