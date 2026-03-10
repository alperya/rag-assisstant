import { useState, useEffect, useCallback } from 'react';
import DocumentPanel from './components/DocumentPanel';
import ChatPanel from './components/ChatPanel';
import { getDocuments } from './api';
import { BookOpenCheck, FileText, MessageSquare } from 'lucide-react';

export default function App() {
  const [documents, setDocuments] = useState([]);
  const [activeTab, setActiveTab] = useState('chat'); // mobile tab: 'chat' | 'docs'

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
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Document Panel — full screen on mobile when active, fixed sidebar on desktop */}
        <div
          className={`
            border-r border-slate-200 overflow-hidden transition-all duration-300
            ${activeTab === 'docs' ? 'max-md:w-full max-md:flex-1' : 'max-md:w-0 max-md:hidden'}
            md:w-80 lg:w-96 md:flex-shrink-0
          `}
        >
          <DocumentPanel
            documents={documents}
            onDocumentsChange={fetchDocuments}
          />
        </div>

        {/* Chat Panel — full screen on mobile when active, always visible on desktop */}
        <div
          className={`
            flex-1 min-w-0
            ${activeTab === 'chat' ? 'max-md:flex max-md:flex-col' : 'max-md:hidden'}
          `}
        >
          <ChatPanel documents={documents} />
        </div>
      </div>

      {/* Mobile Bottom Tab Bar */}
      <nav className="md:hidden bg-white border-t border-slate-200 flex flex-shrink-0 safe-bottom">
        <button
          onClick={() => setActiveTab('chat')}
          className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-xs font-medium transition-colors ${
            activeTab === 'chat'
              ? 'text-primary-600'
              : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <MessageSquare className="w-5 h-5" />
          Chat
        </button>
        <button
          onClick={() => setActiveTab('docs')}
          className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-xs font-medium transition-colors relative ${
            activeTab === 'docs'
              ? 'text-primary-600'
              : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <FileText className="w-5 h-5" />
          Documents
          {documents.length > 0 && (
            <span className="absolute top-1.5 right-1/4 w-4 h-4 bg-primary-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
              {documents.length}
            </span>
          )}
        </button>
      </nav>
    </div>
  );
}
