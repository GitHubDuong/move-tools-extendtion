const STORAGE_KEY = "text_note_state_v2";
const ENCRYPTION_KEY_STORAGE = "move_tool_encryption_key_v1";
const ENCRYPTED_FILE_NAME = "move-tool-data.enc";
const DEFAULT_TITLE = "New Note";
const encoder = new TextEncoder();
const decoder = new TextDecoder();

const mainNotesTabEl = document.getElementById("mainNotesTab");
const mainToolsTabEl = document.getElementById("mainToolsTab");
const mainSetupTabEl = document.getElementById("mainSetupTab");
const notesPanelEl = document.getElementById("notesPanel");
const toolsPanelEl = document.getElementById("toolsPanel");
const setupPanelEl = document.getElementById("setupPanel");

const toolJsonTabEl = document.getElementById("toolJsonTab");
const toolRcsTabEl = document.getElementById("toolRcsTab");
const toolTimeTabEl = document.getElementById("toolTimeTab");
const jsonToolPanelEl = document.getElementById("jsonToolPanel");
const rcsToolPanelEl = document.getElementById("rcsToolPanel");
const timeToolPanelEl = document.getElementById("timeToolPanel");

const tabsEl = document.getElementById("tabs");
const noteTitleEl = document.getElementById("noteTitle");
const noteEditorEl = document.getElementById("noteEditor");
const headingBtn = document.getElementById("headingBtn");
const boldBtn = document.getElementById("boldBtn");
const italicBtn = document.getElementById("italicBtn");
const underlineBtn = document.getElementById("underlineBtn");
const bulletBtn = document.getElementById("bulletBtn");
const colorBtn = document.getElementById("colorBtn");
const textColorInput = document.getElementById("textColorInput");
const linkBtn = document.getElementById("linkBtn");
const clearBtn = document.getElementById("clearBtn");
const renameBtn = document.getElementById("renameBtn");
const deleteBtn = document.getElementById("deleteBtn");
const newTabBtn = document.getElementById("newTabBtn");

const jsonInputEl = document.getElementById("jsonInput");
const jsonOutputEl = document.getElementById("jsonOutput");
const formatJsonBtn = document.getElementById("formatJsonBtn");
const minifyJsonBtn = document.getElementById("minifyJsonBtn");
const copyJsonBtn = document.getElementById("copyJsonBtn");

const rcsEnvEl = document.getElementById("rcsEnv");
const rcsPayloadTypeEl = document.getElementById("rcsPayloadType");
const rcsContentTypeEl = document.getElementById("rcsContentType");
const rcsBodyInputEl = document.getElementById("rcsBodyInput");
const rcsResponseEl = document.getElementById("rcsResponse");
const rcsCallBtn = document.getElementById("rcsCallBtn");
const rcsClearBtn = document.getElementById("rcsClearBtn");

const fromTimezoneEl = document.getElementById("fromTimezone");
const toTimezoneEl = document.getElementById("toTimezone");
const timeInputEl = document.getElementById("timeInput");
const convertTimeBtn = document.getElementById("convertTimeBtn");
const swapTimeBtn = document.getElementById("swapTimeBtn");
const quickVnToUtcEl = document.getElementById("quickVnToUtc");
const timeOutputEl = document.getElementById("timeOutput");

const uatUrlEl = document.getElementById("uatUrl");
const uatUsernameEl = document.getElementById("uatUsername");
const uatPasswordEl = document.getElementById("uatPassword");
const sitUrlEl = document.getElementById("sitUrl");
const sitUsernameEl = document.getElementById("sitUsername");
const sitPasswordEl = document.getElementById("sitPassword");
const saveUatBtn = document.getElementById("saveUatBtn");
const saveSitBtn = document.getElementById("saveSitBtn");

const statusEl = document.getElementById("status");
const closeToolBtn = document.getElementById("closeToolBtn");

function createDefaultSetup() {
  return {
    uat: { url: "", username: "", password: "" },
    sit: { url: "", username: "", password: "" }
  };
}

function bytesToBase64(bytes) {
  let binary = "";
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary);
}

