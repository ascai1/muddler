/* ─── State ───────────────────────────────────────────────────────────────── */
const state = {
  edo: 12,
  format: 'degrees',   // degrees | intervals | binary | text
  rawMode: false,
  rows: [],            // [{intervals:[], locked:bool} | {degrees:string, locked:bool} | {cells:bool[], locked:bool}]
  results: null,
  loading: false,
};

/* ─── DOM refs ────────────────────────────────────────────────────────────── */
const $ = id => document.getElementById(id);
const edoInput      = $('edo-size');
const formatSelect  = $('input-format');
const rawModeCheck  = $('raw-mode');
const rawEditorWrap = $('raw-editor-wrap');
const rawEditor     = $('raw-editor');
const scaleRows     = $('scale-rows');
const addRowBtn     = $('add-row-btn');
const submitBtn     = $('submit-btn');
const statusMsg     = $('status-msg');
const resultsList   = $('results-list');
const resultsEmpty  = $('results-empty');
const displayFormat = $('display-format');
const aboutBtn      = $('about-btn');
const modalOverlay  = $('modal-overlay');
const modalClose    = $('modal-close');

/* ─── Helpers ─────────────────────────────────────────────────────────────── */
function getEdo() { return parseInt(edoInput.value, 10) || 12; }

function rowEdo(rowIndex) {
  // EDO for row i = number of "on" notes in row i-1, or state.edo for row 0
  if (rowIndex === 0) return state.edo;
  const prev = state.rows[rowIndex - 1];
  if (!prev) return state.edo;
  switch (state.format) {
    case 'binary':    return prev.cells.filter(Boolean).length;
    case 'intervals': return prev.intervals.reduce((a, v) => a + (parseInt(v) || 0), 0);
    case 'degrees': {
      const parts = (prev.degrees || '').trim().split(/\s+/).filter(Boolean);
      return parts.length;
    }
    default: return state.edo;
  }
}

/* ─── Row initialisation ─────────────────────────────────────────────────── */
function makeRow(rowIndex) {
  switch (state.format) {
    case 'binary':    return { cells: Array(rowEdo(rowIndex)).fill(false), locked: false };
    case 'intervals': return { intervals: [2, 2, 1, 2, 2, 1, 2], locked: false };
    case 'degrees':   return { degrees: '', locked: false };
    default:          return null;
  }
}

function ensureRows() {
  while (state.rows.length < 2) {
    state.rows.push(makeRow(state.rows.length));
  }
}

/* ─── Render scale rows ───────────────────────────────────────────────────── */
function renderRows() {
  scaleRows.innerHTML = '';
  state.rows.forEach((row, i) => {
    const div = document.createElement('div');
    div.className = 'scale-row';
    div.dataset.index = i;

    // Header
    const header = document.createElement('div');
    header.className = 'scale-row-header';
    const lbl = document.createElement('span');
    lbl.className = 'scale-row-label';
    lbl.textContent = `Scale ${i + 1}  (${rowEdo(i)}-EDO space)`;
    const actions = document.createElement('div');
    actions.className = 'scale-row-actions';

    // Lock checkbox
    const lockLbl = document.createElement('label');
    lockLbl.className = 'lock-checkbox-label';
    const lockChk = document.createElement('input');
    lockChk.type = 'checkbox';
    lockChk.checked = row.locked;
    lockChk.addEventListener('change', () => { state.rows[i].locked = lockChk.checked; });
    lockLbl.appendChild(lockChk);
    lockLbl.appendChild(document.createTextNode('locked'));

    // Remove button (keep at least 1 row)
    const rmBtn = document.createElement('button');
    rmBtn.className = 'btn-icon';
    rmBtn.title = 'Remove row';
    rmBtn.textContent = '✕';
    rmBtn.addEventListener('click', () => {
      state.rows.splice(i, 1);
      if (state.rows.length === 0) state.rows.push(makeRow(0));
      renderRows();
    });

    actions.appendChild(lockLbl);
    if (state.rows.length > 1) actions.appendChild(rmBtn);
    header.appendChild(lbl);
    header.appendChild(actions);
    div.appendChild(header);

    // Input area
    const body = document.createElement('div');
    if (state.format === 'binary') {
      body.appendChild(renderBinaryGrid(row, i));
    } else if (state.format === 'intervals') {
      body.appendChild(renderIntervalRow(row, i));
    } else {
      body.appendChild(renderDegreesInput(row, i));
    }
    div.appendChild(body);
    scaleRows.appendChild(div);
  });
}

