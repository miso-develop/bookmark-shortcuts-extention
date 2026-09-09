# Bookmark Shortcuts Minimal

**English** | [日本語](README.ja.md)

A minimal-permission Firefox and Chrome extension for operating bookmarks on the bookmarks toolbar / bookmarks bar directly from the keyboard.

## Supported browsers

- Firefox: Manifest V3
- Chrome 134 or later: Manifest V3

The folder UI uses an extension action popup on both browsers. The extension does not use a Side Panel.

## Basic shortcuts

| Shortcut | Action |
| --- | --- |
| `Alt+1` through `Alt+9` | Open the 1st through 9th item on the bookmarks toolbar / bar |
| `Alt+0` | Open the 10th item |
| `Alt+Shift+1` through `Alt+Shift+0` | Open a regular bookmark in a new tab |

Folders count as positions. Firefox separators also count as positions.

### Chrome shortcut setup

Chrome allows only four suggested shortcuts to be assigned by an extension. Therefore the Chrome build initially suggests:

- `Alt+1`
- `Alt+2`
- `Alt+3`
- `Alt+4`

All 20 commands are registered. Configure the remaining commands once at:

```text
chrome://extensions/shortcuts
```

The extension's Options page shows the current shortcut configuration as `configured / 20` and highlights commands that are still unassigned.

## Folder popup

When a shortcut targets a folder, the extension opens its dedicated folder popup.

- `↑` / `↓`: Move the selection by 1 item
- `Shift+↑` / `Shift+↓`: Move the selection by 5 items, clamped at the beginning or end
- `PageUp` / `PageDown`: Move the selection by approximately one visible page
- `Shift+PageUp` / `Shift+PageDown`: Move the selection by approximately half of the normal page step
- `Home`: Move to the first selectable item
- `End`: Move to the last selectable item
- `Enter`: Open the selected bookmark or enter the selected folder
- `Ctrl+Enter`: Open the selected bookmark in a new tab
- `←` / `→` at a root folder: Switch the popup to the previous / next folder on the bookmarks toolbar / bar. Regular bookmarks and separators are skipped, and navigation does not wrap
- `←` / `→` inside a subfolder: Do nothing
- `Backspace`: Return to the parent folder
- Back button: Return to the parent folder
- `Alt+Enter`: Open the current folder in a full-page layout in a new tab
- `Alt+Tab`: If the popup receives the key event, perform the same full-page action. The OS normally handles Alt+Tab first, so the extension usually cannot receive it

The popup header shows the root toolbar position, such as `F3`, while a root folder or one of its subfolders is open.

`PageUp` / `PageDown` / `Shift+PageUp` / `Shift+PageDown` / `Shift+↑` / `Shift+↓` / `Home` / `End` move both the selection and actual keyboard focus.

When returning from a subfolder with `Backspace` or the Back button, the extension restores selection and actual focus to the subfolder item you just returned from.

### Mouse and keyboard focus priority

When the pointer actually moves over an item, selection and focus follow that item. If keyboard input occurs afterward, keyboard navigation takes priority. A stationary pointer over a previously selected item does not take selection back after keyboard navigation.

`Tab` / `Shift+Tab` focus navigation within the popup is preserved.

### Pressing shortcuts while the popup is open

The popup handles `Alt+number` itself instead of relying on persistent background state.

- Shortcut for the currently displayed root folder: Does nothing, including while a subfolder is displayed
- Shortcut for another folder: Switches the existing popup to that folder
- Shortcut for a regular bookmark: Opens the bookmark and closes the popup
- `←` / `→` at root level: Switches the same popup to the previous / next available folder

This design also avoids relying on Chrome Manifest V3 service-worker global state.

### Browser shortcut suppression

When the popup receives a key event, every key except `Esc` and plain `Tab` / `Shift+Tab` is handled in the capture phase with `preventDefault()` / `stopImmediatePropagation()`.

Browser- or OS-reserved shortcuts may be processed before a WebExtension receives them. For example, `Ctrl+Tab` or `Alt+Tab` cannot be guaranteed to be suppressed when the browser or OS consumes them first.

`Esc` is intentionally left to the browser so it can close the popup.

## Chrome-specific behavior

### Bookmarks Bar source

Chrome 134+ may expose more than one `bookmarks-bar`, for example a Google Account bar and a local "This device" bar.

- If only one bar is available, it is selected automatically.
- If multiple bars are available, the Options page lets you choose which one `Alt+number` operates on.
- Until a choice is made, the syncing / Google Account bar is preferred when present.

This preference is stored locally in IndexedDB and does not require the `storage` permission.

### Favicons

The Chrome build requires the `favicon` permission and displays Chrome's internally stored site favicons for regular bookmarks. Bookmark URLs are not sent to an external favicon service.

Folders continue to use a generic folder icon.

### Action icon

Chrome cannot place the extension action inside the Bookmarks Bar. The action lives in Chrome's extensions toolbar instead. Pinning Bookmark Shortcuts is recommended so the temporary position badge (`1`, `F3`, etc.) remains visible, but pinning is not required for keyboard shortcuts to work.

## Settings

Open the extension's Options page from the browser's extension manager.

Common setting:

- **Always open with Enter in a new tab**

Chrome additionally shows:

- Keyboard shortcut configuration status
- Bookmarks Bar source selector when multiple bars exist
- Browser / extension version information

The common Enter setting is stored in the extension page's `localStorage`; no `storage` permission is requested.

## Permissions

### Firefox

```json
"permissions": [
  "bookmarks"
]
```

### Chrome

```json
"permissions": [
  "bookmarks",
  "favicon"
]
```

Neither build requests:

- `tabs`
- `storage`
- `activeTab`
- `<all_urls>`
- host permissions

There are no content scripts, external network requests, or data collection.

## Build

Node.js 22 or later:

```bash
npm run build
```

Outputs:

```text
dist/firefox/
dist/chrome/
```

You can also build one target:

```bash
npm run build:firefox
npm run build:chrome
```

Source manifests:

- `manifest.json`: Firefox
- `manifest.chrome.json`: Chrome

## Installation

### Firefox development / temporary installation

1. Run `npm run build:firefox`
2. Open `about:debugging#/runtime/this-firefox`
3. Choose **Load Temporary Add-on...**
4. Select `dist/firefox/manifest.json`

Standard Firefox requires Mozilla signing for permanent installation. For private use, an AMO Unlisted signed XPI can be used.

### Chrome persistent local installation

1. Run `npm run build:chrome`
2. Open `chrome://extensions`
3. Enable **Developer mode**
4. Choose **Load unpacked**
5. Select the `dist/chrome` directory
6. Open `chrome://extensions/shortcuts` and configure any remaining shortcuts you want to use
7. Optionally pin Bookmark Shortcuts to Chrome's extensions toolbar

An unpacked Chrome extension remains installed across browser restarts. After rebuilding, use **Reload** on `chrome://extensions`.

## Tests

```bash
npm test
```

GitHub Actions runs the test suite and builds both Firefox and Chrome packages on pushes to `main` and on pull requests.

## Reference

- https://github.com/mortalis13/Bookmark-Shortcuts

This project was independently reimplemented using only the browser extension APIs required for the functionality, rather than copying code from the referenced project.

## License

MIT License
