import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../context/AuthContext';
import { 
  CloudUpload, CheckCircle, AlertTriangle, Loader, 
  Database, Zap, Plane, Clock, FileText, XCircle 
} from 'lucide-react';

const SOURCES = [
  {
    key: 'sap',
    label: 'SAP / IDoc',
    description: 'Upload SAP flat-file CSV exports (WERKS, MATNR, MENGE, MEINS, BUDAT, KOSTL). Scope 1 fuel emissions.',
    accept: '.csv',
    Icon: Database,
    theme: {
      gradient: 'from-[#2563EB] to-[#1D4ED8]',
      button: 'bg-gradient-to-r from-[#2563EB] to-[#0EA5E9] hover:from-[#1D4ED8] hover:to-[#0284C7]',
      accentText: 'text-[#2563EB]',
      pillBg: 'bg-[#EFF6FF]',
      borderHover: 'hover:border-[#2563EB]/40',
      ring: 'ring-[#2563EB]/30',
      shadow: 'shadow-[0_4px_12px_rgba(37,99,235,0.2)]',
    },
    endpoint: '/ingest/sap/',
    sourceType: 'SAP',
  },
  {
    key: 'utility',
    label: 'Utility Bills',
    description: 'Upload utility portal CSV exports with meter readings and kWh/MWh consumption. Scope 2 electricity.',
    accept: '.csv',
    Icon: Zap,
    theme: {
      gradient: 'from-[#0EA5E9] to-[#0284C7]',
      button: 'bg-gradient-to-r from-[#0EA5E9] to-[#2563EB] hover:from-[#0284C7] hover:to-[#1D4ED8]',
      accentText: 'text-[#0EA5E9]',
      pillBg: 'bg-[#F0F9FF]',
      borderHover: 'hover:border-[#0EA5E9]/40',
      ring: 'ring-[#0EA5E9]/30',
      shadow: 'shadow-[0_4px_12px_rgba(14,165,233,0.2)]',
    },
    endpoint: '/ingest/utility/',
    sourceType: 'UTILITY',
  },
  {
    key: 'travel',
    label: 'Business Travel',
    description: 'Upload Concur-style trip JSON records with air, hotel and car segments. Scope 3 travel.',
    accept: '.json',
    Icon: Plane,
    theme: {
      gradient: 'from-[#10B981] to-[#059669]',
      button: 'bg-gradient-to-r from-[#10B981] to-[#0EA5E9] hover:from-[#059669] hover:to-[#0284C7]',
      accentText: 'text-[#10B981]',
      pillBg: 'bg-[#F0FDF4]',
      borderHover: 'hover:border-[#10B981]/40',
      ring: 'ring-[#10B981]/30',
      shadow: 'shadow-[0_4px_12px_rgba(16,185,129,0.2)]',
    },
    endpoint: '/ingest/travel/',
    sourceType: 'TRAVEL',
  },
];

