import { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader, type IScannerControls } from '@zxing/browser';

/**
 * Full-screen camera barcode scanner. Uses ZXing (works on iOS Safari, which
 * lacks the native BarcodeDetector) to read a product barcode, then hands the
 * code up for an Open Food Facts lookup. Lazy-loaded so ZXing stays out of the
 * main bundle. Default export for React.lazy.
 */
export default function BarcodeScanner({
  onDetected,
  onClose,
}: {
  onDetected: (code: string) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const onDetectedRef = useRef(onDetected);
  onDetectedRef.current = onDetected;
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const reader = new BrowserMultiFormatReader();
    let controls: IScannerControls | null = null;
    let done = false;

    reader
      .decodeFromConstraints({ video: { facingMode: 'environment' } }, video, (result, _err, ctrl) => {
        if (ctrl) controls = ctrl;
        if (result && !done) {
          done = true;
          ctrl?.stop();
          onDetectedRef.current(result.getText());
        }
      })
      .then((ctrl) => {
        controls = ctrl;
        if (done) ctrl.stop(); // detected before the promise resolved
      })
      .catch((e: unknown) => {
        setError(
          e instanceof DOMException && e.name === 'NotAllowedError'
            ? 'Camera access was blocked. Allow the camera in your browser settings and try again.'
            : 'Couldn’t start the camera on this device.',
        );
      });

    return () => {
      done = true;
      controls?.stop();
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black">
      <div className="flex items-center justify-between px-5 py-4">
        <span className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-accent">
          Scan barcode
        </span>
        <button
          onClick={onClose}
          className="px-2 py-1 text-lg text-ink2 hover:text-ink"
          aria-label="Close scanner"
        >
          ✕
        </button>
      </div>

      <div className="relative flex-1 overflow-hidden">
        <video ref={videoRef} className="h-full w-full object-cover" muted playsInline autoPlay />
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-36 w-64 border-2 border-accent/80" />
        </div>
      </div>

      <div className="px-5 py-5 text-center">
        {error ? (
          <p className="text-sm text-fatigued">{error}</p>
        ) : (
          <p className="text-sm text-ink2">Point the camera at a product barcode.</p>
        )}
      </div>
    </div>
  );
}
