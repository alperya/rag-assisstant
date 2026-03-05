import { useState, useRef, useCallback, useEffect } from 'react';
import {
  Upload,
  FileText,
  Trash2,
  AlertCircle,
  CheckCircle2,
  File,
  X,
  Settings,
  Type,
  ChevronDown,
  ChevronRight,
  Send,
} from 'lucide-react';
import { uploadDocument, deleteDocument, submitTextDocument, getConfig } from '../api';

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

  // Text input state
  const [showTextInput, setShowTextInput] = useState(false);
  const [textTitle, setTextTitle] = useState('');
  const [textContent, setTextContent] = useState('');
  const [submittingText, setSubmittingText] = useState(false);

  // Chunk config state
  const [showSettings, setShowSettings] = useState(false);
  const [defaultChunkSize, setDefaultChunkSize] = useState(1500);
  const [defaultChunkOverlap, setDefaultChunkOverlap] = useState(300);
  const [chunkSize, setChunkSize] = useState('');
  const [chunkOverlap, setChunkOverlap] = useState('');

  // Load default config on mount
  useEffect(() => {
    getConfig()
      .then((cfg) => {
        setDefaultChunkSize(cfg.chunk_size);
        setDefaultChunkOverlap(cfg.chunk_overlap);
        setChunkSize(String(cfg.chunk_size));
        setChunkOverlap(String(cfg.chunk_overlap));
      })
      .catch(() => {});
  }, []);

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
        const cs = chunkSize ? parseInt(chunkSize) : null;
        const co = chunkOverlap ? parseInt(chunkOverlap) : null;
        await uploadDocument(file, setUploadProgress, cs, co);
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

  const handleTextSubmit = async () => {
    if (!textContent.trim()) {
      setError('Please enter some text content.');
      clearMessages();
      return;
    }

    const title = textTitle.trim() || `Text Note ${new Date().toLocaleString()}`;
    setSubmittingText(true);
    setError(null);

    try {
      const cs = chunkSize ? parseInt(chunkSize) : null;
      const co = chunkOverlap ? parseInt(chunkOverlap) : null;
      await submitTextDocument(title, textContent, cs, co);
      setSuccess(`"${title}" saved successfully!`);
      setTextTitle('');
      setTextContent('');
      onDocumentsChange();
    } catch (err) {
      const msg = err.response?.data?.detail || 'Failed to save text. Please try again.';
      setError(msg);
    } finally {
      setSubmittingText(false);
      clearMessages();
    }
  };

  const getEffectiveChunkSize = () => {
    const v = parseInt(chunkSize);
    return v > 0 ? v : defaultChunkSize;
  };

  const getEffectiveChunkOverlap = () => {
    const v = parseInt(chunkOverlap);
    return v >= 0 ? v : defaultChunkOverlap;
  };

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="p-4 border-b border-slate-200">
        <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
          <FileText className="w-5 h-5 text-primary-600" />
          Documents
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Upload files or enter text to analyze
        </p>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Upload Area */}
        <div className="p-4 pb-2">
          <div
            className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all duration-200 ${
              dragOver
                ? 'border-primary-500 bg-primary-50'
                : 'border-slate-300 hover:border-primary-400 hover:bg-slate-50'
            } ${uploading ? 'pointer-events-none opacity-60' : ''}`}
            onClick={() => fileInputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            <Upload className="w-7 h-7 text-slate-400 mx-auto mb-2" />
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

        {/* Text Input Section */}
        <div className="px-4 pb-2">
          <button
            onClick={() => setShowTextInput(!showTextInput)}
            className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-primary-600 transition-colors w-full py-1.5"
          >
            {showTextInput ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
            <Type className="w-4 h-4" />
            Text Input
          </button>

          {showTextInput && (
            <div className="mt-2 space-y-2">
              <input
                type="text"
                placeholder="Title (optional)"
                value={textTitle}
                onChange={(e) => setTextTitle(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
              <textarea
                placeholder="Paste or type your text here..."
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
                rows={5}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-y"
              />
              <button
                onClick={handleTextSubmit}
                disabled={submittingText || !textContent.trim()}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
              >
                <Send className="w-4 h-4" />
                {submittingText ? 'Saving...' : 'Save Text'}
              </button>
            </div>
          )}
        </div>

        {/* Chunk Settings Section */}
        <div className="px-4 pb-2">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-primary-600 transition-colors w-full py-1.5"
          >
            {showSettings ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
            <Settings className="w-4 h-4" />
            Chunk Settings
          </button>

          {showSettings && (
            <div className="mt-2 space-y-3 bg-slate-50 rounded-lg p-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  Chunk Size{' '}
                  <span className="text-slate-400">(default: {defaultChunkSize})</span>
                </label>
                <input
                  type="number"
                  placeholder={String(defaultChunkSize)}
                  value={chunkSize}
                  onChange={(e) => setChunkSize(e.target.value)}
                  min={100}
                  max={10000}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
                <p className="text-xs text-slate-400 mt-0.5">
                  Active: {getEffectiveChunkSize()} chars
                </p>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  Chunk Overlap{' '}
                  <span className="text-slate-400">(default: {defaultChunkOverlap})</span>
                </label>
                <input
                  type="number"
                  placeholder={String(defaultChunkOverlap)}
                  value={chunkOverlap}
                  onChange={(e) => setChunkOverlap(e.target.value)}
                  min={0}
                  max={5000}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
                <p className="text-xs text-slate-400 mt-0.5">
                  Active: {getEffectiveChunkOverlap()} chars
                </p>
              </div>
              <button
                onClick={() => {
                  setChunkSize(String(defaultChunkSize));
                  setChunkOverlap(String(defaultChunkOverlap));
                }}
                className="text-xs text-primary-600 hover:text-primary-700 font-medium"
              >
                Reset to Defaults
              </button>
            </div>
          )}
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
            <p className="text-xs text-green-700">{success}</p>
          </div>
        )}

        {/* Document List */}
        <div className="px-4 pb-4">
          {documents.length === 0 ? (
            <div className="text-center py-6">
              <File className="w-10 h-10 text-slate-300 mx-auto mb-2" />
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
                    <span className="text-xl">
                      {doc.file_type === 'text' ? '📝' : FILE_ICONS[doc.file_type] || '📄'}
                    </span>
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
    </div>
  );
}
