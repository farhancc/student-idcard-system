import React from 'react';
import { Search } from 'lucide-react';

interface OrderFiltersProps {
  search: string;
  setSearch: React.Dispatch<React.SetStateAction<string>>;
}

export function OrderFilters({ search, setSearch }: OrderFiltersProps) {
  return (
    <div className="glass-panel" style={{ padding: '16px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
      <Search size={18} color="var(--muted)" />
      <input
        type="text"
        className="form-input"
        style={{ background: 'transparent', border: 'none', padding: '4px', flex: 1 }}
        placeholder="Search by Order ID, Client name, Template name, or Status..."
        value={search}
        onChange={e => setSearch(e.target.value)}
      />
    </div>
  );
}
