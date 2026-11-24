
import { Router } from "express";

import {
  getPendingProperties,
  getAdminProperty,
  approveProperty,
  rejectProperty,
  getAllAdminProperties,
  archiveProperty,
  restoreArchivedProperty,
  unpublishProperty,
  republishProperty
} from "../controllers/adminPropertyController.js";

import {
  authenticate,
  authorizeRoles
} from "../middleware/authMiddleware.js";

const router = Router();

// All routes require an authenticated administrator.
router.use(authenticate);
router.use(authorizeRoles("admin", "superadmin"));

// Review queue.
router.get("/pending", getPendingProperties);

// All properties with filters and pagination.
router.get("/", getAllAdminProperties);

// Property review actions.
router.patch("/:id/approve", approveProperty);
router.patch("/:id/reject", rejectProperty);

// Property lifecycle management.
router.patch("/:id/archive", archiveProperty);
router.patch("/:id/restore", restoreArchivedProperty);
router.patch("/:id/unpublish", unpublishProperty);
router.patch("/:id/republish", republishProperty);

// Individual property inspection.
router.get("/:id", getAdminProperty);

export default router;
