# Bookmark Shortcuts Minimal

**English** | [日本語](README.ja.md)

A minimal-permission Firefox WebExtension for operating bookmarks on the bookmarks toolbar directly from the keyboard.

## Basic shortcuts

| Shortcut | Action |
| --- | --- |
| `Alt+1` through `Alt+9` | Open the 1st through 9th item on the bookmarks toolbar |
| `Alt+0` | Open the 10th item |
| `Alt+Shift+1` through `Alt+Shift+0` | Open a regular bookmark in a new tab |

If the target item is a folder, the extension opens a dedicated folder popup. Folders and separators count as positions on the bookmarks toolbar.

## Folder popup

- `↑` / `↓`: Move the selection by 1 item
- `Shift+↑` / `Shift+↓`: Move the selection by 5 items, clamped at the beginning or end
- `PageUp` / `PageDown`: Move the selection by approximately one visible page
- `Shift+PageUp` / `Shift+PageDown`: Move the selection by approximately half of the normal page step
- `Home`: Move to the first selectable item
- `End`: Move to the last selectable item
- `Enter`: Open the selected bookmark or enter the selected folder
- `Ctrl+Enter`: Open the selected bookmark in a new tab
- `←` / `→` at a root folder: Switch the popup to the previous / next folder on the bookmarks toolbar. Regular bookmarks and separators are skipped, and navigation does not wrap at either end
- `←` / `→` inside a subfolder: Do nothing
- `Backspace`: Return to the parent folder
- Back button: Return to the parent folder
- `Alt+Enter`: Open the current folder in a full-page layout in a new tab
- `Alt+Tab`: If the popup receives the key event, perform the same full-page action. On Windows, however, the OS normally handles Alt+Tab first, so the extension usually cannot receive it

`PageUp` / `PageDown` / `Shift+PageUp` / `Shift+PageDown` / `Shift+↑` / `Shift+↓` / `Home` / `End` move both the selection and the actual keyboard focus to the destination item.

When returning from a subfolder with `Backspace` or the Back button, the extension restores both the selection and actual focus to the subfolder item you just returned from.

### Mouse and keyboard focus priority

When the pointer actually moves over an item, the extension synchronizes selection and focus to that item. If a keyboard input occurs afterward, keyboard navigation takes priority. A stationary mouse pointer over a previously selected item does not take the selection back after keyboard navigation.

`Tab` / `Shift+Tab` focus navigation within the popup is also preserved.

### Pressing shortcuts while the popup is already open

The folder popup and background script are connected through `runtime.Port`.

- Pressing the shortcut for the same root folder on the bookmarks toolbar: Does nothing, even while a subfolder is displayed
- Pressing the shortcut for a different folder: Switches the existing popup to that folder without opening a new tab
- Pressing `←` / `→` while a root folder is displayed: Switches the same popup to the previous / next available folder

If the popup cannot be opened, the extension falls back to opening the same folder view in a full-page layout in a new tab.

### Suppressing browser shortcuts

When the dedicated popup receives a key event, every key except `Esc` and plain `Tab` / `Shift+Tab` is handled in the capture phase with `preventDefault()` / `stopImmediatePropagation()` so that it does not propagate to Firefox. `Ctrl+Tab` is also suppressed if the event reaches the popup.

However, Firefox may process browser-reserved shortcuts before a WebExtension receives them. In particular, reserved shortcuts such as `Ctrl+Tab` may never produce a DOM `keydown` event in the popup. In that case, a WebExtension cannot fully disable the shortcut. This is a Firefox / WebExtensions platform limitation.

`Esc` is intentionally left to Firefox so it can close the popup.

## Settings

Settings are not shown in the folder popup. Open the extension settings from Firefox's Add-ons Manager instead.

Current setting:

- **Always open with Enter in a new tab**

The setting is stored in the extension's own `localStorage`, so the extension does not request the `storage` permission.

## Icons

Firefox's Bookmarks API does not expose stored favicons for bookmarks. To avoid sending bookmark URLs to an external favicon service, the extension currently uses generic folder / bookmark icons.

## Permissions

The extension requests only the `bookmarks` permission.

```json
"permissions": [
  "bookmarks"
]
```

It does not request:

- `tabs`
- `storage`
- `activeTab`
- `<all_urls>`
- host permissions

There are also no content scripts, external network requests, or data collection.

## Temporary installation

1. Clone the repository or download it as a ZIP file
2. Open `about:debugging#/runtime/this-firefox` in Firefox
3. Choose **Load Temporary Add-on...**
4. Select `manifest.json`

After making changes, reload the extension from the same page.

## Changing shortcuts

Open `about:addons` → gear menu → **Manage Extension Shortcuts**.

## Tests

Node.js 22 or later:

```bash
npm test
```

GitHub Actions runs the same test suite on every push to `main` and on pull requests.

## Permanent installation

Standard Firefox builds require Mozilla signing for permanent installation. For private use without public listing, you can submit the extension to AMO as an Unlisted add-on and obtain a signed XPI.

## Reference

- https://github.com/mortalis13/Bookmark-Shortcuts

This project was independently reimplemented using only the WebExtensions APIs required for the functionality, rather than copying code from the referenced project.

## License

MIT License
