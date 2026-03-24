import { Tooltip } from 'antd';
import { FileText, Globe, GitBranch } from 'lucide-react';

const sourceIcon = (type) => {
  if (type === 'web') return <Globe size={11} />;
  if (type === 'github') return <Github size={11} />;
  return <FileText size={11} />;
};

const CitationChip = ({ index, chunk, onClick }) => {
  const meta = chunk?.metadata || {};
  const tooltipText = meta.source
    ? `${meta.source}${meta.page !== undefined ? ` · Page ${meta.page + 1}` : ''}`
    : `Chunk ${index}`;

  return (
    <Tooltip title={tooltipText} placement="top">
      <button
        onClick={onClick}
        className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-900/60 hover:bg-indigo-800/80 border border-indigo-700/60 text-indigo-300 text-xs rounded-full transition-colors cursor-pointer"
      >
        {chunk && sourceIcon(meta.type)}
        <span>[{index}]</span>
      </button>
    </Tooltip>
  );
};

export default CitationChip;
