
import { Router } from "express";

import {
  getPublicEstates,
  getPublicEstateBySlug
} from "../controllers/publicEstateController.js";

const router = Router();

// Public estate listing.
router.get("/", getPublicEstates);

// Public estate details.
router.get("/:slug", getPublicEstateBySlug);

export default router;
