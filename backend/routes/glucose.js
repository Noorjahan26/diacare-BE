const router = require("express").Router();
const mongoose = require("mongoose");
const Glucose = require("../models/Glucose");
const HealthLog = require("../models/HealthLog");

// Ensure HealthLog is required or registered
const authMiddleware = require("../middleware/authMiddleware");

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Log a new glucose reading
router.post("/", authMiddleware, wrap(async (req, res) => {
  const auth = req.auth || req.authPayload;
  if (!auth) return res.status(401).json({ error: "Unauthorized" });

  // Normalize the role check
  const targetPatientId = (auth.role === "patient" || auth.entity_type === "Patient") ? auth.entity_id : req.body.patient_id;

  if (!targetPatientId || !mongoose.isValidObjectId(targetPatientId)) {
    return res.status(400).json({ error: "Valid patient_id is required" });
  }

  const { value, logged_at, time_of_day } = req.body;
  
  // Check for duplicate reading on same day & time
  if (logged_at && time_of_day) {
    const logDate = new Date(logged_at);
    const dayStart = new Date(logDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(logDate);
    dayEnd.setHours(23, 59, 59, 999);

    const existingReading = await Glucose.findOne({
      patient_id: new mongoose.Types.ObjectId(targetPatientId),
      time_of_day: time_of_day,
      logged_at: { $gte: dayStart, $lte: dayEnd }
    });

    if (existingReading) {
      return res.status(409).json({ 
        error: `You already have a "${time_of_day}" reading for this day. Update the existing reading instead.`,
        existing_id: existingReading._id 
      });
    }
  }

  const data = { ...req.body };
  delete data._id; // Remove frontend-generated ID if present

  const log = await Glucose.create({
    ...data,
    patient_id: new mongoose.Types.ObjectId(targetPatientId)
  });
  res.status(201).json(log);
}));

// Get all glucose logs for a patient
router.get("/patient/:patient_id", authMiddleware, wrap(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.patient_id)) {
    return res.status(400).json({ error: "Invalid patient ID format" });
  }

  const pId = new mongoose.Types.ObjectId(req.params.patient_id);
  
  const [glucoseLogs, healthLogs] = await Promise.all([
    Glucose.find({ 
      $or: [{ patient_id: pId }, { patient_id: req.params.patient_id }] 
    }).lean(),
    HealthLog.find({
      $or: [{ patient_id: pId }, { patient_id: req.params.patient_id }],
      blood_glucose: { $ne: null },
    }).lean(),
  ]);

  const normalizedHealthLogs = healthLogs.map((log) => ({
    _id: `healthlog-${log._id}`,
    patient_id: log.patient_id,
    value: log.blood_glucose,
    time_of_day: "Other",
    logged_at: log.logged_at,
    createdAt: log.createdAt,
    source: "healthlog",
  }));

  const logs = [...glucoseLogs, ...normalizedHealthLogs].sort(
    (a, b) => {
      // Ensure we have a valid timestamp to sort by
      const dateB = new Date(b.logged_at || b.createdAt || b.recordedAt || 0);
      const dateA = new Date(a.logged_at || a.createdAt || a.recordedAt || 0);
      return dateB - dateA;
    }
  );

  res.json(logs);
}));

// Delete a log
router.delete("/:id", authMiddleware, wrap(async (req, res) => {
  await Glucose.findByIdAndDelete(req.params.id);
  res.json({ message: "Glucose reading deleted" });
}));

// Update a glucose reading
router.put("/:id", authMiddleware, wrap(async (req, res) => {
  const { value, time_of_day, logged_at } = req.body;
  const readingId = req.params.id;

  if (!mongoose.isValidObjectId(readingId)) {
    return res.status(400).json({ error: "Invalid reading ID" });
  }

  const reading = await Glucose.findByIdAndUpdate(
    readingId,
    { value, time_of_day, logged_at },
    { new: true }
  );

  if (!reading) {
    return res.status(404).json({ error: "Reading not found" });
  }

  res.json(reading);
}));

module.exports = router;
