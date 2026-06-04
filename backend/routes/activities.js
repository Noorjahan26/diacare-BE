const router = require("express").Router();
const mongoose = require("mongoose");
const authMiddleware = require("../middleware/authMiddleware");
const Activity = require("../models/Activity");

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.post("/", authMiddleware, wrap(async (req, res) => {
  const auth = req.auth || req.authPayload;
  const targetPatientId = auth.entity_type === "Patient" ? auth.entity_id : req.body.patient_id;

  if (!targetPatientId || !mongoose.isValidObjectId(targetPatientId)) {
    return res.status(400).json({ error: "Valid patient_id is required" });
  }

  const data = { ...req.body };
  delete data._id;

  const activity = await Activity.create({
    ...data,
    patient_id: new mongoose.Types.ObjectId(targetPatientId)
  });
  res.status(201).json(activity);
}));

router.get("/patient/:patient_id", authMiddleware, wrap(async (req, res) => {
  const pId = new mongoose.Types.ObjectId(req.params.patient_id);
  const activities = await Activity.find({ patient_id: pId }).sort({ logged_at: -1 });
  res.json(activities);
}));

router.put("/:id", authMiddleware, wrap(async (req, res) => {
  const activityId = req.params.id;
  if (!mongoose.isValidObjectId(activityId)) {
    return res.status(400).json({ error: "Valid activity ID is required" });
  }

  const data = { ...req.body };
  delete data._id;
  delete data.patient_id;

  const activity = await Activity.findByIdAndUpdate(activityId, data, { new: true });
  if (!activity) {
    return res.status(404).json({ error: "Activity not found" });
  }
  res.json(activity);
}));

router.delete("/:id", authMiddleware, wrap(async (req, res) => {
  await Activity.findByIdAndDelete(req.params.id);
  res.json({ message: "Activity deleted" });
}));

module.exports = router;
