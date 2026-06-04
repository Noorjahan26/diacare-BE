const router = require("express").Router();
const mongoose = require("mongoose");
const Recommendation = require("../models/Recommendation");
const Auth = require("../models/Auth");
const authMiddleware = require("../middleware/authMiddleware");

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// POST new recommendation
router.post("/", authMiddleware, wrap(async (req, res) => {
  const auth = req.auth || req.authPayload;
  if (!auth) return res.status(401).json({ error: "Unauthorized" });

  const { patient_id } = req.body;
  if (!patient_id || !mongoose.isValidObjectId(patient_id)) {
    return res.status(400).json({ error: "Valid patient_id is required" });
  }

  const rec = await Recommendation.create({
    ...req.body,
    doctor_id: (auth.role === "doctor" || auth.entity_type === "Doctor") ? new mongoose.Types.ObjectId(auth.entity_id) : null,
    patient_id: new mongoose.Types.ObjectId(patient_id)
  });
  res.status(201).json(rec);
}));

// GET recommendations for a patient
router.get("/", authMiddleware, wrap(async (req, res) => {
  const auth = req.auth || req.authPayload;
  if (!auth) return res.status(401).json({ error: "Unauthorized" });

  const { patient_id } = req.query;
  
  let targetId = (auth.role === "patient" || auth.entity_type === "Patient") ? auth.entity_id : patient_id;

  if (!targetId) {
    return res.status(400).json({ error: "patient_id required" });
  }

  const queryId = typeof targetId === 'string' ? new mongoose.Types.ObjectId(targetId) : targetId;

  const recs = await Recommendation.find({ patient_id: queryId }).sort({ timestamp: -1 });
  res.json(recs);
}));

module.exports = router;
