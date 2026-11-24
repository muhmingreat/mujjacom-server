import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { randomBytes, createHash } from "node:crypto";

import User from "../models/User.js";
import { env } from "../config/env.js";
import { sendEmail } from "../services/emailService.js";

const SALT_ROUNDS = 12;
const VERIFICATION_TOKEN_EXPIRY = 60 * 60 * 1000;

const PASSWORD_RESET_TOKEN_EXPIRY = 30 * 60 * 1000;

function createAccessToken(user) {
  return jwt.sign(
    {
      sub: user._id.toString(),
      role: user.role,
      tokenVersion: user.tokenVersion ?? 0,
    },
    env.jwtSecret,
    {
      expiresIn: env.jwtExpiresIn,
      issuer: "amanah-estates-api",
      audience: "amanah-estates-client",
    },
  );
}

function publicUser(user) {
  return {
    id: user._id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    phone: user.phone,
    role: user.role,
    isEmailVerified: user.isEmailVerified,
    accountStatus: user.accountStatus,
  };
}

function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

function escapeHtml(value = "") {
  return String(value).replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character],
  );
}

async function sendVerificationEmail(user, token) {
  const verificationUrl = `${env.frontendUrl.replace(/\/+$/, "")}/verify-email?token=${encodeURIComponent(token)}`;

  const firstName = escapeHtml(user.firstName);

  await sendEmail({
    to: user.email,
    subject: "Verify your AMANAH ESTATES account",
    text: `Hello ${user.firstName},

Thank you for registering with AMANAH ESTATES.

Please verify your email address using this link:

${verificationUrl}

This link expires in 60 minutes.

If you did not create this account, you can ignore this email.`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 30px; color: #24352d;">
        <h2 style="color: #0b3d2e;">Welcome to AMANAH ESTATES</h2>
        <p>Hello ${firstName},</p>
        <p>Thank you for creating an account with us.</p>
        <p>Please verify your email address to activate your account.</p>
        <p style="margin: 30px 0;">
          <a href="${verificationUrl}"
             style="background: #0b3d2e; color: #ffffff; padding: 14px 24px; text-decoration: none; border-radius: 6px;">
            Verify My Email
          </a>
        </p>
        <p>This verification link expires in 60 minutes.</p>
        <p>If you did not create this account, you can ignore this email.</p>
        <p style="margin-top: 30px;">AMANAH ESTATES</p>
      </div>
    `,
  });
}

export async function register(req, res, next) {
  try {
    const { firstName, lastName, email, password, phone } = req.body;

    if (
      typeof firstName !== "string" ||
      typeof lastName !== "string" ||
      typeof email !== "string" ||
      typeof password !== "string" ||
      !firstName.trim() ||
      !lastName.trim() ||
      !email.trim() ||
      !password
    ) {
      return res.status(400).json({
        success: false,
        message: "First name, last name, email and password are required.",
      });
    }

    if (password.length < 8 || password.length > 72) {
      return res.status(400).json({
        success: false,
        message: "Password must contain between 8 and 72 characters.",
      });
    }

    if (phone !== undefined && phone !== null && typeof phone !== "string") {
      return res.status(400).json({
        success: false,
        message: "Phone number must be a string.",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const existingUser = await User.findOne({ email: normalizedEmail });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "An account with this email address already exists.",
      });
    }

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    const verificationToken = randomBytes(32).toString("hex");

    const user = await User.create({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: normalizedEmail,
      phone: phone?.trim() || null,
      password: hashedPassword,
      role: "user",
      emailVerificationTokenHash: hashToken(verificationToken),
      emailVerificationExpiresAt: new Date(
        Date.now() + VERIFICATION_TOKEN_EXPIRY,
      ),
    });

    try {
      await sendVerificationEmail(user, verificationToken);
    } catch (emailError) {
      console.error(
        "Registration verification email failed:",
        emailError.message,
      );

      return res.status(503).json({
        success: false,
        code: "VERIFICATION_EMAIL_FAILED",
        message:
          "Your account was created, but the verification email could not be sent. Please request another verification email.",
      });
    }

    return res.status(201).json({
      success: true,
      message:
        "Account created successfully. Please check your email to verify your account.",
      user: publicUser(user),
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "An account with this email address already exists.",
      });
    }

    next(error);
  }
}

export async function verifyEmail(req, res, next) {
  try {
    const { token } = req.body;

    if (typeof token !== "string" || !token.trim()) {
      return res.status(400).json({
        success: false,
        message: "A valid verification token is required.",
      });
    }

    const tokenHash = hashToken(token.trim());

    const user = await User.findOne({
      emailVerificationTokenHash: tokenHash,
      emailVerificationExpiresAt: { $gt: new Date() },
    }).select("+emailVerificationTokenHash +emailVerificationExpiresAt");

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "This verification link is invalid or has expired.",
      });
    }

    user.isEmailVerified = true;
    user.emailVerificationTokenHash = undefined;
    user.emailVerificationExpiresAt = undefined;

    await user.save();

    return res.status(200).json({
      success: true,
      message:
        "Your email address has been verified successfully. You can now log in.",
    });
  } catch (error) {
    next(error);
  }
}

export async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    if (
      typeof email !== "string" ||
      typeof password !== "string" ||
      !email.trim() ||
      !password
    ) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required.",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const user = await User.findOne({ email: normalizedEmail }).select(
      "+password",
    );

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    if (user.accountStatus !== "active") {
      return res.status(403).json({
        success: false,
        message:
          "This account is currently unavailable. Please contact support.",
      });
    }

    if (!user.isEmailVerified) {
      return res.status(403).json({
        success: false,
        code: "EMAIL_NOT_VERIFIED",
        message: "Please verify your email address before logging in.",
      });
    }

    user.lastLoginAt = new Date();
    await user.save();

    const accessToken = createAccessToken(user);

    return res.status(200).json({
      success: true,
      message: "Login successful.",
      token: accessToken,
      user: publicUser(user),
    });
  } catch (error) {
    next(error);
  }
}

export async function getMe(req, res) {
  return res.status(200).json({
    success: true,
    user: {
      id: req.user._id,
      firstName: req.user.firstName,
      lastName: req.user.lastName,
      email: req.user.email,
      phone: req.user.phone,
      role: req.user.role,
      isEmailVerified: req.user.isEmailVerified,
      accountStatus: req.user.accountStatus,
      createdAt: req.user.createdAt,
    },
  });
}

export async function resendVerificationEmail(req, res, next) {
  try {
    const { email } = req.body;

    if (typeof email !== "string" || !email.trim()) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid email address.",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const user = await User.findOne({
      email: normalizedEmail,
      isEmailVerified: false,
      accountStatus: "active",
    });

    // Use the same response whether the account exists or not.
    const message =
      "If an eligible unverified account exists, a verification email will be sent.";

    if (!user) {
      return res.status(200).json({
        success: true,
        message,
      });
    }

    const verificationToken = randomBytes(32).toString("hex");

    user.emailVerificationTokenHash = hashToken(verificationToken);
    user.emailVerificationExpiresAt = new Date(
      Date.now() + VERIFICATION_TOKEN_EXPIRY,
    );

    await user.save();

    try {
      await sendVerificationEmail(user, verificationToken);
    } catch (emailError) {
      console.error("Resend verification email failed:", emailError.message);

      return res.status(503).json({
        success: false,
        message:
          "The verification email could not be sent. Please try again later.",
      });
    }

    return res.status(200).json({
      success: true,
      message,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateProfile(req, res, next) {
  try {
    const { firstName, lastName, phone } = req.body;

    if (
      typeof firstName !== "string" ||
      typeof lastName !== "string" ||
      !firstName.trim() ||
      !lastName.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "First name and last name are required.",
      });
    }

    if (firstName.trim().length > 100 || lastName.trim().length > 100) {
      return res.status(400).json({
        success: false,
        message: "Names must not exceed 100 characters.",
      });
    }

    if (phone !== undefined && phone !== null && typeof phone !== "string") {
      return res.status(400).json({
        success: false,
        message: "Phone number must be a string.",
      });
    }

    if (typeof phone === "string" && phone.trim().length > 30) {
      return res.status(400).json({
        success: false,
        message: "Phone number must not exceed 30 characters.",
      });
    }

    const user = req.user;

    user.firstName = firstName.trim();
    user.lastName = lastName.trim();
    user.phone = phone?.trim() || null;

    await user.save();

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully.",
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        role: user.role,
        isEmailVerified: user.isEmailVerified,
        accountStatus: user.accountStatus,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function changePassword(req, res, next) {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (
      typeof currentPassword !== "string" ||
      typeof newPassword !== "string" ||
      typeof confirmPassword !== "string" ||
      !currentPassword ||
      !newPassword ||
      !confirmPassword
    ) {
      return res.status(400).json({
        success: false,
        message: "All password fields are required.",
      });
    }

    if (newPassword.length < 8 || newPassword.length > 72) {
      return res.status(400).json({
        success: false,
        message: "New password must contain between 8 and 72 characters.",
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "New password and confirmation do not match.",
      });
    }

    if (currentPassword === newPassword) {
      return res.status(400).json({
        success: false,
        message:
          "Your new password must be different from your current password.",
      });
    }

    const user = await User.findById(req.user._id).select("+password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Account not found.",
      });
    }

    const isCurrentPasswordValid = await bcrypt.compare(
      currentPassword,
      user.password,
    );

    if (!isCurrentPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Your current password is incorrect.",
      });
    }

    user.password = await bcrypt.hash(newPassword, SALT_ROUNDS);
    user.tokenVersion = (user.tokenVersion ?? 0) + 1;

    await user.save();

    return res.status(200).json({
      success: true,
      message: "Your password has been changed successfully.",
    });
  } catch (error) {
    next(error);
  }
}

export async function forgotPassword(req, res, next) {
  try {
    const email = req.body?.email;

    if (typeof email !== "string") {
      return res.status(400).json({
        success: false,
        message: "Please provide your email address.",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      return res.status(400).json({
        success: false,
        message: "Please provide your email address.",
      });
    }

    const user = await User.findOne({
      email: normalizedEmail,
      accountStatus: "active",
    });

    const message =
      "If an account with that email exists, a password reset link will be sent.";

    // Use the same response whether the account exists or not.
    if (!user) {
      return res.status(200).json({
        success: true,
        message,
      });
    }

    const resetToken = randomBytes(32).toString("hex");

    user.passwordResetTokenHash = hashToken(resetToken);
    user.passwordResetExpiresAt = new Date(
      Date.now() + PASSWORD_RESET_TOKEN_EXPIRY,
    );

    await user.save();

    const resetUrl = `${env.frontendUrl.replace(/\/+$/, "")}/reset-password?token=${encodeURIComponent(resetToken)}`;

    const firstName = escapeHtml(user.firstName);

    try {
      await sendEmail({
        to: user.email,
        subject: "Reset your AMANAH ESTATES password",
        text: `Hello ${user.firstName},

We received a request to reset your AMANAH ESTATES account password.

Use this link to create a new password:

${resetUrl}

This link expires in 30 minutes.

If you did not request this change, you can ignore this email.`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 30px; color: #24352d;">
            <h2 style="color: #159447;">Password Reset Request</h2>
            <p>Hello ${firstName},</p>
            <p>We received a request to reset your AMANAH ESTATES account password.</p>
            <p style="margin: 30px 0;">
              <a href="${resetUrl}"
                 style="background: #159447; color: #ffffff; padding: 14px 24px; text-decoration: none; border-radius: 6px;">
                Reset My Password
              </a>
            </p>
            <p>This link expires in 30 minutes.</p>
            <p>If you did not request this change, you can ignore this email.</p>
            <p style="margin-top: 30px;">AMANAH ESTATES</p>
          </div>
        `,
      });
    } catch (emailError) {
      // Invalidate the token if the email could not be delivered.
      user.passwordResetTokenHash = undefined;
      user.passwordResetExpiresAt = undefined;
      await user.save();

      console.error("Password reset email failed:", emailError.message);

      return res.status(503).json({
        success: false,
        message:
          "Unable to send the password reset email. Please try again later.",
      });
    }

    return res.status(200).json({
      success: true,
      message,
    });
  } catch (error) {
    next(error);
  }
}


