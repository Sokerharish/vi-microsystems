require("dotenv").config();

const express      = require("express");
const cors         = require("cors");
const helmet       = require("helmet");
const rateLimit    = require("express-rate-limit");
const connectDB    = require("./config/db");
const contactRoutes = require("./routes/contact");

connectDB();

const app = express();

// Fix for Render proxy
app.set("trust proxy", 1);

app.use(helmet());

const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",").map((o) => o.trim()).filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) callback(null, true);
    else callback(new Error(`CORS: origin '${origin}' not allowed`));
  },
  methods: ["GET", "POST", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, message: "Too many requests. Try again after 15 minutes." },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true, limit: "10kb" }));

app.get("/", (req, res) => {
  res.json({ success: true, message: "VI Microsystems API is running 🚀" });
});

app.use("/api/contact", (req, res, next) => {
  if (req.method === "POST") return contactLimiter(req, res, next);
  next();
});
app.use("/api/contact", contactRoutes);

app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

app.use((err, req, res, _next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ success: false, message: err.message || "Internal server error" });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`\n🚀  VI Microsystems API`);
  console.log(`   Listening on http://localhost:${PORT}`);
  console.log(`   Environment: ${process.env.NODE_ENV || "development"}\n`);
});