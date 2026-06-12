import { useState } from 'react';
import ModeRow from './ModeRow.jsx';

function getGroupLabel(group, displayFormat) {
  if (displayFormat === 'intervals') {
    return `Group ${group.group}: (${group.interval_cycle.join(', ')})`;
  }
  // degrees: show the first mode's degrees as n\N
  const totalEdo = group.interval_cycle.reduce((a, b) => a + b, 0);
  const firstMode = group.modes[0];
  const degreesStr = firstMode
    ? firstMode.degrees.map(d => `${d}\\${totalEdo}`).join(' ')
    : '';
  return `Group ${group.group}: ${degreesStr}`;
}

export default function GroupAccordion({ group, displayFormat, baseHz }) {
  const [open, setOpen] = useState(true);
  const totalEdo = group.interval_cycle.reduce((a, b) => a + b, 0);

  return (
    <div className="group-item">
      <button
        className={`group-header${open ? ' open' : ''}`}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="group-label">{getGroupLabel(group, displayFormat)}</span>
        <span className="group-chevron" aria-hidden="true">▼</span>
      </button>

      <div className={`group-body${open ? ' open' : ''}`}>
        <div className="mode-list">
          {group.modes.map((mode, i) => (
            <ModeRow
              key={i}
              mode={mode}
              totalEdo={totalEdo}
              displayFormat={displayFormat}
              baseHz={baseHz}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

