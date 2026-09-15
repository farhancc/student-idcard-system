import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { FieldCoordinate } from '@/lib/pdf/card-renderer-client';
import type {
  FieldCondition,
  FieldConditionOp,
  FieldComputePart,
  FieldComputeTransform,
} from '@/lib/pdf/field-resolver';

/**
 * The rule builder for one field: when it prints, and what it prints.
 *
 * Deliberately a structured builder rather than an expression box — press
 * operators author these, and every rule it can produce is one the render-time
 * evaluator understands. There is no syntax to get wrong and nothing to parse.
 */

const OPERATORS: Array<{ value: FieldConditionOp; label: string; needsValue: boolean }> = [
  { value: 'notEmpty', label: 'is not empty', needsValue: false },
  { value: 'isEmpty', label: 'is empty', needsValue: false },
  { value: 'eq', label: 'equals', needsValue: true },
  { value: 'neq', label: 'does not equal', needsValue: true },
  { value: 'contains', label: 'contains', needsValue: true },
  { value: 'startsWith', label: 'starts with', needsValue: true },
  { value: 'gt', label: 'is greater than', needsValue: true },
  { value: 'lt', label: 'is less than', needsValue: true },
];

const TRANSFORMS: Array<{ value: '' | FieldComputeTransform; label: string }> = [
  { value: '', label: 'As-is' },
  { value: 'upper', label: 'UPPERCASE' },
  { value: 'lower', label: 'lowercase' },
  { value: 'capitalize', label: 'Capitalised' },
];

const MAX_RULE_ITEMS = 20;

const inputStyle: React.CSSProperties = {
  background: '#1e293b',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '4px',
  color: '#ffffff',
  padding: '3px 5px',
  fontSize: '0.7rem',
  minWidth: 0,
};

const sectionStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
  borderTop: '1px solid rgba(255,255,255,0.08)',
  paddingTop: '8px',
};

const labelStyle: React.CSSProperties = {
  fontSize: '0.7rem',
  color: '#e2e8f0',
  fontWeight: 500,
  cursor: 'pointer',
};

const hintStyle: React.CSSProperties = {
  fontSize: '0.6rem',
  color: '#64748b',
  lineHeight: 1.4,
};

const iconButtonStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: '#94a3b8',
  cursor: 'pointer',
  padding: '2px',
  display: 'flex',
  alignItems: 'center',
};

const addButtonStyle: React.CSSProperties = {
  background: 'rgba(59,130,246,0.15)',
  border: '1px solid rgba(59,130,246,0.4)',
  borderRadius: '4px',
  color: '#93c5fd',
  cursor: 'pointer',
  fontSize: '0.65rem',
  padding: '3px 6px',
  display: 'flex',
  alignItems: 'center',
  gap: '3px',
};

export interface FieldRulesEditorProps {
  side: 'front' | 'back';
  index: number;
  field: FieldCoordinate;
  /** Every field key on the template, for the reference dropdowns. */
  availableFields: string[];
  onUpdate: (updatedProps: Partial<FieldCoordinate>) => void;
}

