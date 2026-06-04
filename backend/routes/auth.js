const router = require("express").Router();
// ✅ removed require("dotenv").config() — already done in server.js
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const Auth = require("../models/Auth");
const Patient = require("../models/Patient");
const Doctor = require("../models/Doctor");
const Admin = require("../models/Admin");
const authMiddleware = require("../middleware/authMiddleware"); // ✅ use shared middleware

// ── Models map ─────────────────────────────────────────────
const ENTITY_MODELS = { Patient, Doctor, Admin };
const ROLE_TO_ENTITY = {
  patient: "Patient",
  doctor: "Doctor",
  admin: "Admin",
};

// ── Error wrapper ───────────────────────────────────────────
const wrap = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// ── JWT ────────────────────────────────────────────────────
const signToken = (auth) =>
  jwt.sign(
    {
      auth_id: auth._id,
      entity_id: auth.entity_id,
      entity_type: auth.entity_type,
      role: auth.role,
    },
    process.env.JWT_SECRET || "development_secret",
    { expiresIn: "7d" }
  );

// ── Helpers ────────────────────────────────────────────────
const getEntityModel = (entity_type) => ENTITY_MODELS[entity_type];

const findEntityByEmail = async (email) => {
  for (const type of ["Patient", "Doctor", "Admin"]) {
    const entity = await ENTITY_MODELS[type].findOne({ email }).lean();
    if (entity) return { entity, entity_type: type };
  }
  return null;
};

const buildUser = async (auth) => {
  const entity = await getEntityModel(auth.entity_type)
    .findById(auth.entity_id)
    .lean();

  if (!entity) throw new Error("Associated entity record not found");

  return {
    auth_id: auth._id,
    entity_id: auth.entity_id,
    entity_type: auth.entity_type,
    role: auth.role,
    name: entity.name,
    email: entity.email,
    createdAt: entity.createdAt,
    phone: entity.phone,
    specialisation: entity.specialisation,
    age: entity.age,
    diabetesType: entity.diabetesType,
    weight: entity.weight,
    height: entity.height,
    gender: entity.gender,
    dob: entity.dob,
    doctors: entity.doctors || [], // ✅ include doctors array for patients
  };
};

// ───────────────────────────────────────────────────────────
// REGISTER
// ───────────────────────────────────────────────────────────
router.post("/register", wrap(async (req, res) => {
  const { name, email, password, role, age, diabetesType, gender, dob } = req.body;

  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: "Name, email, password and role are required" });
  }

  const entity_type = ROLE_TO_ENTITY[role];
  if (!entity_type) {
    return res.status(400).json({ error: "Invalid role" });
  }

  const existingEntity = await findEntityByEmail(email);

  if (existingEntity) {
    const existingAuth = await Auth.findOne({ entity_id: existingEntity.entity._id });
    if (existingAuth) {
      return res.status(409).json({ error: "User already registered" });
    }
  }

  const entityData = { name, email };
  if (entity_type === "Patient") {
    if (age) entityData.age = age;
    if (diabetesType) entityData.diabetesType = diabetesType;
    if (gender) entityData.gender = gender;
    if (dob) entityData.dob = new Date(dob);
  }

  // Auto-assign doctor for new patient registration
  if (role === "patient" && !req.body.assigned_doctor) {
    const doctors = await Doctor.find().lean();
    if (doctors.length > 0) {
      // Sort doctors by patient count (ascending)
      doctors.sort((a, b) => (a.patients?.length || 0) - (b.patients?.length || 0));
      entityData.doctors = [doctors[0]._id];
      
      // Note: We update the doctor's patient list after creating the patient entity
      var autoAssignedDoctorId = doctors[0]._id;
    }
  }

  let entity = existingEntity?.entity;
  if (!entity) {
    entity = await getEntityModel(entity_type).create(entityData);
  } else {
    entity = await getEntityModel(entity_type).findByIdAndUpdate(
      entity._id,
      entityData,
      { new: true }
    );
  }

  // Link doctor if provided
  if (entity_type === "Patient" && req.body.assigned_doctor) {
    await Patient.findByIdAndUpdate(entity._id, {
      $addToSet: { doctors: req.body.assigned_doctor }
    });
    await Doctor.findByIdAndUpdate(req.body.assigned_doctor, {
      $addToSet: { patients: entity._id }
    });
  }

  // Handle auto-assigned doctor link
  if (autoAssignedDoctorId) {
    await Doctor.findByIdAndUpdate(autoAssignedDoctorId, {
      $addToSet: { patients: entity._id }
    });
  }

  const password_hash = await bcrypt.hash(password, 10);

  const auth = await Auth.create({
    entity_id: entity._id,
    entity_type,
    role,
    password_hash,
    status: role === "patient" ? "pending" : "approved"
  });

  // If pending, don't issue a session token yet
  if (auth.status === "pending") {
    return res.status(201).json({ 
      message: "Registration successful. You will be notified when your account is approved." 
    });
  }

  const token = signToken(auth);
  auth.session_token = token;
  await auth.save();

  const user = await buildUser(auth);

  res.status(201).json({
    message: "Registered successfully",
    token,
    user,
  });
}));

