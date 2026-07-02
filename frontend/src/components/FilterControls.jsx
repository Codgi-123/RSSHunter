import * as Popover from '@radix-ui/react-popover';
import { Check, ChevronDown, Search, X } from 'lucide-react';
import { Children, isValidElement, useMemo, useState } from 'react';

export function ClearableInput({ value = '', onChange, placeholder, icon, label, className = '' }) {
  const name = label || placeholder || '筛选条件';
  return (
    <div className={`filter-field filter-input ${className}`}>
      <input aria-label={name} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
      {icon}
      {value && <button type="button" className="filter-clear-button" onClick={() => onChange('')} aria-label={`清空${name}`}><X size={14} /></button>}
    </div>
  );
}

function getOptionLabel(children) {
  return Children.toArray(children).map((item) => (typeof item === 'string' || typeof item === 'number' ? item : '')).join('');
}

export function ClearableSelect({ value = '', onChange, label, children, className = '', multiple = false }) {
  const name = label || '筛选条件';
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const options = useMemo(() => Children.toArray(children).filter(isValidElement).map((child) => {
    const optionValue = child.props.value ?? getOptionLabel(child.props.children);
    return { value: String(optionValue), label: getOptionLabel(child.props.children), disabled: Boolean(child.props.disabled) };
  }), [children]);
  const emptyOption = options.find((item) => item.value === '');
  const selectableOptions = options.filter((item) => item.value !== '' && !item.disabled);
  // ponytail: multi values are stored as a comma-joined string so URL/state/API plumbing is unchanged
  const selectedValues = multiple ? String(value).split(',').filter(Boolean) : [String(value)].filter(Boolean);
  const isChosen = (v) => selectedValues.includes(v);
  const selectedLabels = selectableOptions.filter((item) => isChosen(item.value)).map((item) => item.label);
  const placeholder = emptyOption?.label || name;
  const triggerLabel = selectedValues.length ? (multiple ? selectedLabels.join('、') : options.find((item) => item.value === String(value))?.label) : placeholder;
  const filteredOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return selectableOptions;
    return selectableOptions.filter((item) => item.label.toLowerCase().includes(normalizedQuery) || item.value.toLowerCase().includes(normalizedQuery));
  }, [query, selectableOptions]);

  function choose(nextValue) {
    if (!multiple) { onChange(nextValue); setOpen(false); return; }
    if (!nextValue) { onChange(''); return; }
    const next = isChosen(nextValue) ? selectedValues.filter((v) => v !== nextValue) : [...selectedValues, nextValue];
    onChange(next.join(','));
  }

  return (
    <Popover.Root open={open} onOpenChange={(next) => { setOpen(next); if (next) setQuery(''); }}>
      <div className={`filter-field filter-select searchable-select ${open ? 'open' : ''} ${className}`}>
        <Popover.Trigger asChild>
          <button type="button" className="select-trigger" aria-label={name}>
            <span className={selectedValues.length ? '' : 'placeholder'}>{triggerLabel}</span>
            <ChevronDown size={15} />
          </button>
        </Popover.Trigger>
        {selectedValues.length > 0 && <button type="button" className="filter-clear-button" onClick={() => onChange('')} aria-label={`清空${name}`}><X size={14} /></button>}
      </div>
      <Popover.Portal>
        <Popover.Content className="select-popover" align="start" sideOffset={8} role="listbox" aria-label={`${name}选项`}>
          <label className="select-search">
            <Search size={15} />
            <input aria-label={`搜索${name}`} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`搜索${name}`} autoFocus />
          </label>
          <div className="select-option-list">
            <button type="button" className={`select-option ${!selectedValues.length ? 'selected' : ''}`} role="option" aria-selected={!selectedValues.length} onClick={() => choose('')}>
              <span>{placeholder}</span>
              {!selectedValues.length && <Check size={15} />}
            </button>
            {filteredOptions.map((item) => (
              <button key={item.value} type="button" className={`select-option ${isChosen(item.value) ? 'selected' : ''}`} role="option" aria-selected={isChosen(item.value)} onClick={() => choose(item.value)}>
                <span>{item.label}</span>
                {isChosen(item.value) && <Check size={15} />}
              </button>
            ))}
            {!filteredOptions.length && <div className="select-empty">无匹配选项</div>}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
