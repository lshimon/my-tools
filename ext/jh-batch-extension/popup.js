const STORAGE_KEY = "jh_batch_jobs";

const $ = (id) => document.getElementById(id);

const elements = {
  status: $("current-status"),
  preview: $("current-preview"),
  previewTitle: $("preview-title"),
  previewUrl: $("preview-url"),
  previewBody: $("preview-body"),
  addBtn: $("add-btn"),
  refreshBtn: $("refresh-btn"),
  list: $("job-list"),
  listCount: $("list-count"),
  copyBtn: $("copy-btn"),
  clearBtn: $("clear-btn"),
  badge: $("count-badge"),
  toast: $("toast"),
};

let currentExtraction = null;

const toast = (msg, ms = 1500) => {
  elements.toast.textContent = msg;
  elements.toast.classList.remove("hidden");
  requestAnimationFrame(() => elements.toast.classList.add("show"));
  setTimeout(() => {
    elements.toast.classList.remove("show");
    setTimeout(() => elements.toast.classList.add("hidden"), 200);
  }, ms);
};

const getActiveTab = async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
};

const getJobs = async () => {
  const data = await chrome.storage.local.get(STORAGE_KEY);
  return Array.isArray(data[STORAGE_KEY]) ? data[STORAGE_KEY] : [];
};

const setJobs = async (jobs) => {
  await chrome.storage.local.set({ [STORAGE_KEY]: jobs });
  updateBadgeFromCount(jobs.length);
};

const updateBadgeFromCount = (n) => {
  chrome.action.setBadgeText({ text: n > 0 ? String(n) : "" });
  chrome.action.setBadgeBackgroundColor({ color: "#2563eb" });
  elements.badge.textContent = String(n);
};

const truncate = (s, n) => (s.length > n ? s.slice(0, n).trim() + "…" : s);

const renderList = (jobs) => {
  elements.listCount.textContent = `(${jobs.length})`;
  elements.copyBtn.disabled = jobs.length === 0;
  elements.clearBtn.disabled = jobs.length === 0;

  if (jobs.length === 0) {
    elements.list.innerHTML = '<li class="empty muted">No jobs saved yet.</li>';
    return;
  }

  elements.list.innerHTML = "";
  jobs.forEach((job, i) => {
    const li = document.createElement("li");
    const idx = document.createElement("span");
    idx.className = "idx";
    idx.textContent = `${i + 1}.`;
    const title = document.createElement("span");
    title.className = "title";
    title.title = job.title || job.url;
    title.textContent = job.title || job.url || "(untitled)";
    const remove = document.createElement("button");
    remove.className = "remove";
    remove.type = "button";
    remove.textContent = "✕";
    remove.title = "Remove";
    remove.addEventListener("click", async () => {
      const current = await getJobs();
      current.splice(i, 1);
      await setJobs(current);
      renderList(current);
    });
    li.appendChild(idx);
    li.appendChild(title);
    li.appendChild(remove);
    elements.list.appendChild(li);
  });
};

const showPreview = (data) => {
  currentExtraction = data;
  elements.previewTitle.textContent = data.title || "(no title found)";
  elements.previewUrl.textContent = data.url || "";
  elements.previewBody.textContent = truncate(data.description || "", 240) || "(no description found)";
  elements.preview.classList.remove("hidden");
  elements.status.classList.add("hidden");
  elements.addBtn.disabled = !data.description || data.description.length < 20;
};

const showStatus = (msg, isError = false) => {
  elements.status.textContent = msg;
  elements.status.classList.remove("hidden");
  elements.status.style.color = isError ? "#b91c1c" : "";
  elements.preview.classList.add("hidden");
  elements.addBtn.disabled = true;
};

const extractFromActiveTab = async () => {
  showStatus("Scanning page…");
  try {
    const tab = await getActiveTab();
    if (!tab || !tab.id) {
      showStatus("No active tab.", true);
      return;
    }
    if (!tab.url || /^(chrome|edge|about|chrome-extension):/i.test(tab.url)) {
      showStatus("Not a job page (internal URL).", true);
      return;
    }
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["extractor.js"],
    });
    const data = results && results[0] && results[0].result;
    if (!data) {
      showStatus("Could not read page content.", true);
      return;
    }
    showPreview(data);
  } catch (err) {
    showStatus("Extraction failed: " + (err && err.message ? err.message : err), true);
  }
};

const addCurrentToBatch = async () => {
  if (!currentExtraction) return;
  const jobs = await getJobs();
  jobs.push({
    title: currentExtraction.title || "",
    url: currentExtraction.url || "",
    description: currentExtraction.description || "",
    addedAt: Date.now(),
  });
  await setJobs(jobs);
  renderList(jobs);
  toast("Added");
  elements.addBtn.disabled = true;
};

const formatBatch = (jobs) => {
  const blocks = jobs.map((job, i) => {
    const url = (job.url || "").trim();
    const title = (job.title || "").trim();
    const desc = (job.description || "").trim();
    return `${i + 1}- \n${url}\n\n\n${title}\n${desc}`;
  });
  return `JH BATCH\n\n${blocks.join("\n\n---\n\n")}\n\n---\n`;
};

const copyAll = async () => {
  const jobs = await getJobs();
  if (jobs.length === 0) return;
  const text = formatBatch(jobs);
  try {
    await navigator.clipboard.writeText(text);
    toast(`Copied ${jobs.length} job${jobs.length === 1 ? "" : "s"}`);
  } catch (err) {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand("copy");
      toast(`Copied ${jobs.length} job${jobs.length === 1 ? "" : "s"}`);
    } catch (e2) {
      toast("Copy failed", 2200);
    } finally {
      ta.remove();
    }
  }
};

const clearAll = async () => {
  const jobs = await getJobs();
  if (jobs.length === 0) return;
  const ok = confirm(`Clear all ${jobs.length} saved jobs?`);
  if (!ok) return;
  await setJobs([]);
  renderList([]);
  toast("Cleared");
};

const init = async () => {
  elements.refreshBtn.addEventListener("click", extractFromActiveTab);
  elements.addBtn.addEventListener("click", addCurrentToBatch);
  elements.copyBtn.addEventListener("click", copyAll);
  elements.clearBtn.addEventListener("click", clearAll);

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes[STORAGE_KEY]) {
      const jobs = Array.isArray(changes[STORAGE_KEY].newValue)
        ? changes[STORAGE_KEY].newValue
        : [];
      renderList(jobs);
      updateBadgeFromCount(jobs.length);
    }
  });

  const jobs = await getJobs();
  renderList(jobs);
  updateBadgeFromCount(jobs.length);

  extractFromActiveTab();
};

document.addEventListener("DOMContentLoaded", init);
