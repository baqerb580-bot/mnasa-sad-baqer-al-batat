'use client';
import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const cache = {};
const listeners = {};

export function useCustomFields(entity) {
  const [fields, setFields] = useState(cache[entity] || []);
  useEffect(() => {
    if (!entity) return;
    let alive = true;
    const fetchOnce = async () => {
      try {
        const r = await fetch(`/api/custom-fields/${entity}`);
        const d = await r.json();
        if (alive && Array.isArray(d?.fields)) {
          cache[entity] = d.fields;
          setFields(d.fields);
          (listeners[entity] || []).forEach(fn => fn(d.fields));
        }
      } catch {}
    };
    fetchOnce();
    // Register
    listeners[entity] = listeners[entity] || [];
    const cb = (f) => setFields(f);
    listeners[entity].push(cb);
    return () => {
      alive = false;
      listeners[entity] = (listeners[entity] || []).filter(x => x !== cb);
    };
  }, [entity]);
  return fields;
}

/**
 * Renders a single custom field input.
 */
export function CustomFieldInput({ field, value, onChange }) {
  const v = value ?? field.default ?? '';
  const set = (val) => onChange(field.key, val);

  if (field.visible === false) return null;

  let input = null;
  switch (field.type) {
    case 'textarea':
      input = <Textarea value={v} onChange={e => set(e.target.value)} placeholder={field.placeholder || ''} className="bg-input/30 border-gold/20 h-20" />;
      break;
    case 'number':
    case 'currency':
    case 'percent':
      input = <Input type="number" value={v} onChange={e => set(e.target.value === '' ? '' : Number(e.target.value))} placeholder={field.placeholder || ''} className="bg-input/30 border-gold/20" />;
      break;
    case 'date':
      input = <Input type="date" value={v || ''} onChange={e => set(e.target.value)} className="bg-input/30 border-gold/20" />;
      break;
    case 'datetime':
      input = <Input type="datetime-local" value={v || ''} onChange={e => set(e.target.value)} className="bg-input/30 border-gold/20" />;
      break;
    case 'boolean':
      input = (
        <label className="flex items-center gap-2 cursor-pointer p-2 rounded-lg bg-input/30 border border-gold/20">
          <input type="checkbox" checked={!!v} onChange={e => set(e.target.checked)} className="accent-gold w-4 h-4" />
          <span className="text-sm">{v ? 'نعم' : 'لا'}</span>
        </label>
      );
      break;
    case 'select':
      input = (
        <Select value={String(v || '')} onValueChange={set}>
          <SelectTrigger className="bg-input/30 border-gold/20"><SelectValue placeholder={field.placeholder || 'اختر...'} /></SelectTrigger>
          <SelectContent>
            {(field.options || []).map(opt => {
              const val = typeof opt === 'string' ? opt : opt.value;
              const lbl = typeof opt === 'string' ? opt : opt.label;
              return <SelectItem key={val} value={val}>{lbl}</SelectItem>;
            })}
          </SelectContent>
        </Select>
      );
      break;
    case 'multiselect':
      input = (
        <div className="space-y-1 p-2 rounded-lg bg-input/30 border border-gold/20 max-h-40 overflow-y-auto">
          {(field.options || []).map(opt => {
            const val = typeof opt === 'string' ? opt : opt.value;
            const lbl = typeof opt === 'string' ? opt : opt.label;
            const checked = Array.isArray(v) && v.includes(val);
            return (
              <label key={val} className="flex items-center gap-2 cursor-pointer text-xs">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={e => {
                    const arr = Array.isArray(v) ? [...v] : [];
                    if (e.target.checked) arr.push(val);
                    else { const i = arr.indexOf(val); if (i >= 0) arr.splice(i, 1); }
                    set(arr);
                  }}
                  className="accent-gold"
                />
                {lbl}
              </label>
            );
          })}
        </div>
      );
      break;
    case 'phone':
      input = <Input type="tel" value={v} onChange={e => set(e.target.value)} placeholder={field.placeholder || '07XX'} className="bg-input/30 border-gold/20 font-mono" dir="ltr" />;
      break;
    case 'email':
      input = <Input type="email" value={v} onChange={e => set(e.target.value)} placeholder={field.placeholder || 'name@domain.com'} className="bg-input/30 border-gold/20" dir="ltr" />;
      break;
    case 'url':
      input = <Input type="url" value={v} onChange={e => set(e.target.value)} placeholder={field.placeholder || 'https://...'} className="bg-input/30 border-gold/20" dir="ltr" />;
      break;
    default:
      input = <Input value={v} onChange={e => set(e.target.value)} placeholder={field.placeholder || ''} className="bg-input/30 border-gold/20" />;
  }

  return (
    <div>
      <Label className="text-xs">
        {field.label}
        {field.required && <span className="text-red-400 mr-1">*</span>}
      </Label>
      {input}
    </div>
  );
}

/**
 * Render all custom fields for an entity as a grid.
 * @param customFields - object with custom field values stored under record.customFields
 */
export function CustomFieldsGrid({ entity, customFields, onUpdate, columns = 2 }) {
  const fields = useCustomFields(entity).filter(f => f.visible !== false);
  if (fields.length === 0) return null;

  const handleChange = (key, val) => {
    onUpdate({ ...(customFields || {}), [key]: val });
  };

  return (
    <div className={`md:col-span-${columns} space-y-2`}>
      <div className="border-t border-gold-soft pt-2">
        <p className="text-[10px] font-bold text-violet-400 mb-2">🛠️ حقول مخصصة ({fields.length})</p>
        <div className={`grid grid-cols-1 md:grid-cols-${columns} gap-3`}>
          {fields.map(f => (
            <CustomFieldInput
              key={f.key}
              field={f}
              value={customFields?.[f.key]}
              onChange={handleChange}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Display custom field values read-only (e.g. on cards/details).
 */
export function CustomFieldsDisplay({ entity, customFields }) {
  const fields = useCustomFields(entity).filter(f => f.visible !== false);
  if (fields.length === 0 || !customFields || Object.keys(customFields).length === 0) return null;

  return (
    <div className="space-y-1 pt-2 border-t border-gold-soft">
      {fields.map(f => {
        const v = customFields[f.key];
        if (v === undefined || v === '' || v === null) return null;
        let display = v;
        if (f.type === 'boolean') display = v ? '✅' : '❌';
        else if (Array.isArray(v)) display = v.join(', ');
        else if (f.type === 'currency') display = `${Number(v).toLocaleString('en-US')} د.ع`;
        else if (f.type === 'percent') display = `${v}%`;
        return (
          <div key={f.key} className="flex justify-between text-[11px]">
            <span className="text-muted-foreground">{f.label}:</span>
            <span className="font-bold">{display}</span>
          </div>
        );
      })}
    </div>
  );
}
