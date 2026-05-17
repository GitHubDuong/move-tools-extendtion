const STORAGE_KEY = "text_note_state_v2";
const DEFAULT_TITLE = "New Note";

const mainNotesTabEl = document.getElementById("mainNotesTab");
const mainToolsTabEl = document.getElementById("mainToolsTab");
const mainSetupTabEl = document.getElementById("mainSetupTab");
const notesPanelEl = document.getElementById("notesPanel");
const toolsPanelEl = document.getElementById("toolsPanel");
const setupPanelEl = document.getElementById("setupPanel");

const toolJsonTabEl = document.getElementById("toolJsonTab");
const toolRcsTabEl = document.getElementById("toolRcsTab");
const jsonToolPanelEl = document.getElementById("jsonToolPanel");
const rcsToolPanelEl = document.getElementById("rcsToolPanel");

const tabsEl = document.getElementById("tabs");
const noteTitleEl = document.getElementById("noteTitle");
const noteEl = document.getElementById("note");
const saveBtn = document.getElementById("saveBtn");
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

const uatUrlEl = document.getElementById("uatUrl");
const uatUsernameEl = document.getElementById("uatUsername");
const uatPasswordEl = document.getElementById("uatPassword");
const sitUrlEl = document.getElementById("sitUrl");
const sitUsernameEl = document.getElementById("sitUsername");
const sitPasswordEl = document.getElementById("sitPassword");
const saveUatBtn = document.getElementById("saveUatBtn");
const saveSitBtn = document.getElementById("saveSitBtn");

const statusEl = document.getElementById("status");

function createDefaultSetup() {
  return {
    uat: { url: "", username: "", password: "" },
    sit: { url: "", username: "", password: "" }
  };
}

let state = {
  notes: [],
  activeId: null,
  activeMainTab: "notes",
  activeToolTab: "json",
  setup: createDefaultSetup()
};

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
  await chrome.storage.local.set({ [STORAGE_KEY]: state });
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
  state.activeToolTab = tabName === "rcs" ? "rcs" : "json";

  const jsonActive = state.activeToolTab === "json";
  toolJsonTabEl.classList.toggle("active", jsonActive);
  toolRcsTabEl.classList.toggle("active", !jsonActive);

  toolJsonTabEl.setAttribute("aria-selected", String(jsonActive));
  toolRcsTabEl.setAttribute("aria-selected", String(!jsonActive));

  jsonToolPanelEl.classList.toggle("active", jsonActive);
  rcsToolPanelEl.classList.toggle("active", !jsonActive);

  if (!jsonActive) {
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
    noteEl.value = "";
    noteTitleEl.disabled = true;
    noteEl.disabled = true;
    return;
  }

  noteTitleEl.disabled = false;
  noteEl.disabled = false;
  noteTitleEl.value = active.title;
  noteEl.value = active.content;
}

function render() {
  renderTabs();
  renderEditor();
  renderSetupFields();
  setToolTab(state.activeToolTab);
  setMainTab(state.activeMainTab);
}

async function loadState() {
  const result = await chrome.storage.local.get([STORAGE_KEY]);
  const saved = result[STORAGE_KEY];

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
      activeToolTab: saved.activeToolTab === "rcs" ? "rcs" : "json",
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
  active.content = noteEl.value;
  render();
  await persistState();
  setStatus("Saved");
}

async function clearCurrentNote() {
  const active = getActiveNote();
  if (!active) {
    return;
  }

  active.content = "";
  noteEl.value = "";
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

saveBtn.addEventListener("click", () => {
  saveCurrentNote().catch(() => setStatus("Save failed"));
});

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

noteEl.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
    event.preventDefault();
    saveCurrentNote().catch(() => setStatus("Save failed"));
  }
});

loadState().catch(() => {
  setStatus("Failed to load notes");
});
