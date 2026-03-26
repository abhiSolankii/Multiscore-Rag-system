import { Switch, Tooltip } from "antd";
import { Info, Loader2, Save } from "lucide-react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useDispatch, useSelector } from "react-redux";
import { updateMe } from "../api/auth";
import { selectUser, setUser } from "../store/authSlice";
import { handleError } from "../utils/errorHandler";

const Field = ({ label, hint, children }) => (
  <div className="flex items-center justify-between py-4 border-b border-gray-800 last:border-0">
    <div className="flex items-center gap-1.5">
      <span className="text-sm text-gray-300">{label}</span>
      {hint && (
        <Tooltip title={hint}>
          <Info size={13} className="text-gray-600 cursor-help" />
        </Tooltip>
      )}
    </div>
    {children}
  </div>
);

const SettingsPage = () => {
  const dispatch = useDispatch();
  const user = useSelector(selectUser);
  const [form, setForm] = useState({
    streaming: false,
    max_token_limit: "",
    chat_char_limit: 1500,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user?.config) {
      setForm({
        streaming: !!user.config.enable_streaming,
        max_token_limit: user.config.max_token_limit ?? "",
        chat_char_limit: user.config.chat_char_limit ?? 1500,
      });
    }
  }, [user]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await updateMe({
        ...user?.config,
        streaming: form.streaming,
        max_token_limit: form.max_token_limit
          ? Number(form.max_token_limit)
          : null,
        chat_char_limit: Number(form.chat_char_limit),
      });
      dispatch(setUser(updated.user ?? updated));
      toast.success("Settings saved.");
    } catch (err) {
      handleError(err);
    } finally {
      setSaving(false);
    }
  };

  if (!user) {
    return (
      <div className="flex justify-center items-center h-60">
        <Loader2 size={24} className="animate-spin text-indigo-400" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="border-b border-gray-800 px-6 py-4">
        <h1 className="text-lg font-bold text-white">Settings</h1>
        <p className="text-xs text-gray-500 mt-0.5">{user.email}</p>
      </div>

      <div className="max-w-xl mx-auto px-6 py-8 space-y-8">
        {/* Account info */}
        <div>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Account
          </h2>
          <div className="bg-gray-900 border border-gray-800 rounded-xl px-5 divide-y divide-gray-800">
            <div className="py-4 flex justify-between">
              <span className="text-sm text-gray-400">Email</span>
              <span className="text-sm text-white">{user.email}</span>
            </div>
            <div className="py-4 flex justify-between">
              <span className="text-sm text-gray-400">Tokens remaining</span>
              <span className="text-sm text-indigo-400 font-mono">
                {user.tokens_remaining?.toLocaleString() ?? "—"}
              </span>
            </div>
            <div className="py-4 flex justify-between">
              <span className="text-sm text-gray-400">Total tokens used</span>
              <span className="text-sm text-gray-300 font-mono">
                {user.total_tokens_used?.toLocaleString() ?? "0"}
              </span>
            </div>
          </div>
        </div>

        {/* Preferences */}
        <div>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Preferences
          </h2>
          <div className="bg-gray-900 border border-gray-800 rounded-xl px-5">
            <Field
              label="Enable Streaming"
              hint="Stream AI responses token by token in real time. Matches VITE_ENABLE_STREAMING env."
            >
              <Switch
                checked={form.streaming}
                onChange={(val) => setForm({ ...form, streaming: val })}
                className={form.streaming ? "bg-indigo-600" : "bg-gray-600"}
              />
            </Field>
            <Field
              label="Max Token Limit"
              hint="Cap the number of tokens the AI can generate per response. Leave blank for default."
            >
              <input
                type="number"
                min="100"
                max="32000"
                value={form.max_token_limit}
                onChange={(e) =>
                  setForm({ ...form, max_token_limit: e.target.value })
                }
                placeholder="Default"
                className="w-28 px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm text-right focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </Field>
            <Field
              label="Chat Character Limit"
              hint="Maximum number of characters per message you can send."
            >
              <input
                type="number"
                min="100"
                max="10000"
                value={form.chat_char_limit}
                onChange={(e) =>
                  setForm({ ...form, chat_char_limit: e.target.value })
                }
                className="w-28 px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm text-right focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </Field>
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
        >
          {saving ? (
            <Loader2 size={15} className="animate-spin" />
          ) : (
            <Save size={15} />
          )}
          {saving ? "Saving..." : "Save Settings"}
        </button>
      </div>
    </div>
  );
};

export default SettingsPage;
