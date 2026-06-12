export const SCRIPT_URL = 'https://github.com/ascai1/muddler';

// ─── Binary ↔ representations ─────────────────────────────────────────────────

// binary: bool[] of length edo, index = degree (0-based internally)
// degrees: number[] of 1-indexed degrees
// intervals: number[] of step sizes (does NOT include closing interval back to root)

export function binaryToDegrees(binary) {
  return binary.reduce((acc, on, i) => (on ? [...acc, i + 1] : acc), []);
}

export function binaryToIntervals(binary) {
  const degrees = binaryToDegrees(binary);
  if (degrees.length < 2) return degrees.length === 1 ? [binary.length] : [];
  const edo = binary.length;
  const result = [];
  for (let i = 0; i < degrees.length - 1; i++) {
    result.push(degrees[i + 1] - degrees[i]);
  }
  // closing interval back to root (not shown in UI, but stored for completeness)
  result.push(edo - degrees[degrees.length - 1] + degrees[0]);
  return result;
}

export function degreesToBinary(degrees, edo) {
  const binary = Array(edo).fill(false);
  degrees.forEach(d => {
    const idx = d - 1; // convert 1-indexed to 0-indexed
    if (idx >= 0 && idx < edo) binary[idx] = true;
  });
  return binary;
}

export function intervalsToBinary(intervals, edo) {
  const binary = Array(edo).fill(false);
  let pos = 0;
  binary[0] = true;
  for (const step of intervals) {
    pos += step;
    if (pos < edo) binary[pos] = true;
  }
  return binary;
}

// Parse a raw text line into binary, given the format declared in the header.
export function parseLineToBinary(line, edo, format) {
  const tokens = line.trim().split(/\s+/).filter(t => /[\d./]/.test(t));
  if (tokens.length === 0) return Array(edo).fill(false);

  if (format === 'binary') {
    const binary = Array(edo).fill(false);
    tokens.slice(0, edo).forEach((t, i) => { binary[i] = t !== '0'; });
    return binary;
  }
  if (format === 'intervals') {
    return intervalsToBinary(tokens.map(Number), edo);
  }
  // degrees (default)
  return degreesToBinary(tokens.map(Number), edo);
}

// ─── Row shape ────────────────────────────────────────────────────────────────
// Every row stores all three representations plus edo and locked.
// binary is always the source of truth; degrees and intervals are derived.
//
// { edo, binary, degrees, intervals, locked }

function deriveRepresentations(binary) {
  return {
    binary,
    degrees: binaryToDegrees(binary),
    intervals: binaryToIntervals(binary),
  };
}

export function makeRow(index, rows, rootEdo) {
  const edo = index === 0 ? rootEdo
    : rows[index - 1] ? nextEdo(rows[index - 1]) : rootEdo;
  return { edo, ...deriveRepresentations(Array(edo).fill(false)), locked: false };
}

// The EDO a row implies for its successor = number of active notes.
export function nextEdo(row) {
  return row.binary.filter(Boolean).length || 1;
}

// Walk rows and recompute each row's .edo from its predecessor.
// Also resizes binary arrays if edo changed, preserving as many bits as possible.
export function recomputeEdos(rows, rootEdo) {
  return rows.map((row, i) => {
    const edo = i === 0 ? rootEdo : nextEdo(rows[i - 1]);
    if (edo === row.edo) return row;
    // Resize binary: truncate or pad with false
    const binary = Array(edo).fill(false).map((_, j) => row.binary[j] ?? false);
    return { ...row, edo, ...deriveRepresentations(binary) };
  });
}

// ─── Row update helpers ───────────────────────────────────────────────────────
// Each takes the current row + the new value for one representation,
// returns a fully updated row with all representations in sync.

export function rowFromBinary(row, binary) {
  return { ...row, ...deriveRepresentations(binary) };
}

export function rowFromDegrees(row, degreesText) {
  const parsed = degreesText.trim().split(/\s+/)
    .filter(Boolean).map(Number).filter(n => !isNaN(n));
  const binary = degreesToBinary(parsed, row.edo);
  return { ...row, ...deriveRepresentations(binary), _degreesText: degreesText };
}

export function rowFromIntervals(row, intervals) {
  const binary = intervalsToBinary(intervals, row.edo);
  return { ...row, ...deriveRepresentations(binary) };
}

// ─── Raw text parsing ─────────────────────────────────────────────────────────

// Parse a full muddler text block into rows with all representations populated.
// Returns { edo, format, rows } or throws on bad header.
export function parseRawText(text) {
  const lines = text.split('\n')
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('#'));

  if (lines.length < 1) throw new Error('Input is empty.');

  // Parse header: "12edo degrees" / "17-EDO intervals" etc.
  const headerTokens = lines[0].split(/\s+/);
  const edoMatch = headerTokens[0].match(/(\d+)/);
  if (!edoMatch) throw new Error('Could not parse EDO size from header.');
  const rootEdo = parseInt(edoMatch[1]);
  const rawFormat = headerTokens[1]?.toLowerCase() ?? 'degrees';
  const format =
    ['degrees', 'positions', 'keys'].some(t => rawFormat.startsWith(t[0])) ? 'degrees'
    : ['intervals', 'steps'].some(t => rawFormat.startsWith(t[0])) ? 'intervals'
    : ['binary', 'onoff'].some(t => rawFormat.startsWith(t[0])) ? 'binary'
    : 'degrees';

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const locked = /\block(ed)?\b/i.test(line);
    const cleanLine = line.replace(/\blocked?\b/i, '').trim();

    const edo = i === 1 ? rootEdo : nextEdo(rows[i - 2]);
    const binary = parseLineToBinary(cleanLine, edo, format);
    rows.push({ edo, ...deriveRepresentations(binary), locked });
  }

  return { edo: rootEdo, format, rows };
}

// ─── Serialisation ────────────────────────────────────────────────────────────

export function buildContent(edo, format, rows, rawText, rawMode) {
  if (rawMode || format === 'text') return rawText.trim();

  const formatName = format === 'degrees' ? 'degrees' : format;
  const lines = [`${edo}edo ${formatName}`];
  rows.forEach(row => {
    let line = '';
    if (format === 'binary') {
      line = row.binary.map(v => (v ? '1' : '0')).join(' ');
    } else if (format === 'intervals') {
      // Emit only the explicit intervals (all but the closing one)
      line = row.intervals.slice(0, -1).join(' ');
    } else {
      line = row.degrees.join(' ');
    }
    if (row.locked) line += ' locked';
    lines.push(line);
  });
  return lines.join('\n');
}

// ─── Context tooltip text ─────────────────────────────────────────────────────

export function buildContextText(context, displayFormat = 'intervals', totalEdo = null) {
  return context
    .map((chain) => {
      return chain.map(step => {
        const modeStr = displayFormat === 'degrees' && totalEdo
          ? step.mode_degrees.map(d => `${d}\\${totalEdo}`).join(' ')
          : `[${step.mode_intervals.join(', ')}]`;
        const srcStr = displayFormat === 'degrees' && totalEdo
          ? step.source_scale_degrees.map(d => `${d}\\${totalEdo}`).join(' ')
          : `[${step.source_scale_intervals.join(', ')}]`;
        return `${modeStr}\n  deg ${step.root_degree} / mode ${step.root_mos_degree} of ${srcStr}`;
      }).join('\n');
    })
    .join('\n\n');
}
