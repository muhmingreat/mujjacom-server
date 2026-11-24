
import { Router } from "express";

import {
  getAllAdminEstates,
  getAdminEstate,
  createEstate,
  updateEstate,
  publishEstate,
  archiveEstate,
  restoreEstate
} from "../controllers/estateController.js";

import {
  uploadEstateCover,
  uploadEstateGalleryImages,
  uploadEstateGalleryVideos,
  deleteEstateCover,
  deleteEstateGalleryMedia
} from "../controllers/estateMediaController.js";

import {
  authenticate,
  authorizeRoles
} from "../middleware/authMiddleware.js";

import {
  uploadEstateCoverImage,
  uploadEstateGalleryImages as uploadEstateGalleryImagesMiddleware,
  uploadEstateGalleryVideos as uploadEstateGalleryVideosMiddleware
} from "../middleware/uploadMiddleware.js";

const router = Router();

// All estate administration routes require an authenticated administrator.
router.use(authenticate);
router.use(authorizeRoles("admin", "superadmin"));

// Estate listing and creation.
router.get("/", getAllAdminEstates);
router.post("/", createEstate);

// Estate cover image management.
router.post(
  "/:id/cover-image",
  uploadEstateCoverImage,
  uploadEstateCover
);

router.delete(
  "/:id/cover-image",
  deleteEstateCover
);

// Estate gallery media uploads.
router.post(
  "/:id/gallery/images",
  uploadEstateGalleryImagesMiddleware,
  uploadEstateGalleryImages
);

router.post(
  "/:id/gallery/videos",
  uploadEstateGalleryVideosMiddleware,
  uploadEstateGalleryVideos
);

// Delete an individual gallery item.
router.delete(
  "/:id/gallery/:mediaId",
  deleteEstateGalleryMedia
);

// Estate lifecycle management.
router.patch("/:id/publish", publishEstate);
router.patch("/:id/archive", archiveEstate);
router.patch("/:id/restore", restoreEstate);

// Estate editing and individual inspection.
router.patch("/:id", updateEstate);
router.get("/:id", getAdminEstate);

export default router;
