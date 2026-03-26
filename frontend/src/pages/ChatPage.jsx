import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { Database } from 'lucide-react';
import { getMessages, sendMessage, sendMessageStream, getChat } from '../api/chat';
import { getToken } from '../utils/token';
import { handleError } from '../utils/errorHandler';
import {
  setMessages,
  addMessage,
  selectMessages,
  selectIsStreaming,
  selectStatusStep,
  selectActiveChat,
  setActiveChat,
  startStreaming,
  appendStreamToken,
  setStatusStep,
  setUsedChunks,
  finishStreaming,
  clearStreamingState,
} from '../store/chatSlice';
import MessageBubble from '../components/chat/MessageBubble';
import ChatInput from '../components/chat/ChatInput';
import TypingIndicator from '../components/chat/TypingIndicator';
import DocManagerModal from '../components/chat/DocManagerModal';
import toast from 'react-hot-toast';

const ChatPage = () => {
  const { chatId } = useParams();
  const dispatch = useDispatch();
  const messages = useSelector(selectMessages);
  const isStreaming = useSelector(selectIsStreaming);
  const statusStep = useSelector(selectStatusStep);
  const activeChat = useSelector(selectActiveChat);
  const user = useSelector((state) => state.auth.user);
  const enableStreaming = user?.config?.enable_streaming ?? false;
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetchingMsgs, setFetchingMsgs] = useState(false);
  const [showDocModal, setShowDocModal] = useState(false);
  const messagesEndRef = useRef(null);
  const streamingContentRef = useRef('');

  // Fetch messages + chat data on mount / chatId change
  useEffect(() => {
    const load = async () => {
      setFetchingMsgs(true);
      try {
        const [msgs, chat] = await Promise.all([getMessages(chatId), getChat(chatId)]);
        dispatch(setMessages(msgs));
        dispatch(setActiveChat(chat));
      } catch (err) {
        handleError(err);
      } finally {
        setFetchingMsgs(false);
      }
    };
    load();
  }, [chatId, dispatch]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming, statusStep]);

  const handleSend = async () => {
    if (!input.trim() || loading || isStreaming) return;
    const content = input.trim();
    setInput('');

    // Optimistically add user message
    dispatch(addMessage({ _id: `temp-${Date.now()}`, role: 'user', content, created_at: new Date().toISOString() }));

    if (enableStreaming) {
      await handleStreamingSend(content);
    } else {
      await handleNonStreamingSend(content);
    }
  };

  const handleNonStreamingSend = async (content) => {
    setLoading(true);
    try {
      const assistantMsg = await sendMessage(chatId, content);
      dispatch(addMessage(assistantMsg));
    } catch (err) {
      handleError(err);
    } finally {
      setLoading(false);
    }
  };

  const handleStreamingSend = async (content) => {
    dispatch(startStreaming());
    streamingContentRef.current = '';
    let finalUsedChunks = [];

    try {
      const token = getToken();
      const response = await sendMessageStream(chatId, content, token);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Streaming failed');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop(); // keep incomplete line

        let currentEvent = null;
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEvent = line.slice(7).trim();
          } else if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (data === '[DONE]') break;
            try {
              const parsed = JSON.parse(data);
              if (currentEvent === 'status') {
                dispatch(setStatusStep(parsed.step));
                if (parsed.step === 'retrieved' && parsed.meta?.chunks) {
                  finalUsedChunks = parsed.meta.chunks;
                  dispatch(setUsedChunks(parsed.meta.chunks));
                }
              } else if (currentEvent === 'token') {
                streamingContentRef.current += parsed.text;
                dispatch(appendStreamToken(parsed.text));
              } else if (currentEvent === 'usage') {
                // usage data — handled by backend persistence
              } else if (currentEvent === 'error') {
                toast.error(parsed.error || 'Stream error');
              }
            } catch {
              // non-JSON line, skip
            }
          }
        }
      }

      dispatch(finishStreaming({
        _id: `stream-${Date.now()}`,
        role: 'assistant',
        content: streamingContentRef.current,
        used_chunks: finalUsedChunks,
        created_at: new Date().toISOString(),
      }));
    } catch (err) {
      dispatch(clearStreamingState());
      handleError(err);
    }
  };

  const streamingContent = useSelector((s) => s.chat.streamingContent);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-800 shrink-0">
        <div>
          <h2 className="text-sm font-semibold text-white truncate">
            {activeChat?.title || 'Chat'}
          </h2>
          <p className="text-xs text-gray-500 capitalize">
            {activeChat?.config?.mode || 'hybrid'} mode ·{' '}
            {activeChat?.config?.include_public ? 'Public + Private' : 'Private only'}
          </p>
        </div>
        <button
          onClick={() => setShowDocModal(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-700 hover:border-indigo-500/50 rounded-lg text-xs text-gray-400 hover:text-indigo-400 transition-colors"
        >
          <Database size={13} />
          Manage Sources
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 space-y-5">
        {fetchingMsgs ? (
          <div className="flex justify-center items-center h-32">
            <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : messages.length === 0 && !isStreaming ? (
          <div className="flex flex-col items-center justify-center h-full text-center pb-16">
            <p className="text-gray-600 text-sm">No messages yet. Start the conversation!</p>
          </div>
        ) : (
          <>
            {messages.map((msg) => (
              <MessageBubble key={msg._id} message={msg} chatTitle={activeChat?.title} />
            ))}
            {/* Streaming message bubble — shows content as it arrives */}
            {isStreaming && streamingContent && (
              <MessageBubble
                message={{
                  _id: 'streaming',
                  role: 'assistant',
                  content: streamingContent,
                  used_chunks: [],
                }}
                chatTitle={activeChat?.title}
              />
            )}
            {/* Status / typing indicator while waiting */}
            {(isStreaming || loading) && !streamingContent && (
              <TypingIndicator statusStep={isStreaming ? statusStep : null} />
            )}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <ChatInput
        value={input}
        onChange={setInput}
        onSend={handleSend}
        disabled={fetchingMsgs}
        loading={loading || isStreaming}
      />

      {/* Doc manager modal */}
      <DocManagerModal
        open={showDocModal}
        onClose={() => setShowDocModal(false)}
        chat={activeChat}
      />
    </div>
  );
};

export default ChatPage;
