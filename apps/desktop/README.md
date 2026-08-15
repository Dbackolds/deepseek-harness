# `@deepseek-ai/dsh-desktop`

English | [中文](README.zh.md)

Electron window around the local `dsh web` Host. The chat UI stays the official Web GUI; this package only owns the frameless window, Host process, and title-bar chrome.

## Run

From the repository root, after `pnpm run build`:

```sh
pnpm desktop
```

or:

```sh
pnpm dsh desktop
```

The window starts `dsh web --port 0` as soon as the Electron process exists, so Host boot overlaps Chromium ready. It loads the loopback URL as soon as the HTTP server prints `dsh web: http://127.0.0.1:<port>`; later Host rows keep mounting while the browser boot kernel waits for client plugins. Closing the window stops the Host. Windows uses the system caption overlay for minimize, maximize, and close. The taskbar and window icon is the same DeepSeek whale mark as the Web favicon. On Windows, the first launch writes `DeepSeek Harness.lnk` into the Start menu with that icon and AppUserModelID; pin that shortcut, not a raw `electron.exe` process.

## Known Limitations and Deferred Work

- No installer, auto-update, tray, or multi-window support. `pnpm desktop` / `dsh desktop` is the v1 delivery.
