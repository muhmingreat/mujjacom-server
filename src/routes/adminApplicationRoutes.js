
import { Router } from "express";

import {
  getAllAdminApplications,
  getAdminApplication,
  updateAdminApplication
} from "../controllers/adminApplicationController.js";

import {
  authenticate,
  authorizeRoles
} from "../middleware/authMiddleware.js";

const router = Router();

// Protect all administrative application endpoints.
router.use(authenticate);
router.use(authorizeRoles("admin", "superadmin"));

// Get all applications with filters and pagination.
router.get("/", getAllAdminApplications);

// Get one application's details.
router.get("/:id", getAdminApplication);

// Update application status and review note.
router.patch("/:id", updateAdminApplication);

export default router;
