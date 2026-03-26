import { useEffect, useState } from 'react';
import { Modal, Switch } from 'antd';
import {
  Users, FileText, Globe, GitBranch, Trash2,
  ChevronDown, ChevronUp, Loader2, Save, Shield,
} from 'lucide-react';
import {
  listUsers, updateAdminUser,
  listAllDocuments, deleteAnyDocument,
} from '../api/admin';
import { handleError } from '../utils/errorHandler';
import toast from 'react-hot-toast';

// ── Edit User Modal ────────────────────────────────────────────────────────────
const EditUserModal = ({ user, open, onClose, onSaved }) => {
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setForm({
        tokens_remaining: user.tokens_remaining ?? 0,
        total_tokens_used: user.total_tokens_used ?? 0,
        is_active: user.is_active ?? true,
        is_admin: user.is_admin ?? false,
        config: user.config ?? {},
      });
    }
  }, [user]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await updateAdminUser(user.id, {
        tokens_remaining: Number(form.tokens_remaining),
        total_tokens_used: Number(form.total_tokens_used),
        is_active: form.is_active,
        is_admin: form.is_admin,
        config: form.config,
      });
      onSaved(updated);
      toast.success('User updated.');
      onClose();
    } catch (err) {
      handleError(err);
    } finally {
      setSaving(false);
    }
  };

  if (!user) return null;

  return (
    <Modal
      open={open}
      onCancel={onClose}
      onOk={handleSave}
      okText="Save"
      confirmLoading={saving}
      title={<span className="text-white">Edit User — {user.email}</span>}
      okButtonProps={{ className: 'bg-indigo-600 border-indigo-600' }}
    >
      <div className="space-y-4 py-2">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Tokens Remaining</label>
            <input
              type="number"
              value={form.tokens_remaining}
              onChange={(e) => setForm({ ...form, tokens_remaining: e.target.value })}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Tokens Used</label>
            <input
              type="number"
              value={form.total_tokens_used}
              onChange={(e) => setForm({ ...form, total_tokens_used: e.target.value })}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div className="flex items-center justify-between py-2 border-t border-gray-800">
          <span className="text-sm text-gray-300">Active</span>
          <Switch
            checked={form.is_active}
            onChange={(v) => setForm({ ...form, is_active: v })}
            className={form.is_active ? 'bg-indigo-600' : 'bg-gray-600'}
          />
        </div>
        <div className="flex items-center justify-between py-2 border-t border-gray-800">
          <span className="text-sm text-gray-300">Admin</span>
          <Switch
            checked={form.is_admin}
            onChange={(v) => setForm({ ...form, is_admin: v })}
            className={form.is_admin ? 'bg-orange-500' : 'bg-gray-600'}
          />
        </div>

        {/* Config fields */}
        <div className="border-t border-gray-800 pt-3">
          <p className="text-xs text-gray-500 mb-2">Config</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Chat Char Limit</label>
              <input
                type="number"
                value={form.config?.chat_char_limit ?? 1500}
                onChange={(e) => setForm({ ...form, config: { ...form.config, chat_char_limit: Number(e.target.value) } })}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Max Token Limit</label>
              <input
                type="number"
                value={form.config?.max_token_limit ?? ''}
                onChange={(e) => setForm({ ...form, config: { ...form.config, max_token_limit: e.target.value ? Number(e.target.value) : null } })}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Default"
              />
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};

