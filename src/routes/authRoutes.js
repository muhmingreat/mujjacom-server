import { Router } from "express";
import { rateLimit } from "express-rate-limit";

import {
  register,
  login,
  getMe,
  verifyEmail,
  resendVerificationEmail,
  updateProfile,
  changePassword,
  forgotPassword,
  resetPassword,
  
} from "../controllers/authController.js";

import { authenticate } from "../middleware/authMiddleware.js";

const router = Router();

const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many registration attempts. Please try again later.",
  },
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many login attempts. Please try again later.",
  },
});

const verificationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many verification attempts. Please try again later.",
  },
});

router.post("/register", registerLimiter, register);
router.post("/login", loginLimiter, login);
router.post("/verify-email", verificationLimiter, verifyEmail);
router.post(
  "/resend-verification-email",
  verificationLimiter,
  resendVerificationEmail,
);
router.post("/forgot-password", verificationLimiter, forgotPassword);
router.post("/reset-password", verificationLimiter, resetPassword);
router.put("/profile", authenticate, updateProfile);
router.get("/me", authenticate, getMe);
router.patch("/change-password", authenticate, changePassword);

export default router;
