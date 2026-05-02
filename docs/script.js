let remarks = [];
let currentVideoTime = 0;
let videoElement = null;
let currentTrimMode = "markers";

// --- Trim Mode Switching ---
function switchTrimMode(mode) {
  currentTrimMode = mode;
  document
    .querySelectorAll(".trim-tab")
    .forEach((t) => t.classList.remove("active"));
  document
    .querySelectorAll(".trim-mode-panel")
    .forEach((p) => p.classList.remove("active"));
  event.target.classList.add("active");
  document.getElementById(`trimMode_${mode}`).classList.add("active");
}

function activeTrimmingAction() {
  if (currentTrimMode === "markers") trimByMarkers();
  else if (currentTrimMode === "lines") trimByLines();
  else if (currentTrimMode === "selection") trimBySelection();
}

// --- Transcript character/word counter ---
document.addEventListener("DOMContentLoaded", () => {
  const ta = document.getElementById("transcriptInput");
  ta.addEventListener("input", updateCharCount);
});

function updateCharCount() {
  const raw = document.getElementById("transcriptInput").value;
  const chars = raw.length;
  const words = raw.trim() ? raw.trim().split(/\s+/).length : 0;
  const lines = raw ? raw.split(/\r?\n/).length : 0;
  document.getElementById("charCount").textContent =
    `${chars} characters · ${words} words · ${lines} lines`;
}

