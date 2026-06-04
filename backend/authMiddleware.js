const jwt = require("jsonwebtoken");

/**
 * Middleware to verify JWT and attach auth info to req.auth
 */
const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No token provided, authorization denied" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "development_secret");
    
    // Attach to req.auth (used by patients.js and others)
    req.auth = decoded;
    
    // Also attach to req.authPayload (used in some existing routes like auth.js profile)
    req.authPayload = decoded;
    
    next();
  } catch (err) {
    console.error("Auth Middleware Error:", err.message);
    res.status(401).json({ error: "Token is not valid or has expired" });
  }
};

module.exports = authMiddleware;
