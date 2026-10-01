import { useEffect, useState } from 'react';

const FADE_MS = 300;
// Safety net in case animationend never fires (reduced motion, background
// tab): a little longer than the CSS fill (0.45s delay + 2.1s sweep).
const FALLBACK_MS = 2800;

// Full-screen "Developed by Eswincha Technologies" screen played right after
// a successful login: the name fills in (styles in index.css, .ew-*), and the
// moment the fill completes the name fades (the white backdrop stays opaque,
// so the login form never shows through) and onDone fires so the caller
// navigates into the app. Click/tap or any key skips straight to the fade.
function SplashIntro({ onDone }) {
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (leaving) {
      const timer = setTimeout(onDone, FADE_MS);
      return () => clearTimeout(timer);
    }
    const timer = setTimeout(() => setLeaving(true), FALLBACK_MS);
    const skip = () => setLeaving(true);
    window.addEventListener('keydown', skip);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', skip);
    };
  }, [leaving, onDone]);

  function handleAnimationEnd(e) {
    if (e.animationName === 'ew-sweep') setLeaving(true);
  }

  return (
    <div
      className={`ew-splash fixed inset-0 z-50 flex items-center justify-center bg-white px-6 ${
        leaving ? 'ew-splash--leaving' : ''
      }`}
      onClick={() => setLeaving(true)}
      role="presentation"
    >
      <div className="ew-credit ew-credit--splash" aria-label="Developed by Eswincha Technologies">
        <span className="ew-by" aria-hidden="true">Developed by</span>
        <span className="ew-name" aria-hidden="true">
          <span className="ew-line ew-line--ghost">
            <span className="ew-blue">Eswincha</span>
            <span className="ew-red">Technologies</span>
          </span>
          <span className="ew-reveal" onAnimationEnd={handleAnimationEnd}>
            <span className="ew-reveal-inner">
              <span className="ew-line">
                <span className="ew-blue">Eswincha</span>
                <span className="ew-red">Technologies</span>
              </span>
            </span>
          </span>
        </span>
      </div>
    </div>
  );
}

export default SplashIntro;
