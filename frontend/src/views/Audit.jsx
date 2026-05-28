import { useState, useEffect, useCallback } from 'react';
import { api } from '../context/AuthContext';
import {
  Shield, RefreshCw, ChevronLeft, ChevronRight,
  ChevronRight as ArrowRight, CloudOff, Trash2
} from 'lucide-react';

/* ─── Action badge styles ─────────────────────────────────────── */
const ACTION_STYLE = {
  STATUS_CHANGE: 'bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE]',
  CREATED:       'bg-[#F0F9FF] text-[#0369A1] border border-[#BAE6FD]',
  FLAGGED:       'bg-[#FEF3C7] text-[#D97706] border border-[#FDE68A]',
  APPROVED:      'bg-[#F0FDF4] text-[#166534] border border-[#A7F3D0]',
  DELETED:       'bg-[#FEF2F2] text-[#991B1B] border border-[#FECACA]',
};

/* ─── Status pill colours (for FROM/TO) ──────────────────────── */
const STATUS_PILL = {
  PENDING:  'bg-[#FEF9C3] text-[#854D0E] border border-[#FDE68A]',
  APPROVED: 'bg-[#F0FDF4] text-[#166534] border border-[#A7F3D0]',
  FLAGGED:  'bg-[#FEF2F2] text-[#991B1B] border border-[#FCA5A5]',
  LOCKED:   'bg-[#EFF6FF] text-[#1E40AF] border border-[#BFDBFE]',
  DELETED:  'bg-[#FEF2F2] text-[#991B1B] border border-[#FCA5A5]',
};

/* ─── Timeline dot colour ────────────────────────────────────── */
const TIMELINE_DOT = {
  STATUS_CHANGE: 'bg-[#2563EB]',
  CREATED:       'bg-[#0EA5E9]',
  FLAGGED:       'bg-[#F59E0B]',
  APPROVED:      'bg-[#10B981]',
  DELETED:       'bg-[#DC2626]',
};

function fmtDate(ts) {
  if (!ts) return '—';
  try {
    const d = new Date(ts);
    return d.toLocaleString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
  } catch { return ts; }
}

/* ─── User avatar with initials ──────────────────────────────── */
function UserAvatar({ name }) {
  const initial = name ? name[0].toUpperCase() : '?';
  // Pick a deterministic gradient based on first char code
  const hue = ((initial.charCodeAt(0) * 37) % 360);
  return (
    <span
      className="inline-flex items-center justify-center w-7 h-7 rounded-full text-white text-[11px] font-bold shrink-0 select-none"
      style={{ background: `linear-gradient(135deg, hsl(${hue},70%,45%), hsl(${(hue+40)%360},70%,55%))` }}
      title={name}
    >
      {initial}
    </span>
  );
}

