import client from './client';

export const login = (email, password) =>
  client.post('/auth/login', { email, password }).then((r) => r.data);

export const signup = (email, password, config = {}) =>
  client.post('/auth/signup', { email, password, config }).then((r) => r.data);

export const refreshToken = (refresh_token) =>
  client.post('/auth/refresh', { refresh_token }).then((r) => r.data);

export const getMe = () =>
  client.get('/users/me').then((r) => r.data.user);

export const updateMe = (config) =>
  client.patch('/users/me', { config }).then((r) => r.data);
