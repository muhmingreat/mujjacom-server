
import cloudinary, {
  isCloudinaryConfigured
} from "../config/cloudinary.js";

 export function uploadToCloudinary(
  fileBuffer,
  resourceType,
  folder,
  uploadOptions = {}
) {
  if (!isCloudinaryConfigured()) {
    throw new Error("Cloudinary is not configured.");
  }

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: resourceType,

        ...uploadOptions,

        allowed_formats:
          resourceType === "image"
            ? ["jpg", "jpeg", "png", "webp"]
            : resourceType === "video"
              ? ["mp4", "webm", "mov", "m4v", "avi"]
              : ["pdf"],

        ...(resourceType === "image" && {
          transformation: [
            {
              width: 2000,
              height: 2000,
              crop: "limit",
              quality: "auto",
              fetch_format: "auto"
            }
          ]
        })
      },
      (error, result) => {
        if (error) return reject(error);

        resolve({
          url: result.secure_url,
          publicId: result.public_id,
          resourceType: result.resource_type,
          format: result.format,
          width: result.width || null,
          height: result.height || null,
          duration: result.duration || null
        });
      }
    );

    uploadStream.end(fileBuffer);
  });
}

export function uploadPropertyImage(fileBuffer) {
  return uploadToCloudinary(
    fileBuffer,
    "image",
    "amanah-estates/properties/images"
  );
}

export function uploadPropertyVideo(fileBuffer) {
  return uploadToCloudinary(
    fileBuffer,
    "video",
    "amanah-estates/properties/videos"
  );
}

export async function deletePropertyImage(publicId) {
  if (!isCloudinaryConfigured()) {
    throw new Error("Cloudinary is not configured.");
  }

  return cloudinary.uploader.destroy(publicId, {
    resource_type: "image"
  });
}

export async function deletePropertyVideo(publicId) {
  if (!isCloudinaryConfigured()) {
    throw new Error("Cloudinary is not configured.");
  }

  return cloudinary.uploader.destroy(publicId, {
    resource_type: "video"
  });
}

export function uploadPaymentEvidence(fileBuffer, mimetype) {
  const resourceType =
    mimetype === "application/pdf" ? "raw" : "image";

  return uploadToCloudinary(
    fileBuffer,
    resourceType,
    "amanah-estates/transaction-payments/evidence",
    {
      type: "authenticated"
    }
  );
}


export function createPaymentEvidenceAccessUrl(
  publicId,
  format,
  resourceType
) {
  if (!isCloudinaryConfigured()) {
    throw new Error("Cloudinary is not configured.");
  }

  const expiresAt = Math.floor(Date.now() / 1000) + 300;

  return cloudinary.utils.private_download_url(
    publicId,
    format,
    {
      resource_type: resourceType,
      type: "authenticated",
      expires_at: expiresAt
    }
  );
}

// ==========================================
// ESTATE MEDIA UPLOADS
// ==========================================

export function uploadEstateImage(fileBuffer) {
  return uploadToCloudinary(
    fileBuffer,
    "image",
    "amanah-estates/estates/images"
  );
}

export function uploadEstateVideo(fileBuffer) {
  return uploadToCloudinary(
    fileBuffer,
    "video",
    "amanah-estates/estates/videos"
  );
}

export async function deleteEstateImage(publicId) {
  if (!isCloudinaryConfigured()) {
    throw new Error("Cloudinary is not configured.");
  }

  return cloudinary.uploader.destroy(publicId, {
    resource_type: "image"
  });
}

export async function deleteEstateVideo(publicId) {
  if (!isCloudinaryConfigured()) {
    throw new Error("Cloudinary is not configured.");
  }

  return cloudinary.uploader.destroy(publicId, {
    resource_type: "video"
  });
}