function renderBinaryGrid(row, rowIndex) {
  const edoSize = rowEdo(rowIndex);
  // Resize cells array if EDO changed
  while (row.cells.length < edoSize) row.cells.push(false);
  row.cells.length = edoSize;

  const grid = document.createElement('div');
  grid.className = 'binary-grid';
  row.cells.forEach((on, ci) => {
    const cell = document.createElement('button');
    cell.className = 'bin-cell' + (on ? ' on' : '');
    cell.title = `Degree ${ci + 1}`;
    cell.setAttribute('aria-pressed', on ? 'true' : 'false');
    cell.addEventListener('click', () => {
      state.rows[rowIndex].cells[ci] = !state.rows[rowIndex].cells[ci];
      renderRows();
    });
    grid.appendChild(cell);
  });
  return grid;
}

function renderIntervalRow(row, rowIndex) {
  const edoSize = rowEdo(rowIndex);
  const wrap = document.createElement('div');
  wrap.className = 'interval-row';

  function getSum() {
    return row.intervals.reduce((a, v) => a + (parseInt(v) || 0), 0);
  }

  function refresh() {
    wrap.innerHTML = '';
    row.intervals.forEach((val, ii) => {
      const inp = document.createElement('input');
      inp.type = 'number';
      inp.className = 'interval-input';
      inp.value = val;
      inp.min = 1;
      inp.addEventListener('input', () => {
        state.rows[rowIndex].intervals[ii] = parseInt(inp.value) || 0;
        refresh();
      });
      wrap.appendChild(inp);

      if (row.intervals.length > 1) {
        const rm = document.createElement('button');
        rm.className = 'btn-rm-interval';
        rm.textContent = '−';
        rm.title = 'Remove interval';
        rm.addEventListener('click', () => {
          state.rows[rowIndex].intervals.splice(ii, 1);
          refresh();
        });
        wrap.appendChild(rm);
      }
    });

    // Add button
    const addBtn = document.createElement('button');
    addBtn.className = 'btn-add-interval';
    addBtn.textContent = '+';
    addBtn.title = 'Add interval';
    addBtn.addEventListener('click', () => {
      state.rows[rowIndex].intervals.push(1);
      refresh();
    });
    wrap.appendChild(addBtn);

    // Remainder display
    const remainder = edoSize - getSum();
    const remInp = document.createElement('input');
    remInp.type = 'number';
    remInp.className = 'interval-input remainder';
    remInp.value = remainder;
    remInp.title = 'Remaining steps to complete octave';
    remInp.tabIndex = -1;
    wrap.appendChild(remInp);
  }

  refresh();
  return wrap;
}

function renderDegreesInput(row, rowIndex) {
  const inp = document.createElement('input');
  inp.type = 'text';
  inp.className = 'degrees-input';
  inp.value = row.degrees || '';
  inp.placeholder = rowIndex === 0
    ? `e.g. 1 3 5 6 8 10 12  (1-indexed degrees in ${rowEdo(rowIndex)}-EDO)`
    : `e.g. 1 3 4 5 7  (1-indexed degrees in previous scale's note count)`;
  inp.addEventListener('input', () => { state.rows[rowIndex].degrees = inp.value; });
  return inp;
}

