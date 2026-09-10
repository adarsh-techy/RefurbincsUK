import './global.css';
import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { enableScreens } from 'react-native-screens';
import { Provider, useDispatch } from 'react-redux';
import { store } from './src/store/store';
import { bootstrap, verifySession } from './src/store/auth-slice';
import RootNavigator from './src/navigation/RootNavigator';
import { ThemeProvider } from './src/context/ThemeContext';

// react-native-screens' native optimizations (offloading inactive
// screens/tabs to detached/frozen native views) don't play well with a
// truly global re-render trigger like the light/dark theme toggle, which
// forces every mounted screen to update at once regardless of whether
// react-native-screens has it frozen in the background. On Android this
// surfaced as "Couldn't find a navigation context" thrown from deep inside
// a frozen screen mid-update. Disabling it trades a little screen-transition
// performance for navigation actually being reliable everywhere.
enableScreens(false);

function Bootstrapper() {
  const dispatch = useDispatch();

  useEffect(() => {
    dispatch(bootstrap()).then((action) => {
      if (action.payload?.token) {
        dispatch(verifySession());
      }
    });
  }, [dispatch]);

  return null;
}

export default function App() {
  return (
    <Provider store={store}>
      <ThemeProvider>
        <Bootstrapper />
        <RootNavigator />
        {/* Dark icons/text — the app is light-only. */}
        <StatusBar style="dark" />
      </ThemeProvider>
    </Provider>
  );
}
