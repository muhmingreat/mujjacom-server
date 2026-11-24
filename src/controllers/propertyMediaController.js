
import mongoose from "mongoose";
import Property from "../models/Property.js";

import {
  uploadPropertyImage,
  uploadPropertyVideo,
  deletePropertyImage,
  deletePropertyVideo
} from "../services/uploadService.js";

async function findOwnedProperty(propertyId, userId) {
  if (!mongoose.isValidObjectId(propertyId)) {
    return null;
  }

  return Property.findOne({
    _id: propertyId,
    owner: userId
  });
}

async function cleanupUploads(items, type) {
  await Promise.allSettled(
    items.map((item) =>
      type === "image"
        ? deletePropertyImage(item.publicId)
        : deletePropertyVideo(item.publicId)
    )
  );
}

export async function uploadPropertyImagesController(req, res, next) {
  const uploaded = [];

  try {
    const files = req.files || [];

    if (!files.length) {
      return res.status(400).json({
        success: false,
        message: "Please select at least one image."
      });
    }

    const property = await findOwnedProperty(
      req.params.id,
      req.user._id
    );

    if (!property) {
      return res.status(404).json({
        success: false,
        message: "Property not found or you do not have permission to edit it."
      });
    }

    const existingImages = property.media.filter(
      (item) => item.type === "image"
    ).length;

    if (existingImages + files.length > 10) {
      return res.status(400).json({
        success: false,
        message: "A property can have a maximum of 10 images."
      });
    }

    for (const file of files) {
      const result = await uploadPropertyImage(file.buffer);

      uploaded.push({
        url: result.url,
        type: "image",
        publicId: result.publicId,
        format: result.format,
        width: result.width,
        height: result.height
      });
    }

    property.media.push(...uploaded);

    if (!property.coverImage && uploaded.length) {
      property.coverImage = uploaded[0].url;
    }

    await property.save();

    return res.status(201).json({
      success: true,
      message: "Property images uploaded successfully.",
      data: property
    });
  } catch (error) {
    await cleanupUploads(uploaded, "image");
    next(error);
  }
}

export async function uploadPropertyVideosController(req, res, next) {
  const uploaded = [];

  try {
    const files = req.files || [];

    if (!files.length) {
      return res.status(400).json({
        success: false,
        message: "Please select at least one video."
      });
    }

    const property = await findOwnedProperty(
      req.params.id,
      req.user._id
    );

    if (!property) {
      return res.status(404).json({
        success: false,
        message: "Property not found or you do not have permission to edit it."
      });
    }

    const existingVideos = property.media.filter(
      (item) => item.type === "video"
    ).length;

    if (existingVideos + files.length > 3) {
      return res.status(400).json({
        success: false,
        message: "A property can have a maximum of 3 videos."
      });
    }

    for (const file of files) {
      const result = await uploadPropertyVideo(file.buffer);

      uploaded.push({
        url: result.url,
        type: "video",
        publicId: result.publicId,
        format: result.format,
        duration: result.duration
      });
    }

    property.media.push(...uploaded);

    await property.save();

    return res.status(201).json({
      success: true,
      message: "Property videos uploaded successfully.",
      data: property
    });
  } catch (error) {
    await cleanupUploads(uploaded, "video");
    next(error);
  }
}
