import { useState } from 'react';
import { parseCitations } from '../../utils/citations';
import CitationChip from './CitationChip';
import ChunkModal from './ChunkModal';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { User, Brain } from 'lucide-react';

const MarkdownContent = ({ content }) => (
  <ReactMarkdown
    remarkPlugins={[remarkGfm]}
    components={{
      p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
      h1: ({ children }) => <h1 className="text-xl font-bold mb-2 text-white">{children}</h1>,
      h2: ({ children }) => <h2 className="text-lg font-semibold mb-2 text-white">{children}</h2>,
      h3: ({ children }) => <h3 className="text-base font-semibold mb-1.5 text-white">{children}</h3>,
      ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>,
      ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>,
      li: ({ children }) => <li className="text-gray-300">{children}</li>,
      code: ({ inline, children }) =>
        inline ? (
          <code className="px-1.5 py-0.5 bg-gray-800 text-indigo-300 rounded text-xs font-mono">{children}</code>
        ) : (
          <pre className="bg-gray-800 rounded-lg p-3 overflow-x-auto my-2">
            <code className="text-sm font-mono text-gray-200">{children}</code>
          </pre>
        ),
      blockquote: ({ children }) => (
        <blockquote className="border-l-4 border-indigo-500 pl-3 italic text-gray-400 my-2">{children}</blockquote>
      ),
      table: ({ children }) => (
        <div className="overflow-x-auto my-2">
          <table className="min-w-full text-sm border border-gray-700 rounded">{children}</table>
        </div>
      ),
      th: ({ children }) => <th className="px-3 py-2 bg-gray-800 text-left text-gray-300 border-b border-gray-700">{children}</th>,
      td: ({ children }) => <td className="px-3 py-2 text-gray-300 border-b border-gray-800">{children}</td>,
      hr: () => <hr className="border-gray-700 my-3" />,
      strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
      a: ({ href, children }) => <a href={href} target="_blank" rel="noreferrer" className="text-indigo-400 hover:underline">{children}</a>,
    }}
  >
    {content}
  </ReactMarkdown>
);

const MessageBubble = ({ message }) => {
  const { role, content, used_chunks = [] } = message;
  const isUser = role === 'user';
  const [selectedChunk, setSelectedChunk] = useState(null);

  if (isUser) {
    return (
      <div className="flex justify-end gap-2.5 group">
        <div className="max-w-[80%] bg-indigo-600 text-white rounded-2xl rounded-br-sm px-4 py-3 text-sm">
          <p className="whitespace-pre-wrap">{content}</p>
        </div>
        <div className="w-7 h-7 rounded-full bg-indigo-700 flex items-center justify-center shrink-0 mt-1">
          <User size={14} className="text-white" />
        </div>
      </div>
    );
  }

  // Parse citation tokens
  const segments = parseCitations(content, used_chunks);
  // Build clean markdown text (citations stripped, appended as separate chips)
  const cleanContent = segments.filter((s) => s.type === 'text').map((s) => s.content).join('');
  const citations = segments.filter((s) => s.type === 'citation');

  return (
    <>
      <div className="flex gap-2.5 group">
        <div className="w-7 h-7 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center shrink-0 mt-1">
          <Brain size={14} className="text-indigo-400" />
        </div>
        <div className="max-w-[85%] space-y-2">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl rounded-bl-sm px-4 py-3 text-sm text-gray-200 leading-relaxed">
            <MarkdownContent content={cleanContent} />
          </div>
          {/* Citation chips */}
          {citations.length > 0 && (
            <div className="flex flex-wrap gap-1.5 px-1">
              {citations.map((c) => (
                <CitationChip
                  key={c.index}
                  index={c.index}
                  chunk={c.chunk}
                  onClick={() => setSelectedChunk(c.chunk)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
      <ChunkModal
        open={!!selectedChunk}
        onClose={() => setSelectedChunk(null)}
        chunk={selectedChunk}
      />
    </>
  );
};

export default MessageBubble;
