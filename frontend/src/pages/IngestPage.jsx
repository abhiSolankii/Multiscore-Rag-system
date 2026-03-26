import { Tabs } from "antd";
import {
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

const StatusBadge = ({ status }) => {
  const map = {
    pending: "bg-yellow-900/40 text-yellow-400 border-yellow-800/60",
    running: "bg-blue-900/40 text-blue-400 border-blue-800/60",
    completed: "bg-green-900/40 text-green-400 border-green-800/60",
    failed: "bg-red-900/40 text-red-400 border-red-800/60",
  };
  return (
    <span
      className={`px-2 py-0.5 text-xs rounded-full border capitalize ${map[status] || map.pending}`}
    >
      {status}
    </span>
  );
};

const IngestPage = () => {
  const [docs, setDocs] = useState([]);
  const [jobs, setJobs] = useState([]); // active polling jobs
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [repoInput, setRepoInput] = useState("");
  const [isPublic, setIsPublic] = useState(false);

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

  // Keep a ref so the interval always sees the latest jobs without re-creating itself
  const activeJobsRef = { current: jobs };
  activeJobsRef.current = jobs;

  useEffect(() => {
    if (jobs.length === 0) return;

    const interval = setInterval(async () => {
      const current = activeJobsRef.current;
      if (current.length === 0) {
        clearInterval(interval);
        return;
      }

      const updated = await Promise.all(
        current.map(async (job) => {
          try {
            const res = await pollStatus(job.task_id);
            return { ...job, status: res.status };
          } catch {
            return job;
          }
        }),
      );

      const done = updated.filter(
        (j) => j.status === 'completed' || j.status === 'failed',
      );
      const stillRunning = updated.filter(
        (j) => j.status !== 'completed' && j.status !== 'failed',
      );

      setJobs(stillRunning);

      if (done.length > 0) {
        done.forEach((j) => {
          if (j.status === 'completed')
            toast.success(`"${j.source}" ingested successfully.`);
          else toast.error(`"${j.source}" ingestion failed.`);
        });
        fetchDocs();
      }

      if (stillRunning.length === 0) {
        clearInterval(interval);
      }
    }, 3000);

    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobs.length === 0 ? 0 : 1, fetchDocs]); // only re-run when jobs goes from empty→non-empty

  const submitJob = (task_id, source) => {
    setJobs((prev) => [...prev, { task_id, source, status: "pending" }]);
    toast.success("Ingestion started!");
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setSubmitting(true);
    try {
      const res = await ingestFile(file, isPublic);
      submitJob(res.task_id, file.name);
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
      submitJob(res.task_id, urlInput.trim());
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
      submitJob(res.task_id, repoInput.trim());
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

  const publicSwitch = (
    <label className="flex items-center gap-2 text-xs text-gray-400 mt-4">
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

        {/* Active jobs */}
        {jobs.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-xs font-medium text-gray-400">Active Jobs</h3>
            {jobs.map((job) => (
              <div
                key={job.task_id}
                className="flex items-center justify-between bg-gray-900 border border-gray-800 rounded-lg px-4 py-2.5"
              >
                <p className="text-sm text-white truncate">{job.source}</p>
                <div className="flex items-center gap-2 ml-3 shrink-0">
                  <Loader2 size={13} className="animate-spin text-indigo-400" />
                  <StatusBadge status={job.status} />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Documents */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-medium text-gray-400">
              Documents ({docs.length})
            </h3>
            <button
              onClick={fetchDocs}
              className="text-gray-500 hover:text-white transition-colors"
            >
              <RefreshCw size={13} />
            </button>
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
            <div className="space-y-2">
              {docs.map((doc) => (
                <div
                  key={doc.document_id}
                  className="flex items-center gap-3 bg-gray-900 border border-gray-800 rounded-lg px-4 py-3 group"
                >
                  {doc.type === "web" ? (
                    <Globe size={14} className="text-blue-400 shrink-0" />
                  ) : doc.type === "github" ? (
                    <GitBranch size={14} className="text-gray-300 shrink-0" />
                  ) : (
                    <FileText size={14} className="text-orange-400 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">{doc.source}</p>
                    <p className="text-xs text-gray-500">
                      {doc.type} · {doc.chunk_count ?? "?"} chunks{" "}
                      {doc.is_public ? "· Public" : "· Private"}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDelete(doc.document_id, doc.source)}
                    className="shrink-0 text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default IngestPage;
