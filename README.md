# Text Note Chrome Extension

A Chrome extension with two main tabs:

- `Notes`: multi-note tab management (similar to Sticky Notes)
- `Tools`: utility tools (currently JSON formatter)

## Install in Chrome

1. Open Google Chrome.
2. Go to `chrome://extensions`.
3. Turn on **Developer mode** (top-right).
4. Click **Load unpacked**.
5. Select the `chrome-text-note-extension` folder.

## Features

### Notes tab

- Multiple note tabs
- Create new tab
- Rename tab title
- Delete tab
- Save note content
- Clear note content
- Keyboard save (`Ctrl+S` / `Cmd+S`)
- Persistent storage via `chrome.storage.local`

### Tools tab

- JSON formatting tool
- Format JSON (pretty print, with auto-fix for common mistakes)
- Minify JSON
- Copy output JSON
- Error message when JSON cannot be repaired
