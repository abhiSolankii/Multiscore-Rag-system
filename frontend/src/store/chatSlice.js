import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  chats: [],
  activeChat: null,
  messages: [],
  // Streaming state
  isStreaming: false,
  streamingContent: '',
  statusStep: null,   // e.g. 'rewriting_query' | 'retrieving' | 'retrieved' | 'building_context' | 'calling_llm' | 'generating'
  usedChunks: [],     // populated on 'retrieved' SSE event, before LLM finishes
};

const chatSlice = createSlice({
  name: 'chat',
  initialState,
  reducers: {
    setChats: (state, action) => {
      state.chats = action.payload;
    },
    addChat: (state, action) => {
      state.chats.unshift(action.payload);
    },
    updateChatInList: (state, action) => {
      const idx = state.chats.findIndex((c) => c._id === action.payload._id);
      if (idx !== -1) state.chats[idx] = action.payload;
      if (state.activeChat?._id === action.payload._id) {
        state.activeChat = action.payload;
      }
    },
    removeChatFromList: (state, action) => {
      state.chats = state.chats.filter((c) => c._id !== action.payload);
    },
    setActiveChat: (state, action) => {
      state.activeChat = action.payload;
    },
    setMessages: (state, action) => {
      state.messages = action.payload;
    },
    addMessage: (state, action) => {
      state.messages.push(action.payload);
    },
    // Streaming controls
    startStreaming: (state) => {
      state.isStreaming = true;
      state.streamingContent = '';
      state.statusStep = null;
      state.usedChunks = [];
    },
    appendStreamToken: (state, action) => {
      state.streamingContent += action.payload;
    },
    setStatusStep: (state, action) => {
      state.statusStep = action.payload;
    },
    setUsedChunks: (state, action) => {
      state.usedChunks = action.payload;
    },
    finishStreaming: (state, action) => {
      // action.payload = final assembled message object
      state.isStreaming = false;
      state.streamingContent = '';
      state.statusStep = null;
      if (action.payload) {
        state.messages.push(action.payload);
      }
    },
    clearStreamingState: (state) => {
      state.isStreaming = false;
      state.streamingContent = '';
      state.statusStep = null;
    },
  },
});

export const {
  setChats,
  addChat,
  updateChatInList,
  removeChatFromList,
  setActiveChat,
  setMessages,
  addMessage,
  startStreaming,
  appendStreamToken,
  setStatusStep,
  setUsedChunks,
  finishStreaming,
  clearStreamingState,
} = chatSlice.actions;

export default chatSlice.reducer;

// Selectors
export const selectChats = (state) => state.chat.chats;
export const selectActiveChat = (state) => state.chat.activeChat;
export const selectMessages = (state) => state.chat.messages;
export const selectIsStreaming = (state) => state.chat.isStreaming;
export const selectStreamingContent = (state) => state.chat.streamingContent;
export const selectStatusStep = (state) => state.chat.statusStep;
export const selectUsedChunks = (state) => state.chat.usedChunks;
