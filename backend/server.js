require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connectDB = require("./db");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// DB
connectDB();

// Serve static files from uploads directory
const path = require("path");
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Routes
const routes = [
  ["/patients", require("./routes/patients")],
  ["/doctors", require("./routes/doctors")],
  ["/doctor", require("./routes/doctors")], // Singular mapping for compatibility
  ["/admins", require("./routes/admins")],
  ["/admin", require("./routes/admins")], // Singular mapping for compatibility
  ["/ecg", require("./routes/ecg")],
  ["/medications", require("./routes/medications")],
  ["/reports", require("./routes/reports")],
  ["/notes", require("./routes/notes")],
  ["/alerts", require("./routes/alerts")],
  ["/auth", require("./routes/auth")],
  ["/healthlogs", require("./routes/healthlogs")],
  ["/meals", require("./routes/meals")],
  ["/activities", require("./routes/activities")],
  ["/recommendations", require("./routes/recommendations")],
  ["/glucose", require("./routes/glucose")],
];

routes.forEach(([routePath, router]) => {
  app.use(routePath, router);
  app.use(`/api${routePath}`, router);
});

// Health check
app.get("/", (req, res) => res.json({ status: "Healthcare API running ✅" }));

// Global error handler
app.use((err, req, res, next) => {
  console.error("❌", err.stack);
  res.status(500).json({ error: "Internal server error" });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () =>
  console.log(`🚀 Server running on http://localhost:${PORT}`)
);
