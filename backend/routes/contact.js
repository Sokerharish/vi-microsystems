const express = require("express");
const router = express.Router();
const { body, validationResult } = require("express-validator");
const Contact = require("../models/Contact");
const nodemailer = require("nodemailer");

// ─── Email Transporter ────────────────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// ─── Send Notification Email ──────────────────────────────────────────────────
async function sendNotificationEmail(submission) {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: process.env.EMAIL_USER,
    subject: `📩 New Enquiry from ${submission.firstName} ${submission.lastName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
        <div style="background: #0B1B3A; padding: 20px; border-radius: 8px; text-align: center; margin-bottom: 20px;">
          <h1 style="color: #00D4AA; margin: 0; font-size: 24px;">VI Microsystems</h1>
          <p style="color: rgba(255,255,255,0.6); margin: 5px 0 0;">New Contact Form Submission</p>
        </div>
        <table style="width: 100%; border-collapse: collapse;">
          <tr style="background: #f8f9fa;">
            <td style="padding: 12px; font-weight: bold; color: #475569; width: 40%;">Full Name</td>
            <td style="padding: 12px; color: #0F172A;">${submission.firstName} ${submission.lastName}</td>
          </tr>
          <tr>
            <td style="padding: 12px; font-weight: bold; color: #475569;">Email</td>
            <td style="padding: 12px;"><a href="mailto:${submission.email}" style="color: #1A56DB;">${submission.email}</a></td>
          </tr>
          <tr style="background: #f8f9fa;">
            <td style="padding: 12px; font-weight: bold; color: #475569;">Enquiry Type</td>
            <td style="padding: 12px; color: #0F172A;">${submission.enquiryType}</td>
          </tr>
          <tr>
            <td style="padding: 12px; font-weight: bold; color: #475569;">Message</td>
            <td style="padding: 12px; color: #0F172A;">${submission.message}</td>
          </tr>
          <tr style="background: #f8f9fa;">
            <td style="padding: 12px; font-weight: bold; color: #475569;">Submitted At</td>
            <td style="padding: 12px; color: #0F172A;">${new Date(submission.createdAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</td>
          </tr>
        </table>
        <div style="margin-top: 20px; padding: 15px; background: #f0fdf4; border-radius: 8px; border-left: 4px solid #00D4AA;">
          <p style="margin: 0; color: #475569; font-size: 14px;">Sent from VI Microsystems contact form.</p>
        </div>
      </div>
    `,
  };
  await transporter.sendMail(mailOptions);
}

// ─── Validation Rules ─────────────────────────────────────────────────────────
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

// ─── POST - Submit form ───────────────────────────────────────────────────────
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

    sendNotificationEmail(submission).catch(err =>
      console.error("Email notification error:", err)
    );

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

// ─── GET - List all submissions ───────────────────────────────────────────────
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

// ─── GET - Single submission ──────────────────────────────────────────────────
router.get("/:id", async (req, res) => {
  try {
    const submission = await Contact.findById(req.params.id);
    if (!submission) return res.status(404).json({ success: false, message: "Not found" });
    return res.json({ success: true, data: submission });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ─── PATCH - Update status ────────────────────────────────────────────────────
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

// ─── DELETE - Remove submission ───────────────────────────────────────────────
router.delete("/:id", async (req, res) => {
  try {
    const deleted = await Contact.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ success: false, message: "Not found" });
    return res.json({ success: true, message: "Deleted successfully" });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

module.exports = router;