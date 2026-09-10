import { createContext, useContext, useEffect, useState } from 'react';
import { useColorScheme } from 'nativewind';

const ThemeContext = createContext({ theme: 'light' });

// The app is light-only. A light/dark toggle was tried and pulled back out:
// nativewind's setColorScheme forces a live re-render of every mounted
// screen at once, and colliding with React Navigation's screen
// freezing/detachment for backgrounded tabs threw "Couldn't find a
// navigation context" on Android. Setting the scheme once, here, before
// anything else mounts, avoids that entirely — there's no already-running
// screen tree for a later change to collide with. If a toggle is wanted
// again, it needs a different mechanism than nativewind's live colorScheme
// switch, not a retry of this one.
export function ThemeProvider({ children }) {
  const { setColorScheme } = useColorScheme();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      setColorScheme('light');
    } catch {
      // darkMode: 'class' not picked up by a stale Metro cache — harmless
      // here since the app never needs anything but the light styles.
    }
    setReady(true);
  }, [setColorScheme]);

  if (!ready) return null;

  return <ThemeContext.Provider value={{ theme: 'light' }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
