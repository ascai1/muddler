import { useState, useCallback } from 'react';
import { SCRIPT_URL } from '../utils.js';

export function useMuddler() {
  const [results, setResults] = useState(null);
  const [status, setStatus]   = useState({ msg: '', kind: '' }); // kind: '' | 'error' | 'success'
  const [loading, setLoading] = useState(false);

  const generate = useCallback(async (content) => {
    if (!content) {
      setStatus({ msg: 'No input provided.', kind: 'error' });
      return;
    }
    setLoading(true);
    setStatus({ msg: 'Generating...', kind: '' });
    try {
      const res = await fetch('/muddler/muddle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, initial_index: 1 }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus({ msg: data.error || `Error ${res.status}`, kind: 'error' });
        return;
      }
      setResults(data);
      setStatus({
        msg: `${data.length} group${data.length !== 1 ? 's' : ''} found.`,
        kind: 'success',
      });
    } catch (err) {
      setStatus({ msg: `Request failed: ${err.message}`, kind: 'error' });
    } finally {
      setLoading(false);
    }
  }, []);

  return { results, status, loading, generate };
}
