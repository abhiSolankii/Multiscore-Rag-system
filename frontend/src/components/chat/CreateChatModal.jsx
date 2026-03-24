import { useEffect, useState } from 'react';
import { Modal, Switch, Select, Tooltip } from 'antd';
import { Info } from 'lucide-react';
import { createChat } from '../../api/chat';
import { handleError } from '../../utils/errorHandler';
import toast from 'react-hot-toast';

const { Option } = Select;

const CreateChatModal = ({ open, onClose, onCreated }) => {
  const [title, setTitle] = useState('');
  const [mode, setMode] = useState('hybrid');
  const [includePublic, setIncludePublic] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setTitle('');
      setMode('hybrid');
      setIncludePublic(false);
    }
  }, [open]);

  const handleCreate = async () => {
    if (!title.trim()) { toast.error('Please enter a chat title.'); return; }
    setLoading(true);
    try {
      const chat = await createChat(title.trim(), { mode, include_public: includePublic });
      onCreated(chat);
      onClose();
    } catch (err) {
      handleError(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      onOk={handleCreate}
      okText="Create Chat"
      confirmLoading={loading}
      title={<span className="text-white">New Chat</span>}
      className="dark-modal"
      styles={{
        content: { background: '#111827', border: '1px solid #1f2937' },
        header: { background: '#111827', borderBottom: '1px solid #1f2937' },
        footer: { background: '#111827', borderTop: '1px solid #1f2937' },
        mask: { backdropFilter: 'blur(4px)' },
      }}
      okButtonProps={{ className: 'bg-indigo-600 border-indigo-600 hover:bg-indigo-500' }}
    >
      <div className="space-y-5 py-2">
        {/* Title */}
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1.5">Chat Title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Research on Indian Army"
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
          />
        </div>

        {/* Mode */}
        <div>
          <div className="flex items-center gap-1.5 mb-1.5">
            <label className="text-xs font-medium text-gray-400">Mode</label>
            <Tooltip title="Strict: answers only from documents. Hybrid: uses documents + AI knowledge.">
              <Info size={13} className="text-gray-500 cursor-help" />
            </Tooltip>
          </div>
          <Select
            value={mode}
            onChange={setMode}
            className="w-full"
            popupClassName="dark-select-popup"
          >
            <Option value="hybrid">Hybrid — documents + AI knowledge</Option>
            <Option value="strict">Strict — documents only</Option>
          </Select>
        </div>

        {/* Include Public */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-gray-400">Include Public Documents</span>
            <Tooltip title="When enabled, the AI can also search the shared public knowledge base.">
              <Info size={13} className="text-gray-500 cursor-help" />
            </Tooltip>
          </div>
          <Switch
            checked={includePublic}
            onChange={setIncludePublic}
            className={includePublic ? 'bg-indigo-600' : 'bg-gray-600'}
          />
        </div>
      </div>
    </Modal>
  );
};

export default CreateChatModal;
