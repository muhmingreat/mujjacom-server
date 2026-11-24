
import { Router } from "express";

import {
  createApplication,
  getMyApplications,
  getMyApplication,
  withdrawApplication
} from "../controllers/applicationController.js";

import {
  authenticate,
  requireEmailVerified
} from "../middleware/authMiddleware.js";

const router = Router();

router.use(authenticate);

// Submit an application for a property.
router.post(
  "/property/:propertyId",
  requireEmailVerified,
  createApplication
);

// Get all applications belonging to the logged-in member.
router.get("/mine", getMyApplications);

// Get one application belonging to the logged-in member.
router.get("/mine/:id", getMyApplication);

// Withdraw an application.
router.patch("/mine/:id/withdraw", withdrawApplication);

export default router;
