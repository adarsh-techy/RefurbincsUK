import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import AppRoutes from './routes/AppRoutes';
import { verifySession } from './features/auth/auth-slice';

function App() {
  const dispatch = useDispatch();
  const { token, authChecked } = useSelector((state) => state.auth);

  useEffect(() => {
    if (token && !authChecked) {
      dispatch(verifySession());
    }
  }, [token, authChecked, dispatch]);

  if (!authChecked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white text-sm text-slate-500 dark:bg-surface-950 dark:text-neutral-400">
        Checking session…
      </div>
    );
  }

  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AppRoutes />
    </BrowserRouter>
  );
}

export default App;
