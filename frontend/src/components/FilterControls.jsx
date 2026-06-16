import { Check, ChevronDown, Search, X } from 'lucide-react';
import { Children, isValidElement, useEffect, useId, useMemo, useRef, useState } from 'react';

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

export function ClearableSelect({ value = '', onChange, label, children, className = '' }) {
  const name = label || '筛选条件';
  const listId = useId();
  const rootRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [popoverStyle, setPopoverStyle] = useState({});
  const options = useMemo(() => Children.toArray(children).filter(isValidElement).map((child) => {
    const optionValue = child.props.value ?? getOptionLabel(child.props.children);
    return { value: String(optionValue), label: getOptionLabel(child.props.children), disabled: Boolean(child.props.disabled) };
  }), [children]);
  const emptyOption = options.find((item) => item.value === '');
  const selectableOptions = options.filter((item) => item.value !== '' && !item.disabled);
  const selected = options.find((item) => item.value === String(value));
  const placeholder = emptyOption?.label || name;
  const filteredOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return selectableOptions;
    return selectableOptions.filter((item) => item.label.toLowerCase().includes(normalizedQuery) || item.value.toLowerCase().includes(normalizedQuery));
  }, [query, selectableOptions]);

  useEffect(() => {
    if (!open) return undefined;
    setQuery('');
    function updatePopoverPosition() {
      if (!rootRef.current) return;
      const rect = rootRef.current.getBoundingClientRect();
      const margin = 12;
      const width = Math.min(Math.max(rect.width, 220), window.innerWidth - margin * 2, 320);
      const left = Math.min(Math.max(rect.left, margin), window.innerWidth - width - margin);
      setPopoverStyle({ top: rect.bottom + 8, left, width });
    }
    function closeOnOutside(event) {
      if (rootRef.current && !rootRef.current.contains(event.target)) setOpen(false);
    }
    const frame = window.requestAnimationFrame(updatePopoverPosition);
    window.addEventListener('resize', updatePopoverPosition);
    document.addEventListener('scroll', updatePopoverPosition, true);
    document.addEventListener('mousedown', closeOnOutside);
    document.addEventListener('touchstart', closeOnOutside);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', updatePopoverPosition);
      document.removeEventListener('scroll', updatePopoverPosition, true);
      document.removeEventListener('mousedown', closeOnOutside);
      document.removeEventListener('touchstart', closeOnOutside);
    };
  }, [open]);

  function choose(nextValue) {
    onChange(nextValue);
    setOpen(false);
  }

  return (
    <div className={`filter-field filter-select searchable-select ${open ? 'open' : ''} ${className}`} ref={rootRef} onKeyDown={(event) => { if (event.key === 'Escape') setOpen(false); }}>
      <button type="button" className="select-trigger" aria-label={name} aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? listId : undefined} onClick={() => setOpen((current) => !current)}>
        <span className={value ? '' : 'placeholder'}>{selected?.label || placeholder}</span>
        <ChevronDown size={15} />
      </button>
      {value && <button type="button" className="filter-clear-button" onClick={() => onChange('')} aria-label={`清空${name}`}><X size={14} /></button>}
      {open && (
        <div className="select-popover" style={popoverStyle}>
          <label className="select-search">
            <Search size={15} />
            <input aria-label={`搜索${name}`} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`搜索${name}`} autoFocus />
          </label>
          <div className="select-option-list" id={listId} role="listbox" aria-label={`${name}选项`}>
            <button type="button" className={`select-option ${!value ? 'selected' : ''}`} role="option" aria-selected={!value} onClick={() => choose('')}>
              <span>{placeholder}</span>
              {!value && <Check size={15} />}
            </button>
            {filteredOptions.map((item) => (
              <button key={item.value} type="button" className={`select-option ${String(value) === item.value ? 'selected' : ''}`} role="option" aria-selected={String(value) === item.value} onClick={() => choose(item.value)}>
                <span>{item.label}</span>
                {String(value) === item.value && <Check size={15} />}
              </button>
            ))}
            {!filteredOptions.length && <div className="select-empty">无匹配选项</div>}
          </div>
        </div>
      )}
    </div>
  );
}
