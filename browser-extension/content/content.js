/**
 * MyVault Assistant — Content script.
 * Injects a floating button on detected application pages.
 * Uses Shadow DOM for style isolation. Never injects secrets into the host page DOM.
 */

(async function () {
  "use strict";

  // Ask background for matching app
  const response = await new Promise((resolve) => {
    chrome.runtime.sendMessage(
      { type: "GET_MATCHING_APP", url: window.location.href },
      resolve
    );
  });

  if (!response?.app) return;

  const app = response.app;
  const { myvaultUrl } = await chrome.storage.local.get("myvaultUrl");

  // Create host element with Shadow DOM
  const host = document.createElement("div");
  host.id = "myvault-extension-host";
  const shadow = host.attachShadow({ mode: "closed" });

  // Styles
  const style = document.createElement("style");
  style.textContent = `
    .myvault-ext-fab {
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 2147483647;
      width: 44px;
      height: 44px;
      border-radius: 50%;
      background: #000091;
      color: white;
      border: none;
      cursor: pointer;
      font-size: 18px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 3px 10px rgba(0,0,0,0.3);
      transition: transform 0.15s;
    }
    .myvault-ext-fab:hover { transform: scale(1.1); }

    .myvault-ext-panel {
      position: fixed;
      bottom: 76px;
      right: 20px;
      z-index: 2147483646;
      width: 320px;
      background: white;
      border: 1px solid #ddd;
      border-radius: 8px;
      box-shadow: 0 6px 24px rgba(0,0,0,0.2);
      font-family: "Marianne", system-ui, sans-serif;
      font-size: 13px;
      display: none;
      flex-direction: column;
      max-height: 400px;
    }
    .myvault-ext-panel.open { display: flex; }

    .myvault-ext-head {
      background: #000091;
      color: white;
      padding: 10px 14px;
      border-radius: 8px 8px 0 0;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-weight: 700;
      font-size: 13px;
    }
    .myvault-ext-close {
      background: none;
      border: none;
      color: white;
      font-size: 16px;
      cursor: pointer;
    }

    .myvault-ext-body {
      padding: 12px 14px;
      overflow-y: auto;
      flex: 1;
    }

    .myvault-ext-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 5px 0;
      border-bottom: 1px solid #f0f0f0;
      font-size: 12px;
    }
    .myvault-ext-row:last-child { border-bottom: none; }

    .myvault-ext-key { font-weight: 600; }
    .myvault-ext-val { font-family: monospace; color: #888; }

    .myvault-ext-copy {
      background: none;
      border: 1px solid #ddd;
      border-radius: 3px;
      padding: 1px 6px;
      font-size: 11px;
      cursor: pointer;
      color: #000091;
    }

    .myvault-ext-foot {
      padding: 8px 14px;
      border-top: 1px solid #eee;
      text-align: center;
    }
    .myvault-ext-foot a {
      color: #000091;
      text-decoration: none;
      font-size: 12px;
      font-weight: 600;
    }
  `;
  shadow.appendChild(style);

  // FAB
  const fab = document.createElement("button");
  fab.className = "myvault-ext-fab";
  fab.innerHTML = "&#128274;";
  fab.title = `MyVault — ${app.name}`;
  shadow.appendChild(fab);

  // Panel
  const panel = document.createElement("div");
  panel.className = "myvault-ext-panel";
  panel.innerHTML = `
    <div class="myvault-ext-head">
      <span>MyVault — ${escapeHtml(app.name)}</span>
      <button class="myvault-ext-close">&times;</button>
    </div>
    <div class="myvault-ext-body">Chargement...</div>
    <div class="myvault-ext-foot">
      <a href="#" target="_blank" rel="noopener">
        Modifier dans MyVault &#8599;
      </a>
    </div>
  `;
  // Set the link target via property (no HTML parsing → no attribute injection).
  const footLink = panel.querySelector(".myvault-ext-foot a");
  if (footLink) footLink.href = `${myvaultUrl}/app/${app.friendly_slug}`;
  shadow.appendChild(panel);

  let isOpen = false;
  fab.addEventListener("click", () => {
    isOpen = !isOpen;
    panel.classList.toggle("open", isOpen);
    if (isOpen) loadCreds();
  });

  panel.querySelector(".myvault-ext-close").addEventListener("click", () => {
    isOpen = false;
    panel.classList.remove("open");
  });

  function loadCreds() {
    const body = panel.querySelector(".myvault-ext-body");
    body.textContent = "Chargement...";

    chrome.runtime.sendMessage(
      { type: "GET_CREDENTIALS", appSlug: app.friendly_slug },
      (resp) => {
        body.innerHTML = "";
        if (resp?.error || !resp?.credentials?.values) {
          body.textContent = "Credentials non disponibles";
          return;
        }

        for (const [key, value] of Object.entries(resp.credentials.values)) {
          const row = document.createElement("div");
          row.className = "myvault-ext-row";

          const k = document.createElement("span");
          k.className = "myvault-ext-key";
          k.textContent = key;

          const v = document.createElement("span");
          v.className = "myvault-ext-val";
          v.textContent = "••••";

          const btn = document.createElement("button");
          btn.className = "myvault-ext-copy";
          btn.textContent = "Copier";
          btn.addEventListener("click", async () => {
            await navigator.clipboard.writeText(String(value));
            btn.textContent = "OK";
            setTimeout(() => (btn.textContent = "Copier"), 1500);
          });

          row.appendChild(k);
          row.appendChild(v);
          row.appendChild(btn);
          body.appendChild(row);
        }
      }
    );
  }

  function escapeHtml(str) {
    const el = document.createElement("span");
    el.textContent = str;
    return el.innerHTML;
  }

  document.body.appendChild(host);
})();