function base64ToBytes(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function getOrCreateEncryptionKey() {
  const stored = await chrome.storage.local.get([ENCRYPTION_KEY_STORAGE]);
  const keyBase64 = stored[ENCRYPTION_KEY_STORAGE];

  if (typeof keyBase64 === "string" && keyBase64) {
    return crypto.subtle.importKey(
      "raw",
      base64ToBytes(keyBase64),
      { name: "AES-GCM" },
      false,
      ["encrypt", "decrypt"]
    );
  }

  const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
  const raw = await crypto.subtle.exportKey("raw", key);
  await chrome.storage.local.set({
    [ENCRYPTION_KEY_STORAGE]: bytesToBase64(new Uint8Array(raw))
  });
  return key;
}

async function encryptStateObject(obj) {
  const key = await getOrCreateEncryptionKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plain = encoder.encode(JSON.stringify(obj));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plain);
  return {
    v: 1,
    iv: bytesToBase64(iv),
    data: bytesToBase64(new Uint8Array(encrypted))
  };
}

async function decryptStateObject(payload) {
  if (!payload || typeof payload !== "object" || payload.v !== 1 || !payload.iv || !payload.data) {
    throw new Error("Invalid encrypted payload");
  }

  const key = await getOrCreateEncryptionKey();
  const iv = base64ToBytes(payload.iv);
  const encrypted = base64ToBytes(payload.data);
  const plainBuffer = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, encrypted);
  return JSON.parse(decoder.decode(plainBuffer));
}

async function readEncryptedStateFile() {
  if (!navigator.storage?.getDirectory) {
    throw new Error("Private file storage not supported");
  }

  const root = await navigator.storage.getDirectory();
  let handle;
  try {
    handle = await root.getFileHandle(ENCRYPTED_FILE_NAME, { create: false });
  } catch (error) {
    if (error && error.name === "NotFoundError") {
      return null;
    }
    throw error;
  }

  const file = await handle.getFile();
  if (!file.size) {
    return null;
  }

  const rawText = await file.text();
  const payload = JSON.parse(rawText);
  return decryptStateObject(payload);
}

async function writeEncryptedStateFile(obj) {
  if (!navigator.storage?.getDirectory) {
    throw new Error("Private file storage not supported");
  }

  const root = await navigator.storage.getDirectory();
  const handle = await root.getFileHandle(ENCRYPTED_FILE_NAME, { create: true });
  const writable = await handle.createWritable();
  const payload = await encryptStateObject(obj);
  await writable.write(JSON.stringify(payload));
  await writable.close();
}

let state = {
  notes: [],
  activeId: null,
  activeMainTab: "notes",
  activeToolTab: "json",
  setup: createDefaultSetup()
};
let noteAutosaveTimer = null;
let headingIndex = 0;
const headingLevels = ["p", "h1", "h2", "h3"];

function setStatus(message) {
  statusEl.textContent = message;
  if (!message) {
    return;
  }

  window.setTimeout(() => {
    if (statusEl.textContent === message) {
      statusEl.textContent = "";
    }
  }, 1800);
}

function createNote(title = DEFAULT_TITLE, content = "") {
  return {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    title,
    content
  };
}

function getActiveNote() {
  return state.notes.find((note) => note.id === state.activeId) || null;
}

function normalizeEditorHtml(html) {
  const trimmed = html.trim();
  if (!trimmed || trimmed === "<br>" || trimmed === "<div><br></div>") {
    return "";
  }
  return html;
}

function applyNoteFormat(command) {
  noteEditorEl.focus();
  document.execCommand(command, false);
}

function applyHeading(level) {
  noteEditorEl.focus();
  const tag = level === "p" ? "P" : level.toUpperCase();
  document.execCommand("formatBlock", false, tag);
}

function cycleHeading() {
  headingIndex = (headingIndex + 1) % headingLevels.length;
  applyHeading(headingLevels[headingIndex]);
}

function applyTextColor(color) {
  noteEditorEl.focus();
  document.execCommand("foreColor", false, color);
}

function insertLink() {
  noteEditorEl.focus();
  const inputUrl = window.prompt("Enter URL");
  if (!inputUrl) {
    return;
  }

  const normalized = /^https?:\/\//i.test(inputUrl) ? inputUrl : `https://${inputUrl}`;
  document.execCommand("createLink", false, normalized);
}

