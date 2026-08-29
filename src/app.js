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
    area.textContent = report.area || "Unknown area";

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
    const response = await fetch("/api/status");
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
    const response = await fetch("/api/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ area, status }),
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
