const STORAGE_KEY = "text_note_state_v2";
const DEFAULT_TITLE = "New Note";

const mainNotesTabEl = document.getElementById("mainNotesTab");
const mainToolsTabEl = document.getElementById("mainToolsTab");
const notesPanelEl = document.getElementById("notesPanel");
const toolsPanelEl = document.getElementById("toolsPanel");

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

const statusEl = document.getElementById("status");

let state = {
  notes: [],
  activeId: null,
  activeMainTab: "notes"
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

async function persistState() {
  await chrome.storage.local.set({ [STORAGE_KEY]: state });
}

function getTabLabel(title, index) {
  const trimmed = title.trim();
  return trimmed || `Note ${index + 1}`;
}

function setMainTab(tabName) {
  state.activeMainTab = tabName === "tools" ? "tools" : "notes";

  const notesActive = state.activeMainTab === "notes";
  mainNotesTabEl.classList.toggle("active", notesActive);
  mainToolsTabEl.classList.toggle("active", !notesActive);

  mainNotesTabEl.setAttribute("aria-selected", String(notesActive));
  mainToolsTabEl.setAttribute("aria-selected", String(!notesActive));

  notesPanelEl.classList.toggle("active", notesActive);
  toolsPanelEl.classList.toggle("active", !notesActive);

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
  setMainTab(state.activeMainTab);
}

async function loadState() {
  const result = await chrome.storage.local.get([STORAGE_KEY]);
  const saved = result[STORAGE_KEY];

  if (!saved || !Array.isArray(saved.notes) || saved.notes.length === 0) {
    const first = createNote("Note 1", "");
    state = { notes: [first], activeId: first.id, activeMainTab: "notes" };
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
    state = { notes: [first], activeId: first.id, activeMainTab: "notes" };
  } else {
    const activeExists = safeNotes.some((n) => n.id === saved.activeId);
    state = {
      notes: safeNotes,
      activeId: activeExists ? saved.activeId : safeNotes[0].id,
      activeMainTab: saved.activeMainTab === "tools" ? "tools" : "notes"
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

function parseJsonInput(options = {}) {
  const { allowRepair = false } = options;
  const raw = jsonInputEl.value.trim();

  if (!raw) {
    throw new Error("Input is empty");
  }

  try {
    return { parsed: JSON.parse(raw), repaired: false };
  } catch (strictError) {
    if (!allowRepair) {
      throw strictError;
    }

    const repairedText = tryRepairJson(raw);
    return { parsed: JSON.parse(repairedText), repaired: repairedText !== raw };
  }
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

mainNotesTabEl.addEventListener("click", () => setMainTab("notes"));
mainToolsTabEl.addEventListener("click", () => setMainTab("tools"));

formatJsonBtn.addEventListener("click", formatJson);
minifyJsonBtn.addEventListener("click", minifyJson);
copyJsonBtn.addEventListener("click", () => {
  copyJsonOutput().catch(() => setStatus("Copy failed"));
});

noteEl.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
    event.preventDefault();
    saveCurrentNote().catch(() => setStatus("Save failed"));
  }
});

loadState().catch(() => {
  setStatus("Failed to load notes");
});
