
import nodemailer from "nodemailer";
import { env } from "../config/env.js";

function createTransporter() {
  if (env.emailProvider === "gmail") {
    return nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: env.emailUser,
        pass: env.emailPass
      }
    });
  }

  if (env.emailProvider === "resend") {
    return nodemailer.createTransport({
      host: "smtp.resend.com",
      port: 465,
      secure: true,
      auth: {
        user: "resend",
        pass: env.resendApiKey
      }
    });
  }

  throw new Error("Unsupported email provider.");
}

const transporter = createTransporter();

function validateEmailConfiguration() {
  if (env.emailProvider === "gmail") {
    if (!env.emailUser || !env.emailPass) {
      throw new Error("Gmail email credentials are not configured.");
    }
  }

  if (env.emailProvider === "resend" && !env.resendApiKey) {
    throw new Error("Resend API key is not configured.");
  }

  if (!env.mailFrom) {
    throw new Error("Email sender address is not configured.");
  }
}

export async function verifyEmailConnection() {
  validateEmailConfiguration();

  await transporter.verify();

  return true;
}

export async function sendEmail({
  to,
  subject,
  text,
  html
}) {
  validateEmailConfiguration();

  if (!to || !subject || (!text && !html)) {
    throw new Error(
      "Recipient, subject and email content are required."
    );
  }

  const result = await transporter.sendMail({
    from: env.mailFrom,
    to,
    subject,
    text,
    html
  });

  return {
    messageId: result.messageId,
    accepted: result.accepted
  };
}