function normalizeSetup(rawSetup) {
  const fallback = createDefaultSetup();
  if (!rawSetup || typeof rawSetup !== "object") {
    return fallback;
  }

  const safeEnv = (env) => {
    if (!env || typeof env !== "object") {
      return { url: "", username: "", password: "" };
    }

    return {
      url: typeof env.url === "string" ? env.url : "",
      username: typeof env.username === "string" ? env.username : "",
      password: typeof env.password === "string" ? env.password : ""
    };
  };

  return {
    uat: safeEnv(rawSetup.uat),
    sit: safeEnv(rawSetup.sit)
  };
}

function renderSetupFields() {
  uatUrlEl.value = state.setup.uat.url;
  uatUsernameEl.value = state.setup.uat.username;
  uatPasswordEl.value = state.setup.uat.password;

  sitUrlEl.value = state.setup.sit.url;
  sitUsernameEl.value = state.setup.sit.username;
  sitPasswordEl.value = state.setup.sit.password;
}

async function persistState() {
  await writeEncryptedStateFile(state);
  await chrome.storage.local.remove([STORAGE_KEY]);
}

function getTabLabel(title, index) {
  const trimmed = title.trim();
  return trimmed || `Note ${index + 1}`;
}

function setMainTab(tabName) {
  state.activeMainTab = ["notes", "tools", "setup"].includes(tabName) ? tabName : "notes";

  const notesActive = state.activeMainTab === "notes";
  const toolsActive = state.activeMainTab === "tools";
  const setupActive = state.activeMainTab === "setup";

  mainNotesTabEl.classList.toggle("active", notesActive);
  mainToolsTabEl.classList.toggle("active", toolsActive);
  mainSetupTabEl.classList.toggle("active", setupActive);

  mainNotesTabEl.setAttribute("aria-selected", String(notesActive));
  mainToolsTabEl.setAttribute("aria-selected", String(toolsActive));
  mainSetupTabEl.setAttribute("aria-selected", String(setupActive));

  notesPanelEl.classList.toggle("active", notesActive);
  toolsPanelEl.classList.toggle("active", toolsActive);
  setupPanelEl.classList.toggle("active", setupActive);

  persistState().catch(() => setStatus("Save failed"));
}

function setToolTab(tabName) {
  state.activeToolTab = ["json", "rcs", "time"].includes(tabName) ? tabName : "json";

  const jsonActive = state.activeToolTab === "json";
  const rcsActive = state.activeToolTab === "rcs";
  const timeActive = state.activeToolTab === "time";
  toolJsonTabEl.classList.toggle("active", jsonActive);
  toolRcsTabEl.classList.toggle("active", rcsActive);
  toolTimeTabEl.classList.toggle("active", timeActive);

  toolJsonTabEl.setAttribute("aria-selected", String(jsonActive));
  toolRcsTabEl.setAttribute("aria-selected", String(rcsActive));
  toolTimeTabEl.setAttribute("aria-selected", String(timeActive));

  jsonToolPanelEl.classList.toggle("active", jsonActive);
  rcsToolPanelEl.classList.toggle("active", rcsActive);
  timeToolPanelEl.classList.toggle("active", timeActive);

  if (rcsActive) {
    loadRcsConfigForSelectedEnv();
  }

  persistState().catch(() => setStatus("Save failed"));
}

function renderTabs() {
  tabsEl.innerHTML = "";

  state.notes.forEach((note, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `tab${note.id === state.activeId ? " active" : ""}`;
    button.textContent = getTabLabel(note.title, index);
    button.addEventListener("click", () => {
      state.activeId = note.id;
      render();
      persistState().catch(() => setStatus("Save failed"));
    });
    tabsEl.appendChild(button);
  });
}

function renderEditor() {
  const active = getActiveNote();
  if (!active) {
    noteTitleEl.value = "";
    noteEditorEl.innerHTML = "";
    noteTitleEl.disabled = true;
    noteEditorEl.contentEditable = "false";
    return;
  }

  noteTitleEl.disabled = false;
  noteEditorEl.contentEditable = "true";
  noteTitleEl.value = active.title;
  noteEditorEl.innerHTML = active.content || "";
}

function render() {
  renderTabs();
  renderEditor();
  renderSetupFields();
  setToolTab(state.activeToolTab);
  setMainTab(state.activeMainTab);
}

