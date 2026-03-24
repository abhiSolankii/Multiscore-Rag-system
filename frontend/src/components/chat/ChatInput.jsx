import { useRef, useEffect } from 'react';
import { Send, Loader2 } from 'lucide-react';
import useAuth from '../../hooks/useAuth';

const ChatInput = ({ value, onChange, onSend, disabled, loading }) => {
  const { user } = useAuth();
  const charLimit = user?.config?.chat_char_limit ?? 1500;
  const len = value.length;
  const isOverLimit = len > charLimit;
  const textareaRef = useRef(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [value]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!disabled && !loading && !isOverLimit && value.trim()) onSend();
    }
  };

  return (
    <div className="border-t border-gray-800 bg-gray-950 p-4">
      <div className={`flex gap-3 items-end rounded-xl border px-4 py-3 transition-colors ${
        isOverLimit ? 'border-red-500/60 bg-gray-900' : 'border-gray-700 bg-gray-900 focus-within:border-indigo-500/60'
      }`}>
        <textarea
          ref={textareaRef}
          rows={1}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled || loading}
          placeholder="Ask anything… (Shift+Enter for new line)"
          className="flex-1 bg-transparent text-white text-sm placeholder-gray-500 resize-none outline-none max-h-40 overflow-y-auto"
          style={{ minHeight: '24px' }}
        />
        <button
          onClick={onSend}
          disabled={disabled || loading || isOverLimit || !value.trim()}
          className="shrink-0 p-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
        </button>
      </div>
      {/* Char counter */}
      <div className="flex justify-end mt-1.5">
        <span className={`text-xs ${isOverLimit ? 'text-red-400 font-medium' : 'text-gray-600'}`}>
          {len} / {charLimit}
        </span>
      </div>
    </div>
  );
};

export default ChatInput;
