import { Brain } from "lucide-react";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { useSelector } from "react-redux";
import remarkGfm from "remark-gfm";
import { parseCitations } from "../../utils/citations";
import ChunkModal from "./ChunkModal";
import MessageActions from "./MessageActions";
import SourcesDropdown from "./SourcesDropdown";

const MarkdownContent = ({ content }) => (
  <ReactMarkdown
    remarkPlugins={[remarkGfm]}
    components={{
      p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
      h1: ({ children }) => (
        <h1 className="text-xl font-bold mb-2 text-white">{children}</h1>
      ),
      h2: ({ children }) => (
        <h2 className="text-lg font-semibold mb-2 text-white">{children}</h2>
      ),
      h3: ({ children }) => (
        <h3 className="text-base font-semibold mb-1.5 text-white">
          {children}
        </h3>
      ),
      ul: ({ children }) => (
        <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>
      ),
      ol: ({ children }) => (
        <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>
      ),
      li: ({ children }) => <li className="text-gray-300">{children}</li>,
      code: ({ inline, children }) =>
        inline ? (
          <code className="px-1.5 py-0.5 bg-gray-800 text-indigo-300 rounded text-xs font-mono">
            {children}
          </code>
        ) : (
          <pre className="bg-gray-800 rounded-lg p-3 overflow-x-auto my-2">
            <code className="text-sm font-mono text-gray-200">{children}</code>
          </pre>
        ),
      blockquote: ({ children }) => (
        <blockquote className="border-l-4 border-indigo-500 pl-3 italic text-gray-400 my-2">
          {children}
        </blockquote>
      ),
      table: ({ children }) => (
        <div className="overflow-x-auto my-2">
          <table className="min-w-full text-sm border border-gray-700 rounded">
            {children}
          </table>
        </div>
      ),
      th: ({ children }) => (
        <th className="px-3 py-2 bg-gray-800 text-left text-gray-300 border-b border-gray-700">
          {children}
        </th>
      ),
      td: ({ children }) => (
        <td className="px-3 py-2 text-gray-300 border-b border-gray-800">
          {children}
        </td>
      ),
      hr: () => <hr className="border-gray-700 my-3" />,
      strong: ({ children }) => (
        <strong className="font-semibold text-white">{children}</strong>
      ),
      a: ({ href, children }) => (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="text-indigo-400 hover:underline"
        >
          {children}
        </a>
      ),
    }}
  >
    {content}
  </ReactMarkdown>
);

const MessageBubble = ({ message, chatTitle }) => {
  const { role, content, used_chunks = [], tokens_used } = message;
  const isUser = role === "user";
  const [selectedChunk, setSelectedChunk] = useState(null);
  const user = useSelector((state) => state.auth.user);

  // User color/avatar based on ID for consistency
  const userAvatar = "https://api.dicebear.com/9.x/lorelei/svg?flip=true";

  // ── User Bubble ────────────────────────────────────────────────────────────
  if (isUser) {
    return (
      <div className="flex justify-end gap-3 px-2 sm:px-0">
        <div className="max-w-[85%] sm:max-w-[75%] bg-indigo-600/90 text-white rounded-2xl rounded-tr-sm px-4 py-3 text-[13px] sm:text-sm shadow-md border border-indigo-500/30">
          <p className="whitespace-pre-wrap">{content}</p>
        </div>
        <img
          src={userAvatar}
          className="w-8 h-8 rounded-full bg-gray-800 border-2 border-indigo-500/50 object-cover mt-1"
          alt="avatar"
        />
      </div>
    );
  }

  // ── Assistant Bubble ───────────────────────────────────────────────────────
  const segments = parseCitations(content, used_chunks);
  const cleanContent = segments
    .filter((s) => s.type === "text")
    .map((s) => s.content)
    .join("");

  // Get unique citations by index to avoid duplicate key errors
  const citations = segments
    .filter((s) => s.type === "citation")
    .reduce((acc, curr) => {
      if (!acc.find((item) => item.index === curr.index)) {
        acc.push(curr);
      }
      return acc;
    }, []);

  return (
    <>
      <div className="flex gap-3 px-2 sm:px-0">
        <div className="w-8 h-8 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center shrink-0 mt-1 shadow-inner">
          <Brain size={16} className="text-indigo-400" />
        </div>

        <div className="flex-1 min-w-0 max-w-[85%] sm:max-w-[80%]">
          <div className="bg-gray-900/60 border border-gray-800 rounded-2xl rounded-tl-sm px-4 py-3 shadow-lg">
            <div className="text-[13px] sm:text-sm text-gray-200 leading-relaxed">
              <MarkdownContent content={cleanContent} />
            </div>
          </div>

          {/* Action bar + Sources combined row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mt-1">
            <MessageActions
              content={cleanContent}
              tokensUsed={tokens_used}
              chatTitle={chatTitle}
            />

            <SourcesDropdown
              usedChunks={used_chunks}
              onCitationClick={(chunk) => setSelectedChunk(chunk)}
            />
          </div>
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