async function loadState() {
  let saved = null;
  try {
    saved = await readEncryptedStateFile();
  } catch {
    saved = null;
  }

  if (!saved) {
    const legacy = await chrome.storage.local.get([STORAGE_KEY]);
    if (legacy[STORAGE_KEY]) {
      saved = legacy[STORAGE_KEY];
      state = saved;
      await persistState();
      await chrome.storage.local.remove([STORAGE_KEY]);
    }
  }

  if (!saved || !Array.isArray(saved.notes) || saved.notes.length === 0) {
    const first = createNote("Note 1", "");
    state = {
      notes: [first],
      activeId: first.id,
      activeMainTab: "notes",
      activeToolTab: "json",
      setup: createDefaultSetup()
    };
    await persistState();
    render();
    return;
  }

  const safeNotes = saved.notes
    .filter((n) => typeof n?.id === "string")
    .map((n, i) => ({
      id: n.id,
      title: typeof n.title === "string" ? n.title : `Note ${i + 1}`,
      content: typeof n.content === "string" ? n.content : ""
    }));

  if (safeNotes.length === 0) {
    const first = createNote("Note 1", "");
    state = {
      notes: [first],
      activeId: first.id,
      activeMainTab: "notes",
      activeToolTab: "json",
      setup: normalizeSetup(saved.setup)
    };
  } else {
    const activeExists = safeNotes.some((n) => n.id === saved.activeId);
    state = {
      notes: safeNotes,
      activeId: activeExists ? saved.activeId : safeNotes[0].id,
      activeMainTab: ["notes", "tools", "setup"].includes(saved.activeMainTab) ? saved.activeMainTab : "notes",
      activeToolTab: ["json", "rcs", "time"].includes(saved.activeToolTab) ? saved.activeToolTab : "json",
      setup: normalizeSetup(saved.setup)
    };
  }

  render();
}

async function saveCurrentNote() {
  const active = getActiveNote();
  if (!active) {
    return;
  }

  active.title = noteTitleEl.value.trim() || DEFAULT_TITLE;
  active.content = normalizeEditorHtml(noteEditorEl.innerHTML);
  render();
  await persistState();
  setStatus("Saved");
}

function scheduleNoteAutosave() {
  if (noteAutosaveTimer) {
    window.clearTimeout(noteAutosaveTimer);
  }

  noteAutosaveTimer = window.setTimeout(() => {
    saveCurrentNote().catch(() => setStatus("Save failed"));
  }, 450);
}

async function clearCurrentNote() {
  const active = getActiveNote();
  if (!active) {
    return;
  }

  active.content = "";
  noteEditorEl.innerHTML = "";
  await persistState();
  setStatus("Cleared");
}

async function renameCurrentTab() {
  const active = getActiveNote();
  if (!active) {
    return;
  }

  active.title = noteTitleEl.value.trim() || DEFAULT_TITLE;
  render();
  await persistState();
  setStatus("Renamed");
}

async function addNewTab() {
  const newNote = createNote(`Note ${state.notes.length + 1}`, "");
  state.notes.push(newNote);
  state.activeId = newNote.id;
  render();
  await persistState();
  setStatus("New tab created");
}

async function deleteCurrentTab() {
  if (state.notes.length <= 1) {
    setStatus("At least one tab is required");
    return;
  }

  const currentIndex = state.notes.findIndex((note) => note.id === state.activeId);
  if (currentIndex < 0) {
    return;
  }

  state.notes.splice(currentIndex, 1);
  const nextIndex = Math.max(0, currentIndex - 1);
  state.activeId = state.notes[nextIndex].id;
  render();
  await persistState();
  setStatus("Tab deleted");
}

async function saveSetupEnvironment(env) {
  if (!state.setup[env]) {
    return;
  }

  if (env === "uat") {
    state.setup.uat.url = uatUrlEl.value.trim();
    state.setup.uat.username = uatUsernameEl.value.trim();
    state.setup.uat.password = uatPasswordEl.value;
  } else {
    state.setup.sit.url = sitUrlEl.value.trim();
    state.setup.sit.username = sitUsernameEl.value.trim();
    state.setup.sit.password = sitPasswordEl.value;
  }

  await persistState();
  setStatus(`${env.toUpperCase()} setup saved`);
}

function normalizeQuotes(raw) {
  return raw
    .replace(/[\u201C\u201D]/g, "\"")
    .replace(/[\u2018\u2019]/g, "'");
}

function stripJsonComments(raw) {
  return raw
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:\\])\/\/.*$/gm, "$1");
}

function removeTrailingCommas(raw) {
  return raw.replace(/,\s*([}\]])/g, "$1");
}

