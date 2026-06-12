import { useState } from 'react';
import GroupAccordion from './GroupAccordion.jsx';

export default function ResultsPanel({ results }) {
  const [displayFormat, setDisplayFormat] = useState('degrees');

  return (
    <section className="panel panel-results" aria-label="Results">
      <div className="results-toolbar">
        <span className="results-title">Results</span>
        <div className="field-group field-group--inline">
          <label htmlFor="display-format">Show as</label>
          <select
            id="display-format"
            className="format-select format-select--sm"
            value={displayFormat}
            onChange={(e) => setDisplayFormat(e.target.value)}
          >
            <option value="degrees">n\N degrees</option>
            <option value="intervals">Intervals</option>
          </select>
        </div>
      </div>

      <div className="panel-scroll">
        {!results && (
          <div className="results-empty">
            <p>Configure scales on the left and click <strong>Generate muddles</strong>.</p>
          </div>
        )}
        {results && results.length === 0 && (
          <div className="results-empty">
            <p>No muddles generated. Try adjusting your input.</p>
          </div>
        )}
        {results && results.length > 0 && (
          <div className="results-list">
            {results.map((group) => (
              <GroupAccordion
                key={group.group}
                group={group}
                displayFormat={displayFormat}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
