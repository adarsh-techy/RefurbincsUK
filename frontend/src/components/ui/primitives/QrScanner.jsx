import { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';

// Opens the device camera and continuously decodes QR codes from it, firing
// onScan(value) each time one is found (paused briefly after each hit so the
// same code isn't fired repeatedly while still in frame). This is a
// dev/testing stand-in for a handheld scanner gun — in production the gun
// just types the code into a focused text input, no camera involved.
function QrScanner({ onScan, onClose }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(null);
  const pauseTimeoutRef = useRef(null);
  const onScanRef = useRef(onScan);
  const [error, setError] = useState(null);

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    let cancelled = false;

    function scheduleTick(delay = 0) {
      if (delay > 0) {
        pauseTimeoutRef.current = setTimeout(() => {
          rafRef.current = requestAnimationFrame(tick);
        }, delay);
      } else {
        rafRef.current = requestAnimationFrame(tick);
      }
    }

    function tick() {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);
        if (code?.data) {
          onScanRef.current(code.data);
          scheduleTick(1200);
          return;
        }
      }
      scheduleTick();
    }

    async function start() {
      // getUserMedia only exists in a "secure context" — https, or
      // localhost/127.0.0.1. Loading the app over plain http on a LAN IP
      // (e.g. http://192.168.x.x:5173, common when testing from a phone)
      // makes the browser drop navigator.mediaDevices entirely, which is a
      // different problem than the user denying permission — worth telling
      // apart, since "check permissions" is misleading when there's no
      // permission prompt possible at all.
      if (!navigator.mediaDevices?.getUserMedia) {
        setError(
          window.isSecureContext
            ? 'Camera access is not supported in this browser.'
            : 'Camera access requires HTTPS (or localhost) — this page is loaded over an insecure connection.'
        );
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        scheduleTick();
      } catch (err) {
        if (err.name === 'NotAllowedError' || err.name === 'SecurityError') {
          setError('Camera access was denied — allow it in your browser\'s site settings and try again.');
        } else if (err.name === 'NotFoundError' || err.name === 'OverconstrainedError') {
          setError('No camera was found on this device.');
        } else if (err.name === 'NotReadableError') {
          setError('The camera is already in use by another app.');
        } else {
          setError('Could not access the camera — check permissions.');
        }
      }
    }

    start();

    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (pauseTimeoutRef.current) clearTimeout(pauseTimeoutRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative w-full max-w-xs overflow-hidden rounded-lg border border-slate-200 bg-black dark:border-surface-700">
        <video ref={videoRef} className="w-full" muted playsInline />
        <canvas ref={canvasRef} className="hidden" />
      </div>
      {error && <p className="text-sm text-critical-600 dark:text-red-400">{error}</p>}
      <button
        type="button"
        onClick={onClose}
        className="rounded-md px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-neutral-300 dark:hover:bg-surface-800"
      >
        Stop Scanning
      </button>
    </div>
  );
}

export default QrScanner;
