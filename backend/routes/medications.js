const router = require("express").Router();
const mongoose = require("mongoose");
const Medication = require("../models/Medication");
const Auth = require("../models/Auth");
const authMiddleware = require("../middleware/authMiddleware");

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.post("/", authMiddleware, wrap(async (req, res) => {
  const auth = req.auth || req.authPayload;
  if (!auth) return res.status(401).json({ error: "Unauthorized" });

  let targetPatientId;
  const role = (auth.role || auth.entity_type || "").toLowerCase();

  if (role === "admin") {
    targetPatientId = req.body.patient_id;
    if (!targetPatientId) return res.status(400).json({ error: "patient_id is required" });
  } else if (role === "doctor") {
    targetPatientId = req.body.patient_id;
    if (!targetPatientId) return res.status(400).json({ error: "patient_id is required" });
  } else if (role === "patient") {
    targetPatientId = auth.entity_id;
  } else {
    return res.status(403).json({ error: "Access denied" });
  }

  const medData = { ...req.body };
  delete medData._id; // Prevent frontend IDs from interfering

  const med = await Medication.create({
    ...medData,
    dosage: req.body.dosage || req.body.dose,
    patient_id: new mongoose.Types.ObjectId(targetPatientId)
  });
  res.status(201).json(med);
}));

router.get("/", authMiddleware, wrap(async (req, res) => {
  const auth = req.auth || req.authPayload;
  if (!auth) return res.status(401).json({ error: "Unauthorized" });

  const { patient_id } = req.query;
  let query = {};
  const role = (auth.role || auth.entity_type || "").toLowerCase();

  if (role === "admin") {
    if (!patient_id) return res.status(400).json({ error: "patient_id is required" });
    query.patient_id = new mongoose.Types.ObjectId(patient_id);
  } else if (role === "patient") {
    query.patient_id = new mongoose.Types.ObjectId(auth.entity_id);
  } else if (role === "doctor") {
    if (!patient_id) return res.status(400).json({ error: "patient_id is required for doctors" });
    query.patient_id = new mongoose.Types.ObjectId(patient_id);
  } else {
    console.warn(`[Medications] Forbidden access attempt by ${auth.entity_type} / ${auth.role}`);
    return res.status(403).json({ error: "Access denied" });
  }

  const meds = await Medication.find(query).sort({ createdAt: -1 });
  res.json(meds);
}));

router.get("/patient/:patient_id", authMiddleware, wrap(async (req, res) => {
  const auth = req.auth || req.authPayload;
  if (!auth) return res.status(401).json({ error: "Unauthorized" });

  if ((auth.role === "patient" || auth.entity_type === "Patient") && auth.entity_id.toString() !== req.params.patient_id) {
    return res.status(403).json({ error: "Access denied" });
  }

  const pId = new mongoose.Types.ObjectId(req.params.patient_id);
  const meds = await Medication.find({ 
    $or: [{ patient_id: pId }, { patient_id: req.params.patient_id }] 
  }).sort({ createdAt: -1 });
  res.json(meds);
}));

router.patch("/:id", authMiddleware, wrap(async (req, res) => {
  if (req.body.status) {
    req.body.is_active = (req.body.status === "active");
  }
  const med = await Medication.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!med) return res.status(404).json({ error: "Medication not found" });
  res.json(med);
}));

router.get("/:id", authMiddleware, wrap(async (req, res) => {
  const med = await Medication.findById(req.params.id);
  if (!med) return res.status(404).json({ error: "Medication not found" });
  res.json(med);
}));

router.put("/:id", authMiddleware, wrap(async (req, res) => {
  const med = await Medication.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!med) return res.status(404).json({ error: "Medication not found" });
  res.json(med);
}));

router.patch("/:id/toggle", authMiddleware, wrap(async (req, res) => {
  const med = await Medication.findById(req.params.id);
  if (!med) return res.status(404).json({ error: "Not found" });
  med.is_active = !med.is_active;
  await med.save();
  res.json(med);
}));

router.delete("/:id", authMiddleware, wrap(async (req, res) => {
  await Medication.findByIdAndDelete(req.params.id);
  res.json({ message: "Medication deleted" });
}));

module.exports = router;
