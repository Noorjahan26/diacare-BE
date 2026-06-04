const router = require("express").Router();
const mongoose = require("mongoose");
const authMiddleware = require("../middleware/authMiddleware");
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const MealSchema = new mongoose.Schema({
  patient_id: { type: mongoose.Schema.Types.ObjectId, ref: "Patient", required: true },
  name: { type: String, required: true },
  calories: { type: Number },
  sugar: { type: Number, default: 0 },
  carbohydrates: { type: Number },
  protein: { type: Number },
  fat: { type: Number },
  meal_type: { type: String, enum: ["breakfast", "lunch", "dinner", "snack"], default: "snack" },
  logged_at: { type: Date, default: Date.now },
}, { timestamps: true });

const Meal = mongoose.models.Meal || mongoose.model("Meal", MealSchema);

router.post("/", authMiddleware, wrap(async (req, res) => {
  const auth = req.auth || req.authPayload;
  const targetPatientId = auth.entity_type === "Patient" ? auth.entity_id : req.body.patient_id;

  if (!targetPatientId || !mongoose.isValidObjectId(targetPatientId)) {
    return res.status(400).json({ error: "Valid patient_id is required" });
  }

  const data = { ...req.body };
  delete data._id;

  const meal = await Meal.create({
    ...data,
    patient_id: new mongoose.Types.ObjectId(targetPatientId)
  });
  res.status(201).json(meal);
}));

router.get("/patient/:patient_id", authMiddleware, wrap(async (req, res) => {
  const pId = new mongoose.Types.ObjectId(req.params.patient_id);
  const meals = await Meal.find({ patient_id: pId }).sort({ logged_at: -1 });
  res.json(meals);
}));

router.delete("/:id", authMiddleware, wrap(async (req, res) => {
  await Meal.findByIdAndDelete(req.params.id);
  res.json({ message: "Meal deleted" });
}));

module.exports = router;
