import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../context/AuthContext';
import {
  BarChart3, SlidersHorizontal, ChevronLeft, ChevronRight,
  CheckCircle, AlertTriangle, Clock, X, RefreshCw, Leaf,
  CloudOff, Lock, RefreshCw as RefreshCwIcon, FileText, TrendingDown, Users, Rocket, Check, Flag, Trash2
} from 'lucide-react';

const SCOPE_OPTS  = ['', '1', '2', '3'];
const STATUS_OPTS = ['', 'PENDING', 'APPROVED', 'FLAGGED', 'LOCKED'];
const SOURCE_OPTS = ['', 'SAP', 'UTILITY', 'TRAVEL'];

/* ─── Source badge styles ─────────────────────────────────────── */
const SOURCE_BADGE = {
  SAP:     'bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE]',
  UTILITY: 'bg-[#F0F9FF] text-[#0369A1] border border-[#BAE6FD]',
  TRAVEL:  'bg-[#F0FDF4] text-[#065F46] border border-[#A7F3D0]',
};

/* ─── Scope badge ─────────────────────────────────────────────── */
const SCOPE_BADGE = {
  '1': 'bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE]',
  '2': 'bg-[#F0F9FF] text-[#0369A1] border border-[#BAE6FD]',
  '3': 'bg-[#F0FDF4] text-[#065F46] border border-[#A7F3D0]',
};

/* ─── Status badge + row style ────────────────────────────────── */
const STATUS_STYLE = {
  PENDING:  {
    row:   '',
    badge: 'bg-[#FEF9C3] text-[#854D0E] border border-[#FDE68A]',
    dot:   'bg-[#F59E0B] pulse-dot',
  },
  APPROVED: {
    row:   'bg-[#F0FDF4]/40',
    badge: 'bg-[#F0FDF4] text-[#166534] border border-[#A7F3D0]',
    dot:   'bg-[#10B981]',
  },
  FLAGGED: {
    row:   'bg-[#FFF5F5] border-l-[3px] border-l-[#EF4444]',
    badge: 'bg-[#FEF2F2] text-[#991B1B] border border-[#FCA5A5]',
    dot:   'bg-[#EF4444]',
  },
  LOCKED: {
    row:   'bg-[#EFF6FF]/30',
    badge: 'bg-[#EFF6FF] text-[#1E40AF] border border-[#BFDBFE]',
    dot:   null,
  },
};

/* ─── Count-up hook ───────────────────────────────────────────── */
function useCountUp(target, duration = 800) {
  const [display, setDisplay] = useState(0);
  const prev = useRef(0);
  useEffect(() => {
    const start = prev.current;
    const diff  = target - start;
    if (diff === 0) return;
    const startTime = performance.now();
    const step = (now) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased    = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(start + diff * eased));
      if (progress < 1) requestAnimationFrame(step);
      else prev.current = target;
    };
    requestAnimationFrame(step);
  }, [target, duration]);
  return display;
}

/* ─── Stat Card ───────────────────────────────────────────────── */
function StatCard({ label, value, sub, colorClass, accentColor, Icon, stagger }) {
  const animated = useCountUp(typeof value === 'number' ? value : 0);
  const display  = typeof value === 'number'
    ? animated.toLocaleString('en-US')
    : value;

  return (
    <div
      className={`bg-white rounded-[12px] border border-[#E2E8F4] p-[20px] px-[24px] shadow-[0_1px_3px_rgba(0,0,0,0.06),0_4px_12px_rgba(37,99,235,0.07)] hover:shadow-[0_4px_6px_rgba(0,0,0,0.08),0_10px_20px_rgba(37,99,235,0.1)] hover:-translate-y-[2px] transition-all duration-200 ease-in-out fade-in-up ${stagger}`}
      style={{ borderLeft: `3px solid ${accentColor}` }}
    >
      {/* Row 1: small icon (16px/14px inside) + label text side by side */}
      <div className="flex items-center gap-1.5 h-[16px]">
        <Icon className="w-[14px] h-[14px] text-[#94A3B8]" strokeWidth={2} />
        <span className="text-[#94A3B8] uppercase text-[0.7rem] font-medium tracking-[0.06em] select-none">
          {label}
        </span>
      </div>

      {/* Row 2: the big number */}
      <div
        className="text-[2rem] font-extrabold leading-none mt-2 counter-animate"
        style={{ color: accentColor }}
      >
        {display}
      </div>

      {/* Row 3: subtitle below the number */}
      {sub && (
        <div className="text-[0.78rem] text-[#94A3B8] mt-1">
          {sub}
        </div>
      )}
    </div>
  );
}

