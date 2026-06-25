const GOLDEN_ANGLE = 137.508;
const BAND_SIZE = 60;
const LIGHTNESS_BANDS = [75, 65, 55, 82, 70, 60];
const SATURATION_BANDS = [82, 70, 90, 75, 65];
const DEBOUNCE_MS = 350;

const els = {
  autoScan: document.getElementById('autoScan'),
  caseSensitive: document.getElementById('caseSensitive'),
  termsInput: document.getElementById('termsInput'),
  clearBtn: document.getElementById('clearBtn'),
  status: document.getElementById('status'),
  termCount: document.getElementById('termCount'),
  termsList: document.getElementById('termsList'),
  emptyHint: document.getElementById('emptyHint'),
};

let state = {
  terms: [],
  autoScan: true,
  caseSensitive: false,
  colorIndex: 0,
};

let debounceTimer = null;

function normalizeText(s) {
  return s.replace(/\s+/g, ' ').trim();
}

function nextColor() {
  const i = state.colorIndex++;
  const h = (30 + i * GOLDEN_ANGLE) % 360;
  const band = Math.floor(i / BAND_SIZE);
  const l = LIGHTNESS_BANDS[band % LIGHTNESS_BANDS.length];
  const s = SATURATION_BANDS[Math.floor(band / LIGHTNESS_BANDS.length) % SATURATION_BANDS.length];
  return `hsl(${h.toFixed(2)}, ${s}%, ${l}%)`;
}

async function loadState() {
  const stored = await chrome.storage.local.get([
    'terms', 'autoScan', 'caseSensitive', 'colorIndex',
  ]);
  if (Array.isArray(stored.terms)) state.terms = stored.terms;
  if (typeof stored.autoScan === 'boolean') state.autoScan = stored.autoScan;
  if (typeof stored.caseSensitive === 'boolean') state.caseSensitive = stored.caseSensitive;
  if (typeof stored.colorIndex === 'number') state.colorIndex = stored.colorIndex;

  els.autoScan.checked = state.autoScan;
  els.caseSensitive.checked = state.caseSensitive;
  els.termsInput.value = state.terms.map((t) => t.text).join('\n');
  render();

  if (state.terms.length > 0) {
    await sendHighlightToActiveTab();
  }
}

async function saveState() {
  await chrome.storage.local.set({
    terms: state.terms,
    autoScan: state.autoScan,
    caseSensitive: state.caseSensitive,
    colorIndex: state.colorIndex,
  });
}

function render() {
  els.termCount.textContent = state.terms.length
    ? `(${state.terms.length})`
    : '';
  els.termsList.innerHTML = '';
  if (state.terms.length === 0) {
    els.emptyHint.style.display = 'block';
  } else {
    els.emptyHint.style.display = 'none';
    for (const term of state.terms) {
      els.termsList.appendChild(renderTermRow(term));
    }
  }
}

function renderTermRow(term) {
  const li = document.createElement('li');
  li.className = 'wh-term-row';
  li.title = 'Click to jump to next match';

  const swatch = document.createElement('div');
  swatch.className = 'wh-swatch';
  swatch.style.backgroundColor = term.color;

  const text = document.createElement('span');
  text.className = 'wh-term-text';
  text.textContent = term.text;

  const count = document.createElement('span');
  count.className = 'wh-term-count';
  count.textContent = term.matchCount ?? 0;

  const prevBtn = document.createElement('button');
  prevBtn.className = 'wh-nav-btn';
  prevBtn.textContent = '↑';
  prevBtn.title = 'Previous match';
  prevBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    navigateTerm(term, 'prev');
  });

  const removeBtn = document.createElement('button');
  removeBtn.className = 'wh-remove-btn';
  removeBtn.textContent = '×';
  removeBtn.title = 'Remove this term';
  removeBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    const lines = els.termsInput.value.split('\n');
    const filtered = lines.filter(
      (l) => normalizeText(l).toLowerCase() !== term.text.toLowerCase()
    );
    els.termsInput.value = filtered.join('\n');
    await syncTermsFromInput();
  });

  li.addEventListener('click', () => navigateTerm(term, 'next'));

  li.append(swatch, text, count, prevBtn, removeBtn);
  return li;
}

async function navigateTerm(term, direction) {
  const tab = await getActiveTab();
  if (!tab || !tab.id) return;
  try {
    const response = await chrome.tabs.sendMessage(tab.id, {
      type: 'WH_NAV',
      termId: term.id,
      direction,
    });
    if (!response || !response.ok) return;
    if (response.total === 0) {
      setStatus(`No matches for "${term.text}".`, 'error');
    } else {
      setStatus(
        `${term.text}: ${response.current} / ${response.total}`,
        'success'
      );
    }
  } catch {
    setStatus('Page not ready. Try reloading the tab.', 'error');
  }
}

