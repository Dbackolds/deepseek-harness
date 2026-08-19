/**
 * Frameless window chrome injected over the local Web GUI.
 * @module @deepseek-ai/dsh-desktop/titlebar
 */

/** Height reserved for the custom title bar, in CSS pixels. */
export const TITLEBAR_HEIGHT_PX = 36

/** Markup id of the injected title bar. */
export const TITLEBAR_ID = 'dsh-desktop-titlebar'

/** Horizontal space reserved for the native macOS traffic lights, in CSS pixels. */
export const MAC_TRAFFIC_LIGHT_WIDTH_PX = 70

/** Horizontal space reserved for the Windows caption-button overlay, in CSS pixels. */
export const WINDOWS_OVERLAY_WIDTH_PX = 138

/**
 * Title bar flavor: `mac` reserves left space for the native traffic lights of
 * a `hiddenInset` window; `windows` reserves right space for the system
 * caption-button overlay. Neither draws its own window buttons.
 */
export type TitlebarVariant = 'mac' | 'windows'

/**
 * Map an Electron `process.platform` value to its title bar variant.
 * @param platform a `process.platform` string.
 * @returns the variant the main process should inject.
 */
export function titlebarVariantForPlatform(platform: NodeJS.Platform): TitlebarVariant {
  return platform === 'darwin' ? 'mac' : 'windows'
}

/**
 * Drag-region insets that keep native controls outside the hit box.
 * Padding would sit inside a full-width box and still register as drag.
 */
function dragInset(variant: TitlebarVariant): string {
  return variant === 'mac'
    ? `left: ${String(MAC_TRAFFIC_LIGHT_WIDTH_PX)}px; right: 12px;`
    : `left: 12px; right: ${String(WINDOWS_OVERLAY_WIDTH_PX)}px;`
}

/**
 * HTML for the frameless title bar. The page must also run {@link titlebarScript}.
 * @param variant platform variant controlling the drag-region inset.
 * @returns a single root element string.
 */
export function titlebarMarkup(variant: TitlebarVariant): string {
  return `<div id="${TITLEBAR_ID}" data-dsh-desktop-titlebar="true" data-dsh-desktop-variant="${variant}">`
    + '<div class="dsh-desktop-drag" data-dsh-desktop-drag="true"></div>'
    + '</div>'
}

/**
 * Styles that pin the title bar above the Web GUI without covering its clicks.
 * Only `body` receives the reserved padding: the Web GUI sets
 * `html, body, #root { height: 100% }`, and padding both `html` and `body`
 * stacks two gaps under the fixed bar.
 * The drag rule is a block with an explicit height and side insets. A flex
 * child with no content has no hit box, so Chromium never registers
 * `-webkit-app-region`.
 * @param variant platform variant controlling the drag-region inset.
 * @returns a CSS text block.
 */
export function titlebarStyles(variant: TitlebarVariant): string {
  return `:root { --dsh-desktop-titlebar: ${String(TITLEBAR_HEIGHT_PX)}px; }
#${TITLEBAR_ID} {
  position: fixed; top: 0; left: 0; right: 0; z-index: 2147483647;
  height: var(--dsh-desktop-titlebar);
  background: #151517; color: #ececf1;
  border-bottom: 1px solid rgba(255,255,255,0.06);
  font: 12px/1 -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", sans-serif;
  user-select: none;
}
#${TITLEBAR_ID} .dsh-desktop-drag {
  position: absolute; top: 0; ${dragInset(variant)}
  height: var(--dsh-desktop-titlebar);
  -webkit-app-region: drag;
}
body { padding-top: var(--dsh-desktop-titlebar); box-sizing: border-box; }
`
}

/**
 * Window-control script. Reads `window.dshDesktop` installed by the preload.
 * @returns a JavaScript source string.
 */
function titlebarScript(): string {
  return `(() => {
  const api = window.dshDesktop;
  const root = document.getElementById(${JSON.stringify(TITLEBAR_ID)});
  if (api === undefined || root === null) return;
  root.querySelector("[data-dsh-desktop-drag]")?.addEventListener("dblclick", () => api.maximize());
})();`
}

/**
 * One document that injects the title-bar markup into an already-loaded page.
 * Styles arrive separately through `webContents.insertCSS` so Chromium sees
 * `-webkit-app-region` before first paint. Re-inserting the same rule from a
 * page `<style>` after load does not register a drag region.
 * @param variant platform variant controlling the drag-region inset.
 * @returns JavaScript that a `executeJavaScript` caller can run as a script body.
 */
export function titlebarInjectScript(variant: TitlebarVariant): string {
  return `(() => {
  if (document.getElementById(${JSON.stringify(TITLEBAR_ID)}) !== null) return true;
  document.body.insertAdjacentHTML("afterbegin", ${JSON.stringify(titlebarMarkup(variant))});
  ${titlebarScript()}
  return document.getElementById(${JSON.stringify(TITLEBAR_ID)}) !== null
    && document.querySelector("[data-dsh-desktop-drag]") !== null;
})()`
}

/**
 * Self-contained loading page shown until the Host prints its URL.
 * @param variant platform variant controlling the drag-region inset.
 * @returns a complete HTML document.
 */
export function loadingPage(variant: TitlebarVariant): string {
  return '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"/>'
    + `<title>DeepSeek Harness</title><style>${titlebarStyles(variant)}`
    + 'body{margin:0;background:#151517;color:#ececf1;'
    + 'font:14px/1.4 -apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC",sans-serif;}'
    + '.dsh-desktop-loading{display:flex;align-items:center;justify-content:center;'
    + 'height:calc(100vh - var(--dsh-desktop-titlebar));opacity:.72;}</style></head><body>'
    + `${titlebarMarkup(variant)}<div class="dsh-desktop-loading">正在启动 DeepSeek Harness…</div>`
    + `<script>${titlebarScript()}</script></body></html>`
}
