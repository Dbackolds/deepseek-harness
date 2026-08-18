# `@deepseek-ai/dsh-desktop`

English | [中文](README.zh.md)

Electron window around the local `dsh web` Host. The chat UI stays the official Web GUI; this package only owns the window, Host process, and title-bar chrome.

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

On macOS the window uses `titleBarStyle: hiddenInset`: the native traffic lights sit in the reserved left side of the title bar, and a standard application menu (Edit roles, Window roles, Quit) provides the usual Cmd shortcuts. Closing the window keeps the dock process alive; clicking the dock icon reopens the window and restarts the Host.

## Release

A GitHub Release on a `desktop-v<version>` tag carries one archive per runner: a macOS arm64 zip, a Linux x64 AppImage, and a Windows x64 zip. Each archive embeds the Electron window, a Node 24 binary copied from that runner, and a `pnpm deploy` of `@deepseek-ai/dsh`. The window still starts `dsh web --port 0` and loads the loopback URL; the packaged Host no longer needs a repository checkout or a system Node.

From the repository root, after `pnpm run build`:

```sh
pnpm run desktop:pack -- --platform darwin
```

`Release (desktop)` (`.github/workflows/release-desktop.yml`) packs those three installers and publishes them as that tag's GitHub Release. The notes list commits since the previous `desktop-v*` tag. The desktop package stays `private`; it is not an npm family member. The [desktop GitHub Release Agent Note](../../.agents/notes/implemented/process/2026-08-17-desktop-github-release.md) owns the sequence.

## Known Limitations and Deferred Work

- No auto-update, code signing, tray, or multi-window support. Checkout launch remains `pnpm desktop` / `dsh desktop`.