/* ─── Build request payload ───────────────────────────────────────────────── */
function buildContent() {
  const edo = state.edo;

  if (state.rawMode || state.format === 'text') {
    return rawEditor.value.trim();
  }

  const formatName = state.format === 'degrees' ? 'degrees' : state.format;
  const lines = [`${edo}edo ${formatName}`];

  state.rows.forEach(row => {
    let line = '';
    if (state.format === 'binary') {
      line = row.cells.map(v => v ? '1' : '0').join(' ');
    } else if (state.format === 'intervals') {
      line = row.intervals.join(' ');
    } else {
      line = (row.degrees || '').trim();
    }
    if (row.locked) line += ' locked';
    lines.push(line);
  });

  return lines.join('\n');
}

/* ─── Results rendering ───────────────────────────────────────────────────── */
function renderResults(groups) {
  resultsList.innerHTML = '';
  resultsEmpty.hidden = true;
  resultsList.hidden = false;

  if (!groups || groups.length === 0) {
    resultsEmpty.hidden = false;
    resultsList.hidden = true;
    resultsEmpty.querySelector('p').textContent = 'No muddles generated. Try adjusting your input.';
    return;
  }

  groups.forEach(group => {
    const item = document.createElement('div');
    item.className = 'group-item';

    const headerBtn = document.createElement('button');
    headerBtn.className = 'group-header';
    headerBtn.setAttribute('aria-expanded', 'false');

    const labelSpan = document.createElement('span');
    labelSpan.className = 'group-label';
    labelSpan.textContent = `Group ${group.group}: (${group.interval_cycle.join(', ')})`;

    const chevron = document.createElement('span');
    chevron.className = 'group-chevron';
    chevron.textContent = '▼';
    chevron.setAttribute('aria-hidden', 'true');

    headerBtn.appendChild(labelSpan);
    headerBtn.appendChild(chevron);

    const body = document.createElement('div');
    body.className = 'group-body';

    const modeList = document.createElement('div');
    modeList.className = 'mode-list';

    group.modes.forEach(mode => {
      modeList.appendChild(renderModeRow(mode, group.interval_cycle.reduce((a, b) => a + b, 0)));
    });

    body.appendChild(modeList);
    item.appendChild(headerBtn);
    item.appendChild(body);

    headerBtn.addEventListener('click', () => {
      const isOpen = body.classList.contains('open');
      body.classList.toggle('open', !isOpen);
      headerBtn.classList.toggle('open', !isOpen);
      headerBtn.setAttribute('aria-expanded', String(!isOpen));
    });

    resultsList.appendChild(item);
  });
}

function renderModeRow(mode, totalEdo) {
  const row = document.createElement('div');
  row.className = 'mode-row';

  // Cell grid — totalEdo cells, lit on mode.degrees
  const degreeSet = new Set(mode.degrees);
  const cells = document.createElement('div');
  cells.className = 'mode-cells';
  for (let d = 1; d <= totalEdo; d++) {
    const cell = document.createElement('div');
    cell.className = 'mode-cell' + (degreeSet.has(d) ? ' on' : '');
    cell.title = `Degree ${d}`;
    cells.appendChild(cell);
  }
  row.appendChild(cells);

  // Label
  const label = document.createElement('span');
  label.className = 'mode-label';
  label.dataset.degrees = mode.degrees.map(d => `${d}\\${totalEdo}`).join('  ');
  label.dataset.intervals = mode.intervals.join(' · ');
  label.textContent = getModeLabel(mode, totalEdo);
  row.appendChild(label);

  // Context info button + tooltip
  if (mode.context && mode.context.length > 0) {
    const infoWrap = document.createElement('div');
    infoWrap.className = 'mode-info-wrap';

    const infoBtn = document.createElement('button');
    infoBtn.className = 'mode-info-btn';
    infoBtn.textContent = 'i';
    infoBtn.setAttribute('aria-label', 'Show derivation context');

    const tooltip = document.createElement('div');
    tooltip.className = 'mode-tooltip';
    tooltip.textContent = buildContextText(mode.context);

    infoWrap.appendChild(infoBtn);
    infoWrap.appendChild(tooltip);
    row.appendChild(infoWrap);
  }

  return row;
}

