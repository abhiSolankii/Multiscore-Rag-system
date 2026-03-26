import client from './client';

export const listUsers = () =>
  client.get('/admin/users').then((r) => r.data);

export const getAdminUser = (userId) =>
  client.get(`/admin/users/${userId}`).then((r) => r.data);

export const updateAdminUser = (userId, data) =>
  client.patch(`/admin/users/${userId}`, data).then((r) => r.data);

export const listAllDocuments = () =>
  client.get('/admin/documents').then((r) => r.data);

export const deleteAnyDocument = (documentId) =>
  client.delete(`/admin/documents/${documentId}`).then((r) => r.data);