// ───────────────────────────────────────────────────────────
// LOGIN
// ───────────────────────────────────────────────────────────
router.post("/login", wrap(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  const found = await findEntityByEmail(email);
  if (!found) {
    return res.status(404).json({ error: "No user found" });
  }

  const auth = await Auth.findOne({ entity_id: found.entity._id });
  if (!auth || !auth.password_hash) {
    return res.status(404).json({ error: "Auth record missing" });
  }

  const valid = await bcrypt.compare(password, auth.password_hash);
  if (!valid) {
    return res.status(401).json({ error: "Invalid password" });
  }

  const token = signToken(auth);
  auth.session_token = token;
  await auth.save();

  const user = await buildUser(auth);

  res.json({
    message: "Login successful",
    token,
    user,
  });
}));

// ───────────────────────────────────────────────────────────
// LOGOUT
// ───────────────────────────────────────────────────────────
router.post("/logout", wrap(async (req, res) => {
  const { email, entity_id } = req.body;
  let auth = null;

  if (email) {
    const found = await findEntityByEmail(email);
    if (found) {
      auth = await Auth.findOne({ entity_id: found.entity._id });
    }
  } else if (entity_id) {
    auth = await Auth.findOne({ entity_id });
  }

  if (auth) {
    auth.session_token = null;
    await auth.save();
  }

  res.json({ message: "Logged out" });
}));

// ───────────────────────────────────────────────────────────
// PROFILE
// ───────────────────────────────────────────────────────────
router.get("/profile", authMiddleware, wrap(async (req, res) => {
  // ✅ using shared authMiddleware which sets req.auth
  const payload = req.auth || req.authPayload;
  const auth = await Auth.findById(payload.auth_id);
  if (!auth) return res.status(404).json({ error: "Not found" });

  const user = await buildUser(auth);
  res.json(user);
}));

router.put("/profile", authMiddleware, wrap(async (req, res) => {
  const payload = req.auth || req.authPayload;
  const auth = await Auth.findById(payload.auth_id);
  if (!auth) return res.status(404).json({ error: "Not found" });

  const entityModel = getEntityModel(auth.entity_type);

  // ✅ Strip sensitive fields before updating
  const updates = { ...req.body };
  delete updates._id;
  delete updates.password;
  delete updates.role;
  delete updates.entity_type;
  delete updates.entity_id;

  await entityModel.findByIdAndUpdate(auth.entity_id, updates, { new: true, runValidators: true });

  const user = await buildUser(auth);
  res.json(user);
}));

router.post("/change-password", authMiddleware, wrap(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: "Current and new passwords are required" });
  }

  const auth = await Auth.findById(req.auth.auth_id);
  if (!auth) return res.status(404).json({ error: "Auth record not found" });

  const valid = await bcrypt.compare(currentPassword, auth.password_hash);
  if (!valid) {
    return res.status(400).json({ error: "Incorrect current password" });
  }

  auth.password_hash = await bcrypt.hash(newPassword, 10);
  await auth.save();

  res.json({ message: "Password updated successfully" });
}));

module.exports = router;