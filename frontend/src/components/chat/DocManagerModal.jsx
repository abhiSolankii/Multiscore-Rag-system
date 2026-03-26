import { Modal, Switch } from "antd";
import { FileText, GitBranch, Globe, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useDispatch } from "react-redux";
import { updateChat } from "../../api/chat";
import { listDocuments, listPublicDocuments } from "../../api/ingestion";
import { setActiveChat, updateChatInList } from "../../store/chatSlice";
import { handleError } from "../../utils/errorHandler";

const typeIcon = (type) =>
  type === "web" ? (
    <Globe size={14} className="text-blue-400 shrink-0" />
  ) : type === "github" ? (
    <GitBranch size={14} className="text-gray-300 shrink-0" />
  ) : (
    <FileText size={14} className="text-orange-400 shrink-0" />
  );

const DocManagerModal = ({ open, onClose, chat }) => {
  const dispatch = useDispatch();
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [inactiveDocs, setInactiveDocs] = useState([]);

  const includePublic = chat?.config?.include_public ?? false;

  useEffect(() => {
    if (!open || !chat) return;
    setInactiveDocs(chat.config?.inactive_docs || []);

    const fetchDocs = async () => {
      setLoading(true);
      try {
        // listDocuments() returns all user's docs (private + user's own public ones)
        const myDocs = await listDocuments();

        let merged;
        if (includePublic) {
          // Also pull public docs from other users, then deduplicate
          const publicDocs = await listPublicDocuments();
          merged = Object.values(
            [...myDocs, ...publicDocs].reduce((acc, doc) => {
              acc[doc.document_id] = doc;
              return acc;
            }, {}),
          );
        } else {
          // Private chat — only show user's private docs (filter out their own public ones)
          merged = myDocs.filter((doc) => !doc.is_public);
        }

        setDocs(merged);
      } catch (err) {
        handleError(err);
      } finally {
        setLoading(false);
      }
    };
    fetchDocs();
  }, [open, chat]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleDoc = (docId) => {
    setInactiveDocs((prev) =>
      prev.includes(docId)
        ? prev.filter((id) => id !== docId)
        : [...prev, docId],
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await updateChat(chat._id, {
        config: { ...chat.config, inactive_docs: inactiveDocs },
      });
      dispatch(updateChatInList(updated));
      dispatch(setActiveChat(updated));
      toast.success("Source settings saved.");
      onClose();
    } catch (err) {
      handleError(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      onOk={handleSave}
      okText="Save"
      confirmLoading={saving}
      title={<span className="text-white">Manage Sources</span>}
      okButtonProps={{
        className: "bg-indigo-600 border-indigo-600 hover:bg-indigo-500",
      }}
    >
      <p className="text-xs text-gray-400 mb-4">
        Toggle documents on/off for this chat.{" "}
        {includePublic
          ? "Showing your private docs + all public docs."
          : "Showing your private docs only."}
      </p>
      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 size={24} className="animate-spin text-indigo-400" />
        </div>
      ) : docs.length === 0 ? (
        <p className="text-center text-gray-500 text-sm py-6">
          No documents found.
        </p>
      ) : (
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {docs.map((doc) => {
            const isActive = !inactiveDocs.includes(doc.document_id);
            return (
              <div
                key={doc.document_id}
                className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                  isActive
                    ? "border-gray-700 bg-gray-800/50"
                    : "border-gray-800 bg-gray-900/50 opacity-60"
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  {typeIcon(doc.type)}
                  <div className="min-w-0">
                    <p className="text-sm text-white truncate">{doc.source}</p>
                    <p className="text-xs text-gray-500">
                      {doc.type} · {doc.chunks_ingested ?? "?"} chunks
                      {doc.is_public && (
                        <span className="ml-1 text-green-500">· Public</span>
                      )}
                    </p>
                  </div>
                </div>
                <Switch
                  checked={isActive}
                  onChange={() => toggleDoc(doc.document_id)}
                  className={`ml-3 shrink-0 ${isActive ? "bg-indigo-600" : "bg-gray-600"}`}
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
