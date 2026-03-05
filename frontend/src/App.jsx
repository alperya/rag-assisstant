import { useState, useEffect, useCallback } from 'react';
import DocumentPanel from './components/DocumentPanel';
import ChatPanel from './components/ChatPanel';
import { getDocuments } from './api';
import { BookOpenCheck } from 'lucide-react';

export default function App() {
  const [documents, setDocuments] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const fetchDocuments = useCallback(async () => {
    try {
      const docs = await getDocuments();
      setDocuments(docs);
    } catch (err) {
      console.error('Failed to fetch documents:', err);
    }
  }, []);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  return (
    <div className="h-screen flex flex-col">
      {/* Top Bar */}
      <header className="bg-white border-b border-slate-200 px-4 py-2 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <BookOpenCheck className="w-6 h-6 text-primary-600" />
          <h1 className="text-base font-bold text-slate-800">RAG Assistant</h1>
          <span className="text-xs text-slate-400 hidden sm:inline">
            Corporate Document Analysis
          </span>
        </div>
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="sm:hidden p-2 text-slate-500 hover:text-slate-700 rounded-lg hover:bg-slate-100"
        >
          {sidebarOpen ? 'Hide Docs' : 'Show Docs'}
        </button>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Document Panel (Left) */}
        <div
          className={`${
            sidebarOpen ? 'w-80 lg:w-96' : 'w-0'
          } flex-shrink-0 border-r border-slate-200 transition-all duration-300 overflow-hidden`}
        >
          <DocumentPanel
            documents={documents}
            onDocumentsChange={fetchDocuments}
          />
        </div>

        {/* Chat Panel (Right) */}
        <div className="flex-1 min-w-0">
          <ChatPanel documents={documents} />
        </div>
      </div>
    </div>
  );
}
