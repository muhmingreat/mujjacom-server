
import { Router } from "express";
import { authenticate } from "../middleware/authMiddleware.js";
import {
  getSavedProperties,
  saveProperty,
  unsaveProperty
} from "../controllers/savedPropertyController.js";

const router = Router();

router.use(authenticate);

router.get("/", getSavedProperties);
router.post("/:propertyId", saveProperty);
router.delete("/:propertyId", unsaveProperty);

export default router;