function parseInput() {
  const raw = els.termsInput.value;
  const lines = raw
    .split('\n')
    .map((l) => normalizeText(l))
    .filter((l) => l.length > 0);
  const unique = [];
  const seen = new Set();
  for (const line of lines) {
    const key = line.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(line);
    }
  }
  return unique;
}

async function syncTermsFromInput() {
  const lines = parseInput();
  const lineKeys = new Set(lines.map((l) => l.toLowerCase()));

  state.terms = state.terms.filter((t) => lineKeys.has(t.text.toLowerCase()));

  const existing = new Set(state.terms.map((t) => t.text.toLowerCase()));
  for (const line of lines) {
    if (!existing.has(line.toLowerCase())) {
      state.terms.push({
        id: crypto.randomUUID(),
        text: line,
        color: nextColor(),
        matchCount: 0,
        caseSensitive: state.caseSensitive,
      });
      existing.add(line.toLowerCase());
    }
  }

  for (const t of state.terms) {
    t.caseSensitive = state.caseSensitive;
  }

  const orderMap = new Map();
  lines.forEach((l, i) => orderMap.set(l.toLowerCase(), i));
  state.terms.sort(
    (a, b) =>
      (orderMap.get(a.text.toLowerCase()) ?? 999) -
      (orderMap.get(b.text.toLowerCase()) ?? 999)
  );

  await saveState();
  render();
  await sendHighlightToActiveTab();
}

function setStatus(msg, kind) {
  els.status.textContent = msg;
  els.status.className = 'wh-status' + (kind ? ' ' + kind : '');
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function ensureContentScript(tabId) {
  try {
    await chrome.tabs.sendMessage(tabId, { type: 'WH_PING' });
    return true;
  } catch {
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['content.js'],
      });
      return true;
    } catch {
      return false;
    }
  }
}

async function sendHighlightToActiveTab() {
  const tab = await getActiveTab();
  if (!tab || !tab.id) return;
  if (tab.url && /^(chrome|edge|about|chrome-extension|view-source):/i.test(tab.url)) {
    setStatus('This page blocks extensions.', 'error');
    return;
  }
  const ready = await ensureContentScript(tab.id);
  if (!ready) {
    setStatus('Cannot inject on this page. Try reloading the tab.', 'error');
    return;
  }
  try {
    const response = await chrome.tabs.sendMessage(tab.id, {
      type: 'WH_APPLY',
      terms: state.terms,
    });
    if (response && response.counts) {
      let changed = false;
      for (const term of state.terms) {
        const c = response.counts[term.id] ?? 0;
        if (term.matchCount !== c) {
          term.matchCount = c;
          changed = true;
        }
      }
      if (changed) {
        await saveState();
        render();
      }
      const total = Object.values(response.counts).reduce((a, b) => a + b, 0);
      if (state.terms.length === 0) {
        setStatus('', '');
      } else {
        setStatus(
          `${total} match${total === 1 ? '' : 'es'} across ${state.terms.length} term${state.terms.length === 1 ? '' : 's'}.`,
          total > 0 ? 'success' : 'live'
        );
      }
    }
  } catch (err) {
    setStatus('Page not ready. Try reloading the tab.', 'error');
  }
}

async function clearActiveTab() {
  const tab = await getActiveTab();
  if (!tab || !tab.id) return;
  try {
    await chrome.tabs.sendMessage(tab.id, { type: 'WH_CLEAR' });
  } catch {
    // ignore
  }
}

els.termsInput.addEventListener('input', () => {
  clearTimeout(debounceTimer);
  setStatus('Typing...', 'live');
  debounceTimer = setTimeout(syncTermsFromInput, DEBOUNCE_MS);
});

els.clearBtn.addEventListener('click', async () => {
  state.terms = [];
  els.termsInput.value = '';
  await saveState();
  render();
  setStatus('Cleared.', '');
  await clearActiveTab();
});

els.autoScan.addEventListener('change', async () => {
  state.autoScan = els.autoScan.checked;
  await saveState();
  setStatus(
    state.autoScan
      ? 'Auto-scan on. New pages highlight automatically.'
      : 'Auto-scan off.',
    ''
  );
});

els.caseSensitive.addEventListener('change', async () => {
  state.caseSensitive = els.caseSensitive.checked;
  for (const t of state.terms) t.caseSensitive = state.caseSensitive;
  await saveState();
  await sendHighlightToActiveTab();
});

loadState();
