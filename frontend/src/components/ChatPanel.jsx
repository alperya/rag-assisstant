import { useState, useRef, useEffect } from 'react';
import {
  Send,
  Bot,
  User,
  Loader2,
  BookOpen,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  ShieldAlert,
  ShieldQuestion,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { askQuestion } from '../api';

const CONFIDENCE_CONFIG = {
  high: { icon: ShieldCheck, color: 'text-green-600', bg: 'bg-green-50', label: 'High confidence' },
  medium: { icon: ShieldQuestion, color: 'text-yellow-600', bg: 'bg-yellow-50', label: 'Medium confidence' },
  low: { icon: ShieldAlert, color: 'text-red-600', bg: 'bg-red-50', label: 'Low confidence' },
};

function SourceCard({ source, index }) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-3 text-xs">
      <div className="flex items-center gap-2 mb-1">
        <BookOpen className="w-3.5 h-3.5 text-primary-600" />
        <span className="font-medium text-slate-700">{source.document_name}</span>
        {source.page_number && (
          <span className="text-slate-400">• Page {source.page_number}</span>
        )}
      </div>
      <p className="text-slate-500 leading-relaxed line-clamp-2">
        {source.content_preview}
      </p>
    </div>
  );
}

function ChatMessage({ message }) {
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const isUser = message.role === 'user';
  const conf = message.confidence ? CONFIDENCE_CONFIG[message.confidence] : null;
  const ConfIcon = conf?.icon;

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      {/* Avatar */}
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
          isUser ? 'bg-primary-600' : 'bg-slate-700'
        }`}
      >
        {isUser ? (
          <User className="w-4 h-4 text-white" />
        ) : (
          <Bot className="w-4 h-4 text-white" />
        )}
      </div>

      {/* Message Bubble */}
      <div className={`max-w-[75%] ${isUser ? 'items-end' : 'items-start'}`}>
        <div
          className={`rounded-2xl px-4 py-3 ${
            isUser
              ? 'bg-primary-600 text-white rounded-br-md'
              : 'bg-white border border-slate-200 text-slate-700 rounded-bl-md shadow-sm'
          }`}
        >
          <div className={isUser ? '' : 'markdown-content'}>
            {isUser ? (
              <p className="text-sm">{message.content}</p>
            ) : (
              <ReactMarkdown className="text-sm">{message.content}</ReactMarkdown>
            )}
          </div>
        </div>

        {/* Confidence Badge & Sources */}
        {!isUser && message.sources && message.sources.length > 0 && (
          <div className="mt-2">
            <div className="flex items-center gap-2">
              {conf && (
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${conf.bg} ${conf.color}`}
                >
                  <ConfIcon className="w-3 h-3" />
                  {conf.label}
                </span>
              )}
              <button
                onClick={() => setSourcesOpen(!sourcesOpen)}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
              >
                <BookOpen className="w-3 h-3" />
                {message.sources.length} source{message.sources.length > 1 ? 's' : ''}
                {sourcesOpen ? (
                  <ChevronUp className="w-3 h-3" />
                ) : (
                  <ChevronDown className="w-3 h-3" />
                )}
              </button>
            </div>

            {sourcesOpen && (
              <div className="mt-2 space-y-2">
                {message.sources.map((source, i) => (
                  <SourceCard key={i} source={source} index={i} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ChatPanel({ documents }) {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content:
        'Hello! I\'m your document analysis assistant. Upload documents on the left panel, then ask me questions about their content. I\'ll provide answers with source citations.',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    const question = input.trim();
    if (!question || loading) return;

    if (documents.length === 0) {
      setMessages((prev) => [
        ...prev,
        { role: 'user', content: question },
        {
          role: 'assistant',
          content:
            'Please upload at least one document first. I can only answer questions based on uploaded documents.',
        },
      ]);
      setInput('');
      return;
    }

    setMessages((prev) => [...prev, { role: 'user', content: question }]);
    setInput('');
    setLoading(true);

    try {
      const response = await askQuestion(question);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: response.answer,
          sources: response.sources,
          confidence: response.confidence,
        },
      ]);
    } catch (err) {
      const errorMsg =
        err.response?.data?.detail ||
        'An error occurred while processing your question. Please try again.';
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `⚠️ ${errorMsg}` },
      ]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="h-full flex flex-col bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
          <Bot className="w-5 h-5 text-primary-600" />
          RAG Assistant
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Ask questions about your uploaded documents
        </p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
        {messages.map((msg, i) => (
          <ChatMessage key={i} message={msg} />
        ))}

        {loading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center flex-shrink-0">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
              <div className="flex items-center gap-2 text-slate-500">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Analyzing documents...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="bg-white border-t border-slate-200 p-4">
        <div className="flex items-end gap-3 max-w-4xl mx-auto">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                documents.length === 0
                  ? 'Upload a document first...'
                  : 'Ask a question about your documents...'
              }
              disabled={loading}
              rows={1}
              className="w-full resize-none rounded-xl border border-slate-300 px-4 py-3 pr-12 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:bg-slate-50 disabled:cursor-not-allowed placeholder:text-slate-400"
              style={{ minHeight: '44px', maxHeight: '120px' }}
              onInput={(e) => {
                e.target.style.height = '44px';
                e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
              }}
            />
          </div>
          <button
            onClick={handleSend}
            disabled={!input.trim() || loading}
            className="p-3 rounded-xl bg-primary-600 text-white hover:bg-primary-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors flex-shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
