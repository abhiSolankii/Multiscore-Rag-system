import { Tabs } from "antd";
import {
  AlertTriangle,
  FileText,
  GitBranch,
  Globe,
  Link2,
  Loader2,
  RefreshCw,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import {
  deleteDocument,
  ingestFile,
  ingestGithub,
  ingestUrl,
  listDocuments,
  pollStatus,
} from "../api/ingestion";
import { handleError } from "../utils/errorHandler";

// ── Status badge ──────────────────────────────────────────────────────────────
const StatusBadge = ({ status }) => {
  const map = {
    pending: "bg-yellow-900/40 text-yellow-400 border-yellow-800/60",
    running: "bg-blue-900/40 text-blue-400 border-blue-800/60",
    done: "bg-green-900/40 text-green-400 border-green-800/60",
    failed: "bg-red-900/40 text-red-400 border-red-800/60",
  };
  return (
    <span className={`px-2 py-0.5 text-xs rounded-full border capitalize ${map[status] || map.pending}`}>
      {status}
    </span>
  );
};

// ── Doc row ───────────────────────────────────────────────────────────────────
const DocRow = ({ doc, onDelete }) => {
  const icon =
    doc.type === "web" ? (
      <Globe size={14} className="text-blue-400 shrink-0" />
    ) : doc.type === "github" ? (
      <GitBranch size={14} className="text-gray-300 shrink-0" />
    ) : (
      <FileText size={14} className="text-orange-400 shrink-0" />
    );

  return (
    <div className="flex items-center gap-3 bg-gray-900 border border-gray-800 rounded-lg px-4 py-3 group">
      {icon}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white truncate">{doc.source}</p>
        <p className="text-xs text-gray-500">
          {doc.type} · {doc.chunks_ingested ?? "?"} chunks
        </p>
      </div>
      <StatusBadge status={doc.status === "done" ? "done" : doc.status} />
      <button
        onClick={() => onDelete(doc.document_id, doc.source)}
        className="shrink-0 text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all ml-2"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
};

// ── Main page ─────────────────────────────────────────────────────────────────
const IngestPage = () => {
  const [docs, setDocs] = useState([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [repoInput, setRepoInput] = useState("");
  const [isPublic, setIsPublic] = useState(false);

  // Jobs submitted this session — { task_id, source }
  // Not persisted across reload intentionally (reload picks up via doc.status)
  const [pendingJobs, setPendingJobs] = useState([]);

  // ── Fetch documents ─────────────────────────────────────────────────────────
  const fetchDocs = useCallback(async () => {
    setLoadingDocs(true);
    try {
      const data = await listDocuments();
      setDocs(data);
    } catch (err) {
      handleError(err);
    } finally {
      setLoadingDocs(false);
    }
  }, []);

  useEffect(() => {
    fetchDocs();
  }, [fetchDocs]);

  // ── Polling — one interval per session, depends on pendingJobs ──────────────
  // Using [pendingJobs] as dep: when a job completes, setPendingJobs triggers
  // a re-render, cleanup clears the old interval, effect restarts with fresh list.
  // Simple, correct, no stale closure issues.
  useEffect(() => {
    if (pendingJobs.length === 0) return;

    const id = setInterval(async () => {
      const results = await Promise.all(
        pendingJobs.map(async (job) => {
          try {
            const res = await pollStatus(job.task_id);
            return { ...job, apiStatus: res.status };
          } catch {
            return { ...job, apiStatus: "pending" };
          }
        })
      );

      const done = results.filter(
        (j) => j.apiStatus === "done" || j.apiStatus === "failed"
      );
      const still = results.filter(
        (j) => j.apiStatus !== "done" && j.apiStatus !== "failed"
      );

      if (done.length > 0) {
        done.forEach((j) => {
          if (j.apiStatus === "completed")
            toast.success(`"${j.source}" ingested successfully.`);
          else toast.error(`"${j.source}" ingestion failed.`);
        });
        setPendingJobs(still); // triggers re-render → effect cleanup + restart
        fetchDocs();
      }
    }, 5000);

    return () => clearInterval(id);
  }, [pendingJobs, fetchDocs]);

  // ── Submit helpers ──────────────────────────────────────────────────────────
  const addJob = (task_id, source) => {
    setPendingJobs((prev) => [...prev, { task_id, source }]);
    toast.success("Ingestion started!");
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setSubmitting(true);
    try {
      const res = await ingestFile(file, isPublic);
      addJob(res.task_id, file.name);
    } catch (err) {
      handleError(err);
    } finally {
      setSubmitting(false);
      e.target.value = null;
    }
  };

  const handleUrlSubmit = async () => {
    if (!urlInput.trim()) return;
    setSubmitting(true);
    try {
      const res = await ingestUrl(urlInput.trim(), isPublic);
      addJob(res.task_id, urlInput.trim());
      setUrlInput("");
    } catch (err) {
      handleError(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleGithubSubmit = async () => {
    if (!repoInput.trim()) return;
    setSubmitting(true);
    try {
      const res = await ingestGithub(repoInput.trim(), isPublic);
      addJob(res.task_id, repoInput.trim());
      setRepoInput("");
    } catch (err) {
      handleError(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (docId, source) => {
    try {
      await deleteDocument(docId);
      setDocs((prev) => prev.filter((d) => d.document_id !== docId));
      toast.success(`"${source}" deleted.`);
    } catch (err) {
      handleError(err);
    }
  };

  // ── Derived state ───────────────────────────────────────────────────────────
  const publicDocs = docs.filter((d) => d.is_public);
  const privateDocs = docs.filter((d) => !d.is_public);
  const hasStaleDocsPending = docs.some((d) => d.status !== "done");

  // ── Shared public toggle ────────────────────────────────────────────────────
  const publicSwitch = (
    <label className="flex items-center gap-2 text-xs text-gray-400 mt-4 cursor-pointer">
      <input
        type="checkbox"
        checked={isPublic}
        onChange={(e) => setIsPublic(e.target.checked)}
        className="accent-indigo-500 w-4 h-4"
      />
      Make publicly available
    </label>
  );

  const tabItems = [
    {
      key: "file",
      label: (
        <span className="flex items-center gap-1.5">
          <UploadCloud size={14} /> PDF
        </span>
      ),
      children: (
        <div className="space-y-4">
          <p className="text-xs text-gray-400">
            Upload a PDF file to ingest into the knowledge base.
          </p>
          <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-700 rounded-xl cursor-pointer hover:border-indigo-500/60 transition-colors bg-gray-900/40">
            <UploadCloud size={24} className="text-gray-600 mb-2" />
            <span className="text-xs text-gray-500">Click to upload PDF</span>
            <input
              type="file"
              accept=".pdf"
              className="hidden"
              onChange={handleFileUpload}
              disabled={submitting}
            />
          </label>
          {publicSwitch}
        </div>
      ),
    },
    {
      key: "url",
      label: (
        <span className="flex items-center gap-1.5">
          <Link2 size={14} /> URL
        </span>
      ),
      children: (
        <div className="space-y-4">
          <p className="text-xs text-gray-400">
            Ingest content from a web page URL.
          </p>
          <div className="flex gap-2">
            <input
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://example.com/article"
              className="flex-1 px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              onClick={handleUrlSubmit}
              disabled={submitting || !urlInput.trim()}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-sm rounded-lg transition-colors flex items-center gap-1.5"
            >
              {submitting ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Globe size={14} />
              )}
              Ingest
            </button>
          </div>
          {publicSwitch}
        </div>
      ),
    },
    {
      key: "github",
      label: (
        <span className="flex items-center gap-1.5">
          <GitBranch size={14} /> GitHub
        </span>
      ),
      children: (
        <div className="space-y-4">
          <p className="text-xs text-gray-400">
            Ingest code from a GitHub repository.
          </p>
          <div className="flex gap-2">
            <input
              value={repoInput}
              onChange={(e) => setRepoInput(e.target.value)}
              placeholder="https://github.com/user/repo"
              className="flex-1 px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              onClick={handleGithubSubmit}
              disabled={submitting || !repoInput.trim()}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-sm rounded-lg transition-colors flex items-center gap-1.5"
            >
              {submitting ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <GitBranch size={14} />
              )}
              Ingest
            </button>
          </div>
          {publicSwitch}
        </div>
      ),
    },
  ];

  // ── Doc section renderer ────────────────────────────────────────────────────
  const DocSection = ({ title, list }) => (
    <div>
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
        {title} ({list.length})
      </p>
      {list.length === 0 ? (
        <p className="text-xs text-gray-700 italic pl-1">None</p>
      ) : (
        <div className="space-y-2">
          {list.map((doc) => (
            <DocRow key={doc.document_id} doc={doc} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  );

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="border-b border-gray-800 px-6 py-4 shrink-0">
        <h1 className="text-lg font-bold text-white">Ingest Data</h1>
        <p className="text-xs text-gray-500 mt-0.5">
          Add documents to the knowledge base
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Ingest form */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <Tabs items={tabItems} />
        </div>

        {/* Active jobs this session */}
        {pendingJobs.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-gray-400">Active Jobs</p>
            {pendingJobs.map((job) => (
              <div
                key={job.task_id}
                className="flex items-center justify-between bg-gray-900 border border-gray-800 rounded-lg px-4 py-2.5"
              >
                <p className="text-sm text-white truncate">{job.source}</p>
                <div className="flex items-center gap-2 ml-3 shrink-0">
                  <Loader2 size={13} className="animate-spin text-indigo-400" />
                  <StatusBadge status="pending" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Documents */}
        <div className="space-y-5">
          {/* Header with stale-pending warning */}
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-medium text-gray-400">
              Documents ({docs.length})
            </h3>
            <div className="flex items-center gap-2">
              {hasStaleDocsPending && (
                <span className="flex items-center gap-1 text-xs text-yellow-500">
                  <AlertTriangle size={12} />
                  Pending docs — refresh to update
                </span>
              )}
              <button
                onClick={fetchDocs}
                disabled={loadingDocs}
                className="text-gray-500 hover:text-white transition-colors disabled:opacity-40"
              >
                <RefreshCw size={13} className={loadingDocs ? "animate-spin" : ""} />
              </button>
            </div>
          </div>

          {loadingDocs ? (
            <div className="flex justify-center py-8">
              <Loader2 size={20} className="animate-spin text-indigo-400" />
            </div>
          ) : docs.length === 0 ? (
            <div className="text-center py-8 text-gray-600 text-sm">
              <FileText size={28} className="mx-auto mb-2 text-gray-700" />
              No documents yet.
            </div>
          ) : (
            <div className="space-y-5">
              <DocSection title="Private" list={privateDocs} />
              <DocSection title="Public" list={publicDocs} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default IngestPage;
