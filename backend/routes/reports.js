const router = require("express").Router();
const mongoose = require("mongoose");
const Report = require("../models/Report");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const authMiddleware = require("../middleware/authMiddleware");
const Auth = require("../models/Auth");

const upload = multer({ dest: 'uploads/' });

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// POST new report with file upload
router.post("/", authMiddleware, upload.single('report'), wrap(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  const auth = req.auth || req.authPayload;
  if (!auth) return res.status(401).json({ error: "Unauthorized" });

  const { title, doctor, date, patient_id } = req.body;

  const targetPatientId = (auth.role === "doctor" || auth.entity_type === "Doctor") ? patient_id : auth.entity_id;

  if (!targetPatientId) {
    return res.status(400).json({ error: "Patient ID is required" });
  }

  const fileUrl = `/uploads/${req.file.filename}`;
  const ext = path.extname(req.file.originalname).toLowerCase();
  const fileType = ext === '.pdf' ? 'pdf' : 'image';

  const report = await Report.create({
    patient_id: new mongoose.Types.ObjectId(targetPatientId),
    title,
    doctor: doctor || (auth.entity_type === "Doctor" ? auth.name : "System"),
    date: date || new Date(),
    fileUrl,
    fileType
  });

  res.status(201).json(report);
}));

// GET reports
router.get("/", authMiddleware, wrap(async (req, res) => {
  const auth = req.auth || req.authPayload;
  if (!auth) return res.status(401).json({ error: "Unauthorized" });

  const { patient_id } = req.query;
  let query = {};

  if (auth.role === "patient" || auth.entity_type === "Patient") {
    query.patient_id = new mongoose.Types.ObjectId(auth.entity_id);
  } else if (auth.entity_type === "Doctor" || auth.role === "doctor") {
    if (!patient_id) return res.status(400).json({ error: "patient_id is required for doctors" });
    query.patient_id = new mongoose.Types.ObjectId(patient_id);
  } else {
    console.warn(`[Reports] Forbidden access attempt by ${auth.entity_type} / ${auth.role}`);
    return res.status(403).json({ error: "Access denied" });
  }

  console.log(`[Reports] Authorized: Query for patient ${query.patient_id} by ${auth.entity_type}`);

  const reports = await Report.find(query).sort({ uploaded_at: -1 });
  res.json(reports);
}));

router.get("/patient/:patient_id", authMiddleware, wrap(async (req, res) => {
  const pId = new mongoose.Types.ObjectId(req.params.patient_id);
  const reports = await Report.find({ 
    $or: [{ patient_id: pId }, { patient_id: req.params.patient_id }] 
  }).sort({ uploaded_at: -1 });
  res.json(reports);
}));

// DELETE a report
router.delete("/:id", authMiddleware, wrap(async (req, res) => {
  const report = await Report.findByIdAndDelete(req.params.id);
  if (!report) return res.status(404).json({ error: "Report not found" });
  res.json({ message: "Report deleted" });
}));

module.exports = router;
