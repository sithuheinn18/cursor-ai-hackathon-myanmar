const { initDatabase, insertReport } = require("./db");

const SAMPLE_REPORTS = [
  { area: "Downtown", status: "OFF" },
  { area: "Kamayut", status: "ON" },
  { area: "Bahan", status: "OFF" },
  { area: "Hlaing", status: "ON" },
  { area: "Sanchaung", status: "ON" },
];

async function seed() {
  await initDatabase();

  const inserted = [];
  for (const report of SAMPLE_REPORTS) {
    inserted.push(await insertReport(report.area, report.status));
  }

  console.log(`Seeded ${inserted.length} sample reports:`);
  for (const report of inserted) {
    console.log(`  #${report.id} ${report.area}: ${report.status}`);
  }
}

seed().catch((err) => {
  console.error("Seeding failed:", err.message);
  process.exit(1);
});
