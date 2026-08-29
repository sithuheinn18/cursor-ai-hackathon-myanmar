const express = require("express");
const { insertReport, getLatestStatusByArea } = require("../db");

const router = express.Router();

function normalizeStatus(status) {
  if (typeof status !== "string") {
    return null;
  }
  const value = status.trim().toUpperCase();
  if (value !== "ON" && value !== "OFF") {
    return null;
  }
  return value;
}

router.post("/report", async (req, res) => {
  try {
    const area =
      typeof req.body.area === "string" ? req.body.area.trim() : "";
    const status = normalizeStatus(req.body.status);

    if (!area) {
      res.status(400).json({
        success: false,
        error: "area is required and must be a non-empty string.",
      });
      return;
    }

    if (!status) {
      res.status(400).json({
        success: false,
        error: "status is required and must be 'ON' or 'OFF'.",
      });
      return;
    }

    const report = await insertReport(area, status);
    res.status(201).json({
      success: true,
      message: "Report saved.",
      report,
    });
  } catch (err) {
    console.error("POST /api/report failed:", err.message);
    res.status(500).json({
      success: false,
      error: "Unable to save report.",
    });
  }
});

router.get("/status", async (_req, res) => {
  try {
    const reports = await getLatestStatusByArea();
    res.json(reports);
  } catch (err) {
    console.error("GET /api/status failed:", err.message);
    res.status(500).json({
      success: false,
      error: "Unable to fetch status reports.",
    });
  }
});

module.exports = router;
