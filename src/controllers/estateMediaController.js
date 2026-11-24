
import mongoose from "mongoose";
import Estate from "../models/Estate.js";

import {
  uploadEstateImage,
  uploadEstateVideo,
  deleteEstateImage,
  deleteEstateVideo
} from "../services/uploadService.js";

// ==========================================
// HELPERS
// ==========================================

async function findEstate(id, res) {
  if (!mongoose.isValidObjectId(id)) {
    res.status(400).json({
      success: false,
      message: "Invalid estate ID."
    });
    return null;
  }

  const estate = await Estate.findById(id);

  if (!estate) {
    res.status(404).json({
      success: false,
      message: "Estate not found."
    });
    return null;
  }

  return estate;
}

async function cleanupUploadedAssets(assets = []) {
  await Promise.allSettled(
    assets.map((asset) => {
      if (!asset?.publicId) return Promise.resolve();

      return asset.type === "video"
        ? deleteEstateVideo(asset.publicId)
        : deleteEstateImage(asset.publicId);
    })
  );
}

async function deleteCloudinaryAsset(type, publicId) {
  if (!publicId) return;

  try {
    if (type === "video") {
      await deleteEstateVideo(publicId);
    } else {
      await deleteEstateImage(publicId);
    }
  } catch (error) {
    console.error("Estate media cleanup failed:", error.message);
  }
}

function getUploadedMedia(upload, type) {
  return {
    url: upload.url,
    type,
    publicId: upload.publicId || "",
    caption: ""
  };
}

// ==========================================
// UPLOAD ESTATE COVER IMAGE
// ==========================================

export async function uploadEstateCover(req, res, next) {
  let uploadedAsset = null;

  try {
    const estate = await findEstate(req.params.id, res);
    if (!estate) return;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Please select a cover image."
      });
    }

    uploadedAsset = await uploadEstateImage(req.file.buffer);

    const previousPublicId = estate.coverImagePublicId;

    estate.coverImage = uploadedAsset.url;
    estate.coverImagePublicId = uploadedAsset.publicId;
    estate.updatedBy = req.user?.id || req.user?._id;

    await estate.save();

    // Delete the previous image only after the database update succeeds.
    if (
      previousPublicId &&
      previousPublicId !== uploadedAsset.publicId
    ) {
      await deleteCloudinaryAsset("image", previousPublicId);
    }

    return res.status(200).json({
      success: true,
      message: "Estate cover image uploaded successfully.",
      data: {
        coverImage: estate.coverImage,
        coverImagePublicId: estate.coverImagePublicId
      }
    });
  } catch (error) {
    if (uploadedAsset?.publicId) {
      await cleanupUploadedAssets([
        {
          publicId: uploadedAsset.publicId,
          type: "image"
        }
      ]);
    }

    next(error);
  }
}

// ==========================================
// UPLOAD ESTATE GALLERY IMAGES
// ==========================================

export async function uploadEstateGalleryImages(req, res, next) {
  let uploadedAssets = [];

  try {
    const estate = await findEstate(req.params.id, res);
    if (!estate) return;

    const files = req.files || [];

    if (!files.length) {
      return res.status(400).json({
        success: false,
        message: "Please select at least one gallery image."
      });
    }

    const existingImageCount = estate.gallery.filter(
      (item) => item.type === "image"
    ).length;

    if (existingImageCount + files.length > 10) {
      return res.status(400).json({
        success: false,
        message: "An estate can have a maximum of 10 gallery images."
      });
    }

    const results = await Promise.allSettled(
      files.map((file) => uploadEstateImage(file.buffer))
    );

    uploadedAssets = results
      .filter((result) => result.status === "fulfilled")
      .map((result) => result.value);

    const failedUpload = results.some(
      (result) => result.status === "rejected"
    );

    if (failedUpload) {
      await cleanupUploadedAssets(
        uploadedAssets.map((asset) => ({
          publicId: asset.publicId,
          type: "image"
        }))
      );

      uploadedAssets = [];

      throw (
        results.find((result) => result.status === "rejected")
          ?.reason || new Error("One or more image uploads failed.")
      );
    }

    const media = uploadedAssets.map((asset) =>
      getUploadedMedia(asset, "image")
    );

    estate.gallery.push(...media);
    estate.updatedBy = req.user?.id || req.user?._id;

    await estate.save();

    return res.status(200).json({
      success: true,
      message: "Estate gallery images uploaded successfully.",
      data: {
        gallery: estate.gallery
      }
    });
  } catch (error) {
    if (uploadedAssets.length) {
      await cleanupUploadedAssets(
        uploadedAssets.map((asset) => ({
          publicId: asset.publicId,
          type: "image"
        }))
      );
    }

    next(error);
  }
}

