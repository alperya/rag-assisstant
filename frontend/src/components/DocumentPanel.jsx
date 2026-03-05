import { useState, useRef, useCallback } from 'react';
import {
  Upload,
  FileText,
  Trash2,
  AlertCircle,
  CheckCircle2,
  File,
  X,
} from 'lucide-react';
import { uploadDocument, deleteDocument } from '../api';

const FILE_ICONS = {
  pdf: '📄',
  docx: '📝',
  txt: '📃',
};

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DocumentPanel({ documents, onDocumentsChange }) {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  const clearMessages = () => {
    setTimeout(() => {
      setError(null);
      setSuccess(null);
    }, 4000);
  };

  const handleUpload = useCallback(
    async (file) => {
      const allowedTypes = ['.pdf', '.docx', '.txt'];
      const ext = '.' + file.name.split('.').pop().toLowerCase();

      if (!allowedTypes.includes(ext)) {
        setError(`Unsupported file type: ${ext}. Allowed: PDF, DOCX, TXT`);
        clearMessages();
        return;
      }

      setUploading(true);
      setUploadProgress(0);
      setError(null);

      try {
        await uploadDocument(file, setUploadProgress);
        setSuccess(`"${file.name}" uploaded successfully!`);
        onDocumentsChange();
      } catch (err) {
        const msg =
          err.response?.data?.detail || 'Failed to upload document. Please try again.';
        setError(msg);
      } finally {
        setUploading(false);
        setUploadProgress(0);
        clearMessages();
      }
    },
    [onDocumentsChange]
  );

  const handleDelete = async (docId, filename) => {
    if (!window.confirm(`Delete "${filename}"? This action cannot be undone.`)) return;

    try {
      await deleteDocument(docId);
      setSuccess(`"${filename}" deleted.`);
      onDocumentsChange();
    } catch {
      setError('Failed to delete document.');
    }
    clearMessages();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleUpload(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => setDragOver(false);

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="p-4 border-b border-slate-200">
        <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
          <FileText className="w-5 h-5 text-primary-600" />
          Documents
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Upload PDF, Word, or TXT files to analyze
        </p>
      </div>

      {/* Upload Area */}
      <div className="p-4">
        <div
          className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all duration-200 ${
            dragOver
              ? 'border-primary-500 bg-primary-50'
              : 'border-slate-300 hover:border-primary-400 hover:bg-slate-50'
          } ${uploading ? 'pointer-events-none opacity-60' : ''}`}
          onClick={() => fileInputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
          <p className="text-sm font-medium text-slate-600">
            {uploading ? 'Uploading...' : 'Drop file here or click to upload'}
          </p>
          <p className="text-xs text-slate-400 mt-1">PDF, DOCX, TXT (max 50MB)</p>

          {uploading && (
            <div className="mt-3">
              <div className="w-full bg-slate-200 rounded-full h-2">
                <div
                  className="bg-primary-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <p className="text-xs text-slate-500 mt-1">{uploadProgress}%</p>
            </div>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,.txt"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files[0];
            if (file) handleUpload(file);
            e.target.value = '';
          }}
        />
      </div>

      {/* Status Messages */}
      {error && (
        <div className="mx-4 mb-2 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-red-700">{error}</p>
          <button onClick={() => setError(null)} className="ml-auto">
            <X className="w-3 h-3 text-red-400" />
          </button>
        </div>
      )}

      {success && (
        <div className="mx-4 mb-2 p-3 bg-green-50 border border-green-200 rounded-lg flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
          <p className="text-xs text--700">{success}</p>
        </div>
      )}

      {/* Document List */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {documents.length === 0 ? (
          <div className="text-center py-8">
            <File className="w-12 h-12 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-400">No documents uploaded yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">
              {documents.length} document{documents.length !== 1 ? 's' : ''} loaded
            </p>
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="group bg-slate-50 hover:bg-slate-100 rounded-lg p-3 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <span className="text-xl">{FILE_ICONS[doc.file_type] || '📄'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-700 truncate">
                      {doc.filename}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-slate-400">
                        {formatFileSize(doc.size_bytes)}
                      </span>
                      {doc.page_count && (
                        <>
                          <span className="text-xs text-slate-300">•</span>
                          <span className="text-xs text-slate-400">
                            {doc.page_count} pages
                          </span>
                        </>
                      )}
                      <span className="text-xs text-slate-300">•</span>
                      <span className="text-xs text-slate-400">
                        {doc.chunk_count} chunks
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(doc.id, doc.filename)}
                    className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-all"
                    title="Delete document"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