function StatusBadge({ status }) {
  const styles = {
    DONE:    'bg-[#E6F4EA] text-[#137333] border border-[#A3E2B9]',
    RUNNING: 'bg-[#FEF7E0] text-[#B06000] border border-[#FAD283]',
    FAILED:  'bg-[#FCE8E6] text-[#C5221F] border border-[#FAD2CF]',
    PENDING: 'bg-[#F1F3F4] text-[#5F6368] border border-[#DADCE0]',
  };
  const icons = { DONE: '✓', RUNNING: '⟳', FAILED: '✗', PENDING: '…' };
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${styles[status] || styles.PENDING}`}>
      {icons[status] || ''} {status}
    </span>
  );
}

function fmtTimestamp(iso) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: false,
    }).replace(',', '');
  } catch {
    return iso;
  }
}

function UploadCard({ source }) {
  const { key, label, description, accept, Icon, theme, endpoint, sourceType } = source;
  const inputRef = useRef(null);
  const isUploading = useRef(false);
  const navigate = useNavigate();

  const [file, setFile]         = useState(null);
  const [dragging, setDragging] = useState(false);
  const [uploadState, setUploadState] = useState(null); // null | 'uploading' | 'done' | 'error'

  const [summary, setSummary] = useState(null); 
  const [loadingJob, setLoadingJob] = useState(true);

  useEffect(() => {
    let cancelled = false;
    api.get(`/jobs/?source_type=${sourceType}&limit=1`)
      .then((res) => {
        if (cancelled) return;
        const jobs = Array.isArray(res.data) ? res.data : res.data?.results ?? [];
        if (jobs.length > 0) setSummary(jobs[0]);
      })
      .catch((err) => {
        if (err.response?.status === 401) {
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          navigate('/login');
        }
      })
      .finally(() => { if (!cancelled) setLoadingJob(false); });
    return () => { cancelled = true; };
  }, [sourceType, navigate]);

  const handleFile = (f) => {
    if (!f) return;
    setFile(f);
    setUploadState(null);
  };

  const onDragOver  = useCallback((e) => { e.preventDefault(); setDragging(true); }, []);
  const onDragLeave = useCallback(() => setDragging(false), []);
  const onDrop      = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    handleFile(e.dataTransfer.files[0]);
  }, []);

  const handleUpload = async () => {
    if (!file || isUploading.current) return;
    isUploading.current = true;
    setUploadState('uploading');

    const token = localStorage.getItem('access_token');
    if (!token) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      navigate('/login');
      return;
    }

    const form = new FormData();
    form.append('file', file);
    try {
      const response = await fetch('/api' + endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: form
      });

      if (response.status === 401) {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        navigate('/login');
        return;
      }

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Upload failed');
      }

      setSummary({
        status:        data.status,
        total_parsed:  data.total_parsed,
        total_flagged: data.total_flagged,
        total_failed:  data.total_failed,
        finished_at:   new Date().toISOString(),
      });
      setUploadState('done');
    } catch (err) {
      setSummary({ status: 'FAILED', error: err.message });
      setUploadState('error');
    } finally {
      isUploading.current = false;
    }
  };

  const isDone    = summary?.status === 'DONE';
  const isFailed  = summary?.status === 'FAILED';
  const cardBorder = isDone   ? 'border-[#10B981]/30 bg-white'
                   : isFailed ? 'border-[#EF4444]/30 bg-white'
                   : 'border-[#E2E8F4] bg-white';

  return (
    <div className={`flex flex-col rounded-[16px] shadow-card card-3d card-shine border ${cardBorder} ${theme.borderHover} p-6 transition-all duration-300`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-xl bg-gradient-to-br ${theme.gradient} text-white shadow-sm`}>
            <Icon className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-[#0F172A] text-sm tracking-tight">{label}</h3>
            <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider ${theme.pillBg} ${theme.accentText} border border-current/25 mt-0.5`}>
              {accept.replace('.', '').toUpperCase()}
            </span>
          </div>
        </div>
        {summary?.status && <StatusBadge status={summary.status} />}
      </div>

      <p className="text-xs text-[#475569] mb-4 leading-relaxed font-normal">{description}</p>

      {/* Drop zone */}
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={`flex-grow flex flex-col items-center justify-center gap-2.5 rounded-[12px] border-2 border-dashed cursor-pointer transition-all duration-200 py-7 px-4 mb-4
          ${dragging 
            ? `border-[#2563EB] bg-[#EFF6FF] scale-[1.02] ${theme.ring} ring-2` 
            : 'border-[#CBD5E1] bg-[#F8FAFF] hover:border-[#2563EB] hover:bg-[#EFF6FF]/40'
          }
          ${file ? 'border-[#10B981]/40 bg-[#F0FDF4]/30' : ''}`}
      >
        {file ? (
          <div className="flex flex-col items-center text-center">
            <FileText className="w-9 h-9 text-[#10B981] mb-1" />
            <p className="text-xs font-semibold text-[#0F172A] truncate max-w-[200px]">{file.name}</p>
            <p className="text-[10px] text-[#475569] mt-0.5">{(file.size / 1024).toFixed(1)} KB</p>
          </div>
        ) : (
          <div className="flex flex-col items-center text-center">
            <CloudUpload className="w-8 h-8 text-[#94A3B8] mb-1 transition-colors" />
            <p className="text-xs text-[#475569] font-medium">Drop file here or click to browse</p>
            <p className="text-[10px] text-[#94A3B8] mt-0.5 uppercase tracking-wider font-semibold">Accepts {accept}</p>
          </div>
        )}
        <input
          ref={inputRef}
          id={`upload-input-${key}`}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => handleFile(e.target.files[0])}
        />
      </div>

      {/* Success Animation & Summary banner */}
      {!loadingJob && summary && !summary.error && summary.status === 'DONE' && (
        <div className="mb-4 px-3 py-2.5 rounded-[10px] bg-[#F0FDF4] border border-[#10B981]/25 text-xs text-[#065F46] space-y-1.5 animate-checkmark">
          <div className="flex items-center gap-2 font-semibold">
            <CheckCircle className="w-4 h-4 text-[#10B981] shrink-0" />
            <span>
              <b>{summary.total_parsed}</b> parsed &nbsp;·&nbsp;
              <b className={summary.total_flagged > 0 ? 'text-[#D97706]' : ''}>{summary.total_flagged}</b> flagged &nbsp;·&nbsp;
              <b className={summary.total_failed  > 0 ? 'text-[#EF4444]'  : ''}>{summary.total_failed}</b> failed
            </span>
          </div>
          {summary.finished_at && (
            <div className="flex items-center gap-1.5 text-[10px] text-[#94A3B8]">
              <Clock className="w-3.5 h-3.5" />
              <span>Last uploaded: {fmtTimestamp(summary.finished_at)}</span>
            </div>
          )}
        </div>
      )}

      {/* Failed State Animation & error banner */}
      {summary?.status === 'FAILED' && (
        <div className="mb-4 px-3 py-2.5 rounded-[10px] bg-[#FCE8E6] border border-[#EF4444]/25 text-xs text-[#C5221F] flex items-start gap-2 animate-shake">
          <XCircle className="w-4 h-4 text-[#EF4444] shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold">Upload failed</p>
            <p className="text-[10px] text-[#EF4444]/80 mt-0.5">{summary.error || 'Parsing error occurred'}</p>
          </div>
        </div>
      )}

      {/* Upload button */}
      <button
        id={`upload-btn-${key}`}
        onClick={handleUpload}
        disabled={!file || uploadState === 'uploading'}
        className={`w-full py-2.5 rounded-[10px] text-sm font-semibold transition-all duration-200 flex items-center justify-center gap-2
          ${!file || uploadState === 'uploading'
            ? 'bg-[#E2E8F4] text-[#94A3B8] cursor-not-allowed border border-transparent'
            : `${theme.button} text-white shadow-sm hover:-translate-y-0.5 active:translate-y-0`}`}
      >
        {uploadState === 'uploading' ? (
          <><Loader className="w-4 h-4 animate-spin" /> Uploading…</>
        ) : (
          <><CloudUpload className="w-4 h-4" /> Upload {label}</>
        )}
      </button>

      {/* Timestamp below button if status not done/failed but finished_at exists */}
      {summary?.finished_at && summary.status !== 'DONE' && summary.status !== 'FAILED' && (
        <div className="mt-2.5 text-center text-[10px] text-[#94A3B8] flex items-center justify-center gap-1">
          <Clock className="w-3 h-3" />
          <span>Last active: {fmtTimestamp(summary.finished_at)}</span>
        </div>
      )}
    </div>
  );
}

export default function Upload() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 fade-in-up">
      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-[#0F172A] tracking-tight flex items-center gap-2">
          <Database className="w-7 h-7 text-[#2563EB]" /> Data Ingestion
        </h1>
        <p className="mt-1 text-sm text-[#475569]">Upload emissions data from your enterprise systems</p>
      </div>

      {/* Three cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {SOURCES.map((src) => (
          <UploadCard key={src.key} source={src} />
        ))}
      </div>
    </div>
  );
}
