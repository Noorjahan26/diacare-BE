const mongoose = require("mongoose");

const PatientSchema = new mongoose.Schema({
  name:   { type: String, required: true },
  email:  { type: String, required: true, unique: true },
  gender: { type: String, enum: ["Male", "Female", "Other"] },
  dob:    { type: Date },
  age:    { type: Number },
  diabetesType: { type: String },
  weight: { type: Number },
  height: { type: Number },
  phone:  { 
    type: String,
    validate: {
      validator: (v) => !v || /^[6-9]\d{9}$/.test(v),
      message: "Please enter a valid 10-digit Indian phone number."
    }
  },
  // Consults relationship (M:N with Doctor)
  doctors: [{ type: mongoose.Schema.Types.ObjectId, ref: "Doctor" }]
}, { timestamps: true });

module.exports = mongoose.model("Patient", PatientSchema);
