
import mongoose from "mongoose";
import Property from "../models/Property.js";

const VALID_RECURRING_FREQUENCIES = [
  "monthly",
  "quarterly",
  "biannually",
  "annually"
];

function isValidPriceFrequency(transactionType, priceFrequency) {
  if (transactionType === "sale") {
    return priceFrequency === "one_time";
  }

  if (["rent", "lease"].includes(transactionType)) {
    return VALID_RECURRING_FREQUENCIES.includes(priceFrequency);
  }

  return false;
}

// Public property listings.
export async function listProperties(req, res, next) {
  try {
    const {
      q,
      transactionType,
      propertyType,
      state,
      page = 1,
      limit = 12
    } = req.query;

    const filter = { status: "published" };

    if (transactionType) filter.transactionType = transactionType;
    if (propertyType) filter.propertyType = propertyType;

    if (state) {
      filter["location.state"] = new RegExp(
        `^${escapeRegex(state)}$`,
        "i"
      );
    }

    if (q) filter.$text = { $search: q };

    const safePage = Math.max(1, Number.parseInt(page, 10) || 1);
    const safeLimit = Math.min(
      50,
      Math.max(1, Number.parseInt(limit, 10) || 12)
    );

    const [items, total] = await Promise.all([
      Property.find(filter)
        .select("-__v")
        .sort({ publishedAt: -1, createdAt: -1 })
        .skip((safePage - 1) * safeLimit)
        .limit(safeLimit)
        .lean(),

      Property.countDocuments(filter)
    ]);

    res.json({
      success: true,
      data: items,
      pagination: {
        page: safePage,
        limit: safeLimit,
        total,
        pages: Math.ceil(total / safeLimit)
      }
    });
  } catch (error) {
    next(error);
  }
}

// Get one public property.
export async function getProperty(req, res, next) {
  try {
    const property = await Property.findOne({
      _id: req.params.id,
      status: "published"
    })
      .select("-__v")
      .lean();

    if (!property) {
      return res.status(404).json({
        success: false,
        message: "Property not found."
      });
    }

    res.json({ success: true, data: property });
  } catch (error) {
    next(error);
  }
}

// Create a property draft.
// export async function createProperty(req, res, next) {
//   try {
//     const {
//       title,
//       description,
//       propertyType,
//       transactionType,
//       price,
//       priceFrequency,
//       currency,
//       location,
//       landSize,
//       bedrooms,
//       bathrooms,
//       features
//     } = req.body;

//     if (
//       !title?.trim() ||
//       !["land", "house", "apartment", "commercial", "other"].includes(propertyType) ||
//       !["sale", "lease", "rent"].includes(transactionType)
//     ) {
//       return res.status(400).json({
//         success: false,
//         message: "Please provide a title, valid property type and transaction type."
//       });
//     }
//     if (!isValidPriceFrequency(transactionType, priceFrequency)) {
//   return res.status(400).json({
//     success: false,
//     message:
//       transactionType === "sale"
//         ? "Sale properties must use a one-time price frequency."
//         : "Rental and lease properties must have a valid recurring price frequency."
//   });
// }

// const nextTransactionType = transactionType ?? property.transactionType;

// const transactionTypeChanged =
//   transactionType !== undefined &&
//   transactionType !== property.transactionType;

// if (
//   priceFrequency !== undefined ||
//   transactionTypeChanged
// ) {
//   const nextPriceFrequency =
//     priceFrequency !== undefined
//       ? priceFrequency
//       : property.priceFrequency;

//   if (!isValidPriceFrequency(nextTransactionType, nextPriceFrequency)) {
//     return res.status(400).json({
//       success: false,
//       message:
//         nextTransactionType === "sale"
//           ? "Sale properties must use a one-time price frequency."
//           : "Rental and lease properties must have a valid recurring price frequency."
//     });
//   }
// }
//     const property = await Property.create({
//       owner: req.user._id,
//       title: title.trim(),
//       description,
//       propertyType,
//       transactionType,
//       price,
//       priceFrequency,
//       currency: currency || "NGN",
//       location,
//       landSize,
//       bedrooms,
//       bathrooms,
//       features,
//       status: "draft",
//       verificationStatus: "not_submitted"
//     });

//     res.status(201).json({
//       success: true,
//       message: "Property draft created successfully.",
//       data: property
//     });
//   } catch (error) {
//     next(error);
//   }
// }


export async function createProperty(req, res, next) {
  try {
    const {
      title,
      description,
      propertyType,
      transactionType,
      price,
      priceFrequency,
      currency,
      location,
      landSize,
      bedrooms,
      bathrooms,
      features
    } = req.body;

    if (
      !title?.trim() ||
      !["land", "house", "apartment", "commercial", "other"].includes(propertyType) ||
      !["sale", "lease", "rent"].includes(transactionType)
    ) {
      return res.status(400).json({
        success: false,
        message: "Please provide a title, valid property type and transaction type."
      });
    }

    if (!isValidPriceFrequency(transactionType, priceFrequency)) {
      return res.status(400).json({
        success: false,
        message:
          transactionType === "sale"
            ? "Sale properties must use a one-time price frequency."
            : "Rental and lease properties must have a valid recurring price frequency."
      });
    }

    const property = await Property.create({
      owner: req.user._id,
      title: title.trim(),
      description,
      propertyType,
      transactionType,
      price,
      priceFrequency,
      currency: currency || "NGN",
      location,
      landSize,
      bedrooms,
      bathrooms,
      features,
      status: "draft",
      verificationStatus: "not_submitted"
    });

    res.status(201).json({
      success: true,
      message: "Property draft created successfully.",
      data: property
    });
  } catch (error) {
    next(error);
  }
}