/* ─── Flag Modal ──────────────────────────────────────────────── */
function FlagModal({ record, onClose, onSave }) {
  const [reason, setReason]   = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const handleSave = async () => {
    setLoading(true);
    setError('');
    try {
      await api.patch(`/records/${record.id}/status/`, { status: 'FLAGGED', flag_reason: reason });
      onSave('FLAGGED', reason);
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update status');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(15,23,42,0.4)', backdropFilter: 'blur(4px)' }}
    >
      <div className="w-full max-w-md bg-white border border-[#E2E8F4] rounded-[20px] shadow-[0_20px_60px_rgba(37,99,235,0.15),0_8px_24px_rgba(0,0,0,0.08)] p-6 animate-[scale-in_200ms_ease_forwards]"
        style={{ animation: 'flagModalIn 200ms ease forwards' }}>
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-[#FEF3C7] rounded-lg">
              <AlertTriangle className="w-5 h-5 text-[#F59E0B]" />
            </div>
            <h3 className="font-bold text-[#0F172A] text-base">Flag Record</h3>
          </div>
          <button onClick={onClose} className="p-1.5 text-[#94A3B8] hover:text-[#475569] hover:bg-[#F8FAFF] rounded-lg transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-[#475569] mb-4 leading-relaxed">
          Record: <span className="font-mono text-[#0F172A] bg-[#F8FAFF] px-1.5 py-0.5 rounded">{record.description || `#${record.id}`}</span>
        </p>

        {error && (
          <div className="mb-3 px-3 py-2 rounded-[10px] bg-[#FEF2F2] border border-[#FCA5A5] text-[#EF4444] text-xs font-medium">{error}</div>
        )}

        <div>
          <label className="block text-xs font-semibold text-[#475569] uppercase tracking-wider mb-1.5">Flag Reason</label>
          <textarea
            id="modal-reason-input"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={4}
            placeholder="Describe why this record is being flagged for review…"
            className="w-full px-3.5 py-2.5 bg-[#F8FAFF] border border-[#E2E8F4] rounded-[10px] text-[#0F172A] text-sm placeholder-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#F59E0B] focus:border-[#F59E0B] transition resize-none"
          />
        </div>

        <div className="flex gap-3 mt-5">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-[10px] border border-[#E2E8F4] text-[#475569] text-sm font-medium hover:bg-[#F8FAFF] transition"
          >
            Cancel
          </button>
          <button
            id="modal-save-btn"
            onClick={handleSave}
            disabled={loading}
            className="flex-1 py-2.5 rounded-[10px] bg-warning-gradient text-white text-sm font-semibold shadow-[0_2px_8px_rgba(245,158,11,0.3)] hover:-translate-y-0.5 transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <><RefreshCwIcon className="w-4 h-4 animate-spin" /> Saving…</>
            ) : (
              <><Flag className="w-4 h-4" /> Confirm Flag</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Approve action (inline, no modal) ──────────────────────── */
async function approveRecord(recordId, onSave) {
  await api.patch(`/records/${recordId}/status/`, { status: 'APPROVED', flag_reason: '' });
  onSave('APPROVED', '');
}

/* ─── Roadmap Section ─────────────────────────────────────────── */
const ROADMAP_FEATURES = [
  {
    Icon: RefreshCwIcon,
    title: 'Real-time SAP Integration',
    desc: 'Direct OData connection to SAP Gateway — eliminate manual CSV exports with live data sync',
  },
  {
    Icon: FileText,
    title: 'PDF Utility Bill Parser',
    desc: 'Automatic extraction from utility PDF bills using computer vision — no more manual portal downloads',
  },
  {
    Icon: TrendingDown,
    title: 'Emission Factor Auto-update',
    desc: 'Automatic sync with DEFRA annual updates — factors always current without manual maintenance',
  },
  {
    Icon: Users,
    title: 'Multi-user Roles',
    desc: 'Analyst, Reviewer, and Auditor roles with approval workflows and permission controls',
  },
];

function RoadmapSection() {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-10 bg-white rounded-[16px] border border-[#E2E8F4] shadow-card overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-[#F8FAFF] transition"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-2">
          <Rocket className="w-5 h-5 text-[#2563EB]" />
          <span className="font-bold text-[#0F172A] text-base">Platform Roadmap</span>
        </div>
        <ChevronRight className={`w-5 h-5 text-[#94A3B8] transition-transform duration-300 ${open ? 'rotate-90' : ''}`} />
      </button>

      {open && (
        <div className="px-6 pb-6 pt-2 fade-in-up">
          <p className="text-sm text-[#475569] mb-5">Upcoming features planned for the Breathe ESG platform.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {ROADMAP_FEATURES.map(({ Icon, title, desc }, i) => (
              <div
                key={i}
                className={`card-3d card-shine bg-[#F8FAFF] border-2 border-dashed border-[#CBD5E1] rounded-[16px] p-5 fade-in-up stagger-${i + 1}`}
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-[#EFF6FF] rounded-xl border border-[#BFDBFE] shrink-0">
                    <Icon className="w-5 h-5 text-[#2563EB]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h4 className="font-semibold text-[#0F172A] text-sm">{title}</h4>
                      <span className="px-2 py-0.5 rounded-[6px] text-[10px] font-semibold bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE] uppercase tracking-wider">
                        Coming Soon
                      </span>
                    </div>
                    <p className="text-xs text-[#475569] leading-relaxed">{desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Main Review Component ───────────────────────────────────── */
export default function Review() {
  const [records, setRecords]       = useState([]);
  const [stats, setStats]           = useState({ total: 0, pending: 0, flagged: 0, co2: 0 });
  const [filters, setFilters]       = useState({ source_type: '', scope: '', status: '', date_from: '', date_to: '' });
  const [page, setPage]             = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading]       = useState(false);
  const [flagRecord, setFlagRecord] = useState(null);   // record to flag via modal
  const [selected, setSelected]     = useState(new Set()); // bulk selection
  const [approvingId, setApprovingId] = useState(null); // row being approved (spinner)
  const [refreshSpin, setRefreshSpin] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [fadingRowIds, setFadingRowIds] = useState(new Set());
  const [toast, setToast] = useState(null);
  const [error, setError] = useState(null);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };

  const handleConfirmDelete = async (recordId) => {
    try {
      await api.delete(`/records/${recordId}/`);
      setFadingRowIds(prev => new Set(prev).add(recordId));
      
      setTimeout(() => {
        setRecords(prev => prev.filter(r => r.id !== recordId));
        setFadingRowIds(prev => {
          const next = new Set(prev);
          next.delete(recordId);
          return next;
        });
        fetchGlobalStats();
      }, 300);
      
    } catch (err) {
      const errMsg = err.response?.data?.detail || err.response?.data?.error || 'Failed to delete record';
      showToast(errMsg);
    } finally {
      setDeleteConfirmId(null);
    }
  };

  /* ── Global stats ── */
  const fetchGlobalStats = useCallback(async () => {
    try {
      const [allRes, pendingRes, flaggedRes] = await Promise.all([
        api.get('/records/', { params: { page_size: 1 } }),
        api.get('/records/', { params: { status: 'PENDING', page_size: 1 } }),
        api.get('/records/', { params: { status: 'FLAGGED', page_size: 1 } }),
      ]);
      setStats(prev => ({
        ...prev,
        total:   allRes.data.count,
        pending: pendingRes.data.count,
        flagged: flaggedRes.data.count,
      }));
    } catch (e) {
      console.error('Failed to fetch global stats:', e);
    }
  }, []);

  /* ── Records ── */
  const fetchRecords = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSelected(new Set());
    try {
      const params = { page, page_size: 50, ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)) };
      const res    = await api.get('/records/', { params });
      const data   = res.data;
      const results = data.results || data;
      setRecords(results);
      const count = data.count || results.length;
      setTotalPages(Math.max(1, Math.ceil(count / 50)));
      setStats(prev => ({
        ...prev,
        co2: results.reduce((s, r) => s + parseFloat(r.quantity_kg_co2e || 0), 0),
      }));
      fetchGlobalStats();
    } catch (err) {
      console.error("Failed to fetch records:", err);
      setError("Failed to load records. Check your connection.");
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [page, filters, fetchGlobalStats]);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  /* ── Status update helpers ── */
  const handleRecordStatusUpdate = (recordId, newStatus, flagReason) => {
    setRecords(prev =>
      prev.map(r =>
        r.id === recordId
          ? { ...r, status: newStatus, flag_reason: flagReason }
          : r
      )
    );
    fetchGlobalStats();
  };

  const handleApprove = async (record) => {
    setApprovingId(record.id);
    try {
      await approveRecord(record.id, (status, reason) =>
        handleRecordStatusUpdate(record.id, status, reason)
      );
    } catch {
      // silently ignore — user can retry
    } finally {
      setApprovingId(null);
    }
  };

  /* ── Bulk approve ── */
  const handleBulkApprove = async () => {
    const ids = [...selected];
    setSelected(new Set());
    await Promise.allSettled(
      ids.map(id =>
        api.patch(`/records/${id}/status/`, { status: 'APPROVED', flag_reason: '' })
           .then(() => handleRecordStatusUpdate(id, 'APPROVED', ''))
      )
    );
    fetchGlobalStats();
  };

  /* ── Filters ── */
  const handleFilter = (k, v) => { setFilters(f => ({ ...f, [k]: v })); setPage(1); };
  const clearFilters  = ()     => { setFilters({ source_type: '', scope: '', status: '', date_from: '', date_to: '' }); setPage(1); };
  const hasFilters    = Object.values(filters).some(Boolean);
  const activeCount   = Object.values(filters).filter(Boolean).length;

  /* ── Refresh spin ── */
  const handleRefresh = () => {
    setRefreshSpin(true);
    fetchRecords().finally(() => setTimeout(() => setRefreshSpin(false), 600));
  };

  /* ── Checkbox ── */
  const toggleSelect = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };
  const pendingRecords   = records.filter(r => r.status === 'PENDING');
  const allPendingChecked = pendingRecords.length > 0 && pendingRecords.every(r => selected.has(r.id));
  const toggleAllPending  = () => {
    if (allPendingChecked) {
      setSelected(prev => { const n = new Set(prev); pendingRecords.forEach(r => n.delete(r.id)); return n; });
    } else {
      setSelected(prev => { const n = new Set(prev); pendingRecords.forEach(r => n.add(r.id)); return n; });
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

      {/* ── Page Header ── */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-extrabold text-[#0F172A] tracking-tight flex items-center gap-2">
            <BarChart3 className="w-7 h-7 text-[#2563EB]" /> Review Dashboard
          </h1>
          <p className="mt-0.5 text-sm text-[#475569]">Inspect, filter and approve normalised ESG records.</p>
        </div>
        <button
          id="review-refresh-btn"
          onClick={handleRefresh}
          className="flex items-center gap-2 px-4 py-2 rounded-[10px] bg-white border border-[#E2E8F4] text-[#475569] text-sm font-medium hover:bg-[#F8FAFF] hover:text-[#2563EB] hover:border-[#BFDBFE] shadow-sm transition-all duration-200"
        >
          <RefreshCw className={`w-4 h-4 transition-transform duration-500 ${refreshSpin ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Total Records"
          value={stats.total}
          sub="All sources"
          accentColor="#2563EB"
          Icon={BarChart3}
          stagger="stagger-1"
        />
        <StatCard
          label="Pending Review"
          value={stats.pending}
          sub="Awaiting approval"
          accentColor="#D97706"
          Icon={Clock}
          stagger="stagger-2"
        />
        <StatCard
          label="Flagged"
          value={stats.flagged}
          sub="Requires attention"
          accentColor="#DC2626"
          Icon={AlertTriangle}
          stagger="stagger-3"
        />
        <StatCard
          label="Total KG CO₂e"
          value={Math.round(stats.co2)}
          sub="This page"
          accentColor="#059669"
          Icon={Leaf}
          stagger="stagger-4"
        />
      </div>

      {/* ── Filter Bar ── */}
      <div className="bg-white border border-[#E2E8F4] rounded-[12px] p-4 mb-4 shadow-sm">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex items-center gap-2 text-[#475569] text-sm font-semibold relative">
            <SlidersHorizontal className="w-4 h-4" />
            <span>Filters</span>
            {activeCount > 0 && (
              <span className="absolute -top-2 -right-4 w-4 h-4 rounded-full bg-[#2563EB] text-white text-[9px] font-bold flex items-center justify-center">
                {activeCount}
              </span>
            )}
          </div>

          {[
            { id: 'filter-source', key: 'source_type', label: 'Source', opts: SOURCE_OPTS },
            { id: 'filter-scope',  key: 'scope',       label: 'Scope',  opts: SCOPE_OPTS  },
            { id: 'filter-status', key: 'status',      label: 'Status', opts: STATUS_OPTS },
          ].map(({ id, key, label, opts }) => (
            <select
              key={key}
              id={id}
              value={filters[key]}
              onChange={(e) => handleFilter(key, e.target.value)}
              className="px-3 py-1.5 bg-[#F8FAFF] border border-[#E2E8F4] rounded-[8px] text-sm text-[#475569] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/40 focus:border-[#2563EB] hover:bg-[#EFF6FF] transition"
            >
              <option value="">{label}: All</option>
              {opts.filter(Boolean).map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          ))}

          <div className="flex items-center gap-1.5">
            <input
              id="filter-date-from"
              type="date"
              value={filters.date_from}
              onChange={(e) => handleFilter('date_from', e.target.value)}
              className="px-3 py-1.5 bg-[#F8FAFF] border border-[#E2E8F4] rounded-[8px] text-sm text-[#475569] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/40 focus:border-[#2563EB] transition"
            />
            <span className="text-[#CBD5E1] text-sm">→</span>
            <input
              id="filter-date-to"
              type="date"
              value={filters.date_to}
              onChange={(e) => handleFilter('date_to', e.target.value)}
              className="px-3 py-1.5 bg-[#F8FAFF] border border-[#E2E8F4] rounded-[8px] text-sm text-[#475569] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/40 focus:border-[#2563EB] transition"
            />
          </div>

          <button
            id="filter-shortcut-flagged"
            onClick={() => handleFilter('status', filters.status === 'FLAGGED' ? '' : 'FLAGGED')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-xs font-semibold border transition-all ${
              filters.status === 'FLAGGED'
                ? 'bg-warning-gradient text-white border-transparent shadow-sm'
                : 'border-[#FDE68A] text-[#D97706] bg-[#FFFBEB] hover:bg-[#FEF3C7]'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" /> Flagged Only
          </button>

          {hasFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 text-xs text-[#94A3B8] hover:text-[#475569] transition"
            >
              <X className="w-3.5 h-3.5" /> Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* ── Bulk Actions Bar ── */}
      {selected.size > 0 && (
        <div className="mb-3 px-5 py-3 bg-white border border-[#BFDBFE] border-l-4 border-l-[#2563EB] rounded-[10px] shadow-card flex items-center justify-between gap-3 fade-in-up">
          <span className="text-sm font-semibold text-[#1D4ED8]">
            {selected.size} record{selected.size > 1 ? 's' : ''} selected
          </span>
          <button
            onClick={handleBulkApprove}
            className="flex items-center gap-2 px-4 py-2 rounded-[10px] bg-success-gradient text-white text-sm font-semibold shadow-sm hover:-translate-y-0.5 transition-all"
          >
            <Check className="w-4 h-4" /> Approve All Selected
          </button>
        </div>
      )}

      {/* ── Table ── */}
      <div className="bg-white rounded-[16px] border border-[#E2E8F4] shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#E2E8F4] bg-[#F8FAFF]">
                <th className="px-4 py-3 w-8">
                  <input
                    type="checkbox"
                    checked={allPendingChecked}
                    onChange={toggleAllPending}
                    className="w-3.5 h-3.5 accent-[#2563EB] cursor-pointer"
                    title="Select all pending"
                  />
                </th>
                {['Date','Source','Description','Quantity','Unit','KG CO₂e','Scope','Status','Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left label-custom whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10} className="py-16 text-center text-[#94A3B8]">
                    <RefreshCw className="w-7 h-7 animate-spin mx-auto mb-2 text-[#CBD5E1]" />
                    <p className="text-sm">Loading records…</p>
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={10} className="py-16 text-center text-[#DC2626]">
                    <AlertTriangle className="w-10 h-10 mx-auto mb-2 text-[#EF4444] animate-bounce" />
                    <p className="font-bold text-[#0F172A] text-base mb-1">{error}</p>
                    <p className="text-sm text-[#475569]">Please check your local backend server is running.</p>
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-16 text-center">
                    <CloudOff className="w-14 h-14 mx-auto mb-3 text-[#CBD5E1]" />
                    <p className="font-bold text-[#0F172A] text-base mb-1">No records found</p>
                    <p className="text-sm text-[#475569] mb-4">
                      {hasFilters ? 'Try adjusting your filters.' : 'Upload some data to get started.'}
                    </p>
                    {!hasFilters && (
                      <Link
                        to="/upload"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-primary-btn text-white rounded-[10px] text-sm font-semibold shadow-button hover:-translate-y-0.5 transition-all"
                      >
                        Upload Data
                      </Link>
                    )}
                  </td>
                </tr>
              ) : records.map((r, idx) => {
                const s        = STATUS_STYLE[r.status] || STATUS_STYLE.PENDING;
                const isPending = r.status === 'PENDING';
                const approving = approvingId === r.id;
                const rowBg    = idx % 2 === 0 ? '' : 'bg-[#FAFBFF]';
                const isFading  = fadingRowIds.has(r.id);
                return (
                  <tr
                    key={r.id}
                    className={`border-b border-[#E2E8F4]/60 row-hover-custom ${s.row} ${rowBg} fade-in-up`}
                    style={{
                      animationDelay: `${Math.min(idx * 25, 300)}ms`,
                      opacity: isFading ? 0 : 1,
                      transition: 'all 300ms ease-out',
                    }}
                  >
                    {/* Checkbox */}
                    <td className="px-4 py-3">
                      {isPending && (
                        <input
                           type="checkbox"
                           checked={selected.has(r.id)}
                           onChange={() => toggleSelect(r.id)}
                           className="w-3.5 h-3.5 accent-[#2563EB] cursor-pointer"
                        />
                      )}
                    </td>
                    {/* Date */}
                    <td className="px-4 py-3 whitespace-nowrap font-mono text-xs text-[#475569]">
                      {r.activity_date || '—'}
                    </td>
                    {/* Source */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded-[6px] text-[10px] font-bold uppercase tracking-wider ${SOURCE_BADGE[r.source_type] || 'bg-[#F1F5F9] text-[#475569] border border-[#E2E8F4]'}`}>
                        {r.source_type}
                      </span>
                    </td>
                    {/* Description */}
                    <td className="px-4 py-3 text-[#0F172A] max-w-[180px] truncate" title={r.description}>
                      {r.description || '—'}
                    </td>
                    {/* Quantity */}
                    <td className="px-4 py-3 text-right font-mono text-[#475569] text-xs whitespace-nowrap">
                      {parseFloat(r.quantity || 0).toLocaleString('en-US')}
                    </td>
                    {/* Unit */}
                    <td className="px-4 py-3 text-[#94A3B8] text-xs">{r.unit}</td>
                    {/* CO2e */}
                    <td className="px-4 py-3 text-right font-mono font-semibold text-[#0F172A] text-xs whitespace-nowrap">
                      <span className="flex items-center justify-end gap-1">
                        <Leaf className="w-3 h-3 text-[#10B981] shrink-0" />
                        {parseFloat(r.quantity_kg_co2e || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </td>
                    {/* Scope */}
                    <td className="px-4 py-3 text-center">
                      {r.scope ? (
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${SCOPE_BADGE[String(r.scope)] || 'bg-[#F1F5F9] text-[#475569] border border-[#E2E8F4]'}`}>
                          {r.scope}
                        </span>
                      ) : '—'}
                    </td>
                    {/* Status */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        title={r.status === 'FLAGGED' ? (r.flag_reason || 'Flagged') : undefined}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${s.badge}`}
                      >
                        {r.status === 'LOCKED' ? (
                          <Lock className="w-2.5 h-2.5" />
                        ) : s.dot ? (
                          <span className={`w-1.5 h-1.5 rounded-full inline-block ${s.dot}`} />
                        ) : null}
                        {r.status}
                      </span>
                    </td>
                    {/* Actions */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      {isPending && (
                        <div className="flex gap-2 items-center">
                          {deleteConfirmId === r.id ? (
                            <div className="flex items-center gap-1.5 bg-[#FEF2F2] px-2 py-1 rounded-[8px] border border-[#FCA5A5] fade-in">
                              <span className="text-[11px] font-bold text-[#DC2626] mr-0.5 select-none">Sure?</span>
                              <button
                                onClick={() => handleConfirmDelete(r.id)}
                                className="px-2 py-1 bg-[#DC2626] text-white text-[10px] font-bold rounded-[6px] hover:bg-[#B91C1C] transition-all"
                              >
                                Confirm
                              </button>
                              <button
                                onClick={() => setDeleteConfirmId(null)}
                                className="px-2 py-1 bg-[#64748B] text-white text-[10px] font-bold rounded-[6px] hover:bg-[#475569] transition-all"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <>
                              <button
                                id={`approve-btn-${r.id}`}
                                onClick={() => handleApprove(r)}
                                disabled={approving}
                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-[8px] text-[11px] font-semibold bg-success-gradient text-white shadow-sm hover:-translate-y-0.5 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                              >
                                {approving
                                  ? <RefreshCw className="w-3 h-3 animate-spin" />
                                  : <Check className="w-3 h-3" />}
                                Approve
                              </button>
                              <button
                                id={`flag-btn-${r.id}`}
                                onClick={() => setFlagRecord(r)}
                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-[8px] text-[11px] font-semibold bg-warning-gradient text-white shadow-sm hover:-translate-y-0.5 transition-all"
                              >
                                <Flag className="w-3 h-3" /> Flag
                              </button>
                              <button
                                id={`delete-btn-${r.id}`}
                                onClick={() => setDeleteConfirmId(r.id)}
                                className="flex items-center justify-center p-1.5 rounded-[8px] bg-white border border-[#FCA5A5] text-[#DC2626] hover:bg-[#FEF2F2] hover:border-[#EF4444] hover:-translate-y-[1px] transition-all"
                                title="Delete record (PENDING only)"
                              >
                                <Trash2 className="w-[14px] h-[14px]" />
                              </button>
                            </>
                          )}
                        </div>
                      )}
                      {r.status === 'LOCKED' && (
                        <span className="text-[11px] text-[#94A3B8] flex items-center gap-1">
                          <Clock className="w-3 h-3" /> Locked
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* ── Pagination ── */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-[#E2E8F4] bg-[#F8FAFF]">
          <span className="text-xs text-[#94A3B8] font-medium">Page {page} of {totalPages}</span>
          <div className="flex items-center gap-1.5">
            <button
              id="pagination-prev"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="flex items-center gap-1 px-3 py-1.5 rounded-[8px] border border-[#E2E8F4] text-[#475569] text-xs font-medium hover:bg-white hover:border-[#BFDBFE] hover:text-[#2563EB] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> Prev
            </button>

            {/* Page pills */}
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              const pg = totalPages <= 5 ? i + 1
                : page <= 3 ? i + 1
                : page >= totalPages - 2 ? totalPages - 4 + i
                : page - 2 + i;
              return (
                <button
                  key={pg}
                  onClick={() => setPage(pg)}
                  className={`w-8 h-8 rounded-[8px] text-xs font-semibold transition-all ${
                    pg === page
                      ? 'bg-primary-btn text-white shadow-sm'
                      : 'border border-[#E2E8F4] text-[#475569] hover:bg-white hover:border-[#BFDBFE] hover:text-[#2563EB]'
                  }`}
                >
                  {pg}
                </button>
              );
            })}

            <button
              id="pagination-next"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="flex items-center gap-1 px-3 py-1.5 rounded-[8px] border border-[#E2E8F4] text-[#475569] text-xs font-medium hover:bg-white hover:border-[#BFDBFE] hover:text-[#2563EB] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Roadmap Section ── */}
      <RoadmapSection />

      {/* ── Flag Modal ── */}
      {flagRecord && (
        <FlagModal
          record={flagRecord}
          onClose={() => setFlagRecord(null)}
          onSave={(newStatus, reason) => {
            handleRecordStatusUpdate(flagRecord.id, newStatus, reason);
            setFlagRecord(null);
          }}
        />
      )}

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2 px-4 py-3 bg-[#FEF2F2] border border-[#FCA5A5] text-[#991B1B] rounded-[12px] shadow-lg animate-[slide-in_200ms_ease_out] text-sm font-semibold max-w-md">
          <AlertTriangle className="w-4 h-4 shrink-0 text-[#EF4444]" />
          <span>{toast}</span>
          <button onClick={() => setToast(null)} className="p-1 hover:bg-[#FCA5A5]/20 rounded transition ml-auto">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