// ── Main AdminPage ─────────────────────────────────────────────────────────────
const AdminPage = () => {
  const [users, setUsers] = useState([]);
  const [docs, setDocs] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [docsExpanded, setDocsExpanded] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      setLoadingUsers(true);
      setLoadingDocs(true);
      try {
        const [u, d] = await Promise.all([listUsers(), listAllDocuments()]);
        setUsers(u);
        setDocs(d);
      } catch (err) {
        handleError(err);
      } finally {
        setLoadingUsers(false);
        setLoadingDocs(false);
      }
    };
    fetch();
  }, []);

  const handleDeleteDoc = async (docId, source) => {
    try {
      await deleteAnyDocument(docId);
      setDocs((prev) => prev.filter((d) => d.document_id !== docId));
      toast.success(`Deleted: ${source}`);
    } catch (err) {
      handleError(err);
    }
  };

  const handleUserSaved = (updated) => {
    setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
  };

  const docIcon = (type) =>
    type === 'web' ? (
      <Globe size={13} className="text-blue-400 shrink-0" />
    ) : type === 'github' ? (
      <GitBranch size={13} className="text-gray-300 shrink-0" />
    ) : (
      <FileText size={13} className="text-orange-400 shrink-0" />
    );

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="border-b border-gray-800 px-6 py-4 shrink-0">
        <div className="flex items-center gap-2">
          <Shield size={18} className="text-orange-400" />
          <h1 className="text-lg font-bold text-white">Admin Dashboard</h1>
        </div>
        <p className="text-xs text-gray-500 mt-0.5">
          {users.length} users · {docs.length} total documents
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-8">

        {/* ── Users ─────────────────────────────────────────────────────── */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Users size={15} className="text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-300">Users ({users.length})</h2>
          </div>
          {loadingUsers ? (
            <div className="flex justify-center py-6">
              <Loader2 size={20} className="animate-spin text-indigo-400" />
            </div>
          ) : (
            <div className="space-y-2">
              {users.map((u) => (
                <div
                  key={u.id}
                  className="flex items-center gap-3 bg-gray-900 border border-gray-800 rounded-xl px-4 py-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm text-white font-medium truncate">{u.email}</p>
                      {u.is_admin && (
                        <span className="text-xs px-1.5 py-0.5 bg-orange-900/40 border border-orange-700/50 text-orange-400 rounded-full">
                          Admin
                        </span>
                      )}
                      {!u.is_active && (
                        <span className="text-xs px-1.5 py-0.5 bg-red-900/40 border border-red-700/50 text-red-400 rounded-full">
                          Inactive
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Tokens remaining:{' '}
                      <span className="text-indigo-400 font-mono">{u.tokens_remaining?.toLocaleString()}</span>
                      {' · '}Used:{' '}
                      <span className="font-mono">{u.total_tokens_used?.toLocaleString()}</span>
                    </p>
                  </div>
                  <button
                    onClick={() => setEditUser(u)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-400 border border-gray-700 hover:border-indigo-500/50 hover:text-indigo-400 rounded-lg transition-colors"
                  >
                    <Save size={12} /> Edit
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── All Documents ─────────────────────────────────────────────── */}
        <div>
          <button
            className="flex items-center gap-2 mb-3 w-full text-left"
            onClick={() => setDocsExpanded((v) => !v)}
          >
            <FileText size={15} className="text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-300">
              All Documents ({docs.length})
            </h2>
            {docsExpanded ? (
              <ChevronUp size={14} className="text-gray-500 ml-auto" />
            ) : (
              <ChevronDown size={14} className="text-gray-500 ml-auto" />
            )}
          </button>

          {docsExpanded && (
            loadingDocs ? (
              <div className="flex justify-center py-6">
                <Loader2 size={20} className="animate-spin text-indigo-400" />
              </div>
            ) : docs.length === 0 ? (
              <p className="text-gray-600 text-sm text-center py-4">No documents.</p>
            ) : (
              <div className="space-y-2">
                {docs.map((doc) => (
                  <div
                    key={doc.document_id}
                    className="flex items-center gap-2 bg-gray-900 border border-gray-800 rounded-lg px-4 py-2.5 group"
                  >
                    {docIcon(doc.type)}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">{doc.source}</p>
                      <p className="text-xs text-gray-500">
                        {doc.type} · {doc.chunks_ingested ?? '?'} chunks ·{' '}
                        {doc.is_public ? (
                          <span className="text-green-500">Public</span>
                        ) : (
                          <span>Private</span>
                        )}
                        {' · '}
                        <span className={doc.status === 'done' ? 'text-green-500' : 'text-yellow-400'}>
                          {doc.status}
                        </span>
                      </p>
                    </div>
                    <button
                      onClick={() => handleDeleteDoc(doc.document_id, doc.source)}
                      className="shrink-0 text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      </div>

      <EditUserModal
        open={!!editUser}
        user={editUser}
        onClose={() => setEditUser(null)}
        onSaved={handleUserSaved}
      />
    </div>
  );
};

export default AdminPage;
