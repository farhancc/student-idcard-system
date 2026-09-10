import React from 'react';
import { Sliders } from 'lucide-react';

interface TestDataEditorProps {
  fields: { field: string; type: string }[];
  testData: Record<string, string>;
  onChange: (data: Record<string, string>) => void;
  getFieldDefaultValue: (fieldName: string, fieldType: string) => string;
}

export default function TestDataEditor({
  fields,
  testData,
  onChange,
  getFieldDefaultValue
}: TestDataEditorProps) {
  return (
    <div style={{
      padding: '16px',
      background: 'rgba(255, 255, 255, 0.02)',
      border: '1px solid var(--glass-border)',
      borderRadius: '8px',
      marginBottom: '8px'
    }}>
      <div style={{ 
        fontSize: '0.85rem', 
        fontWeight: 600, 
        color: 'var(--primary)', 
        marginBottom: '12px',
        display: 'flex',
        alignItems: 'center',
        gap: '6px'
      }}>
        <Sliders size={14} />
        Customize Preview Test Data
      </div>
      
      {fields.length === 0 ? (
        <div style={{ fontSize: '0.75rem', color: 'var(--muted)', fontStyle: 'italic' }}>
          Add field mappings below or click on the card to place a field, then customize its test value here.
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          gap: '12px'
        }}>
          {fields.map(({ field, type }) => (
            <div key={field} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--muted)', display: 'flex', justifyContent: 'space-between' }}>
                <span>{field}</span>
                <span style={{ opacity: 0.6, fontSize: '0.65rem', textTransform: 'uppercase' }}>({type})</span>
              </span>
              <input
                type="text"
                className="form-input"
                style={{ padding: '6px 10px', fontSize: '0.8rem' }}
                placeholder={getFieldDefaultValue(field, type)}
                value={testData[field] || ''}
                onChange={e => onChange({ ...testData, [field]: e.target.value })}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
