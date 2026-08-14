/**
 * Frameless window chrome injected over the local Web GUI.
 * @module @deepseek-ai/dsh-desktop/titlebar
 */

/** Height reserved for the custom title bar, in CSS pixels. */
export const TITLEBAR_HEIGHT_PX = 36

/** Markup id of the injected title bar. */
export const TITLEBAR_ID = 'dsh-desktop-titlebar'

/**
 * HTML for the frameless title bar. The page must also run {@link titlebarScript}.
 * @returns a single root element string.
 */
export function titlebarMarkup(): string {
  return `<div id="${TITLEBAR_ID}" data-dsh-desktop-titlebar="true">`
    + '<div class="dsh-desktop-drag" data-dsh-desktop-drag="true">'
    + '<span class="dsh-desktop-title">DeepSeek Harness</span>'
    + '</div>'
    + '<div class="dsh-desktop-controls" data-dsh-desktop-controls="true">'
    + '<button type="button" data-dsh-desktop-action="minimize" aria-label="Minimize"></button>'
    + '<button type="button" data-dsh-desktop-action="maximize" aria-label="Maximize"></button>'
    + '<button type="button" data-dsh-desktop-action="close" aria-label="Close"></button>'
    + '</div></div>'
}

/**
 * Styles that pin the title bar above the Web GUI without covering its clicks.
 * @returns a CSS text block.
 */
export function titlebarStyles(): string {
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
  flex: 1; display: flex; align-items: center; padding: 0 12px;
  -webkit-app-region: drag;
}
#${TITLEBAR_ID} .dsh-desktop-title { opacity: 0.72; pointer-events: none; }
#${TITLEBAR_ID} .dsh-desktop-controls {
  display: flex; -webkit-app-region: no-drag;
}
#${TITLEBAR_ID} button {
  width: 46px; border: 0; padding: 0; background: transparent; color: inherit;
  cursor: pointer; -webkit-app-region: no-drag;
}
#${TITLEBAR_ID} button:hover { background: rgba(255,255,255,0.08); }
#${TITLEBAR_ID} button[data-dsh-desktop-action="close"]:hover { background: #e81123; }
#${TITLEBAR_ID} button::before { content: ""; display: block; width: 10px; height: 10px; margin: 0 auto; }
#${TITLEBAR_ID} button[data-dsh-desktop-action="minimize"]::before {
  border-bottom: 1px solid currentColor; height: 0; transform: translateY(5px);
}
#${TITLEBAR_ID} button[data-dsh-desktop-action="maximize"]::before {
  border: 1px solid currentColor;
}
#${TITLEBAR_ID} button[data-dsh-desktop-action="close"]::before {
  width: 10px; height: 10px;
  background:
    linear-gradient(45deg, transparent 0 42%, currentColor 42% 58%, transparent 58%),
    linear-gradient(-45deg, transparent 0 42%, currentColor 42% 58%, transparent 58%);
}
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
  root.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const action = target.closest("[data-dsh-desktop-action]")?.getAttribute("data-dsh-desktop-action");
    if (action === "minimize") api.minimize();
    if (action === "maximize") api.maximize();
    if (action === "close") api.close();
  });
  root.querySelector("[data-dsh-desktop-drag]")?.addEventListener("dblclick", () => api.maximize());
})();`
}

/**
 * One document that injects the title bar into an already-loaded page.
 * @returns HTML that a `executeJavaScript` caller can treat as a script body.
 */
export function titlebarInjectScript(): string {
  return `(() => {
  if (document.getElementById(${JSON.stringify(TITLEBAR_ID)}) !== null) return true;
  const style = document.createElement("style");
  style.textContent = ${JSON.stringify(titlebarStyles())};
  document.head.append(style);
  document.body.insertAdjacentHTML("afterbegin", ${JSON.stringify(titlebarMarkup())});
  ${titlebarScript()}
  return document.getElementById(${JSON.stringify(TITLEBAR_ID)}) !== null
    && document.querySelector("[data-dsh-desktop-drag]") !== null
    && document.querySelectorAll("[data-dsh-desktop-action]").length === 3;
})()`
}

/**
 * Self-contained loading page shown until the Host prints its URL.
 * @returns a complete HTML document.
 */
export function loadingPage(): string {
  return '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"/>'
    + `<title>DeepSeek Harness</title><style>${titlebarStyles()}`
    + 'body{margin:0;background:#151517;color:#ececf1;'
    + 'font:14px/1.4 -apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC",sans-serif;}'
    + '.dsh-desktop-loading{display:flex;align-items:center;justify-content:center;'
    + 'height:calc(100vh - var(--dsh-desktop-titlebar));opacity:.72;}</style></head><body>'
    + `${titlebarMarkup()}<div class="dsh-desktop-loading">正在启动 DeepSeek Harness…</div>`
    + `<script>${titlebarScript()}</script></body></html>`
}
