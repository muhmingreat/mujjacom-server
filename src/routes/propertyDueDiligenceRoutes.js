import express from "express";
import { authenticate, authorizeRoles } from "../middleware/authMiddleware.js";
import {
  uploadDueDiligenceDocument,
} from "../middleware/dueDiligenceUploadMiddleware.js";

import {
  getMyDueDiligenceCases,
  getMyPropertyDueDiligence,
  uploadMyDueDiligenceDocument,
  getDueDiligenceDocumentAccess,
  getAdminDueDiligenceCases,
  getAdminDueDiligenceCase,
  reviewDueDiligenceDocument,
} from "../controllers/propertyDueDiligenceController.js";

const router = express.Router();

router.use(authenticate);

// Member endpoints
router.get("/mine", getMyDueDiligenceCases);

router.get(
  "/mine/property/:propertyId",
  getMyPropertyDueDiligence
);

router.post(
  "/mine/property/:propertyId/documents",
  uploadDueDiligenceDocument,
  uploadMyDueDiligenceDocument
);

router.get(
  "/mine/:caseId/documents/:documentId/access",
  getDueDiligenceDocumentAccess
);

// Admin endpoints
router.get(
  "/admin",
  authorizeRoles("admin", "superadmin"),
  getAdminDueDiligenceCases
);

router.get(
  "/admin/:caseId",
  authorizeRoles("admin", "superadmin"),
  getAdminDueDiligenceCase
);

router.get(
  "/admin/:caseId/documents/:documentId/access",
  authorizeRoles("admin", "superadmin"),
  getDueDiligenceDocumentAccess
);

router.patch(
  "/admin/:caseId/documents/:documentId/review",
  authorizeRoles("admin", "superadmin"),
  reviewDueDiligenceDocument
);

export default router;