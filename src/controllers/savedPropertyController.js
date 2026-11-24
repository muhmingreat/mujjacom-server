
import mongoose from "mongoose";
import SavedProperty from "../models/SavedProperty.js";
import Property from "../models/Property.js";

export async function getSavedProperties(req, res, next) {
  try {
    const savedProperties = await SavedProperty.find({
      user: req.user._id
    })
      .sort({ createdAt: -1 })
      .populate({
        path: "property",
        match: { status: "published" },
        select: "-__v"
      })
      .lean();

    const data = savedProperties
      .filter(item => item.property)
      .map(item => ({
        savedPropertyId: item._id,
        savedAt: item.createdAt,
        ...item.property
      }));

    res.json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
}

export async function saveProperty(req, res, next) {
  try {
    const { propertyId } = req.params;

    if (!mongoose.isValidObjectId(propertyId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid property ID."
      });
    }

    const property = await Property.findOne({
      _id: propertyId,
      status: "published"
    }).select("_id");

    if (!property) {
      return res.status(404).json({
        success: false,
        message: "Property not found or unavailable."
      });
    }

    try {
      await SavedProperty.create({
        user: req.user._id,
        property: property._id
      });
    } catch (error) {
      if (error.code !== 11000) throw error;
    }

    res.status(200).json({
      success: true,
      message: "Property saved successfully."
    });
  } catch (error) {
    next(error);
  }
}

export async function unsaveProperty(req, res, next) {
  try {
    const { propertyId } = req.params;

    if (!mongoose.isValidObjectId(propertyId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid property ID."
      });
    }

    await SavedProperty.deleteOne({
      user: req.user._id,
      property: propertyId
    });

    res.json({
      success: true,
      message: "Property removed from saved properties."
    });
  } catch (error) {
    next(error);
  }
}