function quoteUnquotedKeys(raw) {
  return raw.replace(/([{,]\s*)([A-Za-z_$][\w$-]*)(\s*:)/g, "$1\"$2\"$3");
}

function convertSingleQuotedStrings(raw) {
  return raw.replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, (_match, content) => {
    const escaped = content.replace(/"/g, "\\\"");
    return `"${escaped}"`;
  });
}

function tryRepairJson(raw) {
  let repaired = normalizeQuotes(raw);
  repaired = stripJsonComments(repaired);
  repaired = removeTrailingCommas(repaired);
  repaired = quoteUnquotedKeys(repaired);
  repaired = convertSingleQuotedStrings(repaired);
  return repaired.trim();
}

function parseJsonRaw(raw, options = {}) {
  const { allowRepair = false } = options;
  const trimmed = raw.trim();

  if (!trimmed) {
    throw new Error("Input is empty");
  }

  try {
    return { parsed: JSON.parse(trimmed), repaired: false };
  } catch (strictError) {
    if (!allowRepair) {
      throw strictError;
    }

    const repairedText = tryRepairJson(trimmed);
    return { parsed: JSON.parse(repairedText), repaired: repairedText !== trimmed };
  }
}

function parseJsonInput(options = {}) {
  return parseJsonRaw(jsonInputEl.value, options);
}

function formatJson() {
  try {
    const result = parseJsonInput({ allowRepair: true });
    jsonOutputEl.value = JSON.stringify(result.parsed, null, 2);
    setStatus(result.repaired ? "JSON fixed and formatted" : "JSON formatted");
  } catch (error) {
    jsonOutputEl.value = "";
    setStatus(`Invalid JSON: ${error.message}`);
  }
}

function minifyJson() {
  try {
    const result = parseJsonInput();
    jsonOutputEl.value = JSON.stringify(result.parsed);
    setStatus("JSON minified");
  } catch (error) {
    jsonOutputEl.value = "";
    setStatus(`Invalid JSON: ${error.message}`);
  }
}

async function copyJsonOutput() {
  const value = jsonOutputEl.value.trim();
  if (!value) {
    setStatus("Nothing to copy");
    return;
  }

  try {
    await navigator.clipboard.writeText(value);
    setStatus("Output copied");
  } catch {
    setStatus("Copy failed");
  }
}

function getConfigForEnv(env) {
  return env === "uat" ? state.setup.uat : state.setup.sit;
}

function hasRequiredConfig(config) {
  return Boolean(config && config.url.trim() && config.username.trim() && config.password);
}

function loadRcsConfigForSelectedEnv() {
  const env = rcsEnvEl.value;
  const config = getConfigForEnv(env);

  if (!hasRequiredConfig(config)) {
    setStatus("missing configurations");
    return null;
  }

  return config;
}

function toBasicAuthHeader(username, password) {
  const raw = `${username}:${password}`;
  const encoded = btoa(unescape(encodeURIComponent(raw)));
  return `Basic ${encoded}`;
}

async function callRcsApi() {
  const config = loadRcsConfigForSelectedEnv();
  if (!config) {
    return;
  }

  const payloadType = rcsPayloadTypeEl.value;
  const contentType = (rcsContentTypeEl.value || "text/plain").trim() || "text/plain";
  const rawBody = rcsBodyInputEl.value;

  if (payloadType !== "other") {
    setStatus("Unsupported payload type");
    return;
  }

  if (!rawBody.trim()) {
    setStatus("Input values are required");
    return;
  }

  rcsCallBtn.disabled = true;

  try {
    const response = await fetch(config.url.trim(), {
      method: "POST",
      headers: {
        "Content-Type": contentType,
        Authorization: toBasicAuthHeader(config.username.trim(), config.password)
      },
      body: rawBody
    });

    const rawText = await response.text();
    let parsedBody;

    try {
      parsedBody = rawText ? JSON.parse(rawText) : null;
    } catch {
      parsedBody = rawText;
    }

    const output = {
      status: response.status,
      ok: response.ok,
      statusText: response.statusText,
      body: parsedBody
    };

    rcsResponseEl.value = JSON.stringify(output, null, 2);
    setStatus(response.ok ? "RCS API success" : "RCS API error");
  } catch (error) {
    rcsResponseEl.value = JSON.stringify({ error: error.message }, null, 2);
    setStatus("RCS API request failed");
  } finally {
    rcsCallBtn.disabled = false;
  }
}

