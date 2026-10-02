import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import apiClient from '../../services/api-client';

export const login = createAsyncThunk('auth/login', async ({ email, password }, { rejectWithValue }) => {
  try {
    const { data } = await apiClient.post('/auth/login', { email, password });
    return data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || 'Unable to sign in. Please try again.');
  }
});

// TEMPORARY: pairs with the backend's temporary /auth/register endpoint.
// Remove alongside RegisterPage once real admin management is in use.
export const register = createAsyncThunk(
  'auth/register',
  async ({ name, email, password, role }, { rejectWithValue }) => {
    try {
      const { data } = await apiClient.post('/auth/register', {
        name,
        email,
        password,
        role,
      });
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

// Validates the stored token against the backend. Rejects (and the reducer
// below clears storage) if the token is missing, expired, or invalid, so a
// stale localStorage entry can never grant dashboard access on its own.
export const verifySession = createAsyncThunk('auth/verifySession', async (_, { rejectWithValue }) => {
  try {
    const { data } = await apiClient.get('/auth/me');
    return data.user;
  } catch (err) {
    // Only a real 401 means the session is invalid; a 5xx or network blip
    // (e.g. the backend waking from sleep) must not sign the user out.
    return rejectWithValue({ unauthorized: err.response?.status === 401 });
  }
});

const storedUser = localStorage.getItem('user');
const storedToken = localStorage.getItem('token');

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    user: storedUser ? JSON.parse(storedUser) : null,
    token: storedToken || null,
    status: 'idle',
    // No token means there's nothing to verify, so we're immediately "checked".
    // With a token, authChecked stays false until verifySession resolves, so
    // protected routes wait for backend confirmation instead of trusting
    // whatever happens to be sitting in localStorage.
    authChecked: !storedToken,
    error: null,
  },
  reducers: {
    logout(state) {
      state.user = null;
      state.token = null;
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    },
    // Replaces the stored user in place — e.g. after changing password,
    // where the response carries the updated must_change_password flag but
    // there's no new token to also handle.
    setUser(state, action) {
      state.user = action.payload;
      localStorage.setItem('user', JSON.stringify(action.payload));
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(login.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(login.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.user = action.payload.user;
        state.token = action.payload.token;
        state.authChecked = true;
        localStorage.setItem('token', action.payload.token);
        localStorage.setItem('user', JSON.stringify(action.payload.user));
      })
      .addCase(login.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload || action.error.message;
      })
      .addCase(register.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(register.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.user = action.payload.user;
        state.token = action.payload.token;
        state.authChecked = true;
        localStorage.setItem('token', action.payload.token);
        localStorage.setItem('user', JSON.stringify(action.payload.user));
      })
      .addCase(register.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload || action.error.message;
      })
      .addCase(verifySession.pending, (state) => {
        state.authChecked = false;
      })
      .addCase(verifySession.fulfilled, (state, action) => {
        state.authChecked = true;
        state.user = action.payload;
        localStorage.setItem('user', JSON.stringify(action.payload));
      })
      .addCase(verifySession.rejected, (state, action) => {
        state.authChecked = true;
        if (action.payload?.unauthorized) {
          state.user = null;
          state.token = null;
          localStorage.removeItem('token');
          localStorage.removeItem('user');
        }
      });
  },
});

export const { logout, setUser } = authSlice.actions;
export default authSlice.reducer;
