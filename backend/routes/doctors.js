const router = require("express").Router();
const Doctor = require("../models/Doctor");
const Patient = require("../models/Patient");
const Recommendation = require("../models/Recommendation");
const Report = require("../models/Report");
const HealthLog = require("../models/HealthLog");
const Glucose = require("../models/Glucose");
const authMiddleware = require("../middleware/authMiddleware");
const mongoose = require("mongoose");
const multer = require('multer');
const path = require('path');

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });

// 1. Get patients assigned to this doctor
router.get("/patients", authMiddleware, wrap(async (req, res) => {
  const auth = req.auth;
  let query = {};

  if (auth.entity_type === "Doctor") {
    query.doctors = new mongoose.Types.ObjectId(auth.entity_id);
  }

  const patients = await Patient.find(query).populate("doctors", "name specialisation").lean();

  const formatted = await Promise.all(patients.map(async (p) => {
    const hasLogs = await Glucose.exists({ patient_id: p._id });
    return {
      ...p,
      hasData: !!hasLogs
    };
  }));

  res.json(formatted);
}));

// 2. Get glucose readings for a patient
router.get("/patients/:patient_id/glucose", authMiddleware, wrap(async (req, res) => {
  const pId = new mongoose.Types.ObjectId(req.params.patient_id);
  const [glucoseLogs, healthLogs] = await Promise.all([
    Glucose.find({ patient_id: pId }).lean(),
    HealthLog.find({
      patient_id: pId,
      blood_glucose: { $ne: null },
    }).lean(),
  ]);

  const normalizedHealthLogs = healthLogs.map((log) => ({
    _id: `healthlog-${log._id}`,
    patient_id: log.patient_id,
    value: log.blood_glucose,
    logged_at: log.logged_at,
    createdAt: log.createdAt,
    source: "healthlog",
  }));

  const logs = [...glucoseLogs, ...normalizedHealthLogs].sort(
    (a, b) => new Date(a.logged_at || a.createdAt) - new Date(b.logged_at || b.createdAt)
  );

  const mapped = logs.map(l => ({
    _id: l._id,
    patient_id: l.patient_id,
    value: l.value,
    recordedAt: l.logged_at,
    createdAt: l.createdAt,
    source: l.source || "glucose"
  }));

  res.json(mapped);
}));

// 3. Get recommendations for a patient (FIXED — now populates doctor name)
router.get("/patients/:patient_id/recommendations", authMiddleware, wrap(async (req, res) => {
  const recs = await Recommendation
    .find({ patient_id: req.params.patient_id })
    .populate("doctor_id", "name specialisation")
    .sort({ createdAt: -1 })
    .lean();

  const formatted = recs.map(r => ({
    ...r,
    doctor_name: r.doctor_id?.name || "Unknown Doctor",
    doctor_specialisation: r.doctor_id?.specialisation || ""
  }));

  res.json(formatted);
}));

// 4. Post a recommendation (FIXED — validates doctor_id and returns populated doc)
router.post("/patients/:patient_id/recommendations", authMiddleware, wrap(async (req, res) => {
  const auth = req.auth || req.authPayload;

  const doctorId = auth?.entity_id && mongoose.Types.ObjectId.isValid(auth.entity_id)
    ? new mongoose.Types.ObjectId(auth.entity_id)
    : null;

  const rec = await Recommendation.create({
    patient_id: new mongoose.Types.ObjectId(req.params.patient_id),
    doctor_id: doctorId,
    title: req.body.title || "Medical Recommendation",
    category: req.body.category || "other",
    message: req.body.message
  });

  const populated = await Recommendation
    .findById(rec._id)
    .populate("doctor_id", "name specialisation")
    .lean();

  res.status(201).json({
    ...populated,
    doctor_name: populated.doctor_id?.name || "Unknown Doctor",
    doctor_specialisation: populated.doctor_id?.specialisation || ""
  });
}));

// 5. Get reports for a patient
router.get("/patients/:patient_id/reports", authMiddleware, wrap(async (req, res) => {
  const reports = await Report.find({ patient_id: req.params.patient_id }).sort({ uploaded_at: -1 }).lean();
  const formatted = reports.map(r => ({
    ...r,
    file_url: r.fileUrl,
    file_type: r.fileType,
    doctor_name: r.doctor,
    report_type: r.fileType
  }));
  res.json(formatted);
}));

// 6. Upload a report for a patient
router.post(
  "/patients/:patient_id/reports",
  authMiddleware,
  upload.single('file'),
  wrap(async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ message: "No binary file uploaded." });
    }

    const report = await Report.create({
      patient_id: new mongoose.Types.ObjectId(req.params.patient_id),
      title: req.body.title,
      doctor: req.body.doctor,
      date: new Date(),
      fileUrl: `/uploads/${req.file.filename}`,
      fileType: req.file.mimetype.split('/')[1] || "pdf"
    });

    res.status(201).json(report);
  })
);

// Standard CRUD endpoints

router.post("/", wrap(async (req, res) => {
  const doctor = await Doctor.create(req.body);
  res.status(201).json(doctor);
}));

router.get("/", wrap(async (req, res) => {
  const doctors = await Doctor.find().populate("admin_id", "name email").populate("patients", "name email");
  res.json(doctors);
}));

router.get("/:id", wrap(async (req, res) => {
  const doctor = await Doctor.findById(req.params.id)
    .populate("admin_id")
    .populate("patients");
  if (!doctor) return res.status(404).json({ error: "Doctor not found" });
  res.json(doctor);
}));

router.put("/:id", wrap(async (req, res) => {
  const doctor = await Doctor.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!doctor) return res.status(404).json({ error: "Doctor not found" });
  res.json(doctor);
}));

router.delete("/:id", wrap(async (req, res) => {
  await Doctor.findByIdAndDelete(req.params.id);
  res.json({ message: "Doctor deleted" });
}));

module.exports = router;