// Get the authenticated member's properties.
export async function getMyProperties(req, res, next) {
  try {
    const properties = await Property.find({
      owner: req.user._id
    })
      .select("-__v")
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      success: true,
      data: properties
    });
  } catch (error) {
    next(error);
  }
}

// Get one property belonging to the authenticated member.
export async function getMyProperty(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid property ID."
      });
    }

    const property = await Property.findOne({
      _id: req.params.id,
      owner: req.user._id
    })
      .select("-__v")
      .lean();

    if (!property) {
      return res.status(404).json({
        success: false,
        message: "Property not found."
      });
    }

    res.json({
      success: true,
      data: property
    });
  } catch (error) {
    next(error);
  }
}

// Escape special characters in search expressions.
function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}


export async function updateMyProperty(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid property ID."
      });
    }

    const property = await Property.findOne({
      _id: req.params.id,
      owner: req.user._id
    });

    if (!property) {
      return res.status(404).json({
        success: false,
        message: "Property not found or you do not have permission to edit it."
      });
    }

    const {
      title,
      description,
      propertyType,
      transactionType,
      price,
      priceFrequency,
      currency,
      location,
      landSize,
      bedrooms,
      bathrooms,
      features
    } = req.body;

    if (
      title !== undefined &&
      (typeof title !== "string" || !title.trim() || title.trim().length > 160)
    ) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid property title."
      });
    }

    if (
      propertyType !== undefined &&
      !["land", "house", "apartment", "commercial", "other"].includes(propertyType)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid property type."
      });
    }

    if (
      transactionType !== undefined &&
      !["sale", "lease", "rent"].includes(transactionType)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid transaction type."
      });
    }

    const nextTransactionType =
      transactionType !== undefined
        ? transactionType
        : property.transactionType;

    const transactionTypeChanged =
      transactionType !== undefined &&
      transactionType !== property.transactionType;

    if (
      priceFrequency !== undefined ||
      transactionTypeChanged
    ) {
      const nextPriceFrequency =
        priceFrequency !== undefined
          ? priceFrequency
          : property.priceFrequency;

      if (
        !isValidPriceFrequency(
          nextTransactionType,
          nextPriceFrequency
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            nextTransactionType === "sale"
              ? "Sale properties must use a one-time price frequency."
              : "Rental and lease properties must have a valid recurring price frequency."
        });
      }
    }

    if (title !== undefined) property.title = title.trim();
    if (description !== undefined) property.description = description;
    if (propertyType !== undefined) property.propertyType = propertyType;
    if (transactionType !== undefined) property.transactionType = transactionType;
    if (price !== undefined) property.price = price;
    if (priceFrequency !== undefined) property.priceFrequency = priceFrequency;
    if (currency !== undefined) property.currency = currency;
    if (location !== undefined) property.location = location;
    if (landSize !== undefined) property.landSize = landSize;
    if (bedrooms !== undefined) property.bedrooms = bedrooms;
    if (bathrooms !== undefined) property.bathrooms = bathrooms;
    if (features !== undefined) property.features = features;

    await property.save();

    return res.json({
      success: true,
      message: "Property updated successfully.",
      data: property
    });
  } catch (error) {
    next(error);
  }
}


// Submit a property for review.
export async function submitMyProperty(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid property ID."
      });
    }

    const property = await Property.findOne({
      _id: req.params.id,
      owner: req.user._id
    });

    if (!property) {
      return res.status(404).json({
        success: false,
        message: "Property not found or you do not have permission to submit it."
      });
    }

    if (
      ["pending_review", "under_review", "verified"].includes(
        property.verificationStatus
      )
    ) {
      return res.status(409).json({
        success: false,
        message: "This property has already been submitted or reviewed."
      });
    }

    if (!Array.isArray(property.media) || property.media.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Upload at least one property image or video before submitting."
      });
    }

    property.verificationStatus = "pending_review";

    await property.save();

    return res.json({
      success: true,
      message: "Your property has been submitted successfully and is awaiting review.",
      data: property
    });
  } catch (error) {
    next(error);
  }
}

// Delete a property belonging to the authenticated member.
export async function deleteMyProperty(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid property ID."
      });
    }

    const property = await Property.findOneAndDelete({
      _id: req.params.id,
      owner: req.user._id
    });

    if (!property) {
      return res.status(404).json({
        success: false,
        message: "Property not found or you do not have permission to delete it."
      });
    }

    return res.json({
      success: true,
      message: "Property deleted successfully."
    });
  } catch (error) {
    next(error);
  }
}