export default function FieldRulesEditor({
  side,
  index,
  field: f,
  availableFields,
  onUpdate,
}: FieldRulesEditorProps) {
  const visibleIf = f.visibleIf;
  const compute = f.compute;

  // A computed field may not reference another computed field — the resolver is
  // per-field and has no defined order for a chain. Keep those keys out of the
  // dropdown so the rule cannot be built in the first place.
  const referenceableFields = availableFields.filter(key => key !== f.field);

  const conditions: FieldCondition[] = visibleIf?.conditions ?? [];
  const parts: FieldComputePart[] = compute?.parts ?? [];

  const defaultRefField = referenceableFields[0] ?? f.field ?? '';

  const updateConditions = (next: FieldCondition[]) =>
    onUpdate({ visibleIf: { match: visibleIf?.match ?? 'all', conditions: next } });

  const updateParts = (next: FieldComputePart[]) => onUpdate({ compute: { parts: next } });

  return (
    <>
      {/* ── Visibility rule ─────────────────────────────────────────────── */}
      <div style={sectionStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <input
            type="checkbox"
            id={`visible-toggle-${side}-${index}`}
            checked={!!visibleIf}
            onChange={e =>
              e.target.checked
                ? updateConditions([{ field: defaultRefField, op: 'notEmpty' }])
                : onUpdate({ visibleIf: undefined })
            }
            style={{ cursor: 'pointer' }}
          />
          <label htmlFor={`visible-toggle-${side}-${index}`} style={labelStyle}>
            Only print this field when&hellip;
          </label>
        </div>

        {visibleIf && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            {conditions.length > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ fontSize: '0.65rem', color: '#94a3b8' }}>Match</span>
                <select
                  value={visibleIf.match ?? 'all'}
                  onChange={e =>
                    onUpdate({
                      visibleIf: { match: e.target.value as 'all' | 'any', conditions },
                    })
                  }
                  style={{ ...inputStyle, flex: 1 }}
                >
                  <option value="all">all of these</option>
                  <option value="any">any of these</option>
                </select>
              </div>
            )}

            {conditions.map((cond, ci) => {
              const operator = OPERATORS.find(o => o.value === cond.op);
              return (
                <div key={ci} style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                  <select
                    value={cond.field}
                    onChange={e => {
                      const next = [...conditions];
                      next[ci] = { ...cond, field: e.target.value };
                      updateConditions(next);
                    }}
                    style={{ ...inputStyle, flex: '1 1 30%' }}
                  >
                    {/* A rule may reference a key no longer on the template; keep it
                        selectable rather than silently rewriting the saved rule. */}
                    {!availableFields.includes(cond.field) && cond.field && (
                      <option value={cond.field}>{cond.field} (missing)</option>
                    )}
                    {availableFields.map(key => (
                      <option key={key} value={key}>{key}</option>
                    ))}
                  </select>

                  <select
                    value={cond.op}
                    onChange={e => {
                      const next = [...conditions];
                      next[ci] = { ...cond, op: e.target.value as FieldConditionOp };
                      updateConditions(next);
                    }}
                    style={{ ...inputStyle, flex: '1 1 30%' }}
                  >
                    {OPERATORS.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>

                  {operator?.needsValue && (
                    <input
                      type="text"
                      value={cond.value == null ? '' : String(cond.value)}
                      onChange={e => {
                        const next = [...conditions];
                        next[ci] = { ...cond, value: e.target.value };
                        updateConditions(next);
                      }}
                      placeholder="value"
                      style={{ ...inputStyle, flex: '1 1 25%' }}
                    />
                  )}

                  <button
                    type="button"
                    title="Remove condition"
                    aria-label="Remove condition"
                    onClick={() => {
                      const next = conditions.filter((_, i) => i !== ci);
                      if (next.length === 0) onUpdate({ visibleIf: undefined });
                      else updateConditions(next);
                    }}
                    style={iconButtonStyle}
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              );
            })}

            {conditions.length < MAX_RULE_ITEMS && (
              <button
                type="button"
                onClick={() => updateConditions([...conditions, { field: defaultRefField, op: 'notEmpty' }])}
                style={addButtonStyle}
              >
                <Plus size={10} /> Add condition
              </button>
            )}

            <div style={hintStyle}>
              Hidden fields leave their space empty — nothing below moves up.
            </div>
          </div>
        )}
      </div>

      {/* ── Computed value ──────────────────────────────────────────────── */}
      <div style={sectionStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <input
            type="checkbox"
            id={`compute-toggle-${side}-${index}`}
            checked={!!compute}
            onChange={e =>
              e.target.checked
                ? updateParts([{ kind: 'field', field: defaultRefField }])
                : onUpdate({ compute: undefined })
            }
            style={{ cursor: 'pointer' }}
          />
          <label htmlFor={`compute-toggle-${side}-${index}`} style={labelStyle}>
            Build the value from other fields
          </label>
        </div>

        {compute && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <div style={hintStyle}>
              This field no longer reads its own data column — the parts below
              produce its value, joined in order.
            </div>

            {parts.map((part, pi) => (
              <div key={pi} style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                <select
                  value={part.kind}
                  onChange={e => {
                    const next = [...parts];
                    next[pi] =
                      e.target.value === 'literal'
                        ? { kind: 'literal', text: '' }
                        : { kind: 'field', field: defaultRefField };
                    updateParts(next);
                  }}
                  style={{ ...inputStyle, flex: '0 0 62px' }}
                >
                  <option value="field">Field</option>
                  <option value="literal">Text</option>
                </select>

                {part.kind === 'field' ? (
                  <>
                    <select
                      value={part.field ?? ''}
                      onChange={e => {
                        const next = [...parts];
                        next[pi] = { ...part, field: e.target.value };
                        updateParts(next);
                      }}
                      style={{ ...inputStyle, flex: '1 1 40%' }}
                    >
                      {!referenceableFields.includes(part.field ?? '') && part.field && (
                        <option value={part.field}>{part.field} (missing)</option>
                      )}
                      {referenceableFields.map(key => (
                        <option key={key} value={key}>{key}</option>
                      ))}
                    </select>
                    <select
                      value={part.transform ?? ''}
                      onChange={e => {
                        const next = [...parts];
                        const transform = e.target.value as '' | FieldComputeTransform;
                        next[pi] = { ...part, transform: transform || undefined };
                        updateParts(next);
                      }}
                      style={{ ...inputStyle, flex: '1 1 30%' }}
                    >
                      {TRANSFORMS.map(t => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </>
                ) : (
                  <input
                    type="text"
                    value={part.text ?? ''}
                    onChange={e => {
                      const next = [...parts];
                      next[pi] = { ...part, text: e.target.value };
                      updateParts(next);
                    }}
                    placeholder="literal text, e.g. a space"
                    style={{ ...inputStyle, flex: '1 1 70%' }}
                  />
                )}

                <button
                  type="button"
                  title="Remove part"
                  aria-label="Remove part"
                  onClick={() => {
                    const next = parts.filter((_, i) => i !== pi);
                    if (next.length === 0) onUpdate({ compute: undefined });
                    else updateParts(next);
                  }}
                  style={iconButtonStyle}
                >
                  <Trash2 size={11} />
                </button>
              </div>
            ))}

            {parts.length < MAX_RULE_ITEMS && (
              <div style={{ display: 'flex', gap: '4px' }}>
                <button
                  type="button"
                  onClick={() => updateParts([...parts, { kind: 'field', field: defaultRefField }])}
                  style={addButtonStyle}
                >
                  <Plus size={10} /> Field
                </button>
                <button
                  type="button"
                  onClick={() => updateParts([...parts, { kind: 'literal', text: ' ' }])}
                  style={addButtonStyle}
                >
                  <Plus size={10} /> Text
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