// --- TRIM MODE 1: By Markers (FIXED) ---
function normalizeText(text) {
  return text
    .toLowerCase()
    .replace(/[\u2018\u2019\u201C\u201D]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function fuzzyIndexOf(haystack, needle) {
  // Normalize both strings for comparison
  const normHay = normalizeText(haystack);
  const normNeedle = normalizeText(needle);

  const idx = normHay.indexOf(normNeedle);
  if (idx === -1) return -1;

  // Map back to original string position
  // Walk through original string counting normalized chars
  let normPos = 0;
  let origPos = 0;
  const origLower = haystack.toLowerCase();

  // Build a mapping: for each position in normalized string, what's the original position
  let normToOrig = [];
  for (let i = 0; i < haystack.length; i++) {
    const ch = origLower[i];
    if (/\s/.test(ch)) {
      // Check if this starts a multi-space sequence
      if (i === 0 || !/\s/.test(origLower[i - 1])) {
        normToOrig.push(i);
      }
      // else skip (collapsed space)
    } else {
      normToOrig.push(i);
    }
  }

  return normToOrig[idx] !== undefined ? normToOrig[idx] : idx;
}

function trimByMarkers() {
  const raw = document.getElementById("transcriptInput").value;
  const startMarker = document.getElementById("startMarker").value.trim();
  const endMarker = document.getElementById("endMarker").value.trim();
  const errorEl = document.getElementById("trimError");
  const outputEl = document.getElementById("trimmedOutput");
  const textEl = document.getElementById("trimmedText");
  const statusEl = document.getElementById("trimStatus");
  const debugEl = document.getElementById("debugBox");

  errorEl.textContent = "";
  outputEl.style.display = "none";
  statusEl.style.display = "none";
  debugEl.style.display = "none";

  if (!raw.trim()) {
    errorEl.textContent = "⚠ Paste a transcript first.";
    return;
  }
  if (!startMarker) {
    errorEl.textContent = "⚠ Enter a start marker.";
    return;
  }
  if (!endMarker) {
    errorEl.textContent = "⚠ Enter an end marker.";
    return;
  }

  // Normalize for matching
  const normRaw = normalizeText(raw);
  const normStart = normalizeText(startMarker);
  const normEnd = normalizeText(endMarker);

  // Find start marker
  const startMatchIdx = normRaw.indexOf(normStart);
  if (startMatchIdx === -1) {
    errorEl.textContent = `⚠ Start marker not found: "${startMarker}"`;
    showDebugInfo(raw, startMarker, endMarker);
    return;
  }

  // Content begins AFTER the start marker phrase
  const contentStartNorm = startMatchIdx + normStart.length;

  // Find end marker AFTER the start marker
  const endMatchIdx = normRaw.indexOf(normEnd, contentStartNorm);
  if (endMatchIdx === -1) {
    errorEl.textContent = `⚠ End marker not found after start marker: "${endMarker}"`;
    showDebugInfo(raw, startMarker, endMarker);
    return;
  }

  // Now map normalized positions back to original text
  // We'll use a simpler approach: search in the original text case-insensitively with flexible spacing
  const startRegex = new RegExp(
    escapeRegex(normStart).replace(/ /g, "\\s+"),
    "i",
  );
  const startMatch = raw.match(startRegex);

  if (!startMatch) {
    errorEl.textContent = `⚠ Start marker not found (regex): "${startMarker}"`;
    return;
  }

  const origStartEnd = startMatch.index + startMatch[0].length;

  const remainingText = raw.substring(origStartEnd);
  const endRegex = new RegExp(escapeRegex(normEnd).replace(/ /g, "\\s+"), "i");
  const endMatch = remainingText.match(endRegex);

  if (!endMatch) {
    errorEl.textContent = `⚠ End marker not found after start: "${endMarker}"`;
    return;
  }

  const trimmed = remainingText.substring(0, endMatch.index).trim();

  if (!trimmed) {
    errorEl.textContent = "⚠ No content found between the two markers.";
    return;
  }

  displayTrimmedResult(trimmed);
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function showDebugInfo(raw, startMarker, endMarker) {
  const debugEl = document.getElementById("debugBox");
  const normRaw = normalizeText(raw);
  const first200 = normRaw.substring(0, 300);
  const last200 = normRaw.substring(Math.max(0, normRaw.length - 300));

  debugEl.innerHTML = `
            <strong>🔍 Debug Info — Why markers weren't found:</strong><br><br>
            <strong>Looking for start:</strong> "${escapeHtml(normalizeText(startMarker))}"<br>
            <strong>Looking for end:</strong> "${escapeHtml(normalizeText(endMarker))}"<br><br>
            <strong>First 300 chars (normalized):</strong><br>
            "${escapeHtml(first200)}"<br><br>
            <strong>Last 300 chars (normalized):</strong><br>
            "${escapeHtml(last200)}"<br><br>
            <em>Tip: Copy a few words from the transcript and paste them as your marker.</em>
        `;
  debugEl.style.display = "block";
}

// --- TRIM MODE 2: By Line Numbers ---
function countLines() {
  const raw = document.getElementById("transcriptInput").value;
  if (!raw.trim()) {
    document.getElementById("lineCountInfo").textContent =
      "Paste a transcript first.";
    return;
  }
  const lines = raw.split(/\r?\n/);
  document.getElementById("lineCountInfo").textContent =
    `Total lines: ${lines.length}`;
  document.getElementById("lineEnd").value = lines.length;
}

function trimByLines() {
  const raw = document.getElementById("transcriptInput").value;
  const errorEl = document.getElementById("trimError");
  errorEl.textContent = "";

  if (!raw.trim()) {
    errorEl.textContent = "⚠ Paste a transcript first.";
    return;
  }

  const lines = raw.split(/\r?\n/);
  const start = Math.max(
    1,
    parseInt(document.getElementById("lineStart").value) || 1,
  );
  const end = Math.min(
    lines.length,
    parseInt(document.getElementById("lineEnd").value) || lines.length,
  );

  if (start > end) {
    errorEl.textContent = `⚠ Start line (${start}) is after end line (${end}).`;
    return;
  }

  const trimmed = lines
    .slice(start - 1, end)
    .join("\n")
    .trim();
  if (!trimmed) {
    errorEl.textContent = "⚠ Selected range is empty.";
    return;
  }

  displayTrimmedResult(trimmed);
}

// --- TRIM MODE 3: Manual Selection ---
function trimBySelection() {
  const ta = document.getElementById("transcriptInput");
  const errorEl = document.getElementById("trimError");
  errorEl.textContent = "";

  const start = ta.selectionStart;
  const end = ta.selectionEnd;

  if (start === end) {
    errorEl.textContent =
      "⚠ No text selected. Highlight the part you want in the transcript box, then click Trim.";
    return;
  }

  const trimmed = ta.value.substring(start, end).trim();
  if (!trimmed) {
    errorEl.textContent = "⚠ Selection is empty.";
    return;
  }

  displayTrimmedResult(trimmed);
}

// --- Shared result display ---
function displayTrimmedResult(trimmed) {
  const outputEl = document.getElementById("trimmedOutput");
  const textEl = document.getElementById("trimmedText");
  const statusEl = document.getElementById("trimStatus");
  const errorEl = document.getElementById("trimError");
  const debugEl = document.getElementById("debugBox");

  errorEl.textContent = "";
  debugEl.style.display = "none";

  textEl.textContent = trimmed;
  outputEl.style.display = "block";
  statusEl.style.display = "flex";

  const wordCount = trimmed.split(/\s+/).filter(Boolean).length;
  document.getElementById("trimStatusText").textContent =
    `${wordCount} words extracted · ${trimmed.length} characters`;
  showToast("Transcript trimmed successfully!");
}

// --- Preview Markers ---
function previewMarkers() {
  const raw = document.getElementById("transcriptInput").value;
  const startMarker = document.getElementById("startMarker").value.trim();
  const endMarker = document.getElementById("endMarker").value.trim();
  const debugEl = document.getElementById("debugBox");

  if (!raw.trim()) {
    showToast("Paste a transcript first");
    return;
  }

  const normStart = normalizeText(startMarker);
  const normEnd = normalizeText(endMarker);

  const startRegex = new RegExp(
    "(" + escapeRegex(normStart).replace(/ /g, "\\s+") + ")",
    "i",
  );
  const endRegex = new RegExp(
    "(" + escapeRegex(normEnd).replace(/ /g, "\\s+") + ")",
    "i",
  );

  const startMatch = raw.match(startRegex);
  const endMatch = raw.match(endRegex);

  let html = "<strong>🔍 Marker Preview:</strong><br><br>";

  if (startMatch) {
    const ctx = raw.substring(
      Math.max(0, startMatch.index - 40),
      startMatch.index + startMatch[0].length + 40,
    );
    html += `✅ <strong>Start marker found</strong> at position ${startMatch.index}:<br>`;
    html += `"...${escapeHtml(ctx).replace(escapeHtml(startMatch[0]), `<span class="highlight-found">${escapeHtml(startMatch[0])}</span>`)}..."<br><br>`;
  } else {
    html += `❌ <strong>Start marker NOT found:</strong> "${escapeHtml(startMarker)}"<br><br>`;
  }

  if (endMatch) {
    const ctx = raw.substring(
      Math.max(0, endMatch.index - 40),
      endMatch.index + endMatch[0].length + 40,
    );
    html += `✅ <strong>End marker found</strong> at position ${endMatch.index}:<br>`;
    html += `"...${escapeHtml(ctx).replace(escapeHtml(endMatch[0]), `<span class="highlight-found">${escapeHtml(endMatch[0])}</span>`)}..."<br>`;
  } else {
    html += `❌ <strong>End marker NOT found:</strong> "${escapeHtml(endMarker)}"<br>`;
  }

  debugEl.innerHTML = html;
  debugEl.style.display = "block";
}

function clearTranscript() {
  document.getElementById("transcriptInput").value = "";
  document.getElementById("trimmedOutput").style.display = "none";
  document.getElementById("trimStatus").style.display = "none";
  document.getElementById("trimError").textContent = "";
  document.getElementById("debugBox").style.display = "none";
  updateCharCount();
  showToast("Transcript cleared");
}

// --- Video Functions ---
function convertDropboxLink(url) {
  let converted = url.trim();
  if (converted.includes("dropbox.com")) {
    if (converted.includes("dl=0"))
      converted = converted.replace("dl=0", "raw=1");
    else if (converted.includes("dl=1"))
      converted = converted.replace("dl=1", "raw=1");
    else if (!converted.includes("raw=1"))
      converted += (converted.includes("?") ? "&" : "?") + "raw=1";
  }
  return converted;
}

function loadVideo() {
  const url = document.getElementById("dropboxLink").value.trim();
  if (!url) {
    showToast("Please paste a Dropbox link first");
    return;
  }

  const directUrl = convertDropboxLink(url);
  const container = document.getElementById("videoContainer");
  const placeholder = document.getElementById("videoPlaceholder");
  if (placeholder) placeholder.remove();
  if (videoElement) videoElement.remove();

  videoElement = document.createElement("video");
  videoElement.controls = true;
  videoElement.preload = "metadata";
  videoElement.style.cssText =
    "position:absolute;top:0;left:0;width:100%;height:100%;background:#000;";

  const source = document.createElement("source");
  source.src = directUrl;
  source.type = "video/mp4";
  videoElement.appendChild(source);
  container.appendChild(videoElement);

  videoElement.addEventListener("timeupdate", () => {
    currentVideoTime = videoElement.currentTime;
    document.getElementById("currentTimeDisplay").textContent =
      formatTime(currentVideoTime);
  });

  videoElement.addEventListener("loadeddata", () => {
    document.getElementById("videoStatus").textContent = "● Video loaded";
    showToast("Video loaded successfully!");
  });

  videoElement.addEventListener("error", () => {
    document.getElementById("videoStatus").textContent = "⚠ Load error";
    container.innerHTML = `
                <div style="position:absolute;top:0;left:0;width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#ccc;padding:1.5rem;text-align:center;background:#1a1a2e;">
                    <p>⚠ Direct embed didn't work. Try a public link.</p>
                    <a href="${url}" target="_blank" style="color:#d4ac0d;margin-top:0.75rem;">Open in Dropbox ↗</a>
                </div>`;
  });

  document.getElementById("videoStatus").textContent = "⏳ Loading...";
}

function formatTime(s) {
  const m = Math.floor(s / 60),
    sec = Math.floor(s % 60);
  return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
}

function parseTime(t) {
  const p = t.split(":").map(Number);
  if (p.length === 3) return p[0] * 3600 + p[1] * 60 + p[2];
  return p[0] * 60 + p[1];
}

// --- Remark Functions ---
function addRemark() {
  const input = document.getElementById("remarkInput");
  const text = input.value.trim();
  if (!text) {
    showToast("Type a remark first");
    return;
  }

  remarks.push({
    id: Date.now(),
    number: remarks.length + 1,
    timestamp: formatTime(currentVideoTime),
    rawTime: currentVideoTime,
    text: text,
  });

  input.value = "";
  renderRemarks();
  showToast(
    `Remark #${remarks.length} added at ${remarks[remarks.length - 1].timestamp}`,
  );
}

function deleteRemark(id) {
  remarks = remarks.filter((r) => r.id !== id);
  remarks.forEach((r, i) => (r.number = i + 1));
  renderRemarks();
}

function editRemark(id) {
  const r = remarks.find((r) => r.id === id);
  if (!r) return;
  const newText = prompt("Edit remark:", r.text);
  if (newText !== null && newText.trim()) {
    r.text = newText.trim();
    renderRemarks();
  }
}

function seekToTime(t) {
  if (videoElement) {
    videoElement.currentTime = parseTime(t);
    videoElement.play();
  }
}

function clearRemarks() {
  if (!remarks.length) return;
  if (confirm(`Clear all ${remarks.length} remarks?`)) {
    remarks = [];
    renderRemarks();
    showToast("Cleared");
  }
}

function renderRemarks() {
  const list = document.getElementById("remarksList");
  const empty = document.getElementById("remarksEmpty");
  const copyBar = document.getElementById("copyBar");
  document.getElementById("remarkCount").textContent =
    `${remarks.length} remark${remarks.length !== 1 ? "s" : ""}`;

  if (!remarks.length) {
    list.innerHTML = "";
    empty.style.display = "block";
    copyBar.style.display = "none";
    return;
  }

  empty.style.display = "none";
  copyBar.style.display = "flex";
  document.getElementById("copyStatus").textContent = "";

  list.innerHTML = remarks
    .map(
      (r) => `
            <li class="remark-item">
                <span class="remark-number">${r.number}.</span>
                <span class="remark-timestamp" onclick="seekToTime('${r.timestamp}')" title="Click to seek">${r.timestamp}</span>
                <span class="remark-text">${escapeHtml(r.text)}</span>
                <span class="remark-actions">
                    <button onclick="editRemark(${r.id})" title="Edit">✏️</button>
                    <button onclick="deleteRemark(${r.id})" title="Delete">🗑</button>
                </span>
            </li>
        `,
    )
    .join("");
}

function insertTimestamp() {
  const input = document.getElementById("remarkInput");
  input.value += `[${formatTime(currentVideoTime)}] `;
  input.focus();
}

function copyRemarks() {
  if (!remarks.length) {
    showToast("No remarks to copy");
    return;
  }
  const text = remarks
    .map((r) => `${r.number}. [${r.timestamp}] ${r.text}`)
    .join("\n");
  navigator.clipboard.writeText(text).then(() => {
    showToast("Copied! Paste into WhatsApp");
    document.getElementById("copyStatus").textContent = "✓ Copied";
  });
}

function copyTrimmed() {
  const text = document.getElementById("trimmedText").textContent;
  if (!text) {
    showToast("Trim a transcript first");
    return;
  }
  navigator.clipboard
    .writeText(text)
    .then(() => showToast("Trimmed transcript copied!"));
}

function escapeHtml(t) {
  const d = document.createElement("div");
  d.textContent = t;
  return d.innerHTML;
}

function showToast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(t._to);
  t._to = setTimeout(() => t.classList.remove("show"), 2500);
}

// --- Keyboard Shortcuts ---
document.addEventListener("keydown", (e) => {
  if (
    e.ctrlKey &&
    e.key === "Enter" &&
    document.activeElement.id === "remarkInput"
  ) {
    e.preventDefault();
    addRemark();
  }
  if (e.ctrlKey && e.key === "t") {
    e.preventDefault();
    insertTimestamp();
  }
});

document.getElementById("dropboxLink").addEventListener("paste", () => {
  setTimeout(() => {
    if (document.getElementById("dropboxLink").value.includes("dropbox.com"))
      loadVideo();
  }, 100);
});

renderRemarks();
