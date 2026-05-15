'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import AuthGuard from '@/components/AuthGuard';
import { API, ScanResult, ApiError } from '@/lib/api';
import { laplacianVariance, meanLuma } from '@/lib/blur';

// ── Auto-capture state machine ────────────────────────────────────────────────
type Phase = 'requesting' | 'scanning' | 'capturing' | 'sending' | 'result' | 'error';

const QUALITY_THRESHOLD = 60;
const QUALITY_TARGET = 5;
const DECAY_RATE = 1.5;
const LUMA_STABILITY_THRESHOLD = 8;

function formatPrice(v?: number | null) {
  if (v == null) return '—';
  return `$${v.toFixed(2)}`;
}

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color = pct >= 80 ? 'bg-green-500' : pct >= 50 ? 'bg-yellow-500' : 'bg-red-500';
  return (
    <div className="w-full">
      <div className="flex justify-between text-xs text-gray-500 mb-1">
        <span>Confidence</span><span>{pct}%</span>
      </div>
      <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function ResultSheet({ result, onDismiss, onScanAnother }: {
  result: ScanResult;
  onDismiss: () => void;
  onScanAnother: () => void;
}) {
  const router = useRouter();
  const { item } = result;

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onDismiss} />
      <div className="relative w-full md:max-w-md bg-white dark:bg-gray-900 rounded-t-2xl md:rounded-2xl shadow-2xl p-6 pb-8 animate-in slide-in-from-bottom duration-300">
        <div className="w-10 h-1 bg-gray-300 dark:bg-gray-700 rounded-full mx-auto mb-4 md:hidden" />

        <div className="flex items-start gap-4 mb-4">
          {item.image_url ? (
            <img src={item.image_url} alt={result.player_name} className="w-24 h-auto rounded-lg object-cover flex-shrink-0 shadow" style={{ aspectRatio: '63/88' }} />
          ) : (
            <div className="w-24 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center flex-shrink-0 text-orange-500 font-bold text-lg" style={{ aspectRatio: '63/88' }}>
              {result.player_name?.split(' ').map(w => w[0]).join('').slice(0, 2)}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 truncate">{result.player_name}</h2>
            {result.team && <p className="text-sm text-gray-500">{result.team}{result.position ? ` · ${result.position}` : ''}</p>}
            {result.year && <p className="text-sm text-gray-500">{result.year} {result.set_name ?? ''}</p>}
            {result.variant && result.variant !== 'Base' && (
              <span className="inline-block mt-1 text-xs px-2 py-0.5 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded-full font-medium">
                {result.variant}
              </span>
            )}
          </div>
        </div>

        <ConfidenceBar value={result.confidence} />

        {(item.low_price != null || item.mid_price != null || item.high_price != null) && (
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            {[['Low', item.low_price], ['Mid', item.mid_price], ['High', item.high_price]].map(([label, val]) => (
              <div key={label as string} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-2">
                <p className="text-xs text-gray-500 mb-0.5">{label}</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{formatPrice(val as number)}</p>
              </div>
            ))}
          </div>
        )}

        {result.notes && (
          <p className="mt-3 text-xs text-gray-500 dark:text-gray-400 italic">{result.notes}</p>
        )}

        <div className="mt-5 flex gap-3">
          <button
            onClick={onScanAnother}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            Scan Another
          </button>
          <button
            onClick={() => router.push(`/collection/${item.id}`)}
            className="flex-1 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold transition-colors"
          >
            View Card
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ScanPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const analysisRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const qualityRef = useRef(0);
  const prevLumaRef = useRef<number | null>(null);

  const [phase, setPhase] = useState<Phase>('requesting');
  const [quality, setQuality] = useState(0);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setPhase('scanning');
    } catch {
      setPhase('error');
      setErrorMsg('Camera access denied. Please allow camera access and try again.');
    }
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  }, []);

  const capture = useCallback(async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    setPhase('capturing');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);

    stopCamera();
    if (analysisRef.current) clearInterval(analysisRef.current);

    canvas.toBlob(async (blob) => {
      if (!blob) { setPhase('scanning'); startCamera(); return; }
      setPhase('sending');
      try {
        const scanResult = await API.scanCard(blob);
        setResult(scanResult);
        setPhase('result');
      } catch (err) {
        setPhase('error');
        setErrorMsg(err instanceof ApiError ? err.message : 'Scan failed. Please try again.');
      }
    }, 'image/jpeg', 0.92);
  }, [stopCamera, startCamera]);

  // Frame analysis loop
  useEffect(() => {
    if (phase !== 'scanning') return;

    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    analysisRef.current = setInterval(() => {
      if (video.readyState < 2) return;

      const w = video.videoWidth || 640;
      const h = video.videoHeight || 480;
      canvas.width = w;
      canvas.height = h;
      ctx.drawImage(video, 0, 0);

      const variance = laplacianVariance(ctx, w, h);
      const luma = meanLuma(ctx, w, h);
      const lumaShift = prevLumaRef.current != null ? Math.abs(luma - prevLumaRef.current) : 0;
      prevLumaRef.current = luma;

      const isSharp = variance > QUALITY_THRESHOLD;
      const isStable = lumaShift < LUMA_STABILITY_THRESHOLD;

      if (isSharp && isStable) {
        qualityRef.current = Math.min(qualityRef.current + 1, QUALITY_TARGET + 1);
      } else {
        qualityRef.current = Math.max(0, qualityRef.current - DECAY_RATE);
      }

      setQuality(qualityRef.current);

      if (qualityRef.current >= QUALITY_TARGET) {
        qualityRef.current = 0;
        setQuality(0);
        capture();
      }
    }, 150);

    return () => {
      if (analysisRef.current) clearInterval(analysisRef.current);
    };
  }, [phase, capture]);

  useEffect(() => {
    startCamera();
    return () => {
      if (analysisRef.current) clearInterval(analysisRef.current);
      stopCamera();
    };
  }, [startCamera, stopCamera]);

  const handleScanAnother = () => {
    setResult(null);
    qualityRef.current = 0;
    prevLumaRef.current = null;
    setQuality(0);
    setPhase('requesting');
    startCamera();
  };

  const progress = Math.min(quality / QUALITY_TARGET, 1);
  const guideW = Math.min(280, typeof window !== 'undefined' ? window.innerWidth * 0.65 : 280);
  const guideH = guideW * (88 / 63);
  const circum = Math.PI * 2 * 140;

  const statusText = phase === 'requesting' ? 'Starting camera…'
    : phase === 'capturing' ? 'Capturing…'
    : phase === 'sending' ? 'Identifying card…'
    : phase === 'error' ? errorMsg
    : progress > 0.6 ? 'Almost there…'
    : 'Hold card steady in frame';

  return (
    <AuthGuard>
      <div className="relative w-full bg-black overflow-hidden" style={{ height: 'calc(100vh - 0px)', minHeight: '100dvh' }}>
        {/* Camera preview */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="absolute inset-0 w-full h-full object-cover"
        />

        {/* Off-screen analysis canvas */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Dark vignette */}
        <div className="absolute inset-0 bg-black/40" style={{
          background: 'radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.7) 100%)'
        }} />

        {/* Card guide overlay */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative" style={{ width: guideW, height: guideH }}>
            {/* Progress arc */}
            <svg
              className="absolute -inset-4"
              width={guideW + 32} height={guideH + 32}
              style={{ top: -16, left: -16 }}
            >
              <rect
                x={16} y={16}
                width={guideW} height={guideH}
                rx={12} ry={12}
                fill="none"
                stroke="rgba(255,255,255,0.15)"
                strokeWidth={3}
              />
              <rect
                x={16} y={16}
                width={guideW} height={guideH}
                rx={12} ry={12}
                fill="none"
                stroke="#f97316"
                strokeWidth={3}
                strokeDasharray={`${2 * (guideW + guideH)}`}
                strokeDashoffset={`${2 * (guideW + guideH) * (1 - progress)}`}
                strokeLinecap="round"
                className="transition-all duration-150"
              />
            </svg>

            {/* Corner brackets */}
            {[
              { top: 0, left: 0, rotate: '0deg' },
              { top: 0, right: 0, rotate: '90deg' },
              { bottom: 0, right: 0, rotate: '180deg' },
              { bottom: 0, left: 0, rotate: '270deg' },
            ].map((pos, i) => (
              <div key={i} className="absolute w-6 h-6" style={{ ...pos }}>
                <svg width={24} height={24} viewBox="0 0 24 24" style={{ transform: `rotate(${pos.rotate})` }}>
                  <path d="M2 12 L2 2 L12 2" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            ))}
          </div>
        </div>

        {/* Status text */}
        <div className="absolute bottom-36 md:bottom-16 left-0 right-0 flex flex-col items-center gap-3 px-4">
          <p className={`text-sm font-medium px-4 py-1.5 rounded-full backdrop-blur-sm ${
            phase === 'error' ? 'bg-red-500/80 text-white' :
            progress > 0.6 ? 'bg-orange-500/80 text-white' :
            'bg-black/40 text-white'
          }`}>
            {statusText}
          </p>

          {/* Manual capture button */}
          {phase === 'scanning' && (
            <button
              onClick={capture}
              className="mt-2 w-16 h-16 rounded-full bg-white/20 border-4 border-white backdrop-blur-sm flex items-center justify-center hover:bg-white/30 transition-colors active:scale-95"
              aria-label="Capture"
            >
              <div className="w-10 h-10 rounded-full bg-white" />
            </button>
          )}

          {phase === 'error' && (
            <button
              onClick={handleScanAnother}
              className="mt-2 px-6 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl text-sm transition-colors"
            >
              Try Again
            </button>
          )}
        </div>

        {/* Sending spinner overlay */}
        {(phase === 'capturing' || phase === 'sending') && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 gap-4">
            <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-white text-sm font-medium">{phase === 'sending' ? 'Identifying card…' : 'Processing…'}</p>
          </div>
        )}

        {/* Result sheet */}
        {phase === 'result' && result && (
          <ResultSheet
            result={result}
            onDismiss={handleScanAnother}
            onScanAnother={handleScanAnother}
          />
        )}
      </div>
    </AuthGuard>
  );
}
