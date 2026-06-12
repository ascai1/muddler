import { useState } from 'react';
import ScaleRow from './ScaleRow.jsx';
import StatusMessage from './StatusMessage.jsx';
import { makeRow, recomputeEdos, buildContent, parseRawText } from '../utils.js';

export default function InputPanel({ onGenerate, status, loading }) {
  const [edo, setEdo]       = useState(12);
  const [format, setFormat] = useState('degrees');
  const [rawText, setRawText] = useState('');
  const [rows, setRows]     = useState(() => {
    const { rows } = parseRawText('12edo degrees\n1 3 5 6 8 10 12\n1 2 3 5 6');
    return rows;
  });

  function updateRows(nextRows, currentEdo = edo) {
    setRows(recomputeEdos(nextRows, currentEdo));
  }

  function handleEdoChange(val) {
    const next = parseInt(val);
    setEdo(next);
    setRows(prev => recomputeEdos(prev, next));
  }

  function handleFormatChange(val) {
    setFormat(val);
    // Switching to text: pre-fill raw editor from current structured state
    if (val === 'text' && !rawText.trim()) {
      setRawText(buildContent(edo, format, rows, '', false));
    }
    // Switching away from text: parse raw editor back into rows
    if (val !== 'text' && rawText.trim()) {
      try {
        const parsed = parseRawText(rawText);
        setEdo(parsed.edo);
        setRows(recomputeEdos(parsed.rows, parsed.edo));
      } catch {
        // Leave rows as-is if parse fails
      }
    }
  }

  function handleRawTextChange(text) {
    setRawText(text);
    try {
      const parsed = parseRawText(text);
      setEdo(parsed.edo);
      setRows(recomputeEdos(parsed.rows, parsed.edo));
    } catch {
      // Ignore parse errors while user is still typing
    }
  }

  function handleRowChange(index, updatedRow) {
    updateRows(rows.map((r, i) => (i === index ? updatedRow : r)));
  }

  function handleRowRemove(index) {
    const next = rows.filter((_, i) => i !== index);
    updateRows(next.length > 0 ? next : [makeRow(0, [], edo)]);
  }

  function handleAddRow() {
    updateRows([...rows, makeRow(rows.length, rows, edo)]);
  }

  function handleSubmit() {
    const content = buildContent(edo, format, rows, rawText, format === 'text');
    onGenerate(content);
  }

  const showRaw = format === 'text';

  return (
    <section className="panel panel-input" aria-label="Scale input">
      <div className="panel-scroll">

        <div className="input-header-row">
          <div className="field-group">
            <label htmlFor="edo-size">EDO</label>
            <select
              id="edo-size"
              className="edo-select"
              value={edo}
              onChange={(e) => handleEdoChange(e.target.value)}
            >
              {Array.from({ length: 127 }, (_, i) => i + 2).map(n => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
          <div className="field-group">
            <label htmlFor="input-format">Format</label>
            <select
              id="input-format"
              className="format-select"
              value={format}
              onChange={(e) => handleFormatChange(e.target.value)}
            >
              <option value="degrees">Degrees</option>
              <option value="intervals">Intervals</option>
              <option value="binary">Binary</option>
              <option value="text">Raw text</option>
            </select>
          </div>
        </div>

        {showRaw && (
          <div className="raw-editor-wrap">
            <textarea
              className="raw-editor"
              rows={8}
              spellCheck={false}
              placeholder={'12edo degrees\n1 3 5 6 8 10 12\n1 2 3 5 6'}
              value={rawText}
              onChange={(e) => handleRawTextChange(e.target.value)}
            />
            <p className="hint">
              Paste or type muddler input directly. The first line must be{' '}
              <code>NNedo [format]</code>.
            </p>
            <p className="hint" style={{ marginTop: '6px' }}>
              The raw text input supports <code>n\N</code> notation from{' '}
              <a
                href="https://scaleworkshop.plainsound.org/?version=3.3.1#"
                target="_blank"
                rel="noopener noreferrer"
                className="subtitle-link"
                style={{ opacity: 1, textDecoration: 'underline' }}
              >
                Scale Workshop
              </a>{' '}
              if each scale is specified in one whitespace-delimited line.
            </p>
          </div>
        )}

        {!showRaw && (
          <>
            <div className="scale-rows">
              {rows.map((row, i) => (
                <ScaleRow
                  key={i}
                  row={row}
                  rowIndex={i}
                  format={format}
                  canRemove={rows.length > 1}
                  onChange={handleRowChange}
                  onRemove={handleRowRemove}
                />
              ))}
            </div>
            <div className="add-row-bar">
              <button className="btn-ghost" onClick={handleAddRow}>+ Add scale row</button>
            </div>
          </>
        )}
        <div className="submit-bar">
          <StatusMessage msg={status.msg} kind={status.kind} />
          <button className="btn-primary" onClick={handleSubmit} disabled={loading}>
            Generate muddles →
          </button>
        </div>
      </div>
    </section>
  );
}
