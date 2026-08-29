const API_BASE = "";

const BATTERY_VOLTS = 12;
const BATTERY_EFFICIENCY = 0.8;
const OUTAGE_DURATION_MS = 4 * 60 * 60 * 1000;

const connectionBadge = document.getElementById("connection-badge");
const connectionLabel = document.getElementById("connection-label");
const townshipSelect = document.getElementById("township");
const feed = document.getElementById("status-feed");
const btnOn = document.getElementById("btn-power-on");
const btnOff = document.getElementById("btn-power-off");
const batteryAh = document.getElementById("battery-ah");
const powerWatts = document.getElementById("power-watts");
const hoursLeft = document.getElementById("hours-left");
const toastRegion = document.getElementById("toast-region");

function setConnectionState(online) {
  connectionBadge.dataset.state = online ? "online" : "offline";
  connectionLabel.textContent = online ? "Online" : "Offline";
}

function formatTime(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Just now";
  }
  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function normalizeReports(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }
  if (payload && Array.isArray(payload.reports)) {
    return payload.reports;
  }
  return [];
}

function isPowerOn(status) {
  return String(status).toUpperCase() === "ON";
}

function formatRemaining(ms) {
  if (ms <= 0) {
    return "0 min";
  }

  const totalMins = Math.floor(ms / 60000);
  const hours = Math.floor(totalMins / 60);
  const mins = totalMins % 60;

  if (hours > 0 && mins > 0) {
    return `${hours}h ${mins}m`;
  }
  if (hours > 0) {
    return `${hours}h`;
  }
  return `${mins} min`;
}

function getEstimatedReturnLabel(report) {
  if (isPowerOn(report.status)) {
    return "⚡ Grid Active";
  }

  const reportTime = new Date(report.timestamp);
  const returnTime = Number.isNaN(reportTime.getTime())
    ? new Date(Date.now() + OUTAGE_DURATION_MS)
    : new Date(reportTime.getTime() + OUTAGE_DURATION_MS);
  const remaining = returnTime.getTime() - Date.now();

  return `⏱️ Estimated Return: ${formatTime(returnTime)} (Remaining: ${formatRemaining(remaining)})`;
}

function showToast(message, variant = "success") {
  const toast = document.createElement("div");
  toast.className = `toast toast--${variant}`;
  toast.setAttribute("role", "status");
  toast.textContent = message;
  toastRegion.append(toast);

  window.setTimeout(() => {
    toast.classList.add("toast--out");
    window.setTimeout(() => toast.remove(), 280);
  }, 2800);
}

function renderFeed(reports) {
  feed.replaceChildren();

  if (reports.length === 0) {
    const empty = document.createElement("li");
    empty.className = "feed-item feed-item--empty";
    empty.textContent = "No reports yet. Tap Power ON or Power OFF to post.";
    feed.append(empty);
    return;
  }

  for (const report of reports) {
    const on = isPowerOn(report.status);
    const item = document.createElement("li");
    item.className = `feed-item feed-item--${on ? "on" : "off"}`;

    const icon = document.createElement("span");
    icon.className = "feed-item__icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = on ? "⚡" : "❌";

    const meta = document.createElement("div");
    meta.className = "feed-item__meta";

    const area = document.createElement("span");
    area.className = "feed-item__township";
    area.textContent = report.township || report.area || "Unknown area";

    const time = document.createElement("span");
    time.className = "feed-item__time";
    time.textContent = formatTime(report.timestamp);

    const eta = document.createElement("span");
    eta.className = `feed-item__eta ${on ? "feed-item__eta--on" : "feed-item__eta--off"}`;
    eta.textContent = getEstimatedReturnLabel(report);

    meta.append(area, time, eta);

    const status = document.createElement("span");
    status.className = "feed-item__status";
    status.textContent = on ? "ON" : "OFF";

    item.append(icon, meta, status);
    feed.append(item);
  }
}

async function fetchStatusFeed() {
  try {
    const response = await fetch(`${API_BASE}/api/status`);
    if (!response.ok) {
      throw new Error("Status feed request failed.");
    }
    const payload = await response.json();
    renderFeed(normalizeReports(payload));
  } catch (err) {
    renderFeed([]);
    console.error(err);
  }
}

