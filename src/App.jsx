import React, { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";

// -------------------- Utilities --------------------
function mulberry32(seed) {
  let t = seed >>> 0;
  return function () {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function hashStringToSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
  }
  return h >>> 0;
}

function pickN(arr, n, rng) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, n);
}

function getParam(name) {
  const url = new URL(window.location.href);
  return url.searchParams.get(name);
}

function setParam(name, value) {
  const url = new URL(window.location.href);
  if (value == null || value === "") url.searchParams.delete(name);
  else url.searchParams.set(name, value);
  window.history.replaceState({}, "", url.toString());
}

const DEFAULT_PHRASES = [
  "Traffic stop for expired tags","K-9 unit deployed","Foot chase","Felony warrant hit","Vehicle pursuit called off",
  "Suspect claims it's not their pants","Open container in vehicle","Caller hangs up on dispatch","Argument at gas station",
  "Domestic disturbance (no arrests)","Outstanding warrant discovered","Officer reminds driver to carry insurance",
  "Impounded vehicle","Field sobriety test","Breathalyzer administered","Misdemeanor citation issued",
  "Officer de-escalates tense situation","Bodycam view shifts to another officer","Taser drawn but not used","Backup requested",
  "Found property returned to owner","Informative legal explanation by officer","Dispatch mispronounces street name","Noise complaint",
  "Traffic collision, non-injury","Driver blames GPS","Officer asks: 'Anything illegal in the car?'","Air unit mentioned",
  "Suspect tosses something while running","Consent search of vehicle","Miranda rights read","Passenger has a warrant",
  "Tow truck on scene","Citation for seatbelt","Suspicious person behind a business","Radio goes code silence",
  "Clerk points 'they went that way'","Handcuffs applied without incident","Suspect gives false name","Bike stop",
  "Skateboarder asked to leave property","Open warrant out of another county","Probation search","Stolen vehicle recovered",
  "Shoplifting call","Trespassing warning issued","Neighbors dispute parking","'That's not mine' about backpack",
  "Officer compliments cooperative suspect","Officer says: 'For your safety and mine'","Ambulance staged nearby","Narcan administered",
  "Public intoxication","Citation instead of arrest","Loose dog with animal control called","Missing license plate",
  "Window tint too dark","Air freshener on mirror mentioned","Open carry clarification","Bike without lights at night",
  "Routine pat-down (consent given)","Officer returns wallet found on scene","Victim declines to press charges","Welfare check",
  "Juveniles released to guardian","Fire department requested","Broken tail light","Wrong-way driver corrected",
  "Plate doesn't match vehicle","Expired registration over 6 months","Probable cause explained","Perimeter set up",
  "Spike strips referenced","Cuffed suspect thanks officer","Officer says 'We just want to make sure you're okay'",
  "Bicycle reported stolen","Alleyway search","'I only had two beers'","License suspended","Officer hands out resource card",
  "Dispatch tone-out","Helicopter spotlight","Citation for no proof of insurance","Glass pipe discovered",
  "Vehicle inventory before tow","'Is this being recorded?'","Officer reminds driver to signal","Passenger released on scene",
];

const STORAGE = {
  phrases: "opl_bingo_phrases",
  dark: "opl_bingo_dark",
  options: "opl_bingo_options",
  leaderboard: "opl_bingo_leaderboard",
};

const WIN_PATTERNS = {
  line: "Any row or column",
  diag: "Diagonals count too",
  corners: "Four corners",
  blackout: "Blackout (whole card)",
};

