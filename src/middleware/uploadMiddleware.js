
import multer from "multer";

const IMAGE_LIMIT = 10 * 1024 * 1024;
const VIDEO_LIMIT = 100 * 1024 * 1024;

const imageMimeTypes = [
  "image/jpeg",
  "image/png",
  "image/webp"
];

const videoMimeTypes = [
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-m4v",
  "video/x-msvideo",
  "video/avi"
];

const storage = multer.memoryStorage();

function createUpload(allowedTypes, fileSize, maxFiles) {
  return multer({
    storage,
    limits: {
      fileSize,
      files: maxFiles
    },
    fileFilter(req, file, callback) {
      if (!allowedTypes.includes(file.mimetype)) {
        return callback(
          new Error(`Unsupported file type: ${file.originalname}`)
        );
      }

      callback(null, true);
    }
  });
}

// Maximum 10 images, 10 MB each.
export const uploadPropertyImages = createUpload(
  imageMimeTypes,
  IMAGE_LIMIT,
  10
).array("images", 10);

// Maximum 3 videos, 100 MB each.
export const uploadPropertyVideos = createUpload(
  videoMimeTypes,
  VIDEO_LIMIT,
  3
).array("videos", 3);

// ==========================================
// ESTATE MEDIA UPLOADS
// ==========================================

// Estate cover image: maximum 1 image, 10 MB.
export const uploadEstateCoverImage = createUpload(
  imageMimeTypes,
  IMAGE_LIMIT,
  1
).single("coverImage");

// Estate gallery images: maximum 10 images, 10 MB each.
export const uploadEstateGalleryImages = createUpload(
  imageMimeTypes,
  IMAGE_LIMIT,
  10
).array("images", 10);

// Estate gallery videos: maximum 3 videos, 100 MB each.
export const uploadEstateGalleryVideos = createUpload(
  videoMimeTypes,
  VIDEO_LIMIT,
  3
).array("videos", 3);

// Payment evidence: maximum 1 file, 5 MB.
const PAYMENT_EVIDENCE_LIMIT = 5 * 1024 * 1024;

const paymentEvidenceMimeTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf"
];

export const uploadPaymentEvidence = createUpload(
  paymentEvidenceMimeTypes,
  PAYMENT_EVIDENCE_LIMIT,
  1
).single("evidence");