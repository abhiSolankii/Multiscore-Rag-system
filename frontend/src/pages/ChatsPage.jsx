import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Plus, Search, MessageSquare } from 'lucide-react';
import { getChats } from '../api/chat';
import { setChats, addChat, selectChats } from '../store/chatSlice';
import ChatCard from '../components/chat/ChatCard';
import CreateChatModal from '../components/chat/CreateChatModal';
import { handleError } from '../utils/errorHandler';
import { useNavigate } from 'react-router-dom';

const ChatsPage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const chats = useSelector(selectChats);
  const [loading, setLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [search, setSearch] = useState('');
  const [modeFilter, setModeFilter] = useState('all');

  useEffect(() => {
    const fetchChats = async () => {
      setLoading(true);
      try {
        const data = await getChats();
        dispatch(setChats(data));
      } catch (err) {
        handleError(err);
      } finally {
        setLoading(false);
      }
    };
    fetchChats();
  }, [dispatch]);

  const filtered = chats.filter((c) => {
    const matchSearch = c.title.toLowerCase().includes(search.toLowerCase());
    const matchMode = modeFilter === 'all' || c.config?.mode === modeFilter;
    return matchSearch && matchMode;
  });

  const handleCreated = (chat) => {
    dispatch(addChat(chat));
    navigate(`/chats/${chat._id}`);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b border-gray-800 px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-white">Chats</h1>
          <p className="text-xs text-gray-500 mt-0.5">{chats.length} conversation{chats.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Plus size={16} />
          New Chat
        </button>
      </div>

      {/* Filters */}
      <div className="px-6 py-3 flex flex-col sm:flex-row gap-3 border-b border-gray-800/60">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search chats..."
            className="w-full pl-9 pr-4 py-2 bg-gray-900 border border-gray-800 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
          />
        </div>
        <select
          value={modeFilter}
          onChange={(e) => setModeFilter(e.target.value)}
          className="px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-sm text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
        >
          <option value="all">All modes</option>
          <option value="strict">Strict</option>
          <option value="hybrid">Hybrid</option>
        </select>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex justify-center items-center h-40">
            <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-center">
            <MessageSquare size={32} className="text-gray-700 mb-3" />
            <p className="text-gray-500 text-sm">{search ? 'No chats match your search.' : 'No chats yet. Create one!'}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((chat) => (
              <ChatCard key={chat._id} chat={chat} />
            ))}
          </div>
        )}
      </div>

      <CreateChatModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={handleCreated}
      />
    </div>
  );
};

export default ChatsPage;
