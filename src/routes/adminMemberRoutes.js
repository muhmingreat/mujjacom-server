
import { Router } from "express";

import {
  getAllAdminMembers,
  getAdminMemberStats,
  getAdminMember,
  updateAdminMemberStatus,
  getAdminMemberAuditHistory
} from "../controllers/adminMemberController.js";

import {
  authenticate,
  authorizeRoles
} from "../middleware/authMiddleware.js";

const router = Router();

// Protect all member-management endpoints.
router.use(authenticate);
router.use(authorizeRoles("admin", "superadmin"))

// Get member statistics.
router.get("/stats", getAdminMemberStats);

// Get all members with filters and pagination.
router.get("/", getAllAdminMembers);

// Get one member's details.
router.get("/:id", getAdminMember);
router.get("/:id/audit-history", getAdminMemberAuditHistory);

// Suspend or reactivate a member.
router.patch("/:id/status", updateAdminMemberStatus);

export default router;
