
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { env } from "../config/env.js";

export async function authenticate(req, res, next) {
  try {
    const authorization = req.headers.authorization;

    if (!authorization?.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Authentication required."
      });
    }

    const token = authorization.slice(7).trim();

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Authentication token is missing."
      });
    }

    let decoded;

    try {
      decoded = jwt.verify(token, env.jwtSecret, {
        algorithms: ["HS256"],
        issuer: "amanah-estates-api",
        audience: "amanah-estates-client"
      });
    } catch {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired authentication token."
      });
    }

    const user = await User.findById(decoded.sub);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User account not found."
      });
    }
    if ((decoded.tokenVersion ?? 0) !== (user.tokenVersion ?? 0)) {
  return res.status(401).json({
    success: false,
    code: "SESSION_REVOKED",
    message: "Your session is no longer valid. Please sign in again."
  });
}

    if (user.accountStatus !== "active") {
      return res.status(403).json({
        success: false,
        message: "This account is currently unavailable."
      });
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
}

export function requireEmailVerified(req, res, next) {
  if (!req.user?.isEmailVerified) {
    return res.status(403).json({
      success: false,
      code: "EMAIL_NOT_VERIFIED",
      message: "Please verify your email address to access this feature."
    });
  }

  next();
}

export function authorizeRoles(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to access this resource."
      });
    }

    next();
  };
}
