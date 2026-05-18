'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import AuthGuard from '@/components/AuthGuard';
import { API, ScanResult, ApiError } from '@/lib/api';
import { laplacianVariance, meanLuma } from '@/lib/blur';

type Phase = 'requesting' | 'scanning' | 'locking' | 'capturing' | 'sending' | 'result' | 'error';

const QUALITY_THRESHOLD = 60;
const QUALITY_TARGET    = 5;
const DECAY_RATE        = 1.5;
const LUMA_DELTA_MAX    = 8;

const RARE_KEYWORDS = /prizm|refractor|gold|rainbow|superfractor|auto|patch|rookie|rpa|ssp|short print/i;

function isRare(result: ScanResult) {
  return RARE_KEYWORDS.test(result.variant ?? '') || (result.confidence > 0.88 && (result.item?.mid_price ?? 0) > 40);
}

function formatPrice(v?: number | null) {
  if (v == null) return '—';
  return v >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${v.toFixed(2)}`;
}

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color = pct >= 80 ? 'bg-green-500' : pct >= 50 ? 'bg-yellow-500' : 'bg-red-500';
  return (
    <div className="w-full">
      <div className="flex justify-between text-xs text-gray-500 mb-1.5">
        <span>Confidence</span>
        <span className="font-semibold">{pct}%</span>
      </div>
      <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function PriceBox({ label, value, highlight }: { label: string; value?: number | null; highlight?: boolean }) {
  return (
    <div className={`flex-1 text-center rounded-xl p-3 ${highlight ? 'bg-orange-50 dark:bg-orange-900/20 ring-1 ring-orange-200 dark:ring-orange-800' : 'bg-gray-50 dark:bg-gray-800'}`}>
      <p className={`text-xs mb-0.5 ${highlight ? 'text-orange-500 font-medium' : 'text-gray-500'}`}>{label}</p>
      <p className={`text-base font-bold ${highlight ? 'text-orange-600 dark:text-orange-400' : 'text-gray-900 dark:text-gray-100'}`}>
        {formatPrice(value)}
      </p>
    </div>
  );
}

function ResultSheet({ result, captureDataUrl, onDismiss, onScanAnother }: {
  result: ScanResult;
  captureDataUrl: string | null;
  onDismiss: () => void;
  onScanAnother: () => void;
}) {
  const router = useRouter();
  const rare = isRare(result);
  const imageUrl = captureDataUrl ?? result.item?.image_url;

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
      <div className="absolute inset-0 bg-black/70" onClick={onDismiss} />
      <div className="relative w-full md:max-w-md bg-white dark:bg-gray-900 rounded-t-3xl md:rounded-2xl shadow-2xl overflow-hidden animate-slide-up">
        {rare && (
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-yellow-400 via-orange-500 to-pink-500" />
        )}

        <div className="px-5 pt-5 pb-6">
          {/* Drag handle */}
          <div className="w-10 h-1 bg-gray-300 dark:bg-gray-700 rounded-full mx-auto mb-4 md:hidden" />

          {rare && (
            <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-full px-3 py-1 w-fit mb-3">
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              Rare find!
            </div>
          )}

          <div className="flex items-start gap-4 mb-5">
            {imageUrl ? (
              <div className="relative flex-shrink-0">
                <img
                  src={imageUrl} alt={result.player_name}
                  className="w-24 rounded-xl object-cover shadow-md"
                  style={{ aspectRatio: '63/88' }}
                />
                {rare && <div className="absolute inset-0 rounded-xl holo-overlay" />}
              </div>
            ) : (
              <div
                className="w-24 flex-shrink-0 rounded-xl bg-gradient-to-br from-orange-100 to-orange-50 dark:from-orange-900/20 dark:to-gray-800 flex items-center justify-center shadow"
                style={{ aspectRatio: '63/88' }}
              >
                <span className="text-2xl font-bold text-orange-400">
                  {result.player_name?.split(' ').map(w => w[0]).join('').slice(0, 2)}
                </span>
              </div>
            )}

            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 leading-tight">{result.player_name}</h2>
              {result.team && (
                <p className="text-sm text-gray-500 mt-0.5">
                  {result.team}{result.position ? ` · ${result.position}` : ''}
                </p>
              )}
              {result.year && (
                <p className="text-sm text-gray-500">{result.year}{result.set_name ? ` ${result.set_name}` : ''}</p>
              )}
              <div className="flex flex-wrap gap-1.5 mt-2">
                {result.variant && result.variant !== 'Base' && (
                  <span className="text-xs px-2 py-0.5 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded-full font-medium">
                    {result.variant}
                  </span>
                )}
                {result.condition_estimate && (
                  <span className="text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full">
                    {result.condition_estimate}
                  </span>
                )}
              </div>
            </div>
          </div>

          <ConfidenceBar value={result.confidence} />

          {(result.item?.low_price != null || result.item?.mid_price != null || result.item?.high_price != null) && (
            <div className="mt-4 flex gap-2">
              <PriceBox label="Low"  value={result.item.low_price} />
              <PriceBox label="Mid"  value={result.item.mid_price} highlight />
              <PriceBox label="High" value={result.item.high_price} />
            </div>
          )}

          {result.notes && (
            <p className="mt-3 text-xs text-gray-500 dark:text-gray-400 italic leading-relaxed">{result.notes}</p>
          )}

          <div className="mt-5 flex gap-3">
            <button
              onClick={onScanAnother}
              className="flex-1 py-3 rounded-2xl border border-gray-200 dark:border-gray-700 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 active:scale-[0.98] transition-all"
            >
              Scan Another
            </button>
            <button
              onClick={() => router.push(`/collection/${result.item?.id}`)}
              className="flex-1 py-3 rounded-2xl bg-orange-500 hover:bg-orange-600 active:scale-[0.98] text-white text-sm font-semibold transition-all shadow-sm shadow-orange-200 dark:shadow-none"
            >
              View Card →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ScanPage() {
  const videoRef    = useRef<HTMLVideoElement>(null);
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const analysisRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef   = useRef<MediaStream | null>(null);
  const qualityRef  = useRef(0);
  const prevLumaRef = useRef<number | null>(null);
  const captureDataUrlRef = useRef<string | null>(null);

  const [phase, setPhase] = useState<Phase>('requesting');
  const [quality, setQuality] = useState(0);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [showFlash, setShowFlash] = useState(false);
  const [guideSize, setGuideSize] = useState({ w: 0, h: 0 });

  // Resize-aware guide dimensions
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => {
      const { width, height } = el.getBoundingClientRect();
      const w = Math.min(width * 0.68, 300);
      setGuideSize({ w, h: w * (88 / 63) });
    };
    measure();
    const obs = new ResizeObserver(measure);
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setPhase('scanning');
    } catch {
      setPhase('error');
      setErrorMsg('Camera access denied. Allow camera access and try again.');
    }
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  }, []);

  const capture = useCallback(async () => {
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    setPhase('capturing');
    if (analysisRef.current) clearInterval(analysisRef.current);

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width  = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);

    // Store preview immediately — result sheet shows this before upload completes
    captureDataUrlRef.current = canvas.toDataURL('image/jpeg', 0.8);

    // Shutter flash
    setShowFlash(true);
    setTimeout(() => setShowFlash(false), 350);

    // Haptic feedback on mobile browsers that support it
    if ('vibrate' in navigator) navigator.vibrate(40);

    stopCamera();

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
    if (phase !== 'scanning' && phase !== 'locking') return;

    const canvas = canvasRef.current;
    const video  = videoRef.current;
    if (!canvas || !video) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    analysisRef.current = setInterval(() => {
      if (video.readyState < 2) return;

      const w = video.videoWidth  || 640;
      const h = video.videoHeight || 480;
      canvas.width  = w;
      canvas.height = h;
      ctx.drawImage(video, 0, 0);

      const variance  = laplacianVariance(ctx, w, h);
      const luma      = meanLuma(ctx, w, h);
      const lumaShift = prevLumaRef.current != null ? Math.abs(luma - prevLumaRef.current) : 0;
      prevLumaRef.current = luma;

      const isSharp  = variance > QUALITY_THRESHOLD;
      const isStable = lumaShift < LUMA_DELTA_MAX;

      if (isSharp && isStable) {
        qualityRef.current = Math.min(qualityRef.current + 1, QUALITY_TARGET + 1);
      } else {
        qualityRef.current = Math.max(0, qualityRef.current - DECAY_RATE);
      }

      const q = qualityRef.current;
      setQuality(q);

      // Enter locking phase when quality is high
      if (q >= QUALITY_TARGET * 0.6 && phase === 'scanning') setPhase('locking');
      if (q < QUALITY_TARGET * 0.3 && phase === 'locking')    setPhase('scanning');

      if (q >= QUALITY_TARGET) {
        qualityRef.current = 0;
        setQuality(0);
        capture();
      }
    }, 150);

    return () => { if (analysisRef.current) clearInterval(analysisRef.current); };
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
    captureDataUrlRef.current = null;
    qualityRef.current = 0;
    prevLumaRef.current = null;
    setQuality(0);
    setPhase('requesting');
    startCamera();
  };

  const progress    = Math.min(quality / QUALITY_TARGET, 1);
  const isLocking   = phase === 'locking';
  const { w: gW, h: gH } = guideSize;
  const perimeter   = gW > 0 ? 2 * (gW + gH) : 0;
  const guideColor  = isLocking ? '#22c55e' : progress > 0 ? '#f97316' : 'rgba(255,255,255,0.5)';

  const statusText =
    phase === 'requesting' ? 'Starting camera…' :
    phase === 'capturing'  ? 'Capturing…' :
    phase === 'sending'    ? 'Identifying card…' :
    phase === 'error'      ? errorMsg :
    isLocking              ? 'Hold still…' :
    progress > 0.3         ? 'Looking good…' :
                             'Place card in frame';

  return (
    <AuthGuard>
      <div
        ref={containerRef}
        className="relative w-full bg-black overflow-hidden"
        style={{ height: '100dvh', minHeight: '100vh' }}
      >
        {/* Camera preview */}
        <video
          ref={videoRef} autoPlay playsInline muted
          className="absolute inset-0 w-full h-full object-cover"
        />

        {/* Analysis canvas (hidden) */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Capture shutter flash */}
        {showFlash && (
          <div className="absolute inset-0 bg-white z-20 animate-flash pointer-events-none" />
        )}

        {/* Vignette */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse at center, transparent 28%, rgba(0,0,0,0.72) 100%)' }}
        />

        {/* Card guide overlay */}
        {gW > 0 && (
          <div className="absolute inset-0 flex items-center justify-center" style={{ marginBottom: '60px' }}>
            <div className="relative" style={{ width: gW, height: gH }}>
              {/* Locking pulse ring */}
              {isLocking && (
                <div
                  className="absolute rounded-xl border-2 border-green-400 animate-pulse-ring pointer-events-none"
                  style={{ inset: -8 }}
                />
              )}

              {/* Progress border */}
              <svg
                className="absolute pointer-events-none"
                width={gW + 32} height={gH + 32}
                style={{ top: -16, left: -16 }}
              >
                {/* Ghost track */}
                <rect
                  x={16} y={16} width={gW} height={gH} rx={12} ry={12}
                  fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth={2.5}
                />
                {/* Progress fill */}
                {perimeter > 0 && (
                  <rect
                    x={16} y={16} width={gW} height={gH} rx={12} ry={12}
                    fill="none"
                    stroke={guideColor}
                    strokeWidth={2.5}
                    strokeDasharray={perimeter}
                    strokeDashoffset={perimeter * (1 - progress)}
                    strokeLinecap="round"
                    style={{ transition: 'stroke-dashoffset 150ms linear, stroke 200ms ease' }}
                  />
                )}
              </svg>

              {/* Corner brackets */}
              {(['tl','tr','br','bl'] as const).map((corner) => {
                const style: React.CSSProperties = {
                  position: 'absolute',
                  ...(corner === 'tl' ? { top: 0,    left: 0   } : {}),
                  ...(corner === 'tr' ? { top: 0,    right: 0  } : {}),
                  ...(corner === 'br' ? { bottom: 0, right: 0  } : {}),
                  ...(corner === 'bl' ? { bottom: 0, left: 0   } : {}),
                };
                const rotate = { tl: 0, tr: 90, br: 180, bl: 270 }[corner];
                return (
                  <div key={corner} style={style}>
                    <svg width={22} height={22} viewBox="0 0 22 22"
                      style={{ transform: `rotate(${rotate}deg)`, display: 'block' }}>
                      <path d="M2 11 L2 2 L11 2" fill="none"
                        stroke={isLocking ? '#22c55e' : 'white'} strokeWidth={2.5}
                        strokeLinecap="round" strokeLinejoin="round"
                        style={{ transition: 'stroke 200ms ease' }}
                      />
                    </svg>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Status + controls */}
        <div className="absolute bottom-0 left-0 right-0 pb-safe pb-8 flex flex-col items-center gap-4 px-4"
          style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px) + 2rem, 3.5rem)' }}
        >
          {/* Status pill */}
          <div className={`text-sm font-medium px-5 py-1.5 rounded-full backdrop-blur-sm transition-all duration-300 ${
            phase === 'error' ? 'bg-red-500/85 text-white' :
            isLocking         ? 'bg-green-500/85 text-white' :
            progress > 0.3    ? 'bg-orange-500/85 text-white' :
                                'bg-black/45 text-white'
          }`}>
            {statusText}
          </div>

          {/* Manual shutter */}
          {(phase === 'scanning' || phase === 'locking') && (
            <button
              onClick={capture}
              className="w-[72px] h-[72px] rounded-full bg-white/15 border-[3.5px] border-white backdrop-blur-sm flex items-center justify-center hover:bg-white/25 active:scale-95 transition-all"
              aria-label="Capture card"
            >
              <div className={`w-[52px] h-[52px] rounded-full transition-colors duration-200 ${isLocking ? 'bg-green-400' : 'bg-white'}`} />
            </button>
          )}

          {phase === 'error' && (
            <button
              onClick={handleScanAnother}
              className="px-7 py-3 bg-orange-500 hover:bg-orange-600 active:scale-95 text-white font-semibold rounded-2xl text-sm transition-all"
            >
              Try Again
            </button>
          )}
        </div>

        {/* Capturing / sending overlay */}
        {(phase === 'capturing' || phase === 'sending') && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/65 gap-5 z-10">
            {captureDataUrlRef.current && (
              <div className="relative animate-scale-in">
                <img
                  src={captureDataUrlRef.current}
                  alt="Captured card"
                  className="w-32 rounded-2xl shadow-2xl object-cover"
                  style={{ aspectRatio: '63/88' }}
                />
                <div className="absolute inset-0 rounded-2xl ring-2 ring-orange-400 animate-pulse" />
              </div>
            )}
            <div className="flex flex-col items-center gap-3">
              <div className="w-10 h-10 border-[3px] border-orange-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-white text-sm font-medium">
                {phase === 'sending' ? 'Identifying card…' : 'Processing…'}
              </p>
            </div>
          </div>
        )}

        {/* Result sheet */}
        {phase === 'result' && result && (
          <ResultSheet
            result={result}
            captureDataUrl={captureDataUrlRef.current}
            onDismiss={handleScanAnother}
            onScanAnother={handleScanAnother}
          />
        )}
      </div>
    </AuthGuard>
  );
}