function clearRcsTool() {
  rcsBodyInputEl.value = "";
  rcsPayloadTypeEl.value = "other";
  rcsContentTypeEl.value = "text/plain";
  rcsResponseEl.value = "";
}

function getSupportedTimeZones() {
  if (typeof Intl.supportedValuesOf === "function") {
    const zones = Intl.supportedValuesOf("timeZone");
    const unique = Array.from(new Set([...zones, "UTC"]));
    return unique.sort((a, b) => a.localeCompare(b));
  }
  return ["UTC"];
}

function populateTimezoneSelect(timezoneEl, preferredTimezone = "") {
  const zones = getSupportedTimeZones();
  timezoneEl.innerHTML = "";
  zones.forEach((zone) => {
    const option = document.createElement("option");
    option.value = zone;
    option.textContent = `${zone} (${formatOffset(getTimeZoneOffsetMinutes(zone, new Date()))})`;
    timezoneEl.appendChild(option);
  });
  if (preferredTimezone && zones.includes(preferredTimezone)) {
    timezoneEl.value = preferredTimezone;
  }
}

function initTimeTool() {
  populateTimezoneSelect(fromTimezoneEl, "Asia/Ho_Chi_Minh");
  populateTimezoneSelect(toTimezoneEl, "America/New_York");

  const now = new Date();
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  timeInputEl.value = `${hh}:${mm}`;
  applyQuickVnToUtcMode();
}

function getTimeZoneOffsetMinutes(timeZone, date) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  });

  const parts = formatter.formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type)?.value || "00";
  const asUtc = Date.UTC(
    Number(get("year")),
    Number(get("month")) - 1,
    Number(get("day")),
    Number(get("hour")),
    Number(get("minute")),
    Number(get("second"))
  );
  return (asUtc - date.getTime()) / 60000;
}

function formatOffset(offsetMinutes) {
  const roundedMinutes = Math.round(offsetMinutes);
  const sign = roundedMinutes >= 0 ? "+" : "-";
  const abs = Math.abs(roundedMinutes);
  const hh = String(Math.floor(abs / 60)).padStart(2, "0");
  const mm = String(abs % 60).padStart(2, "0");
  return `UTC${sign}${hh}:${mm}`;
}

function getTodayInTimeZone(timeZone) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  const parts = formatter.formatToParts(new Date());
  const get = (type) => Number(parts.find((p) => p.type === type)?.value || "0");
  return { year: get("year"), month: get("month"), day: get("day") };
}

function localTimeInZoneToUtcMs(localTime, timeZone) {
  const match = localTime.match(/^(\d{2}):(\d{2})$/);
  if (!match) {
    throw new Error("Invalid input time");
  }

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const today = getTodayInTimeZone(timeZone);
  const year = today.year;
  const month = today.month;
  const day = today.day;

  let utcMs = Date.UTC(year, month - 1, day, hour, minute, 0);
  for (let i = 0; i < 3; i += 1) {
    const offset = getTimeZoneOffsetMinutes(timeZone, new Date(utcMs));
    utcMs = Date.UTC(year, month - 1, day, hour, minute, 0) - offset * 60000;
  }
  return utcMs;
}

function formatInTimeZone(utcMs, timeZone) {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  });
  return formatter.format(new Date(utcMs));
}

