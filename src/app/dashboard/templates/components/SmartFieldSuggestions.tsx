import React from 'react';
import { Lightbulb } from 'lucide-react';

const SMART_SUGGESTIONS: Record<string, string[]> = {
  ID_CARD:      ['photo', 'name', 'id', 'department', 'qr'],
  CERTIFICATE:  ['name', 'course', 'grade', 'date', 'signature'],
  BADGE:        ['name', 'role', 'company', 'qr'],
  LABEL:        ['productName', 'barcode', 'batch', 'price'],
  TICKET:       ['name', 'seat', 'date', 'qr'],
  VISITOR_PASS: ['name', 'company', 'validity', 'qr'],
  LETTER:       ['name', 'address', 'accountNumber'],
  CARD:         ['name', 'membershipId', 'expiry'],
  TAG:          ['serialNumber', 'barcode', 'qr'],
  STICKER:      ['productCode', 'batch', 'qr'],
  OTHER:        [],
};

interface SmartFieldSuggestionsProps {
  category: string;
  existingFieldNames: string[];
  onAddField: (suggestion: string) => void;
}

export default function SmartFieldSuggestions({
  category,
  existingFieldNames,
  onAddField
}: SmartFieldSuggestionsProps) {
  const suggestions = SMART_SUGGESTIONS[category] || [];
  if (suggestions.length === 0) return null;

  return (
    <div style={{
      padding: '12px 16px',
      background: 'rgba(250,204,21,0.06)',
      border: '1px solid rgba(250,204,21,0.2)',
      borderRadius: '10px',
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      flexWrap: 'wrap',
      marginBottom: '16px',
      width: '100%'
    }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#fbbf24', fontSize: '0.8rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
        <Lightbulb size={14} /> Suggested Fields
      </span>
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        {suggestions.map(suggestion => {
          const alreadyAdded = existingFieldNames.includes(suggestion);
          return (
            <button
              key={suggestion}
              type="button"
              disabled={alreadyAdded}
              onClick={() => onAddField(suggestion)}
              style={{
                padding: '3px 10px',
                borderRadius: '99px',
                fontSize: '0.72rem',
                fontWeight: 600,
                border: alreadyAdded ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(250,204,21,0.3)',
                background: alreadyAdded ? 'rgba(255,255,255,0.04)' : 'rgba(250,204,21,0.1)',
                color: alreadyAdded ? 'var(--muted)' : '#fbbf24',
                cursor: alreadyAdded ? 'not-allowed' : 'pointer',
                textDecoration: alreadyAdded ? 'line-through' : 'none',
                transition: 'all 0.2s',
              }}
              title={alreadyAdded ? 'Already added' : `Add "${suggestion}" to front fields`}
            >
              {alreadyAdded ? '✓ ' : '+ '}{suggestion}
            </button>
          );
        })}
      </div>
    </div>
  );
}
