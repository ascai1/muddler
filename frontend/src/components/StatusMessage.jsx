import { SCRIPT_URL } from '../utils.js';
 
export default function StatusMessage({ msg, kind }) {
  if (!msg) return null;
  const cls = `status-msg${kind ? ` ${kind}` : ''}`;
  if (msg.includes(SCRIPT_URL)) {
    const [before, after] = msg.split(SCRIPT_URL);
    return (
      <span className={cls}>
        {before}
        <a href={SCRIPT_URL} target="_blank" rel="noopener">full Python script</a>
        {after}
      </span>
    );
  }
  return <span className={cls}>{msg}</span>;
}
 
