import multer from "multer";

const allowedMimeTypes = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const upload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 1,
  },

  fileFilter: (_req, file, callback) => {
    if (!allowedMimeTypes.has(file.mimetype)) {
      return callback(
        new Error("Only PDF, JPEG, PNG, and WebP documents are allowed.")
      );
    }

    callback(null, true);
  },
});

export const uploadDueDiligenceDocument = upload.single("document");