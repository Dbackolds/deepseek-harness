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

The window starts `dsh web --port 0`, waits for `dsh web: http://127.0.0.1:<port>`, then loads that loopback URL. Closing the window stops the Host.

## Known Limitations and Deferred Work

- No installer, auto-update, tray, or multi-window support. `pnpm desktop` / `dsh desktop` is the v1 delivery.
