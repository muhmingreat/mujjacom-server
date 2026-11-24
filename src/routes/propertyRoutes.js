import { Router } from "express";

import {
  createProperty,
  getMyProperties,
  getMyProperty,
  getProperty,
  listProperties,
  updateMyProperty,
  deleteMyProperty,
  submitMyProperty,
} from "../controllers/propertyController.js";

import {
  authenticate,
  requireEmailVerified,
} from "../middleware/authMiddleware.js";
import {
  uploadPropertyImagesController,
  uploadPropertyVideosController,
} from "../controllers/propertyMediaController.js";

import {
  uploadPropertyImages,
  uploadPropertyVideos,
} from "../middleware/uploadMiddleware.js";
const router = Router();

// Authenticated members can submit properties.
// Email verification is required before submission.
router.post("/", authenticate, requireEmailVerified, createProperty);

// A member can view their own submitted properties.
router.get("/mine", authenticate, getMyProperties);
router.get("/mine/:id", authenticate, getMyProperty);
router.patch("/mine/:id", authenticate, requireEmailVerified, updateMyProperty);
router.delete("/mine/:id", authenticate, requireEmailVerified, deleteMyProperty);
// Upload property images.
router.post(
  "/mine/:id/images",
  authenticate,
  requireEmailVerified,
  uploadPropertyImages,
  uploadPropertyImagesController
);

// Upload property videos.
router.post(
  "/mine/:id/videos",
  authenticate,
  requireEmailVerified,
  uploadPropertyVideos,
  uploadPropertyVideosController
);
// Submit a completed property for review.
router.post(
  "/mine/:id/submit",
  authenticate,
  requireEmailVerified,
  submitMyProperty
);
// Public property listings.
router.get("/", listProperties);
router.get("/:id", getProperty);

export default router;
