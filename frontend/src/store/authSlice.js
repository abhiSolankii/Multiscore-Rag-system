import { createSlice } from '@reduxjs/toolkit';
import { clearTokens, setToken, setRefreshToken, getToken } from '../utils/token';

const initialState = {
  user: null,
  token: getToken(), // rehydrate from localStorage on load
  isLoading: false,
  error: null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials: (state, action) => {
      const { user, access_token, refresh_token } = action.payload;
      state.user = user;
      state.token = access_token;
      state.error = null;
      setToken(access_token);
      if (refresh_token) setRefreshToken(refresh_token);
    },
    setUser: (state, action) => {
      state.user = action.payload;
    },
    setLoading: (state, action) => {
      state.isLoading = action.payload;
    },
    logout: (state) => {
      state.user = null;
      state.token = null;
      state.error = null;
      clearTokens();
    },
  },
});

export const { setCredentials, setUser, setLoading, logout } = authSlice.actions;
export default authSlice.reducer;

// Selectors
export const selectUser = (state) => state.auth.user;
export const selectToken = (state) => state.auth.token;
export const selectIsAuthenticated = (state) => !!state.auth.token;
export const selectIsLoading = (state) => state.auth.isLoading;
