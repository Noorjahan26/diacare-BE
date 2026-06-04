const router = require("express").Router();
const Alert = require("../models/Alert");
const authMiddleware = require("../middleware/authMiddleware");
const mongoose = require("mongoose");

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.post("/", authMiddleware, wrap(async (req, res) => {
  const auth = req.auth || req.authPayload;
  const data = { ...req.body };
  delete data._id;

  const alert = await Alert.create({
    ...data,
    patient_id: data.patient_id ? new mongoose.Types.ObjectId(data.patient_id) : auth.entity_id
  });
  res.status(201).json(alert);
}));

// Alerts for a patient
router.get("/patient/:patient_id", wrap(async (req, res) => {
  const { patient_id } = req.params;
  
  if (!patient_id || patient_id === "undefined") {
    return res.json([]); // Return empty if no patient context
  }

  const alerts = await Alert.find({ patient_id: new mongoose.Types.ObjectId(patient_id) })
    .populate("admin_id", "name");
  res.json(alerts);
}));

// Alerts received by an admin ("receives" relationship)
router.get("/admin/:admin_id", wrap(async (req, res) => {
  const alerts = await Alert.find({ admin_id: req.params.admin_id })
    .populate("patient_id", "name email");
  res.json(alerts);
}));

router.get("/:id", wrap(async (req, res) => {
  const alert = await Alert.findById(req.params.id)
    .populate("patient_id")
    .populate("admin_id");
  if (!alert) return res.status(404).json({ error: "Alert not found" });
  res.json(alert);
}));

// Resolve an alert
router.patch("/:id/resolve", wrap(async (req, res) => {
  const alert = await Alert.findByIdAndUpdate(
    req.params.id,
    { is_resolved: true },
    { new: true }
  );
  if (!alert) return res.status(404).json({ error: "Alert not found" });
  res.json(alert);
}));

router.put("/:id", wrap(async (req, res) => {
  const alert = await Alert.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!alert) return res.status(404).json({ error: "Alert not found" });
  res.json(alert);
}));

router.delete("/:id", wrap(async (req, res) => {
  await Alert.findByIdAndDelete(req.params.id);
  res.json({ message: "Alert deleted" });
}));

module.exports = router;
