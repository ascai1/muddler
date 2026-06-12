import { rowFromBinary, rowFromDegrees, rowFromIntervals } from '../utils.js';

// ─── Binary grid ──────────────────────────────────────────────────────────────
function BinaryGrid({ row, onChange }) {
  return (
    <div className="binary-grid">
      {row.binary.map((on, ci) => (
        <button
          key={ci}
          className={`bin-cell${on ? ' on' : ''}`}
          title={`Degree ${ci + 1}`}
          aria-pressed={on}
          onClick={() => {
            const next = [...row.binary];
            next[ci] = !next[ci];
            onChange(rowFromBinary(row, next));
          }}
        />
      ))}
    </div>
  );
}

// ─── Interval row ─────────────────────────────────────────────────────────────
function IntervalRow({ row, onChange }) {
  // Display all intervals except the implicit closing one
  const displayed = row.intervals.slice(0, -1);
  const closingInterval = row.intervals[row.intervals.length - 1] ?? row.edo;

  function update(next) {
    onChange(rowFromIntervals(row, next));
  }

  return (
    <div className="interval-row">
      {displayed.map((val, ii) => (
        <span key={ii} style={{ display: 'contents' }}>
          <input
            type="number"
            className="interval-input"
            value={val}
            min={1}
            onChange={(e) => {
              const next = [...displayed];
              next[ii] = parseInt(e.target.value) || 0;
              update(next);
            }}
          />
          {displayed.length > 1 && (
            <button
              className="btn-rm-interval"
              title="Remove interval"
              onClick={() => update(displayed.filter((_, i) => i !== ii))}
            >−</button>
          )}
        </span>
      ))}
      <button
        className="btn-add-interval"
        title="Add interval"
        onClick={() => update([...displayed, 1])}
      >+</button>
      <input
        type="number"
        className="interval-input remainder"
        value={closingInterval}
        readOnly
        tabIndex={-1}
        title="Closing interval back to root"
      />
    </div>
  );
}

// ─── Degrees input ────────────────────────────────────────────────────────────
function DegreesInput({ row, rowIndex, onChange }) {
  // Show the stored text if present (preserves partial/in-progress input),
  // otherwise derive display text from the canonical degrees array.
  const value = row._degreesText ?? row.degrees.join(' ');
  const placeholder = rowIndex === 0
    ? `e.g. 1 3 5 6 8 10 12  (1-indexed degrees in ${row.edo}-EDO)`
    : `e.g. 1 2 3 5 6  (1-indexed degrees in previous scale's note count)`;

  return (
    <input
      type="text"
      className="degrees-input"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(rowFromDegrees(row, e.target.value))}
    />
  );
}

// ─── ScaleRow ─────────────────────────────────────────────────────────────────
export default function ScaleRow({ row, rowIndex, format, canRemove, onChange, onRemove }) {
  return (
    <div className="scale-row">
      <div className="scale-row-header">
        <span className="scale-row-label">Scale {rowIndex + 1}&ensp;({row.edo}-EDO space)</span>
        <div className="scale-row-actions">
          <label className="lock-checkbox-label">
            <input
              type="checkbox"
              checked={row.locked}
              onChange={(e) => onChange(rowIndex, { ...row, locked: e.target.checked })}
            />
            locked
          </label>
          {canRemove && (
            <button className="btn-icon" title="Remove row" onClick={() => onRemove(rowIndex)}>✕</button>
          )}
        </div>
      </div>

      {format === 'binary'    && <BinaryGrid    row={row} onChange={(r) => onChange(rowIndex, r)} />}
      {format === 'intervals' && <IntervalRow   row={row} onChange={(r) => onChange(rowIndex, r)} />}
      {format === 'degrees'   && <DegreesInput  row={row} rowIndex={rowIndex} onChange={(r) => onChange(rowIndex, r)} />}
    </div>
  );
}
