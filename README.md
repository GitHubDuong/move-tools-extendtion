# Text Note Chrome Extension

A Chrome extension with three main tabs:

- `Notes`: multi-note tab management (similar to Sticky Notes)
- `Tools`: `JSON Formatter` and `RCS API Caller`
- `Setup`: RCS API environment configuration

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

#### JSON Formatter

- Format JSON (pretty print, with auto-fix for common mistakes)
- Minify JSON
- Copy output JSON
- Error message when JSON cannot be repaired

#### RCS API Caller

- Select environment: `SIT` or `UAT`
- Load URL, username, password from `Setup`
- If missing setup values, show: `missing configurations`
- Input request values as JSON body
- Call POST API with:
  - URL from setup configuration
  - Basic Authentication (`username` + `password`)
  - JSON body from input values
- Show full response result (`status`, `ok`, `statusText`, `body`)

### Setup tab

- Two environment frames: `UAT` and `SIT`
- Each frame has:
  - Input URL
  - Username
  - Password
- Save each environment configuration independently
- Configurations are persisted in `chrome.storage.local`
