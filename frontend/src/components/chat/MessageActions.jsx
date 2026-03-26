import { useState } from 'react';
import { Tooltip } from 'antd';
import {
  ThumbsUp,
  ThumbsDown,
  Copy,
  Download,
  Volume2,
  VolumeX,
  Check,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { exportMessageAsPdf } from '../../utils/pdfExport';
import { speakText, stopSpeech } from '../../utils/speechReader';
import TokenBadge from './TokenBadge';

const ActionBtn = ({ icon, label, onClick, active = false, danger = false }) => {
  const ActIcon = icon;
  return (
    <Tooltip title={label} placement="top">
      <button
        onClick={onClick}
        className={`p-1.5 rounded-md transition-colors ${
          danger
            ? 'text-red-400 hover:bg-red-900/20'
            : active
            ? 'text-indigo-400 bg-indigo-900/40'
            : 'text-gray-400 hover:text-white hover:bg-gray-800'
        }`}
      >
        <ActIcon size={14} />
      </button>
    </Tooltip>
  );
};

const MessageActions = ({ content, tokensUsed, chatTitle }) => {
  const [liked, setLiked] = useState(null); // null | 'up' | 'down'
  const [copied, setCopied] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success('Copied to clipboard');
    } catch {
      toast.error('Copy failed');
    }
  };

  const handleDownload = () => {
    exportMessageAsPdf(content, chatTitle || 'Chat Response');
  };

  const handleSpeak = () => {
    if (speaking) {
      stopSpeech();
      setSpeaking(false);
    } else {
      speakText(content, { onEnd: () => setSpeaking(false) });
      setSpeaking(true);
    }
  };

  const handleLike = () => setLiked((prev) => (prev === 'up' ? null : 'up'));
  const handleDislike = () => setLiked((prev) => (prev === 'down' ? null : 'down'));

  return (
    <div className="flex flex-wrap items-center gap-1 mt-2 mb-1 px-1">
      <div className="flex items-center gap-0.5 mr-2">
        <ActionBtn
          icon={ThumbsUp}
          label="Helpful"
          onClick={handleLike}
          active={liked === 'up'}
        />
        <ActionBtn
          icon={ThumbsDown}
          label="Not helpful"
          onClick={handleDislike}
          active={liked === 'down'}
        />
      </div>
      
      <div className="w-px h-4 bg-gray-800 hidden sm:block mr-2" />
      
      <div className="flex items-center gap-0.5 mr-2">
        <ActionBtn
          icon={copied ? Check : Copy}
          label={copied ? 'Copied!' : 'Copy'}
          onClick={handleCopy}
          active={copied}
        />
        <ActionBtn
          icon={Download}
          label="Download PDF"
          onClick={handleDownload}
        />
        <ActionBtn
          icon={speaking ? VolumeX : Volume2}
          label={speaking ? 'Stop reading' : 'Read aloud'}
          onClick={handleSpeak}
          active={speaking}
        />
      </div>
      
      <div className="w-px h-4 bg-gray-800 hidden sm:block mr-2" />
      
      <TokenBadge tokensUsed={tokensUsed} />
    </div>
  );
};

export default MessageActions;
