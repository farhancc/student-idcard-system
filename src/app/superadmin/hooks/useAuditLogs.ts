import { useState, useCallback } from 'react';

export function useAuditLogs() {
  const [logs, setLogs] = useState<any[]>([]);
  const [totalLogs, setTotalLogs] = useState(0);
  const [totalPagesLogs, setTotalPagesLogs] = useState(1);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logPage, setLogPage] = useState(1);
  const [logSearch, setLogSearch] = useState('');
  const [logCategory, setLogCategory] = useState('');
  const [logSeverity, setLogSeverity] = useState('');
  const [expandedLogId, setExpandedLogId] = useState<number | null>(null);
  const [error, setError] = useState('');

  const fetchAuditLogs = useCallback(async () => {
    setLogsLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        page: String(logPage),
        limit: '50',
        ...(logSearch && { search: logSearch }),
        ...(logCategory && { category: logCategory }),
        ...(logSeverity && { severity: logSeverity }),
      });
      const res = await fetch(`/api/superadmin/audit-logs?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch audit logs');
      setLogs(data.logs || []);
      setTotalLogs(data.total || 0);
      setTotalPagesLogs(data.totalPages || 1);
    } catch (err: any) {
      setError(err.message || 'Failed to load audit logs.');
    } finally {
      setLogsLoading(false);
    }
  }, [logPage, logSearch, logCategory, logSeverity]);

  return {
    logs, setLogs,
    totalLogs, setTotalLogs,
    totalPagesLogs, setTotalPagesLogs,
    logsLoading, setLogsLoading,
    logPage, setLogPage,
    logSearch, setLogSearch,
    logCategory, setLogCategory,
    logSeverity, setLogSeverity,
    expandedLogId, setExpandedLogId,
    error, setError,
    fetchAuditLogs
  };
}
