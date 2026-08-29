const express = require("express");
const cors = require("cors");
const { initDatabase } = require("./db");
const reportsRouter = require("./routes/reports");

const PORT = 3000;
const app = express();

app.use(cors());
app.use(express.json());

app.use("/api", reportsRouter);

app.use((_req, res) => {
  res.status(404).json({ success: false, error: "Not found." });
});

async function start() {
  try {
    await initDatabase();
    app.listen(PORT, () => {
      console.log(`VoltPulse API listening on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error("Failed to start server:", err.message);
    process.exit(1);
  }
}

start();
