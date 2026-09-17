import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiClient from '../services/api-client';

// Loads whatever session was persisted from a previous launch. Runs once at
// app start, before the navigator decides which screen to show.
export const bootstrap = createAsyncThunk('auth/bootstrap', async () => {
  const [token, userJson] = await Promise.all([
    AsyncStorage.getItem('token'),
    AsyncStorage.getItem('user'),
  ]);
  const user = userJson ? JSON.parse(userJson) : null;

  // A saved session still carrying an admin-issued temp password shouldn't
  // auto-resume straight into the Set Password screen on cold start — drop
  // it so the app lands on Login instead, same as a fresh install.
  if (user?.must_change_password) {
    await AsyncStorage.multiRemove(['token', 'user']);
    return { token: null, user: null };
  }

  return { token, user };
});

export const login = createAsyncThunk(
  'auth/login',
  async ({ email, password }, { rejectWithValue }) => {
    try {
      const { data } = await apiClient.post('/auth/login', { email, password });
      await AsyncStorage.setItem('token', data.token);
      await AsyncStorage.setItem('user', JSON.stringify(data.user));
      return data;
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        (err.code === 'ECONNABORTED'
          ? 'Connection timed out. Make sure your phone and server are on the same Wi-Fi.'
          : !err.response
          ? 'Network error. Cannot reach backend server at ' + apiClient.defaults.baseURL
          : err.message || 'Unable to sign in. Please try again.');
      return rejectWithValue(msg);
    }
  }
);

// Validates the stored token against the backend. Rejects (and the reducer
// below clears storage) if the token is missing, expired, or invalid, so a
// stale AsyncStorage entry can never grant access on its own.
export const verifySession = createAsyncThunk('auth/verifySession', async () => {
  const { data } = await apiClient.get('/auth/me');
  await AsyncStorage.setItem('user', JSON.stringify(data.user));
  return data.user;
});

// Replaces the stored user in place — e.g. after changing password, where
// the response carries the updated must_change_password flag but there's no
// new token to also handle.
export const setUser = createAsyncThunk('auth/setUser', async (user) => {
  await AsyncStorage.setItem('user', JSON.stringify(user));
  return user;
});

export const logout = createAsyncThunk('auth/logout', async () => {
  await AsyncStorage.multiRemove(['token', 'user']);
});

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    user: null,
    token: null,
    status: 'idle',
    // Nothing has been loaded from storage yet — the navigator shows a
    // loading screen until this flips true.
    bootstrapped: false,
    // Mirrors the web app: with a token, stays false until verifySession
    // resolves, so the app waits for backend confirmation rather than
    // trusting whatever happens to be sitting in storage.
    authChecked: false,
    error: null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(bootstrap.fulfilled, (state, action) => {
        state.bootstrapped = true;
        state.token = action.payload.token;
        state.user = action.payload.user;
        if (!action.payload.token) state.authChecked = true;
      })
      .addCase(login.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(login.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.user = action.payload.user;
        state.token = action.payload.token;
        state.authChecked = true;
      })
      .addCase(login.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload || action.error.message;
      })
      .addCase(verifySession.pending, (state) => {
        state.authChecked = false;
      })
      .addCase(verifySession.fulfilled, (state, action) => {
        state.authChecked = true;
        state.user = action.payload;
      })
      .addCase(verifySession.rejected, (state) => {
        state.authChecked = true;
        state.user = null;
        state.token = null;
      })
      .addCase(setUser.fulfilled, (state, action) => {
        state.user = action.payload;
      })
      .addCase(logout.fulfilled, (state) => {
        state.user = null;
        state.token = null;
      });
  },
});

export default authSlice.reducer;
