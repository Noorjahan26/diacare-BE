const router = require("express").Router();
const mongoose = require("mongoose");
const HealthLogSchema = new mongoose.Schema({
  patient_id: { type: mongoose.Schema.Types.ObjectId, ref: "Patient", required: true },
  blood_pressure_sys: { type: Number },
  blood_pressure_dia: { type: Number },
  heart_rate: { type: Number },
  weight: { type: Number },
  blood_glucose: { type: Number },
  logged_at: { type: Date, default: Date.now },
}, { timestamps: true });

const HealthLog = mongoose.models.HealthLog || mongoose.model("HealthLog", HealthLogSchema);
const authMiddleware = require("../middleware/authMiddleware");

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Log a new health reading
router.post("/", authMiddleware, wrap(async (req, res) => {
  const auth = req.auth || req.authPayload;
  if (!auth) return res.status(401).json({ error: "Unauthorized" });

  const targetPatientId = (auth.role === "patient" || auth.entity_type === "Patient") ? auth.entity_id : req.body.patient_id;

  if (!targetPatientId || !mongoose.isValidObjectId(targetPatientId)) {
    return res.status(400).json({ error: "Valid patient_id is required" });
  }

  const data = { ...req.body };
  delete data._id;

  const log = await HealthLog.create({
    ...data,
    patient_id: new mongoose.Types.ObjectId(targetPatientId)
  });
  res.status(201).json(log);
}));

// Get all health logs for a patient
router.get("/patient/:patient_id", authMiddleware, wrap(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.patient_id)) {
    return res.status(400).json({ error: "Invalid patient ID format" });
  }

  const pId = new mongoose.Types.ObjectId(req.params.patient_id);
  const logs = await HealthLog.find({ patient_id: pId }).sort({ logged_at: -1 });
  res.json(logs);
}));

// Get one log
router.get("/:id", authMiddleware, wrap(async (req, res) => {
  const log = await HealthLog.findById(req.params.id);
  if (!log) return res.status(404).json({ error: "Health log not found" });
  res.json(log);
}));

// Delete a log
router.delete("/:id", authMiddleware, wrap(async (req, res) => {
  await HealthLog.findByIdAndDelete(req.params.id);
  res.json({ message: "Health log deleted" });
}));

module.exports = router;
