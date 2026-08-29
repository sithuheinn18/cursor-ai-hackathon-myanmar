const express = require("express");
const serverless = require("serverless-http");
const cors = require("cors");
const { getStore } = require("@netlify/blobs");

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

let globalReports = null;

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

function parseBody(req) {
  const raw = req.body;
  if (raw == null || raw === "") {
    return {};
  }
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }
  if (Buffer.isBuffer(raw)) {
    try {
      return JSON.parse(raw.toString("utf8"));
    } catch {
      return {};
    }
  }
  if (typeof raw === "object") {
    return raw;
  }
  return {};
}

function isPopulatedReports(reports) {
  return Array.isArray(reports) && reports.length > 0;
}

async function handleStatus(_req, res) {
  try {
    const store = getStore("voltpulse_reports");
    const reports = await store.get("reports", { type: "json" });
    if (isPopulatedReports(reports)) {
      globalReports = reports;
      res.json(reports);
      return;
    }
  } catch {
    // Fall through to in-memory or seed data.
  }

  if (isPopulatedReports(globalReports)) {
    res.json(globalReports);
    return;
  }

  res.json(getSeedReports());
}

async function handleReport(req, res) {
  const body = parseBody(req);
  const township = String(body.township || body.area || "").trim();
  const status = String(body.status || "")
    .trim()
    .toUpperCase();

  const report = {
    id: Date.now(),
    township,
    status,
    timestamp: new Date().toISOString(),
  };

  const existing = isPopulatedReports(globalReports)
    ? globalReports
    : getSeedReports();
  globalReports = [report, ...existing];

  try {
    const store = getStore("voltpulse_reports");
    await store.setJSON("reports", globalReports);
  } catch {
    // Ignore Blobs failures; the in-memory list is still returned.
  }

  res.status(200).json({ success: true, reports: globalReports });
}

app.get("/api/status", handleStatus);
app.get("/status", handleStatus);
app.post("/api/report", handleReport);
app.post("/report", handleReport);

module.exports.handler = serverless(app);
