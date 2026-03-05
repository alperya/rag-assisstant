import axios from 'axios';

const API_BASE = '/api';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 120000, // 2 minute timeout for large documents
});

export const uploadDocument = async (file, onProgress, chunkSize, chunkOverlap) => {
  const formData = new FormData();
  formData.append('file', file);
  if (chunkSize) formData.append('chunk_size', chunkSize);
  if (chunkOverlap) formData.append('chunk_overlap', chunkOverlap);

  const response = await api.post('/documents/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (progressEvent) => {
      if (onProgress) {
        const percent = Math.round(
          (progressEvent.loaded * 100) / progressEvent.total
        );
        onProgress(percent);
      }
    },
  });

  return response.data;
};

export const submitTextDocument = async (title, content, chunkSize, chunkOverlap) => {
  const payload = { title, content };
  if (chunkSize) payload.chunk_size = parseInt(chunkSize);
  if (chunkOverlap) payload.chunk_overlap = parseInt(chunkOverlap);

  const response = await api.post('/documents/text', payload);
  return response.data;
};

export const getDocuments = async () => {
  const response = await api.get('/documents');
  return response.data;
};

export const getConfig = async () => {
  const response = await api.get('/config');
  return response.data;
};

export const deleteDocument = async (docId) => {
  const response = await api.delete(`/documents/${docId}`);
  return response.data;
};

export const askQuestion = async (question, documentIds = null) => {
  const payload = { question };
  if (documentIds && documentIds.length > 0) {
    payload.document_ids = documentIds;
  }

  const response = await api.post('/chat', payload);
  return response.data;
};

export const healthCheck = async () => {
  const response = await api.get('/health');
  return response.data;
};