// Compute win status for a given set of marked indices on an N x N card.
// freeIndex = index of the FREE square if enabled, else -1.
function computeWin(marks, size, pattern, freeIndex) {
  const has = (i) => marks.has(i) || i === freeIndex;
  const all = (arr) => arr.every(has);

  // Indices helpers
  const rows = Array.from({ length: size }, (_, r) => Array.from({ length: size }, (_, c) => r*size + c));
  const cols = Array.from({ length: size }, (_, c) => Array.from({ length: size }, (_, r) => r*size + c));
  const mainDiag = Array.from({ length: size }, (_, i) => i*size + i);
  const antiDiag = Array.from({ length: size }, (_, i) => i*size + (size-1-i));

  if (pattern === "blackout") {
    const allIndices = Array.from({ length: size*size }, (_, i) => i).filter(i => i !== freeIndex);
    return all(allIndices);
  }

  const lines = [...rows, ...cols];
  if (pattern === "line") {
    return lines.some(all);
  }
  if (pattern === "diag") {
    return lines.some(all) || all(mainDiag) || all(antiDiag);
  }
  if (pattern === "corners") {
    const corners = [0, size-1, size*(size-1), size*size-1];
    const cornersWin = corners.every(has);
    // Corners-only OR corners plus lines/diags — many parties like corners as standalone.
    return cornersWin || lines.some(all) || all(mainDiag) || all(antiDiag);
  }
  return false;
}

// -------------------- UI Bits --------------------
function Button({ children, onClick, title, className = "" }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={"px-3 py-2 text-sm rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 hover:bg-neutral-50 dark:hover:bg-neutral-800 active:scale-[.98] shadow-sm " + className}
    >
      {children}
    </button>
  );
}

