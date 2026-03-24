import { Modal } from 'antd';
import { ExternalLink, FileText, Globe, GitBranch } from 'lucide-react';

const typeConfig = {
  web: { icon: Globe, color: 'text-blue-400', label: 'Web Page' },
  github: { icon: GitBranch, color: 'text-gray-300', label: 'GitHub' },
  pdf: { icon: FileText, color: 'text-orange-400', label: 'PDF' },
};

const ChunkModal = ({ open, onClose, chunk }) => {
  if (!chunk) return null;
  const meta = chunk.metadata || {};
  const cfg = typeConfig[meta.type] || typeConfig.pdf;
  const Icon = cfg.icon;

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={600}
      title={
        <div className="flex items-center gap-2">
          <Icon size={16} className={cfg.color} />
          <span className="text-white text-sm font-medium">Source — {cfg.label}</span>
        </div>
      }
      styles={{
        content: { background: '#111827', border: '1px solid #1f2937' },
        header: { background: '#111827', borderBottom: '1px solid #1f2937' },
        mask: { backdropFilter: 'blur(4px)' },
      }}
    >
      <div className="space-y-4 py-2">
        {/* Source URL / filename */}
        <div className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 flex items-center justify-between gap-2">
          <p className="text-xs text-gray-300 truncate">{meta.source || 'Unknown source'}</p>
          {meta.type === 'web' && meta.source && (
            <a href={meta.source} target="_blank" rel="noreferrer" className="shrink-0 text-indigo-400 hover:text-indigo-300 transition-colors">
              <ExternalLink size={14} />
            </a>
          )}
        </div>

        {/* Metadata pills */}
        <div className="flex flex-wrap gap-2">
          {meta.page !== undefined && (
            <span className="px-2 py-0.5 bg-gray-800 border border-gray-700 text-gray-400 text-xs rounded-full">
              Page {meta.page + 1}
            </span>
          )}
          {meta.chunk_index !== undefined && (
            <span className="px-2 py-0.5 bg-gray-800 border border-gray-700 text-gray-400 text-xs rounded-full">
              Chunk #{meta.chunk_index}
            </span>
          )}
          {meta.token_count && (
            <span className="px-2 py-0.5 bg-gray-800 border border-gray-700 text-gray-400 text-xs rounded-full">
              {meta.token_count} tokens
            </span>
          )}
          {chunk.score && (
            <span className="px-2 py-0.5 bg-indigo-900/40 border border-indigo-700/50 text-indigo-300 text-xs rounded-full">
              Score: {chunk.score.toFixed(3)}
            </span>
          )}
        </div>

        {/* Content */}
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-3 max-h-64 overflow-y-auto">
          <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">{chunk.content}</p>
        </div>
      </div>
    </Modal>
  );
};

export default ChunkModal;
