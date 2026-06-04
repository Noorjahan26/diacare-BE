const router = require("express").Router();
const ECG = require("../models/ECG");
const authMiddleware = require("../middleware/authMiddleware");
const mongoose = require("mongoose");

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Log a new ECG reading
router.post("/", authMiddleware, wrap(async (req, res) => {
  const auth = req.auth || req.authPayload;
  const targetPatientId = auth.entity_type === "Patient" ? auth.entity_id : req.body.patient_id;
  
  if (!targetPatientId || !mongoose.isValidObjectId(targetPatientId)) {
    return res.status(400).json({ error: "Valid patient_id is required" });
  }

  const data = { ...req.body };
  delete data._id;

  const ecg = await ECG.create({
    ...data,
    patient_id: new mongoose.Types.ObjectId(targetPatientId)
  });
  res.status(201).json(ecg);
}));

// Get all ECG logs for a patient
router.get("/patient/:patient_id", wrap(async (req, res) => {
  const logs = await ECG.find({ patient_id: req.params.patient_id }).sort({ logged_at: -1 });
  res.json(logs);
}));

// Get one ECG log
router.get("/:id", wrap(async (req, res) => {
  const log = await ECG.findById(req.params.id).populate("patient_id", "name");
  if (!log) return res.status(404).json({ error: "ECG log not found" });
  res.json(log);
}));

router.delete("/:id", wrap(async (req, res) => {
  await ECG.findByIdAndDelete(req.params.id);
  res.json({ message: "ECG log deleted" });
}));

module.exports = router;
