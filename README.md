# Text Note Chrome Extension

A Chrome extension with three main tabs:

- `Notes`: multi-note tab management (similar to Sticky Notes)
- `Tools`: `JSON Formatter` and `RCS API Caller`
  - plus `Country Time Converter`
- `Setup`: RCS API environment configuration

## Install in Chrome

1. Open Google Chrome.
2. Go to `chrome://extensions`.
3. Turn on **Developer mode** (top-right).
4. Click **Load unpacked**.
5. Select the `chrome-text-note-extension` folder.

## Usage Mode

- Click the extension icon to open tools in Chrome Side Panel.
- You can operate on the web page and extension tools simultaneously.
- Click `Close Tool` inside the extension to hide it.

## Features

- Tool data is stored in an encrypted file (`move-tool-data.enc`) in extension private storage.

### Notes tab

- Multiple note tabs
- Create new tab
- Rename tab title
- Delete tab
- Auto-save note content while typing
- Clear note content
- Rich text editing: bold, italic, underline, bullet list
- Additional editor tools: heading styles, text color, insert link
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
- Payload type is `Other` (not JSON)
- Input request values as raw payload body
- Configure `Content-Type` (default: `text/plain`)
- Call POST API with:
  - URL from setup configuration
  - Basic Authentication (`username` + `password`)
  - Raw body from input values
- Show full response result (`status`, `ok`, `statusText`, `body`)

#### Country Time Converter

- Select source timezone
- Input source time only (`HH:mm`)
- Select destination timezone
- Timezone dropdown supports all available timezones and shows zone + UTC offset
- Convert and output converted time (time only)
- Swap source/destination timezone quickly

### Setup tab

- Two environment frames: `UAT` and `SIT`
- Each frame has:
  - Input URL
  - Username
  - Password
- Save each environment configuration independently
- Configurations are persisted in `chrome.storage.local`