function getModeLabel(mode, totalEdo) {
  if (displayFormat.value === 'intervals') {
    return mode.intervals.join(' · ');
  }
  return mode.degrees.map(d => `${d}\\${totalEdo}`).join('  ');
}

function buildContextText(context) {
  return context.map((chain, ci) => {
    const chainLines = chain.map(step => {
      const modeStr = `[${step.mode_intervals.join(', ')}]`;
      const srcStr  = `[${step.source_scale_intervals.join(', ')}]`;
      return `  ${modeStr}\n    degree ${step.root_degree} / mode ${step.root_mos_degree} of ${srcStr}`;
    });
    return `— derivation ${ci + 1}:\n${chainLines.join('\n')}`;
  }).join('\n\n');
}

function refreshModeLabels() {
  const totalEdo = state.results
    ? state.results[0]?.interval_cycle.reduce((a, b) => a + b, 0)
    : 0;
  document.querySelectorAll('.mode-label').forEach(lbl => {
    lbl.textContent = displayFormat.value === 'intervals'
      ? lbl.dataset.intervals
      : lbl.dataset.degrees;
  });
}

async function generate() {
  const content = buildContent();
  if (!content) {
    setStatus('No input provided.', 'error');
    return;
  }

  submitBtn.disabled = true;
  setStatus('Generating...', '');

  try {
    const res = await fetch('/muddler/muddle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, initial_index: 1 }),
    });
    const data = await res.json();
    if (!res.ok) {
      setStatus(data.error || `Error ${res.status}`, 'error');
      return;
    }
    state.results = data;
    renderResults(data);
    setStatus(`${data.length} group${data.length !== 1 ? 's' : ''} found.`, 'success');
  } catch (err) {
    setStatus(`Request failed: ${err.message}`, 'error');
  } finally {
    submitBtn.disabled = false;
  }
}

function setStatus(msg, cls) {
  statusMsg.textContent = msg;
  statusMsg.className = 'status-msg' + (cls ? ` ${cls}` : '');
}

/* ─── Event wiring ────────────────────────────────────────────────────────── */
edoInput.addEventListener('change', () => {
  state.edo = getEdo();
  if (state.format === 'binary') {
    // Resize first row's cells
    state.rows[0].cells = Array(state.edo).fill(false);
  }
  renderRows();
});

formatSelect.addEventListener('change', () => {
  state.format = formatSelect.value;
  if (state.format === 'text') {
    state.rawMode = true;
    rawModeCheck.checked = true;
  } else {
    // Re-initialise rows for new format
    state.rows = state.rows.map((_, i) => makeRow(i));
  }
  toggleRawMode();
  renderRows();
});

rawModeCheck.addEventListener('change', () => {
  state.rawMode = rawModeCheck.checked;
  toggleRawMode();
});

function toggleRawMode() {
  const show = state.rawMode || state.format === 'text';
  rawEditorWrap.hidden = !show;
  scaleRows.hidden = show;
  addRowBtn.parentElement.hidden = show;
  if (show && !rawEditor.value.trim()) {
    rawEditor.value = buildContent();
  }
}

addRowBtn.addEventListener('click', () => {
  state.rows.push(makeRow(state.rows.length));
  renderRows();
});

submitBtn.addEventListener('click', generate);

displayFormat.addEventListener('change', refreshModeLabels);

// Modal
aboutBtn.addEventListener('click', () => { modalOverlay.hidden = false; });
modalClose.addEventListener('click', () => { modalOverlay.hidden = true; });
modalOverlay.addEventListener('click', e => { if (e.target === modalOverlay) modalOverlay.hidden = true; });
document.addEventListener('keydown', e => { if (e.key === 'Escape') modalOverlay.hidden = true; });

/* ─── Init ────────────────────────────────────────────────────────────────── */
state.edo = getEdo();
state.format = formatSelect.value;
ensureRows();
renderRows();
