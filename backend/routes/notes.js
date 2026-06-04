const router = require("express").Router();
const Note = require("../models/Note");
const authMiddleware = require("../middleware/authMiddleware");
const mongoose = require("mongoose");

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.post("/", authMiddleware, wrap(async (req, res) => {
  const auth = req.auth || req.authPayload;
  const targetPatientId = auth.entity_type === "Patient" ? auth.entity_id : req.body.patient_id;

  const data = { ...req.body };
  delete data._id;

  const note = await Note.create({
    ...data,
    patient_id: new mongoose.Types.ObjectId(targetPatientId),
    doctor_id: auth.entity_type === "Doctor" ? new mongoose.Types.ObjectId(auth.entity_id) : data.doctor_id
  });
  res.status(201).json(note);
}));

// Notes for a patient
router.get("/patient/:patient_id", wrap(async (req, res) => {
  const notes = await Note.find({ patient_id: new mongoose.Types.ObjectId(req.params.patient_id) })
    .populate("doctor_id", "name specialisation");
  res.json(notes);
}));

// Notes written by a doctor
router.get("/doctor/:doctor_id", wrap(async (req, res) => {
  const notes = await Note.find({ doctor_id: req.params.doctor_id })
    .populate("patient_id", "name");
  res.json(notes);
}));

router.get("/:id", wrap(async (req, res) => {
  const note = await Note.findById(req.params.id)
    .populate("patient_id")
    .populate("doctor_id");
  if (!note) return res.status(404).json({ error: "Note not found" });
  res.json(note);
}));

router.put("/:id", wrap(async (req, res) => {
  const note = await Note.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!note) return res.status(404).json({ error: "Note not found" });
  res.json(note);
}));

router.delete("/:id", wrap(async (req, res) => {
  await Note.findByIdAndDelete(req.params.id);
  res.json({ message: "Note deleted" });
}));

module.exports = router;
