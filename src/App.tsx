import { useMemo, useRef, useState, type ChangeEvent } from 'react';
import {
  PSYNC_P_SIZE,
  defaultProjection,
  exportSnapshotJson,
  importSnapshotJson,
  step,
  type Bit,
  type PrivateBits,
  type PrivateState,
  type PublicState,
} from '@psync/core';

type UiStatus = 'IDLE' | 'RUNNING' | 'FAIL' | 'COMPLETE';

const INITIAL_PRIV_A: PrivateState = { c: 0, b: [1, 0, 1, 1, 0, 1] };
const INITIAL_PRIV_B: PrivateState = { c: 0, b: [1, 0, 1, 1, 0, 0] };
const INITIAL_PUBLIC_STATE: PublicState = { p: 0, k: 0, c_pub: 0 };
const RECEIPT_FUNCTION = (pFinal: number): Bit => (pFinal % 2 === 0 ? 0 : 1);

function toggleBit(bit: Bit): Bit {
  return (bit ^ 1) as Bit;
}

function togglePrivateBit(bits: PrivateBits, index: number): PrivateBits {
  const next = [...bits] as number[];
  next[index] = (next[index] ^ 1) as Bit;
  return next as PrivateBits;
}

const App = () => {
  const [privA, setPrivA] = useState<PrivateState>(INITIAL_PRIV_A);
  const [privB, setPrivB] = useState<PrivateState>(INITIAL_PRIV_B);
  const [publicState, setPublicState] = useState<PublicState>(INITIAL_PUBLIC_STATE);
  const [trace, setTrace] = useState<number[]>([0]);
  const [status, setStatus] = useState<UiStatus>('IDLE');
  const [receiptEnabled, setReceiptEnabled] = useState(false);
  const [nextRoundState, setNextRoundState] = useState<PublicState | null>(null);
  const [snapshotText, setSnapshotText] = useState('');
  const [snapshotMessage, setSnapshotMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getSnapshotJson = () =>
    exportSnapshotJson({
      receiptEnabled,
      status,
      publicState,
      privateA: privA,
      privateB: privB,
      trace,
      nextRoundState,
    });

  const runStep = () => {
    if (publicState.k >= 6 || status === 'FAIL' || status === 'COMPLETE') {
      return;
    }

    setNextRoundState(null);
    const result = step(publicState, privA, privB, defaultProjection);

    if (result.status === 'FAIL') {
      setStatus('FAIL');
      return;
    }

    setPublicState(result.publicState);
    setTrace((prev) => [...prev, result.publicState.p]);

    if (result.status === 'COMPLETE') {
      const nextCPub = receiptEnabled ? RECEIPT_FUNCTION(result.publicState.p) : result.publicState.c_pub;
      setNextRoundState({
        p: result.publicState.p,
        k: 0,
        c_pub: nextCPub,
      });
      setStatus('COMPLETE');
      return;
    }

    setStatus('RUNNING');
  };

  const reset = () => {
    setPublicState(INITIAL_PUBLIC_STATE);
    setTrace([0]);
    setStatus('IDLE');
    setNextRoundState(null);
    setSnapshotMessage(null);
  };

  const handleExportDownload = () => {
    const json = getSnapshotJson();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `psync-snapshot-${Date.now()}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setSnapshotMessage('Snapshot exported to file.');
  };

  const handleExportToEditor = () => {
    setSnapshotText(getSnapshotJson());
    setSnapshotMessage('Snapshot exported to editor.');
  };

  const applySnapshot = (raw: string) => {
    const snapshot = importSnapshotJson(raw);
    setReceiptEnabled(snapshot.receiptEnabled);
    setStatus(snapshot.status);
    setPublicState(snapshot.publicState);
    setPrivA(snapshot.privateA);
    setPrivB(snapshot.privateB);
    setTrace(snapshot.trace);
    setNextRoundState(snapshot.nextRoundState);
  };

  const handleImportFromEditor = () => {
    try {
      applySnapshot(snapshotText);
      setSnapshotMessage('Snapshot imported successfully.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Snapshot import failed.';
      setSnapshotMessage(message);
    }
  };

  const handleImportFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const raw = await file.text();
      setSnapshotText(raw);
      applySnapshot(raw);
      setSnapshotMessage(`Imported snapshot from ${file.name}.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Snapshot import failed.';
      setSnapshotMessage(message);
    } finally {
      event.target.value = '';
    }
  };

  const points = useMemo(() => {
    return Array.from({ length: PSYNC_P_SIZE }).map((_, i) => {
      const angle = (i / PSYNC_P_SIZE) * Math.PI * 2;
      const r = 160;
      return { x: 200 + Math.cos(angle) * r, y: 200 + Math.sin(angle) * r, i };
    });
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#050505] text-white p-4 font-mono">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 w-full max-w-6xl">
        <div className="space-y-6 bg-[#111] p-6 rounded-2xl border border-white/10">
          <h2 className="text-xl font-bold text-blue-400">PSYNC PROJECTION</h2>

          <div className="space-y-4">
            <div className="p-3 bg-white/5 rounded-lg border border-white/5">
              <label className="text-[10px] text-white/40 block mb-2 uppercase tracking-widest">Peer A (c_A, b_A)</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setPrivA((prev) => ({ ...prev, c: toggleBit(prev.c) }))}
                  className={`px-2 py-1 rounded border ${privA.c ? 'bg-blue-600' : 'border-white/20'}`}
                >
                  {privA.c}
                </button>
                <div className="flex gap-1">
                  {privA.b.map((bit, i) => (
                    <button
                      key={i}
                      onClick={() => setPrivA((prev) => ({ ...prev, b: togglePrivateBit(prev.b, i) }))}
                      className={`w-6 h-8 rounded border ${bit ? 'bg-blue-500/40 border-blue-400' : 'border-white/10'}`}
                    >
                      {bit}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-3 bg-white/5 rounded-lg border border-white/5">
              <label className="text-[10px] text-white/40 block mb-2 uppercase tracking-widest">Peer B (c_B, b_B)</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setPrivB((prev) => ({ ...prev, c: toggleBit(prev.c) }))}
                  className={`px-2 py-1 rounded border ${privB.c ? 'bg-indigo-600' : 'border-white/20'}`}
                >
                  {privB.c}
                </button>
                <div className="flex gap-1">
                  {privB.b.map((bit, i) => (
                    <button
                      key={i}
                      onClick={() => setPrivB((prev) => ({ ...prev, b: togglePrivateBit(prev.b, i) }))}
                      className={`w-6 h-8 rounded border ${bit ? 'bg-indigo-500/40 border-indigo-400' : 'border-white/10'}`}
                    >
                      {bit}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2 pt-4">
            <button
              onClick={runStep}
              disabled={status === 'FAIL' || status === 'COMPLETE'}
              className="w-full py-4 bg-white text-black font-black rounded-xl hover:bg-blue-400 transition disabled:opacity-20"
            >
              PROJECT STEP (k={publicState.k})
            </button>
            <button onClick={reset} className="text-[10px] text-white/20 hover:text-white uppercase tracking-widest py-2">
              Reset State
            </button>
            <button
              onClick={() => setReceiptEnabled((prev) => !prev)}
              className={`text-[10px] uppercase tracking-widest py-2 rounded border ${
                receiptEnabled ? 'border-emerald-400/70 text-emerald-300' : 'border-white/20 text-white/40'
              }`}
            >
              Receipt R(p_final)=p_final mod 2: {receiptEnabled ? 'ON' : 'OFF'}
            </button>
            <button
              onClick={handleExportDownload}
              className="text-[10px] uppercase tracking-widest py-2 rounded border border-sky-400/60 text-sky-300"
            >
              Export Snapshot (.json)
            </button>
            <button
              onClick={handleExportToEditor}
              className="text-[10px] uppercase tracking-widest py-2 rounded border border-white/20 text-white/70"
            >
              Export To Editor
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="text-[10px] uppercase tracking-widest py-2 rounded border border-white/20 text-white/70"
            >
              Import From File
            </button>
            <input ref={fileInputRef} type="file" accept="application/json,.json" className="hidden" onChange={handleImportFile} />
            <textarea
              value={snapshotText}
              onChange={(event) => setSnapshotText(event.target.value)}
              placeholder="Paste PSYNC snapshot JSON here"
              rows={6}
              className="w-full bg-black/50 border border-white/15 rounded p-2 text-[10px] text-white/80"
            />
            <button
              onClick={handleImportFromEditor}
              className="text-[10px] uppercase tracking-widest py-2 rounded border border-emerald-400/60 text-emerald-300"
            >
              Import From Editor
            </button>
            {snapshotMessage && <div className="text-[10px] text-white/50">{snapshotMessage}</div>}
          </div>
        </div>

        <div className="lg:col-span-2 relative aspect-square bg-black rounded-3xl border border-white/5 overflow-hidden flex items-center justify-center">
          <div className="absolute top-6 left-6 z-20">
            <div className={`text-xs font-bold tracking-widest uppercase ${status === 'FAIL' ? 'text-red-500' : 'text-emerald-500'}`}>
              STATUS: {status}
            </div>
            <div className="text-[10px] text-white/30 mt-1">
              U = ({publicState.p}, {publicState.k}, {publicState.c_pub})
            </div>
            {nextRoundState && (
              <div className="text-[10px] text-emerald-300/80 mt-1">
                next U = ({nextRoundState.p}, {nextRoundState.k}, {nextRoundState.c_pub})
              </div>
            )}
          </div>

          <svg viewBox="0 0 400 400" className="w-[90%] h-[90%] transform -rotate-90">
            {points.map((point) => (
              <circle key={point.i} cx={point.x} cy={point.y} r="1.5" fill={point.i === publicState.p ? '#60a5fa' : '#222'} />
            ))}

            {trace.length > 1 &&
              trace.map((pIdx, i) => {
                if (i === 0) {
                  return null;
                }

                const prev = points[trace[i - 1]];
                const current = points[pIdx];

                return (
                  <line
                    key={i}
                    x1={prev.x}
                    y1={prev.y}
                    x2={current.x}
                    y2={current.y}
                    stroke="#3b82f6"
                    strokeWidth="2"
                    strokeOpacity={i / trace.length}
                  />
                );
              })}

            <circle
              cx={points[publicState.p].x}
              cy={points[publicState.p].y}
              r="6"
              fill="transparent"
              stroke="#60a5fa"
              strokeWidth="2"
              className="animate-pulse"
            />
          </svg>

          {status === 'FAIL' && (
            <div className="absolute inset-0 bg-red-950/20 backdrop-blur-sm flex items-center justify-center">
              <div className="text-center p-8 bg-black border border-red-500/50 rounded-2xl">
                <h3 className="text-red-500 font-black text-xl tracking-tighter">COMMIT ERROR</h3>
                <p className="text-[10px] text-white/40 mt-2 uppercase">Projections diverged at k={publicState.k}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="mt-8 text-[9px] text-white/20 uppercase tracking-[0.4em] max-w-4xl text-center">
        Formal Closure: F(U, line_A, res_A) == F(U, line_B, res_B)
      </div>
    </div>
  );
};

export default App;
