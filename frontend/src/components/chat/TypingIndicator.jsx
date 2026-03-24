const STEP_LABELS = {
  rewriting_query: 'Decomposing your query...',
  retrieving: 'Searching knowledge base...',
  retrieved: 'Processing sources...',
  building_context: 'Building context...',
  calling_llm: 'Sending to AI...',
  generating: null, // switch to dots animation
};

const TypingIndicator = ({ statusStep }) => {
  const label = STEP_LABELS[statusStep];

  // If step is 'generating' or null — show animated dots
  if (!label) {
    return (
      <div className="flex gap-2.5">
        <div className="w-7 h-7 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center shrink-0">
          <span className="text-indigo-400 text-xs font-bold">AI</span>
        </div>
        <div className="flex items-center gap-1 py-3 px-4 bg-gray-900 border border-gray-800 rounded-2xl rounded-bl-sm">
          <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
          <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
          <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-2.5">
      <div className="w-7 h-7 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center shrink-0">
        <span className="text-indigo-400 text-xs font-bold">AI</span>
      </div>
      <div className="flex items-center gap-2 py-2 px-4 bg-gray-900/60 border border-gray-800 rounded-2xl rounded-bl-sm">
        <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-pulse" />
        <span className="text-xs text-gray-400 italic">{label}</span>
      </div>
    </div>
  );
};

export default TypingIndicator;
