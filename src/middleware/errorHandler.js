export function errorHandler(error, _req, res, _next) {
  console.error(error);

  if (error.name === "CastError") {
    return res.status(400).json({ success: false, message: "Invalid resource identifier." });
  }

  if (error.name === "ValidationError") {
    return res.status(400).json({ success: false, message: error.message });
  }

  res.status(error.status || 500).json({
    success: false,
    message: error.status && error.status < 500 ? error.message : "An unexpected server error occurred."
  });
}
