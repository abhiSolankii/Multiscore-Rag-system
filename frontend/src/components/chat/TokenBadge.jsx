import { Tooltip } from 'antd';
import { Coins } from 'lucide-react';

const fmt = (n) => (n != null ? Number(n).toLocaleString() : '—');
const fmtCost = (c) => (c != null ? `$${Number(c).toFixed(6)}` : null);

const TokenBadge = ({ tokensUsed }) => {
  if (!tokensUsed) return null;

  const { prompt_tokens, completion_tokens, total_tokens, cost } = tokensUsed;

  const tooltip = (
    <div className="text-xs space-y-1 min-w-[140px]">
      <div className="text-gray-400 font-bold mb-1 border-b border-gray-700 pb-1">Token usage</div>
      <div className="flex justify-between gap-4">
        <span className="text-gray-400">Prompt</span>
        <span className="text-white font-mono">{fmt(prompt_tokens)}</span>
      </div>
      <div className="flex justify-between gap-4">
        <span className="text-gray-400">Completion</span>
        <span className="text-white font-mono">{fmt(completion_tokens)}</span>
      </div>
      <div className="flex justify-between gap-4 border-t border-gray-700 pt-1 mt-1">
        <span className="text-gray-400">Total</span>
        <span className="text-indigo-300 font-mono font-semibold">{fmt(total_tokens)}</span>
      </div>
      {fmtCost(cost) && (
        <div className="flex justify-between gap-4">
          <span className="text-gray-400">Cost</span>
          <span className="text-green-400 font-mono">{fmtCost(cost)}</span>
        </div>
      )}
    </div>
  );

  return (
    <Tooltip title={tooltip} placement="top">
      <span className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-indigo-400 cursor-default transition-colors bg-gray-900/50 px-2 py-0.5 rounded border border-gray-800">
        <Coins size={11} />
        {fmt(total_tokens)}
      </span>
    </Tooltip>
  );
};

export default TokenBadge;