async function submitReport(status) {
  const area = townshipSelect.value;
  const buttons = [btnOn, btnOff];
  buttons.forEach((btn) => {
    btn.disabled = true;
  });

  try {
    const response = await fetch(`${API_BASE}/api/report`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ township: area, area, status }),
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(payload.error || "Report was not saved.");
    }

    showToast(`Reported Power ${status} for ${area}.`, "success");
    await fetchStatusFeed();
  } catch (err) {
    showToast(err.message || "Could not submit report.", "error");
    console.error(err);
  } finally {
    buttons.forEach((btn) => {
      btn.disabled = false;
    });
  }
}

function updateBatteryRuntime() {
  const ah = Number(batteryAh.value);
  const watts = Number(powerWatts.value);

  if (!Number.isFinite(ah) || !Number.isFinite(watts) || ah <= 0 || watts <= 0) {
    hoursLeft.textContent = "0.0 Hours";
    return;
  }

  const hours = (ah * BATTERY_VOLTS * BATTERY_EFFICIENCY) / watts;
  hoursLeft.textContent = `${hours.toFixed(1)} Hours`;
}

function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker
      .register(new URL("../sw.js", import.meta.url))
      .catch((err) => {
        console.error("Service worker registration failed.", err);
      });
  }
}

const CHART_JS_SRC = "https://cdn.jsdelivr.net/npm/chart.js";
let outageChart = null;

function injectOutageChartCard() {
  const liveFeed = document.getElementById("live-feed");
  if (!liveFeed || document.getElementById("outageChart")) {
    return;
  }

  liveFeed.insertAdjacentHTML(
    "afterend",
    `<section class="card" style="margin-top: 1.5rem;">
      <h3 style="font-size: 1.1rem; margin-bottom: 0.75rem; color: #f7fafc;">📈 24-Hour Township Outage Trends</h3>
      <div style="position: relative; width: 100%; height: 220px;">
        <canvas id="outageChart"></canvas>
      </div>
    </section>`
  );
}

function initOutageChart() {
  const canvas = document.getElementById("outageChart");
  if (!canvas || typeof window.Chart !== "function" || outageChart) {
    return;
  }

  outageChart = new window.Chart(canvas, {
    type: "line",
    data: {
      labels: ["06:00", "09:00", "12:00", "15:00", "18:00", "21:00", "Now"],
      datasets: [
        {
          label: "Active Township Outages",
          data: [1, 3, 2, 5, 4, 3, 2],
          borderColor: "#ff4d4d",
          backgroundColor: "rgba(255, 77, 77, 0.15)",
          fill: true,
          tension: 0.4,
          pointBackgroundColor: "#ff4d4d",
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          type: "category",
          ticks: { color: "#a0aec0" },
          grid: { color: "rgba(255, 255, 255, 0.08)" },
        },
        y: {
          ticks: { color: "#a0aec0" },
          grid: { color: "rgba(255, 255, 255, 0.08)" },
        },
      },
    },
  });
}

function loadChartJs(onReady) {
  const existing = document.querySelector(`script[src="${CHART_JS_SRC}"]`);
  if (window.Chart) {
    onReady();
    return;
  }

  if (existing) {
    existing.addEventListener("load", onReady, { once: true });
    return;
  }

  const script = document.createElement("script");
  script.src = CHART_JS_SRC;
  script.onload = onReady;
  document.head.append(script);
}

setConnectionState(navigator.onLine);
window.addEventListener("online", () => setConnectionState(true));
window.addEventListener("offline", () => setConnectionState(false));
registerServiceWorker();

btnOn.addEventListener("click", () => submitReport("ON"));
btnOff.addEventListener("click", () => submitReport("OFF"));
batteryAh.addEventListener("input", updateBatteryRuntime);
powerWatts.addEventListener("input", updateBatteryRuntime);

updateBatteryRuntime();
fetchStatusFeed();
injectOutageChartCard();
loadChartJs(initOutageChart);
