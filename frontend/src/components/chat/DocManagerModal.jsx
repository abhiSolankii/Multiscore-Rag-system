import { useEffect, useState } from 'react';
import { Modal, Switch } from 'antd';
import { FileText, Globe, Loader2 } from 'lucide-react';
import { listDocuments } from '../../api/ingestion';
import { updateChat } from '../../api/chat';
import { useDispatch } from 'react-redux';
import { updateChatInList } from '../../store/chatSlice';
import { handleError } from '../../utils/errorHandler';
import toast from 'react-hot-toast';

const DocManagerModal = ({ open, onClose, chat }) => {
  const dispatch = useDispatch();
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [inactiveDocs, setInactiveDocs] = useState([]);

  useEffect(() => {
    if (!open || !chat) return;
    setInactiveDocs(chat.config?.inactive_docs || []);
    const fetchDocs = async () => {
      setLoading(true);
      try {
        const data = await listDocuments();
        setDocs(data);
      } catch (err) {
        handleError(err);
      } finally {
        setLoading(false);
      }
    };
    fetchDocs();
  }, [open, chat]);

  const toggleDoc = (docId) => {
    setInactiveDocs((prev) =>
      prev.includes(docId) ? prev.filter((id) => id !== docId) : [...prev, docId]
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await updateChat(chat._id, {
        config: { ...chat.config, inactive_docs: inactiveDocs },
      });
      dispatch(updateChatInList(updated));
      toast.success('Source settings saved.');
      onClose();
    } catch (err) {
      handleError(err);
    } finally {
      setSaving(false);
    }
  };

  const typeIcon = (type) =>
    type === 'web' ? <Globe size={14} className="text-blue-400" /> : <FileText size={14} className="text-orange-400" />;

  return (
    <Modal
      open={open}
      onCancel={onClose}
      onOk={handleSave}
      okText="Save"
      confirmLoading={saving}
      title={<span className="text-white">Manage Sources</span>}
      styles={{
        content: { background: '#111827', border: '1px solid #1f2937' },
        header: { background: '#111827', borderBottom: '1px solid #1f2937' },
        footer: { background: '#111827', borderTop: '1px solid #1f2937' },
        mask: { backdropFilter: 'blur(4px)' },
      }}
      okButtonProps={{ className: 'bg-indigo-600 border-indigo-600 hover:bg-indigo-500' }}
    >
      <p className="text-xs text-gray-400 mb-4">
        Toggle documents to enable or disable them for this chat. Disabled documents are excluded from retrieval.
      </p>
      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 size={24} className="animate-spin text-indigo-400" />
        </div>
      ) : docs.length === 0 ? (
        <p className="text-center text-gray-500 text-sm py-6">No documents found.</p>
      ) : (
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {docs.map((doc) => {
            const isActive = !inactiveDocs.includes(doc.document_id);
            return (
              <div
                key={doc.document_id}
                className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                  isActive ? 'border-gray-700 bg-gray-800/50' : 'border-gray-800 bg-gray-900/50 opacity-60'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  {typeIcon(doc.type)}
                  <div className="min-w-0">
                    <p className="text-sm text-white truncate">{doc.source}</p>
                    <p className="text-xs text-gray-500">{doc.type} · {doc.chunk_count ?? '?'} chunks</p>
                  </div>
                </div>
                <Switch
                  checked={isActive}
                  onChange={() => toggleDoc(doc.document_id)}
                  className={`ml-3 shrink-0 ${isActive ? 'bg-indigo-600' : 'bg-gray-600'}`}
                />
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
};

export default DocManagerModal;
