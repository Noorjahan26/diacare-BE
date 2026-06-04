const router = require("express").Router();
const mongoose = require("mongoose"); // ✅ required once at top
const Admin = require("../models/Admin");
const Doctor = require("../models/Doctor");
const Patient = require("../models/Patient");
const Auth = require("../models/Auth");
const HealthLog = require("../models/HealthLog");
const bcrypt = require("bcryptjs");
const authMiddleware = require("../middleware/authMiddleware");

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// ✅ authMiddleware added
router.post("/", authMiddleware, wrap(async (req, res) => {
  const admin = await Admin.create(req.body);
  res.status(201).json(admin);
}));

// ✅ authMiddleware added
router.get("/", authMiddleware, wrap(async (req, res) => {
  const admins = await Admin.find();
  res.json(admins);
}));

// ── Named routes MUST come before /:id to avoid route shadowing ──

// Platform Stats
router.get("/stats", authMiddleware, wrap(async (req, res) => {
  const [patients, doctors, admins, logs, glucoseLogs] = await Promise.all([
    Patient.countDocuments(),
    Doctor.countDocuments(),
    Admin.countDocuments(),
    HealthLog.countDocuments(),
    mongoose.models.Glucose // ✅ using top-level mongoose
      ? mongoose.models.Glucose.countDocuments()
      : Promise.resolve(0)
  ]);
  res.json({ patients, doctors, admins, logs, glucoseReadings: glucoseLogs || logs });
}));

// User Management: Get all users with their entity details
router.get("/users", authMiddleware, wrap(async (req, res) => {
  const allAuths = await Auth.find().lean();
  const users = await Promise.all(allAuths.map(async (auth) => {
    let entity = null;
    if (auth.entity_id && mongoose.Types.ObjectId.isValid(auth.entity_id)) { // ✅ top-level mongoose
      if (auth.entity_type === "Patient") entity = await Patient.findById(auth.entity_id).populate("doctors", "name").lean();
      if (auth.entity_type === "Doctor") entity = await Doctor.findById(auth.entity_id).lean();
      if (auth.entity_type === "Admin") entity = await Admin.findById(auth.entity_id).lean();
    }

    return {
      _id: auth._id,
      entity_id: auth.entity_id,
      name: entity?.name || "Unknown",
      email: entity?.email || "Unknown",
      role: auth.role,
      doctors: entity?.doctors || [],
      status: auth.status || "approved",
      joined: entity?.createdAt || auth.createdAt,
      createdAt: entity?.createdAt || auth.createdAt
    };
  }));
  res.json(users);
}));

router.post("/users", authMiddleware, wrap(async (req, res) => {
  const { name, email, password, role, assignedDoctor } = req.body;

  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: "Name, email, password and role are required" });
  }

  const normalizedRole = role.toLowerCase();
  const entityTypeByRole = {
    patient: "Patient",
    doctor: "Doctor",
    admin: "Admin",
  };
  const entityType = entityTypeByRole[normalizedRole];

  if (!entityType) {
    return res.status(400).json({ error: "Invalid role" });
  }

  const existingEntities = await Promise.all([
    Patient.findOne({ email }).lean(),
    Doctor.findOne({ email }).lean(),
    Admin.findOne({ email }).lean(),
  ]);

  if (existingEntities.some(Boolean)) {
    return res.status(409).json({ error: "User already exists" });
  }

  const entityData = { name, email };
  if (entityType === "Patient" && assignedDoctor) {
    entityData.doctors = [assignedDoctor];
  }

  const EntityModel = entityType === "Patient" ? Patient : entityType === "Doctor" ? Doctor : Admin;
  const entity = await EntityModel.create(entityData);

  if (entityType === "Patient" && assignedDoctor) {
    await Doctor.findByIdAndUpdate(assignedDoctor, { $addToSet: { patients: entity._id } });
  }

  const auth = await Auth.create({
    entity_id: entity._id,
    entity_type: entityType,
    role: normalizedRole,
    password_hash: await bcrypt.hash(password, 10),
    status: req.body.status || "approved"
  });

  res.status(201).json({
    _id: auth._id,
    entity_id: entity._id,
    name: entity.name,
    email: entity.email,
    role: auth.role,
    assignedDoctor: entity.doctors?.[0] || null,
    status: auth.status,
    joined: entity.createdAt || auth.createdAt,
    createdAt: entity.createdAt || auth.createdAt,
  });
}));

// Approve User
router.patch("/users/:id/approve", authMiddleware, wrap(async (req, res) => {
  const auth = await Auth.findByIdAndUpdate(req.params.id, { status: "approved" }, { new: true });
  if (!auth) return res.status(404).json({ error: "User not found" });
  res.json({ message: "User approved successfully" });
}));

// Reassign Doctor
router.patch("/users/:id/assign-doctor", authMiddleware, wrap(async (req, res) => {
  const { doctorId } = req.body;
  const auth = await Auth.findById(req.params.id);
  
  if (!auth || auth.entity_type !== "Patient") {
    return res.status(400).json({ error: "Invalid patient" });
  }

  // Remove patient from all previous doctors
  await Doctor.updateMany({ patients: auth.entity_id }, { $pull: { patients: auth.entity_id } });
  
  // Update patient record
  await Patient.findByIdAndUpdate(auth.entity_id, { doctors: [doctorId] });
  
  // Add patient to new doctor
  await Doctor.findByIdAndUpdate(doctorId, { $addToSet: { patients: auth.entity_id } });

  res.json({ message: "Doctor reassigned successfully" });
}));

router.delete("/users/:id", authMiddleware, wrap(async (req, res) => {
  const auth = await Auth.findById(req.params.id);
  if (!auth) return res.status(404).json({ error: "User not found" });

  if (auth.entity_type === "Patient") await Patient.findByIdAndDelete(auth.entity_id);
  if (auth.entity_type === "Doctor") await Doctor.findByIdAndDelete(auth.entity_id);
  if (auth.entity_type === "Admin") await Admin.findByIdAndDelete(auth.entity_id);

  await Auth.findByIdAndDelete(req.params.id);
  res.json({ message: "User deleted" });
}));

// ── ID-based routes below ──

router.get("/:id", authMiddleware, wrap(async (req, res) => { // ✅ authMiddleware added
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) { // ✅ top-level mongoose
    return res.status(400).json({ error: "Invalid Admin ID format" });
  }
  const admin = await Admin.findById(req.params.id);
  if (!admin) return res.status(404).json({ error: "Admin not found" });
  res.json(admin);
}));

// Get all doctors managed by this admin
router.get("/:id/doctors", authMiddleware, wrap(async (req, res) => { // ✅ authMiddleware added
  const doctors = await Doctor.find({ admin_id: req.params.id });
  res.json(doctors);
}));

router.put("/:id", authMiddleware, wrap(async (req, res) => { // ✅ authMiddleware added
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) { // ✅ top-level mongoose
    return res.status(400).json({ error: "Invalid Admin ID format" });
  }
  const admin = await Admin.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true } // ✅ fixed returnDocument
  );
  if (!admin) return res.status(404).json({ error: "Admin not found" });
  res.json(admin);
}));

router.delete("/:id", authMiddleware, wrap(async (req, res) => { // ✅ authMiddleware added
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) { // ✅ top-level mongoose
    return res.status(400).json({ error: "Invalid Admin ID format" });
  }
  await Admin.findByIdAndDelete(req.params.id);
  res.json({ message: "Admin deleted" });
}));

module.exports = router;