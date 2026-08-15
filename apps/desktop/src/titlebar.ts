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

/** Drag-region padding that keeps native controls outside the draggable area. */
function dragPadding(variant: TitlebarVariant): string {
  return variant === 'mac'
    ? `padding: 0 12px 0 ${String(MAC_TRAFFIC_LIGHT_WIDTH_PX)}px;`
    : `padding: 0 ${String(WINDOWS_OVERLAY_WIDTH_PX)}px 0 12px;`
}

/**
 * HTML for the frameless title bar. The page must also run {@link titlebarScript}.
 * @param variant platform variant controlling the drag-region padding.
 * @returns a single root element string.
 */
export function titlebarMarkup(variant: TitlebarVariant): string {
  return `<div id="${TITLEBAR_ID}" data-dsh-desktop-titlebar="true" data-dsh-desktop-variant="${variant}">`
    + '<div class="dsh-desktop-drag" data-dsh-desktop-drag="true">'
    + '<span class="dsh-desktop-title">DeepSeek Harness</span>'
    + '</div>'
    + '</div>'
}

/**
 * Styles that pin the title bar above the Web GUI without covering its clicks.
 * @param variant platform variant controlling the drag-region padding.
 * @returns a CSS text block.
 */
export function titlebarStyles(variant: TitlebarVariant): string {
  return `:root { --dsh-desktop-titlebar: ${String(TITLEBAR_HEIGHT_PX)}px; }
#${TITLEBAR_ID} {
  position: fixed; top: 0; left: 0; right: 0; z-index: 2147483647;
  height: var(--dsh-desktop-titlebar);
  display: flex; align-items: stretch;
  background: #151517; color: #ececf1;
  border-bottom: 1px solid rgba(255,255,255,0.06);
  font: 12px/1 -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", sans-serif;
  user-select: none;
}
#${TITLEBAR_ID} .dsh-desktop-drag {
  flex: 1; display: flex; align-items: center; ${dragPadding(variant)}
  -webkit-app-region: drag;
}
#${TITLEBAR_ID} .dsh-desktop-title { opacity: 0.72; pointer-events: none; }
html, body { padding-top: var(--dsh-desktop-titlebar); box-sizing: border-box; }
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
 * One document that injects the title bar into an already-loaded page.
 * @param variant platform variant controlling the drag-region padding.
 * @returns HTML that a `executeJavaScript` caller can treat as a script body.
 */
export function titlebarInjectScript(variant: TitlebarVariant): string {
  return `(() => {
  if (document.getElementById(${JSON.stringify(TITLEBAR_ID)}) !== null) return true;
  const style = document.createElement("style");
  style.textContent = ${JSON.stringify(titlebarStyles(variant))};
  document.head.append(style);
  document.body.insertAdjacentHTML("afterbegin", ${JSON.stringify(titlebarMarkup(variant))});
  ${titlebarScript()}
  return document.getElementById(${JSON.stringify(TITLEBAR_ID)}) !== null
    && document.querySelector("[data-dsh-desktop-drag]") !== null;
})()`
}

/**
 * Self-contained loading page shown until the Host prints its URL.
 * @param variant platform variant controlling the drag-region padding.
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