function Toggle({ checked, onChange, label }) {
  return (
    <label className="flex items-center gap-2 text-sm select-none cursor-pointer">
      <span className="hidden sm:block">{label}</span>
      <span className={`relative w-10 h-6 rounded-full transition-colors ${checked ? "bg-blue-600" : "bg-neutral-300 dark:bg-neutral-700"}`} onClick={() => onChange(!checked)}>
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${checked ? "translate-x-4" : ""}`}></span>
      </span>
    </label>
  );
}

function TopBar({ dark, setDark, seed, onRegenerate, onPrint, onShare, onEdit, onOptions, onLeaderboard }) {
  return (
    <div className="w-full flex flex-wrap items-center justify-between gap-2 p-3 rounded-2xl shadow bg-white/80 dark:bg-neutral-900/80 backdrop-blur border border-neutral-200 dark:border-neutral-800">
      <div className="flex items-center gap-3">
        <span className="text-xl font-bold tracking-tight">On Patrol: Live — Bingo+</span>
        <span className="text-xs px-2 py-1 rounded-full bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700">seed: {seed}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button onClick={onRegenerate} title="New random card">🔀 New Card</Button>
        <Button onClick={onShare} title="Copy/Share this exact card">🔗 Share</Button>
        <Button onClick={onPrint} title="Print this card">🖨️ Print</Button>
        <Button onClick={onLeaderboard} title="Leaderboard">🏆 Leaderboard</Button>
        <Button onClick={onOptions} title="Card options">⚙️ Options</Button>
        <Button onClick={onEdit} title="Add or edit squares">✏️ Edit Phrases</Button>
        <Toggle checked={dark} onChange={setDark} label={dark ? "Dark" : "Light"} />
      </div>
    </div>
  );
}

function BingoGrid({ items, marks, onToggle, size }) {
  return (
    <div className="grid gap-2 print:gap-1 w-full" style={{ gridTemplateColumns: `repeat(${size}, minmax(0,1fr))` }}>
      {items.map((text, idx) => (
        <BingoCell key={idx} index={idx} text={text} marked={marks.has(idx)} onToggle={() => onToggle(idx)} />
      ))}
    </div>
  );
}

function BingoCell({ index, text, marked, onToggle }) {
  const isFree = text === "__FREE__";
  return (
    <button
      onClick={onToggle}
      className={`relative min-h-[80px] sm:min-h-[110px] p-2 rounded-2xl border text-center text-xs sm:text-sm leading-snug font-medium shadow-sm print:shadow-none select-none transition-transform active:scale-[.98]
        ${marked ? "bg-green-600 text-white border-green-700" : "bg-white/90 dark:bg-neutral-900/80 border-neutral-200 dark:border-neutral-800"}
      `}
    >
      {isFree ? (
        <div className="flex h-full items-center justify-center">
          <div className={`text-center ${marked ? "text-white" : "text-neutral-700 dark:text-neutral-200"}`}>
            <div className="text-lg sm:text-2xl font-black tracking-wider">FREE</div>
            <div className="text-[10px] sm:text-xs opacity-80">Stay Safe ✦ Be Kind</div>
          </div>
        </div>
      ) : (
        <span className={`${marked ? "text-white" : "text-neutral-800 dark:text-neutral-100"}`}>{text}</span>
      )}
      <span className="absolute -top-2 -right-2 text-[10px] opacity-40 print:hidden">{index + 1}</span>
    </button>
  );
}

function PhraseEditor({ open, onClose, phrases, setPhrases, resetDefaults }) {
  const [text, setText] = useState(phrases.join("\n"));
  const fileRef = useRef(null);

  useEffect(() => { if (open) setText(phrases.join("\n")); }, [open, phrases]);

  const doSave = () => {
    const cleaned = text.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    setPhrases(cleaned);
    onClose();
  };
  const doExport = () => {
    const blob = new Blob([JSON.stringify({ phrases }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "on-patrol-live-bingo-phrases.json"; a.click();
    URL.revokeObjectURL(url);
  };
  const doImport = (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (Array.isArray(data)) setText(data.join("\n"));
        else if (Array.isArray(data.phrases)) setText(data.phrases.join("\n"));
      } catch { alert("Invalid JSON"); }
    };
    reader.readAsText(file);
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="w-full max-w-3xl rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-xl overflow-hidden">
        <div className="p-4 flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800">
          <h2 className="text-lg font-semibold">Edit Phrases</h2>
          <button onClick={onClose} className="text-sm px-2 py-1 rounded-lg border">Close</button>
        </div>
        <div className="p-4 space-y-3">
          <p className="text-sm opacity-80">One phrase per line. Save persists to your browser.</p>
          <textarea className="w-full h-72 p-3 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 font-mono text-sm"
            value={text} onChange={(e) => setText(e.target.value)} />
          <div className="flex flex-wrap gap-2">
            <Button onClick={doSave}>💾 Save</Button>
            <Button onClick={resetDefaults}>↺ Reset to defaults</Button>
            <Button onClick={doExport}>⬇️ Export JSON</Button>
            <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={doImport} />
            <Button onClick={() => fileRef.current?.click()}>⬆️ Import JSON</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function OptionsPanel({ open, onClose, options, setOptions }) {
  const [local, setLocal] = useState(options);
  useEffect(() => { if (open) setLocal(options); }, [open, options]);

  const update = (patch) => setLocal({ ...local, ...patch });
  const save = () => { setOptions(local); onClose(); };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/50">
      <div className="w-full max-w-xl rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-xl overflow-hidden">
        <div className="p-4 flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800">
          <h2 className="text-lg font-semibold">Card Options</h2>
          <button onClick={onClose} className="text-sm px-2 py-1 rounded-lg border">Close</button>
        </div>
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm">Size
              <select className="w-full mt-1 p-2 rounded-lg border" value={local.size} onChange={(e)=>update({size: parseInt(e.target.value)})}>
                <option value={3}>3 × 3</option>
                <option value={4}>4 × 4</option>
                <option value={5}>5 × 5</option>
              </select>
            </label>
            <label className="text-sm">Win Pattern
              <select className="w-full mt-1 p-2 rounded-lg border" value={local.pattern} onChange={(e)=>update({pattern: e.target.value})}>
                <option value="line">Lines (rows/cols)</option>
                <option value="diag">Lines + Diagonals</option>
                <option value="corners">Four Corners</option>
                <option value="blackout">Blackout (whole card)</option>
              </select>
            </label>
            <label className="text-sm flex items-center gap-2 mt-2">
              <input type="checkbox" checked={local.free} onChange={(e)=>update({free: e.target.checked})} />
              FREE center
            </label>
            <label className="text-sm">Seed (blank = random)
              <input className="w-full mt-1 p-2 rounded-lg border" value={local.seed} onChange={(e)=>update({seed: e.target.value})} placeholder="e.g. 123456" />
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={save}>💾 Save</Button>
            <Button onClick={()=>setLocal(options)}>↺ Revert</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Leaderboard({ open, onClose, board, setBoard }) {
  const [name, setName] = useState("");
  const addPlayer = () => {
    const n = name.trim(); if (!n) return;
    if (board.players.some(p => p.name.toLowerCase() === n.toLowerCase())) { alert("Player exists"); return; }
    setBoard({ ...board, players: [...board.players, { name: n, wins: 0 }] });
    setName("");
  };
  const bump = (i, delta) => {
    const players = board.players.map((p, idx) => idx===i ? { ...p, wins: Math.max(0, p.wins + delta) } : p);
    setBoard({ ...board, players });
  };
  const remove = (i) => setBoard({ ...board, players: board.players.filter((_,idx)=>idx!==i) });
  const resetWins = () => setBoard({ ...board, players: board.players.map(p => ({...p, wins:0})) });
  const exportBoard = () => {
    const blob = new Blob([JSON.stringify(board, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "opl-leaderboard.json"; a.click();
    URL.revokeObjectURL(url);
  };
  const importBoard = (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (data && Array.isArray(data.players)) setBoard({ players: data.players.map(p => ({ name: String(p.name), wins: Number(p.wins)||0 })) });
      } catch { alert("Invalid JSON"); }
    };
    reader.readAsText(file);
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="w-full max-w-2xl rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-xl overflow-hidden">
        <div className="p-4 flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800">
          <h2 className="text-lg font-semibold">Leaderboard</h2>
          <button onClick={onClose} className="text-sm px-2 py-1 rounded-lg border">Close</button>
        </div>
        <div className="p-4 space-y-3">
          <div className="flex gap-2">
            <input className="flex-1 p-2 rounded-lg border" placeholder="Add player name" value={name} onChange={(e)=>setName(e.target.value)} />
            <Button onClick={addPlayer}>➕ Add</Button>
            <Button onClick={resetWins}>↺ Reset Wins</Button>
            <Button onClick={exportBoard}>⬇️ Export</Button>
            <label className="px-3 py-2 text-sm rounded-xl border cursor-pointer">
              ⬆️ Import
              <input type="file" accept="application/json" className="hidden" onChange={importBoard} />
            </label>
          </div>
          <table className="w-full text-sm border-separate border-spacing-y-1">
            <thead>
              <tr className="text-left opacity-70"><th className="px-2">Player</th><th>Wins</th><th></th></tr>
            </thead>
            <tbody>
              {board.players.sort((a,b)=>b.wins-a.wins || a.name.localeCompare(b.name)).map((p, i) => (
                <tr key={p.name} className="bg-white/80 dark:bg-neutral-800/60">
                  <td className="px-2 py-2 rounded-l-xl">{p.name}</td>
                  <td className="px-2 py-2">
                    <div className="inline-flex items-center gap-2">
                      <Button onClick={()=>bump(i,-1)}>−</Button>
                      <span className="min-w-[2ch] text-center">{p.wins}</span>
                      <Button onClick={()=>bump(i,1)}>＋</Button>
                    </div>
                  </td>
                  <td className="px-2 py-2 text-right rounded-r-xl">
                    <Button onClick={()=>remove(i)}>🗑️ Remove</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-xs opacity-60">Stored locally in your browser so it works on GitHub Pages. Use Export/Import if you switch devices.</p>
        </div>
      </div>
    </div>
  );
}

// -------------------- App --------------------
export default function App() {
  // theme
  const [dark, setDark] = useState(() => localStorage.getItem(STORAGE.dark) === "1");
  useEffect(() => { document.documentElement.classList.toggle("dark", dark); localStorage.setItem(STORAGE.dark, dark ? "1":"0"); }, [dark]);

  // phrases
  const [phrases, setPhrases] = useState(() => {
    const saved = localStorage.getItem(STORAGE.phrases);
    return saved ? JSON.parse(saved) : DEFAULT_PHRASES;
  });
  useEffect(() => { localStorage.setItem(STORAGE.phrases, JSON.stringify(phrases)); }, [phrases]);

  // options
  const [options, setOptions] = useState(() => {
    const saved = localStorage.getItem(STORAGE.options);
    return saved ? JSON.parse(saved) : { size: 5, free: true, pattern: "diag", seed: "" };
  });
  useEffect(() => { localStorage.setItem(STORAGE.options, JSON.stringify(options)); }, [options]);

  const [seed, setSeed] = useState(() => getParam("seed") || options.seed || Math.floor(Math.random()*1e9).toString());
  const rng = useMemo(() => mulberry32(hashStringToSeed(seed)), [seed]);

  // items according to options
  const items = useMemo(() => {
    const count = options.size * options.size - (options.free ? 1 : 0);
    const pool = pickN(phrases, Math.max(count, 0), rng);
    if (!options.free) return pool;
    const mid = Math.floor((options.size*options.size)/2);
    const first = pool.slice(0, mid);
    const rest = pool.slice(mid);
    return [...first, "__FREE__", ...rest];
  }, [phrases, rng, options]);

  const [marks, setMarks] = useState(new Set());
  const freeIndex = options.free ? Math.floor((options.size*options.size)/2) : -1;

  useEffect(() => { setParam("seed", seed); }, [seed]);

  const toggleMark = (idx) => {
    if (idx === freeIndex) return;
    setMarks(prev => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  };
  const regenerate = () => { setSeed(options.seed || Math.floor(Math.random()*1e9).toString()); setMarks(new Set()); };

  // share
  const copyOrShare = async () => {
    const url = new URL(window.location.href);
    try {
      if (navigator.share) await navigator.share({ title: "On Patrol: Live — Bingo+", url: url.toString() });
      else { await navigator.clipboard.writeText(url.toString()); alert("Link copied to clipboard"); }
    } catch {}
  };

  // leader board
  const [board, setBoard] = useState(() => {
    const saved = localStorage.getItem(STORAGE.leaderboard);
    return saved ? JSON.parse(saved) : { players: [] };
  });
  useEffect(() => { localStorage.setItem(STORAGE.leaderboard, JSON.stringify(board)); }, [board]);

  const [showEditor, setShowEditor] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [showBoard, setShowBoard] = useState(false);

  // Bingo call + validation
  const [callerName, setCallerName] = useState("");
  const [callResult, setCallResult] = useState(null);
  const validateBingo = () => {
    const ok = computeWin(marks, options.size, options.pattern, freeIndex);
    setCallResult(ok ? "valid" : "invalid");
    if (ok && callerName.trim()) {
      const name = callerName.trim();
      const exists = board.players.find(p => p.name.toLowerCase() === name.toLowerCase());
      if (exists) {
        setBoard({ players: board.players.map(p => p.name.toLowerCase()===name.toLowerCase() ? { ...p, wins: p.wins+1 } : p) });
      } else {
        setBoard({ players: [...board.players, { name, wins: 1 }] });
      }
    }
  };

  // QR for sharing this seed/card
  const qrCanvasRef = useRef(null);
  useEffect(() => {
    const url = new URL(window.location.href);
    QRCode.toCanvas(qrCanvasRef.current, url.toString(), { width: 160 });
  }, [seed, options.size, options.free, options.pattern]);

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-neutral-50 to-neutral-100 dark:from-neutral-950 dark:to-neutral-900 text-neutral-900 dark:text-neutral-100">
      <style>{`
        @media print {
          .print\:hidden { display: none !important; }
          .print\:grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .print\:gap-1 { gap: 0.25rem; }
        }
      `}</style>
      <div className="mx-auto max-w-6xl p-4 space-y-4">
        <TopBar
          dark={dark}
          setDark={setDark}
          seed={seed}
          onRegenerate={regenerate}
          onPrint={() => window.print()}
          onShare={copyOrShare}
          onEdit={() => setShowEditor(true)}
          onOptions={() => setShowOptions(true)}
          onLeaderboard={() => setShowBoard(true)}
        />

        <div className="grid lg:grid-cols-[1fr,360px] gap-4 items-start">
          <div className="rounded-2xl p-3 bg-white/80 dark:bg-neutral-900/70 border border-neutral-200 dark:border-neutral-800 shadow">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <div className="text-2xl font-extrabold tracking-tight">BINGO</div>
                <div className="text-xs opacity-70">On Patrol: Live — Episode Card</div>
              </div>
              <div className="flex gap-2 print:hidden">
                <button className="px-3 py-2 text-sm rounded-xl border" onClick={() => { window.location.search=''; }}>Reset Link</button>
                <button className="px-3 py-2 text-sm rounded-xl border" onClick={() => { localStorage.clear(); window.location.reload(); }}>Full Reset</button>
              </div>
            </div>

            <BingoGrid items={items} marks={marks} onToggle={toggleMark} size={options.size} />
            <div className="mt-3 grid sm:grid-cols-2 gap-2 print:hidden">
              <div className="flex items-center gap-2">
                <input className="flex-1 p-2 rounded-lg border" placeholder="Who's calling bingo?" value={callerName} onChange={(e)=>setCallerName(e.target.value)} />
                <Button onClick={validateBingo}>📣 Call Bingo</Button>
              </div>
              <div className="flex items-center gap-2">
                <Button onClick={()=>setMarks(new Set())}>🧽 Clear Marks</Button>
                <Button onClick={()=>window.print()}>🖨️ Print</Button>
                <Button onClick={copyOrShare}>🔗 Share</Button>
              </div>
            </div>
            {callResult && (
              <div className={"mt-2 text-sm " + (callResult==="valid" ? "text-green-600" : "text-red-600")}>
                {callResult === "valid" ? "✅ Valid bingo! Leaderboard updated." : "❌ Not a valid bingo for current pattern."}
              </div>
            )}
            <div className="mt-3 text-xs opacity-70 print:hidden">
              Tip: FREE center can be toggled in Options. Current win: <b>{WIN_PATTERNS[options.pattern]}</b>.
            </div>
          </div>

          <aside className="space-y-3 print:hidden">
            <div className="rounded-2xl p-3 bg-white/80 dark:bg-neutral-900/70 border border-neutral-200 dark:border-neutral-800 shadow">
              <h3 className="font-semibold mb-2">Episode Tools</h3>
              <div className="grid grid-cols-2 gap-2">
                <Button onClick={copyOrShare}>Copy Link</Button>
                <Button onClick={() => window.print()}>Print Card</Button>
                <Button onClick={() => setShowOptions(true)}>Card Options…</Button>
                <Button onClick={() => setShowEditor(true)}>Edit Phrases…</Button>
              </div>
            </div>

            <div className="rounded-2xl p-3 bg-white/80 dark:bg-neutral-900/70 border border-neutral-200 dark:border-neutral-800 shadow">
              <h3 className="font-semibold mb-2">Share this Card</h3>
              <canvas ref={qrCanvasRef} className="mx-auto"></canvas>
              <p className="text-xs opacity-60 mt-2 text-center">Scan to open the exact same seed/options.</p>
            </div>

            <div className="rounded-2xl p-3 bg-white/80 dark:bg-neutral-900/70 border border-neutral-200 dark:border-neutral-800 shadow">
              <h3 className="font-semibold mb-2">Leaderboard (Top 5)</h3>
              <ul className="text-sm space-y-1">
                {board.players.sort((a,b)=>b.wins-a.wins || a.name.localeCompare(b.name)).slice(0,5).map(p => (
                  <li key={p.name} className="flex justify-between"><span>{p.name}</span><span>{p.wins}</span></li>
                ))}
              </ul>
              <div className="mt-2 text-right">
                <Button onClick={()=>setShowBoard(true)}>Open Full Leaderboard</Button>
              </div>
            </div>
          </aside>
        </div>
      </div>

      <PhraseEditor
        open={showEditor}
        onClose={() => setShowEditor(false)}
        phrases={phrases}
        setPhrases={setPhrases}
        resetDefaults={()=>setPhrases(DEFAULT_PHRASES)}
      />
      <OptionsPanel
        open={showOptions}
        onClose={()=>setShowOptions(false)}
        options={options}
        setOptions={(opts)=>{ setOptions(opts); setSeed(opts.seed || Math.floor(Math.random()*1e9).toString()); setMarks(new Set()); }}
      />
      <Leaderboard
        open={showBoard}
        onClose={()=>setShowBoard(false)}
        board={board}
        setBoard={setBoard}
      />

      <div className="p-4 text-center text-xs opacity-60">© {new Date().getFullYear()} On Patrol: Live — Bingo+</div>
    </div>
  );
}