/* ─── Status Pill ────────────────────────────────────────────── */
function StatusPill({ status }) {
  if (!status) return <span className="text-[#CBD5E1] text-xs">—</span>;
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${STATUS_PILL[status] || 'bg-[#F1F5F9] text-[#475569] border-[#E2E8F4]'}`}>
      {status}
    </span>
  );
}

export default function Audit() {
  const [logs, setLogs]           = useState([]);
  const [page, setPage]           = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal]         = useState(0);
  const [loading, setLoading]     = useState(false);
  const [refreshSpin, setRefreshSpin] = useState(false);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res     = await api.get('/audit/', { params: { page, page_size: 50 } });
      const data    = res.data;
      const results = data.results || data;
      setLogs(results);
      const count   = data.count ?? results.length;
      setTotal(count);
      setTotalPages(Math.max(1, Math.ceil(count / 50)));
    } catch {
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const handleRefresh = () => {
    setRefreshSpin(true);
    fetchLogs().finally(() => setTimeout(() => setRefreshSpin(false), 600));
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-extrabold text-[#0F172A] tracking-tight flex items-center gap-2">
            <Shield className="w-7 h-7 text-[#2563EB]" /> Audit Log
          </h1>
          <p className="mt-0.5 text-sm text-[#475569] flex items-center gap-2 flex-wrap">
            Immutable, tamper-evident record of all status changes and actions.
            {total > 0 && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE] text-[11px] font-bold">
                {total.toLocaleString()} entries
              </span>
            )}
          </p>
        </div>
        <button
          id="audit-refresh-btn"
          onClick={handleRefresh}
          className="flex items-center gap-2 px-4 py-2 rounded-[10px] bg-white border border-[#E2E8F4] text-[#475569] text-sm font-medium hover:bg-[#F8FAFF] hover:text-[#2563EB] hover:border-[#BFDBFE] shadow-sm transition-all duration-200"
        >
          <RefreshCw className={`w-4 h-4 ${refreshSpin ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* ── Table ── */}
      <div className="bg-white rounded-[16px] border border-[#E2E8F4] shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#E2E8F4] bg-[#F8FAFF]">
                {/* Timeline gutter */}
                <th className="w-8 px-2" />
                {['Timestamp', 'User', 'Record ID', 'Action', 'From', '', 'To', 'Reason'].map((h, i) => (
                  <th
                    key={`${h}-${i}`}
                    className="px-4 py-3 text-left label-custom whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center text-[#94A3B8]">
                    <RefreshCw className="w-7 h-7 animate-spin mx-auto mb-2 text-[#CBD5E1]" />
                    <p className="text-sm">Loading audit log…</p>
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center">
                    <CloudOff className="w-14 h-14 mx-auto mb-3 text-[#CBD5E1]" />
                    <p className="font-bold text-[#0F172A] text-base mb-1">No audit entries yet</p>
                    <p className="text-sm text-[#475569]">Approve or flag records to generate entries.</p>
                  </td>
                </tr>
              ) : logs.map((log, i) => {
                const entry = log;
                const actionKey = log.action?.toUpperCase().replace(/\s+/g, '_') || 'STATUS_CHANGE';
                const style     = ACTION_STYLE[actionKey] || ACTION_STYLE.STATUS_CHANGE;
                const dotColor  = TIMELINE_DOT[actionKey] || TIMELINE_DOT.STATUS_CHANGE;
                const user      = log.changed_by_username || log.user || 'system';
                const isLast    = i === logs.length - 1;

                return (
                  <tr
                    key={log.id || i}
                    className="border-b border-[#E2E8F4]/60 row-hover-custom odd:bg-white even:bg-[#FAFBFF] fade-in-up"
                    style={{ animationDelay: `${Math.min(i * 20, 300)}ms` }}
                  >
                    {/* Timeline dot + vertical line */}
                    <td className="px-2 py-0 relative w-8">
                      <div className="flex flex-col items-center h-full absolute inset-0">
                        {/* Line above dot */}
                        {i > 0 && (
                          <div className="w-px flex-1 bg-[#E2E8F4]" style={{ minHeight: '50%' }} />
                        )}
                        <div className={`w-3 h-3 rounded-full border-2 border-white shadow-sm shrink-0 ${dotColor}`} />
                        {/* Line below dot */}
                        {!isLast && (
                          <div className="w-px flex-1 bg-[#E2E8F4]" style={{ minHeight: '50%' }} />
                        )}
                      </div>
                    </td>

                    {/* Timestamp */}
                    <td className="px-4 py-3 whitespace-nowrap font-mono text-xs text-[#475569]">
                      {fmtDate(log.created_at || log.timestamp)}
                    </td>

                    {/* User avatar + name */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <UserAvatar name={user} />
                        <span className="text-xs font-semibold text-[#0F172A] max-w-[80px] truncate">
                          {user}
                        </span>
                      </div>
                    </td>

                    {/* Record ID */}
                    <td className="px-4 py-3 whitespace-nowrap font-mono text-xs text-[#94A3B8]">
                      {log.record ? `#${log.record}` : '—'}
                    </td>

                    {/* Action badge */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`px-2.5 py-0.5 rounded-[6px] text-[10px] font-bold uppercase tracking-wider border ${style} inline-flex items-center gap-1`}>
                        {actionKey === 'DELETED' && <Trash2 className="w-3 h-3 inline" />}
                        {log.action || 'STATUS_CHANGE'}
                      </span>
                    </td>

                    {/* FROM status pill */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <StatusPill status={entry.before_state?.status} />
                    </td>

                    {/* Arrow */}
                    <td className="px-1 py-3 text-[#CBD5E1]">
                      <ArrowRight className="w-3.5 h-3.5" />
                    </td>

                    {/* TO status pill */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <StatusPill status={entry.after_state?.status} />
                    </td>

                    {/* Reason */}
                    <td className="px-4 py-3 text-xs max-w-[180px] truncate">
                      {entry.action === 'FLAGGED' && entry.after_state?.flag_reason
                        ? entry.after_state.flag_reason
                        : ''}
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
              id="audit-pagination-prev"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="flex items-center gap-1 px-3 py-1.5 rounded-[8px] border border-[#E2E8F4] text-[#475569] text-xs font-medium hover:bg-white hover:border-[#BFDBFE] hover:text-[#2563EB] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> Prev
            </button>

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
              id="audit-pagination-next"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="flex items-center gap-1 px-3 py-1.5 rounded-[8px] border border-[#E2E8F4] text-[#475569] text-xs font-medium hover:bg-white hover:border-[#BFDBFE] hover:text-[#2563EB] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
