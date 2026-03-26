import { useNavigate } from 'react-router-dom';
import { MessageSquare, Clock, ArrowRight, Globe, Lock, Trash2 } from 'lucide-react';

const modeColors = {
  strict: 'bg-red-900/40 text-red-400 border-red-800/60',
  hybrid: 'bg-blue-900/40 text-blue-400 border-blue-800/60',
};

const formatDate = (dateStr) => {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const ChatCard = ({ chat, onDelete }) => {
  const navigate = useNavigate();
  const config = chat.config || {};

  const handleDelete = (e) => {
    e.stopPropagation();
    onDelete(chat._id, chat.title);
  };

  return (
    <div className="group flex flex-col justify-between bg-gray-900 border border-gray-800 hover:border-indigo-500/40 rounded-xl p-4 transition-all duration-200 hover:shadow-lg hover:shadow-indigo-900/10">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-1.5 bg-gray-800 rounded-lg shrink-0">
            <MessageSquare size={14} className="text-indigo-400" />
          </div>
          <h3 className="text-sm font-semibold text-white truncate">{chat.title}</h3>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className={`text-xs px-2 py-0.5 rounded-full border capitalize ${modeColors[config.mode] || modeColors.hybrid}`}>
            {config.mode || 'hybrid'}
          </span>
          <button
            onClick={handleDelete}
            className="p-1 text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all rounded"
            title="Delete chat"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* Meta */}
      <div className="flex items-center gap-3 text-xs text-gray-500 mb-4">
        <span className="flex items-center gap-1">
          <Clock size={11} />
          {formatDate(chat.updated_at)}
        </span>
        {config.include_public ? (
          <span className="flex items-center gap-1 text-green-500">
            <Globe size={11} /> Public
          </span>
        ) : (
          <span className="flex items-center gap-1">
            <Lock size={11} /> Private
          </span>
        )}
      </div>

      {/* Continue button */}
      <button
        onClick={() => navigate(`/chats/${chat._id}`)}
        className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-indigo-500/30 text-indigo-400 text-xs font-medium hover:bg-indigo-600 hover:text-white hover:border-indigo-600 transition-all"
      >
        Continue <ArrowRight size={13} />
      </button>
    </div>
  );
};

export default ChatCard;