export async function resetPassword(req, res, next) {
  try {
    const { token, newPassword, confirmPassword } = req.body;

    if (
      typeof token !== "string" ||
      !token.trim() ||
      typeof newPassword !== "string" ||
      typeof confirmPassword !== "string" ||
      !newPassword ||
      !confirmPassword
    ) {
      return res.status(400).json({
        success: false,
        message: "Reset token and all password fields are required.",
      });
    }

    if (newPassword.length < 8 || newPassword.length > 72) {
      return res.status(400).json({
        success: false,
        message: "Password must contain between 8 and 72 characters.",
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Password and confirmation do not match.",
      });
    }

    const tokenHash = hashToken(token.trim());

    const user = await User.findOne({
      passwordResetTokenHash: tokenHash,
      passwordResetExpiresAt: { $gt: new Date() },
      accountStatus: "active",
    }).select("+passwordResetTokenHash +passwordResetExpiresAt");

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "This password reset link is invalid or has expired. Please request a new one.",
      });
    }

    user.password = await bcrypt.hash(newPassword, SALT_ROUNDS);

    // Invalidate all previously issued access tokens.
    user.tokenVersion = (user.tokenVersion ?? 0) + 1;

    // Make the reset link unusable after successful password reset.
    user.passwordResetTokenHash = undefined;
    user.passwordResetExpiresAt = undefined;

    await user.save();

    return res.status(200).json({
      success: true,
      message: "Your password has been reset successfully. Please sign in.",
    });
  } catch (error) {
    next(error);
  }
}