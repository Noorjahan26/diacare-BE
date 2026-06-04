const router = require("express").Router();
const Patient = require("../models/Patient");
const Doctor  = require("../models/Doctor");

const authMiddleware = require("../middleware/authMiddleware");
const mongoose = require("mongoose");

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Create patient
router.post("/", authMiddleware, wrap(async (req, res) => {
  const patient = await Patient.create(req.body);
  res.status(201).json(patient);
}));

// Get patients (Filtered by doctor if applicable)
router.get("/", authMiddleware, wrap(async (req, res) => {
  const auth = req.auth;
  let query = {};

  if (auth.entity_type === "Doctor") {
    // Only get patients assigned to this doctor
    query.doctors = new mongoose.Types.ObjectId(auth.entity_id);
  }

  const patients = await Patient.find(query).populate("doctors", "name specialisation");
  res.json(patients);
}));

// Get one patient (full details)
router.get("/:id", wrap(async (req, res) => {
  const patient = await Patient.findById(req.params.id).populate("doctors");
  if (!patient) return res.status(404).json({ error: "Patient not found" });
  res.json(patient);
}));

// Update patient
router.put("/:id", wrap(async (req, res) => {
  const patient = await Patient.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!patient) return res.status(404).json({ error: "Patient not found" });
  res.json(patient);
}));

// Delete patient
router.delete("/:id", wrap(async (req, res) => {
  await Patient.findByIdAndDelete(req.params.id);
  res.json({ message: "Patient deleted" });
}));

// Connect Patient ↔ Doctor (CONSULTS relationship)
router.post("/:id/consult/:doctor_id", wrap(async (req, res) => {
  const { id, doctor_id } = req.params;

  const [patient, doctor] = await Promise.all([
    Patient.findById(id),
    Doctor.findById(doctor_id)
  ]);

  if (!patient || !doctor) return res.status(404).json({ error: "Patient or Doctor not found" });

  await Patient.findByIdAndUpdate(id,        { $addToSet: { doctors: doctor_id } });
  await Doctor.findByIdAndUpdate(doctor_id,  { $addToSet: { patients: id } });

  res.json({ message: "Patient-Doctor consultation link created" });
}));

module.exports = router;
