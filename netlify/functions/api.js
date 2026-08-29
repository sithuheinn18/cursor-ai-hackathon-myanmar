const express = require("express");
const serverless = require("serverless-http");
const cors = require("cors");
const { getStore } = require("@netlify/blobs");

const app = express();
app.use(cors());
app.use(express.json());

function getReportsStore() {
  return getStore({
    name: "voltpulse_reports",
    consistency: "strong",
  });
}

function getSeedReports() {
  return [
    {
      id: 1,
      township: "Kamayut",
      status: "OFF",
      timestamp: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
    },
    {
      id: 2,
      township: "Downtown",
      status: "ON",
      timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    },
    {
      id: 3,
      township: "Bahan",
      status: "ON",
      timestamp: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    },
  ];
}

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

async function readReports(store) {
  const reports = await store.get("reports", { type: "json" });
  if (!Array.isArray(reports)) {
    return getSeedReports();
  }
  return reports;
}

async function handleStatus(_req, res) {
  try {
    const store = getReportsStore();
    const reports = await store.get("reports", { type: "json" });
    res.json(Array.isArray(reports) ? reports : getSeedReports());
  } catch (err) {
    console.error("GET /api/status failed:", err.message);
    res.status(500).json({
      success: false,
      error: "Unable to fetch status reports.",
    });
  }
}

async function handleReport(req, res) {
  try {
    const townshipRaw =
      typeof req.body?.township === "string"
        ? req.body.township
        : typeof req.body?.area === "string"
          ? req.body.area
          : "";
    const township = townshipRaw.trim();
    const status = normalizeStatus(req.body?.status);

    if (!township) {
      res.status(400).json({
        success: false,
        error: "township is required and must be a non-empty string.",
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

    const store = getReportsStore();
    const existing = await readReports(store);
    const report = {
      id: Date.now(),
      township,
      status,
      timestamp: new Date().toISOString(),
    };
    const updatedReports = [report, ...existing];
    await store.setJSON("reports", updatedReports);

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
}

app.get("/api/status", handleStatus);
app.get("/status", handleStatus);
app.post("/api/report", handleReport);
app.post("/report", handleReport);

module.exports.handler = serverless(app);
