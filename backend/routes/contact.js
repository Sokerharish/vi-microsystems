const express = require("express");
const router = express.Router();
const { body, validationResult } = require("express-validator");
const Contact = require("../models/Contact");

const contactValidation = [
  body("firstName").trim().notEmpty().withMessage("First name is required").isLength({ max: 50 }),
  body("lastName").trim().notEmpty().withMessage("Last name is required").isLength({ max: 50 }),
  body("email").trim().notEmpty().withMessage("Email is required").isEmail().withMessage("Invalid email").normalizeEmail(),
  body("enquiryType").notEmpty().withMessage("Enquiry type is required").isIn([
    "Product / Services Inquiry", "ECE Internship", "EEE Internship",
    "CSE Internship", "R&D Consulting", "Other",
  ]),
  body("message").trim().notEmpty().withMessage("Message is required").isLength({ min: 10, max: 2000 }),
];

// POST - Submit form
router.post("/", contactValidation, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({
      success: false,
      message: "Validation failed",
      errors: errors.array().map((e) => ({ field: e.path, message: e.msg })),
    });
  }
  try {
    const { firstName, lastName, email, enquiryType, message } = req.body;
    const submission = await Contact.create({
      firstName, lastName, email, enquiryType, message,
      ipAddress: req.ip,
    });
    return res.status(201).json({
      success: true,
      message: "Thank you! Your message has been received. We'll get back to you shortly.",
      data: {
        id: submission._id,
        name: `${submission.firstName} ${submission.lastName}`,
        enquiryType: submission.enquiryType,
        submittedAt: submission.createdAt,
      },
    });
  } catch (err) {
    console.error("Contact submission error:", err);
    return res.status(500).json({ success: false, message: "Something went wrong. Please try again later." });
  }
});

// GET - List all submissions
router.get("/", async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 20);
    const skip  = (page - 1) * limit;
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.enquiryType) filter.enquiryType = req.query.enquiryType;
    const [submissions, total] = await Promise.all([
      Contact.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).select("-ipAddress"),
      Contact.countDocuments(filter),
    ]);
    return res.json({
      success: true,
      data: submissions,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// GET - Single submission
router.get("/:id", async (req, res) => {
  try {
    const submission = await Contact.findById(req.params.id);
    if (!submission) return res.status(404).json({ success: false, message: "Not found" });
    return res.json({ success: true, data: submission });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// PATCH - Update status
router.patch("/:id/status", async (req, res) => {
  const { status } = req.body;
  if (!["new", "read", "replied"].includes(status)) {
    return res.status(400).json({ success: false, message: "Invalid status value" });
  }
  try {
    const updated = await Contact.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!updated) return res.status(404).json({ success: false, message: "Not found" });
    return res.json({ success: true, data: updated });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

module.exports = router;