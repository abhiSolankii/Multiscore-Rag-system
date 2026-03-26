import client from './client';

export const ingestFile = (file, isPublic = false) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('is_public', isPublic);
  return client
    .post('/ingest/file', formData, { headers: { 'Content-Type': 'multipart/form-data' } })
    .then((r) => r.data);
};

export const ingestUrl = (url, isPublic = false) =>
  client.post('/ingest/url', { url, is_public: isPublic }).then((r) => r.data);

export const ingestGithub = (repoUrl, isPublic = false) =>
  client.post('/ingest/github', { repo_url: repoUrl, is_public: isPublic }).then((r) => r.data);

export const pollStatus = (taskId) =>
  client.get(`/ingest/status/${taskId}`).then((r) => r.data);

export const listDocuments = (params = {}) =>
  client.get('/ingest/documents', { params }).then((r) => r.data);

export const listPublicDocuments = (params = {}) =>
  client.get('/ingest/documents/public', { params }).then((r) => r.data);

export const deleteDocument = (documentId) =>
  client.delete(`/ingest/document/${documentId}`).then((r) => r.data);
