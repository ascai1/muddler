import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { buildContextText } from '../utils.js';

// ─── Shared AudioContext ───────────────────────────────────────────────────────
// One context for the whole page; browsers require a user gesture to resume it.
let sharedAudioCtx = null;
function getAudioCtx() {
  if (!sharedAudioCtx) {
    sharedAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (sharedAudioCtx.state === 'suspended') sharedAudioCtx.resume();
  return sharedAudioCtx;
}

// ─── Playback ─────────────────────────────────────────────────────────────────
const SLOW_BPM  = 100;
const FAST_BPM  = 500;
const HOLD_S    = 2;
const FADE_S    = 0.015; // cross-fade between notes to avoid clicks
const PEAK      = 0.8;

function edoFreq(baseHz, degree0indexed, totalEdo) {
  return baseHz * Math.pow(2, degree0indexed / totalEdo);
}

// Schedule a single note: ramp to freq at startTime, hold for dur seconds,
// then fade out. Returns the oscillator so it can be stopped early.
function scheduleNote(ctx, masterGain, freq, startTime, dur, peak) {
  const osc  = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.connect(gain);
  gain.connect(masterGain);

  osc.frequency.setValueAtTime(freq, startTime);
  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(peak, startTime + FADE_S);
  gain.gain.setValueAtTime(peak, startTime + dur - FADE_S);
  gain.gain.linearRampToValueAtTime(0, startTime + dur);

  osc.start(startTime);
  osc.stop(startTime + dur);
  return osc;
}

// Build and schedule the full playback sequence.
// Returns a stop() function that silences everything immediately.
function playMode(baseHz, degrees1indexed, totalEdo) {
  const ctx = getAudioCtx();

  // Master gain so we can silence all notes at once on stop
  const master = ctx.createGain();
  master.gain.setValueAtTime(1, ctx.currentTime);
  master.connect(ctx.destination);

  // 0-indexed degrees + octave cap
  const deg0 = degrees1indexed.map(d => d - 1);
  const withOctave = [...deg0, totalEdo]; // octave = N = one full period

  const slowDur = 60 / SLOW_BPM;
  const fastDur = 60 / FAST_BPM;

  const peak = PEAK / Math.pow(withOctave.length, 0.5);

  const oscs = [];
  let t = ctx.currentTime + 0.05; // small lead-in

  // 1. Ascending
  for (const d of withOctave) {
    oscs.push(scheduleNote(ctx, master, edoFreq(baseHz, d, totalEdo), t, slowDur, peak));
    t += slowDur;
  }

  // 2. Descending (omit the octave top which was just played, omit root which comes next)
  const descending = [...withOctave].reverse().slice(1);
  for (const d of descending) {
    oscs.push(scheduleNote(ctx, master, edoFreq(baseHz, d, totalEdo), t, slowDur, peak));
    t += slowDur;
  }

  // 3. Rest for one slow beat before arpeggio
  t += slowDur;

  // 4. Ascending arpeggio at 500bpm — notes overlap with exponential decay,
  //    each sustained until HOLD_S after the last note's attack.
  //    Peak gain scaled by 1/noteCount so the summed signal stays within range.
  const arpeggioEnd = t + withOctave.length * fastDur + HOLD_S;
  for (let i = 0; i < withOctave.length; i++) {
    const attackTime = t + i * fastDur;
    const sustainEnd = arpeggioEnd;
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.connect(gain);
    gain.connect(master);
    osc.frequency.setValueAtTime(edoFreq(baseHz, withOctave[i], totalEdo), attackTime);
    gain.gain.setValueAtTime(0, attackTime);
    gain.gain.linearRampToValueAtTime(peak, attackTime + FADE_S);
    // Exponential decay from peak to near-zero over the remaining sustain window
    gain.gain.setTargetAtTime(0.0001, attackTime + FADE_S, (sustainEnd - attackTime) / 4);
    gain.gain.setValueAtTime(0, sustainEnd);
    osc.start(attackTime);
    osc.stop(sustainEnd);
    oscs.push(osc);
  }
  t = arpeggioEnd;

  // Total duration for auto-stop
  const totalDur = t - ctx.currentTime + 0.1;
  const autoStop = setTimeout(() => {
    master.disconnect();
  }, totalDur * 1000);

  return function stop() {
    clearTimeout(autoStop);
    const now = ctx.currentTime;
    master.gain.setValueAtTime(master.gain.value, now);
    master.gain.linearRampToValueAtTime(0, now + 0.03);
    setTimeout(() => master.disconnect(), 50);
    oscs.forEach(o => { try { o.stop(); } catch {} });
  };
}

// ─── Tooltip ──────────────────────────────────────────────────────────────────
function getModeLabel(mode, totalEdo, displayFormat) {
  if (displayFormat === 'intervals') return mode.intervals.join(' · ');
  return mode.degrees.map((d) => `${d}\\${totalEdo}`).join('  ');
}

function ContextTooltip({ anchorRef, children }) {
  const [pos, setPos] = useState({ top: -9999, left: -9999 });
  const tooltipRef = useRef(null);

  const reposition = useCallback(() => {
    if (!anchorRef.current || !tooltipRef.current) return;
    const anchor  = anchorRef.current.getBoundingClientRect();
    const tip     = tooltipRef.current.getBoundingClientRect();
    const GAP     = 8;
    const MARGIN  = 8;

    const spaceAbove = anchor.top;
    const spaceBelow = window.innerHeight - anchor.bottom;
    const placeAbove = spaceAbove >= tip.height + GAP || spaceAbove >= spaceBelow;

    const top = placeAbove
      ? anchor.top - tip.height - GAP
      : anchor.bottom + GAP;

    let left = anchor.right - tip.width;
    left = Math.max(MARGIN, Math.min(left, window.innerWidth - tip.width - MARGIN));

    setPos({ top, left });
  }, [anchorRef]);

  useEffect(() => {
    reposition();
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    return () => {
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
    };
  }, [reposition]);

  return createPortal(
    <div
      ref={tooltipRef}
      className="mode-tooltip--portal"
      style={{ top: pos.top, left: pos.left }}
    >
      {children}
    </div>,
    document.body
  );
}

function InfoButton({ content }) {
  const [visible, setVisible] = useState(false);
  const btnRef = useRef(null);
  return (
    <div className="mode-info-wrap">
      <button
        ref={btnRef}
        className="mode-info-btn"
        aria-label="Show derivation context"
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
        onFocus={() => setVisible(true)}
        onBlur={() => setVisible(false)}
      >i</button>
      {visible && <ContextTooltip anchorRef={btnRef}>{content}</ContextTooltip>}
    </div>
  );
}

// ─── Play / Stop buttons ──────────────────────────────────────────────────────
function PlayControls({ degrees, totalEdo, baseHz }) {
  const stopRef = useRef(null);
  const [playing, setPlaying] = useState(false);

  // Clean up on unmount
  useEffect(() => () => stopRef.current?.(), []);

  function handlePlay() {
    stopRef.current?.();
    stopRef.current = playMode(baseHz, degrees, totalEdo);
    setPlaying(true);

    // Compute total duration and auto-reset state
    const deg0 = degrees.map(d => d - 1);
    const noteCount = deg0.length + 1; // +1 for octave
    const slowDur = 60 / SLOW_BPM;
    const fastDur = 60 / FAST_BPM;
    // ascending + descending (without repeated endpoints) + rest + arpeggio + hold
    const totalMs = (
      noteCount * slowDur +            // ascending incl. octave
      (noteCount - 1) * slowDur +      // descending (excl. repeated octave, incl. root)
      slowDur +                        // rest beat before arpeggio
      noteCount * fastDur +            // arpeggio attacks
      HOLD_S                           // hold/decay tail
    ) * 1000 + 200;                    // small buffer

    setTimeout(() => setPlaying(false), totalMs);
  }

  function handleStop() {
    stopRef.current?.();
    stopRef.current = null;
    setPlaying(false);
  }

  return (
    <div className="play-controls">
      {!playing ? (
        <button className="play-btn" aria-label="Play mode" onClick={handlePlay}>▶</button>
      ) : (
        <button className="stop-btn" aria-label="Stop playback" onClick={handleStop}>■</button>
      )}
    </div>
  );
}

// ─── ModeRow ──────────────────────────────────────────────────────────────────
export default function ModeRow({ mode, totalEdo, displayFormat, baseHz }) {
  const degreeSet = new Set(mode.degrees);
  const label = getModeLabel(mode, totalEdo, displayFormat);
  const hasContext = mode.context && mode.context.length > 0;

  return (
    <div className="mode-row">
      <div className="mode-row__play">
        <PlayControls degrees={mode.degrees} totalEdo={totalEdo} baseHz={baseHz} />
      </div>

      <div className="mode-row__centre">
        <div className="mode-cells">
          {Array.from({ length: totalEdo }, (_, i) => i + 1).map((d) => (
            <div
              key={d}
              className={`mode-cell${degreeSet.has(d) ? ' on' : ''}`}
              title={`Degree ${d}`}
            />
          ))}
        </div>
        <span className="mode-label">{label}</span>
      </div>

      {hasContext && (
        <div className="mode-row__info">
          <InfoButton content={buildContextText(mode.context, displayFormat, totalEdo)} />
        </div>
      )}
    </div>
  );
}