function formatIsoInTimeZone(utcMs, timeZone) {
  const date = new Date(utcMs);
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  });

  const parts = formatter.formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type)?.value || "00";
  const offset = formatOffset(getTimeZoneOffsetMinutes(timeZone, date)).replace("UTC", "");
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:${get("second")}${offset}`;
}

function convertCountryTime() {
  const inputValue = timeInputEl.value;
  if (!inputValue) {
    setStatus("Input time is required");
    return;
  }

  try {
    const fromZone = fromTimezoneEl.value;
    const toZone = toTimezoneEl.value;
    const utcMs = localTimeInZoneToUtcMs(inputValue, fromZone);
    const isoOutput = formatIsoInTimeZone(utcMs, toZone);
    const result = [
      `From: ${fromZone}`,
      `To: ${toZone}`,
      `Input: ${inputValue}`
    ];
    result.push(`Output: ${isoOutput}`);
    timeOutputEl.value = result.join("\n");
    setStatus("Time converted");
  } catch (error) {
    timeOutputEl.value = "";
    setStatus(`Convert failed: ${error.message}`);
  }
}

function swapTimeDirection() {
  if (quickVnToUtcEl.checked) {
    return;
  }
  const fromTimezone = fromTimezoneEl.value;
  fromTimezoneEl.value = toTimezoneEl.value;
  toTimezoneEl.value = fromTimezone;
}

function setTimezoneIfAvailable(selectEl, preferredValues) {
  const options = Array.from(selectEl.options).map((o) => o.value);
  const found = preferredValues.find((value) => options.includes(value));
  if (found) {
    selectEl.value = found;
  }
}

function applyQuickVnToUtcMode() {
  const quickMode = quickVnToUtcEl.checked;
  if (quickMode) {
    setTimezoneIfAvailable(fromTimezoneEl, ["Asia/Ho_Chi_Minh"]);
    setTimezoneIfAvailable(toTimezoneEl, ["UTC", "Etc/UTC"]);
  }
  fromTimezoneEl.disabled = quickMode;
  toTimezoneEl.disabled = quickMode;
}

clearBtn.addEventListener("click", () => {
  clearCurrentNote().catch(() => setStatus("Clear failed"));
});

renameBtn.addEventListener("click", () => {
  renameCurrentTab().catch(() => setStatus("Rename failed"));
});

newTabBtn.addEventListener("click", () => {
  addNewTab().catch(() => setStatus("Create failed"));
});

deleteBtn.addEventListener("click", () => {
  deleteCurrentTab().catch(() => setStatus("Delete failed"));
});

saveUatBtn.addEventListener("click", () => {
  saveSetupEnvironment("uat").catch(() => setStatus("Save failed"));
});

saveSitBtn.addEventListener("click", () => {
  saveSetupEnvironment("sit").catch(() => setStatus("Save failed"));
});

mainNotesTabEl.addEventListener("click", () => setMainTab("notes"));
mainToolsTabEl.addEventListener("click", () => setMainTab("tools"));
mainSetupTabEl.addEventListener("click", () => setMainTab("setup"));

toolJsonTabEl.addEventListener("click", () => setToolTab("json"));
toolRcsTabEl.addEventListener("click", () => setToolTab("rcs"));
toolTimeTabEl.addEventListener("click", () => setToolTab("time"));
rcsEnvEl.addEventListener("change", loadRcsConfigForSelectedEnv);

formatJsonBtn.addEventListener("click", formatJson);
minifyJsonBtn.addEventListener("click", minifyJson);
copyJsonBtn.addEventListener("click", () => {
  copyJsonOutput().catch(() => setStatus("Copy failed"));
});

rcsCallBtn.addEventListener("click", () => {
  callRcsApi().catch(() => setStatus("RCS API request failed"));
});

rcsClearBtn.addEventListener("click", clearRcsTool);
convertTimeBtn.addEventListener("click", convertCountryTime);
swapTimeBtn.addEventListener("click", swapTimeDirection);
quickVnToUtcEl.addEventListener("change", applyQuickVnToUtcMode);

boldBtn.addEventListener("click", () => applyNoteFormat("bold"));
italicBtn.addEventListener("click", () => applyNoteFormat("italic"));
underlineBtn.addEventListener("click", () => applyNoteFormat("underline"));
bulletBtn.addEventListener("click", () => applyNoteFormat("insertUnorderedList"));
headingBtn.addEventListener("click", cycleHeading);
colorBtn.addEventListener("click", () => textColorInput.click());
textColorInput.addEventListener("input", () => applyTextColor(textColorInput.value));
linkBtn.addEventListener("click", insertLink);
closeToolBtn.addEventListener("click", () => window.close());

noteEditorEl.addEventListener("keydown", (event) => {
  if (event.key === "Tab") {
    event.preventDefault();
    noteEditorEl.focus();
    if (event.shiftKey) {
      document.execCommand("outdent", false);
    } else {
      document.execCommand("indent", false);
    }
    scheduleNoteAutosave();
    return;
  }

  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
    event.preventDefault();
    saveCurrentNote().catch(() => setStatus("Save failed"));
  }
});

noteEditorEl.addEventListener("input", scheduleNoteAutosave);
noteTitleEl.addEventListener("input", scheduleNoteAutosave);

loadState().catch(() => {
  setStatus("Failed to load notes");
});

initTimeTool();