// ==========================================
// UPLOAD ESTATE GALLERY VIDEOS
// ==========================================

export async function uploadEstateGalleryVideos(req, res, next) {
  let uploadedAssets = [];

  try {
    const estate = await findEstate(req.params.id, res);
    if (!estate) return;

    const files = req.files || [];

    if (!files.length) {
      return res.status(400).json({
        success: false,
        message: "Please select at least one gallery video."
      });
    }

    const existingVideoCount = estate.gallery.filter(
      (item) => item.type === "video"
    ).length

    if (existingVideoCount + files.length > 3) {
      return res.status(400).json({
        success: false,
        message: "An estate can have a maximum of 3 gallery videos."
      })
    }

    const results = await Promise.allSettled(
      files.map((file) => uploadEstateVideo(file.buffer))
    );

    uploadedAssets = results
      .filter((result) => result.status === "fulfilled")
      .map((result) => result.value);

    const failedUpload = results.some(
      (result) => result.status === "rejected"
    );

    if (failedUpload) {
      await cleanupUploadedAssets(
        uploadedAssets.map((asset) => ({
          publicId: asset.publicId,
          type: "video"
        }))
      );

      uploadedAssets = [];

      throw (
        results.find((result) => result.status === "rejected")
          ?.reason || new Error("One or more video uploads failed.")
      );
    }

    const media = uploadedAssets.map((asset) =>
      getUploadedMedia(asset, "video")
    );

    estate.gallery.push(...media);
    estate.updatedBy = req.user?.id || req.user?._id;

    await estate.save();

    return res.status(200).json({
      success: true,
      message: "Estate gallery videos uploaded successfully.",
      data: {
        gallery: estate.gallery
      }
    });
  } catch (error) {
    if (uploadedAssets.length) {
      await cleanupUploadedAssets(
        uploadedAssets.map((asset) => ({
          publicId: asset.publicId,
          type: "video"
        }))
      );
    }

    next(error);
  }
}

// ==========================================
// DELETE ESTATE COVER IMAGE
// ==========================================

export async function deleteEstateCover(req, res, next) {
  try {
    const estate = await findEstate(req.params.id, res);
    if (!estate) return;

    if (!estate.coverImage) {
      return res.status(404).json({
        success: false,
        message: "This estate has no cover image."
      });
    }

    const previousPublicId = estate.coverImagePublicId;

    estate.coverImage = "";
    estate.coverImagePublicId = "";
    estate.updatedBy = req.user?.id || req.user?._id;

    await estate.save();

    if (previousPublicId) {
      await deleteCloudinaryAsset("image", previousPublicId);
    }

    return res.status(200).json({
      success: true,
      message: "Estate cover image removed successfully."
    });
  } catch (error) {
    next(error);
  }
}

// ==========================================
// DELETE ESTATE GALLERY MEDIA
// ==========================================

export async function deleteEstateGalleryMedia(req, res, next) {
  try {
    const estate = await findEstate(req.params.id, res);
    if (!estate) return;

    const media = estate.gallery.id(req.params.mediaId);

    if (!media) {
      return res.status(404).json({
        success: false,
        message: "Estate gallery media not found."
      });
    }

    const { publicId, type } = media;

    media.deleteOne();

    estate.updatedBy = req.user?.id || req.user?._id;

    await estate.save();

    if (publicId) {
      await deleteCloudinaryAsset(type, publicId);
    }

    return res.status(200).json({
      success: true,
      message: "Estate gallery media removed successfully.",
      data: {
        gallery: estate.gallery
      }
    });
  } catch (error) {
    next(error);
  }
}
