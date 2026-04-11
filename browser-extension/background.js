/**
 * MyVault Assistant — Background service worker.
 * Manages app list sync, URL pattern matching, and badge updates.
 */

const DEFAULT_MYVAULT_URL = "https://myvault.example.com";

// Cached app list with URL patterns
let appRegistry = [];

// Initialize on install
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({ myvaultUrl: DEFAULT_MYVAULT_URL, apps: [] });
  syncApps();
});

// Sync apps on startup
chrome.runtime.onStartup.addListener(syncApps);

// Listen for messages from popup and content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "GET_APPS") {
    sendResponse({ apps: appRegistry });
    return true;
  }

  if (message.type === "GET_MATCHING_APP") {
    const url = message.url;
    const match = findMatchingApp(url);
    sendResponse({ app: match });
    return true;
  }

  if (message.type === "SYNC_APPS") {
    syncApps().then(() => sendResponse({ ok: true }));
    return true;
  }

  if (message.type === "GET_CREDENTIALS") {
    getCredentials(message.appSlug)
      .then((creds) => sendResponse({ credentials: creds }))
      .catch((err) => sendResponse({ error: err.message }));
    return true;
  }

  return false;
});

// Update badge when tab changes
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  const tab = await chrome.tabs.get(activeInfo.tabId);
  updateBadge(tab);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete") {
    updateBadge(tab);
  }
});

async function syncApps() {
  const { myvaultUrl } = await chrome.storage.local.get("myvaultUrl");
  try {
    const resp = await fetch(`${myvaultUrl}/api/v1/me/apps`, {
      credentials: "include",
    });
    if (resp.ok) {
      appRegistry = await resp.json();
      await chrome.storage.local.set({ apps: appRegistry });
    }
  } catch {
    // Offline or not authenticated — use cached list
    const { apps } = await chrome.storage.local.get("apps");
    appRegistry = apps || [];
  }
}

function findMatchingApp(url) {
  if (!url) return null;
  // Check stored URL patterns
  for (const app of appRegistry) {
    if (app.url_patterns) {
      for (const pattern of app.url_patterns) {
        const regex = patternToRegex(pattern);
        if (regex.test(url)) return app;
      }
    }
  }
  return null;
}

function patternToRegex(pattern) {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*");
  return new RegExp(`^${escaped}$`);
}

function updateBadge(tab) {
  if (!tab?.url) return;
  const match = findMatchingApp(tab.url);
  if (match) {
    chrome.action.setBadgeText({ tabId: tab.id, text: "1" });
    chrome.action.setBadgeBackgroundColor({ tabId: tab.id, color: "#000091" });
  } else {
    chrome.action.setBadgeText({ tabId: tab.id, text: "" });
  }
}

async function getCredentials(appSlug) {
  const { myvaultUrl } = await chrome.storage.local.get("myvaultUrl");
  const resp = await fetch(
    `${myvaultUrl}/api/v1/me/apps/${appSlug}/entries`,
    { credentials: "include" }
  );
  if (!resp.ok) throw new Error("Failed to fetch credentials");
  return resp.json();
}
