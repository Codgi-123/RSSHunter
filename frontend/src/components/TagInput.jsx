import { X } from 'lucide-react';
import { useState } from 'react';
import { splitTags } from '../utils/format';

export default function TagInput({ value = [], onChange, placeholder = '输入标签后回车' }) {
  const tags = splitTags(value);
  const [draft, setDraft] = useState('');

  function commit(text = draft) {
    const nextTags = splitTags(text);
    if (!nextTags.length) return;
    const merged = [...tags];
    nextTags.forEach((tag) => {
      if (!merged.includes(tag)) merged.push(tag);
    });
    onChange(merged);
    setDraft('');
  }

  function remove(tag) {
    onChange(tags.filter((item) => item !== tag));
  }

  function handleKeyDown(event) {
    if (['Enter', 'Tab', ','].includes(event.key) || event.key === '，') {
      event.preventDefault();
      commit();
    }
    if (event.key === 'Backspace' && !draft && tags.length) {
      remove(tags[tags.length - 1]);
    }
  }

  return (
    <div className="tag-input-wrap">
      {tags.map((tag) => (
        <span className="tag-chip editable" key={tag}>
          {tag}
          <button type="button" className="tag-remove" aria-label={`移除标签 ${tag}`} onClick={() => remove(tag)}><X size={13} /></button>
        </span>
      ))}
      <input
        className="tag-input-field"
        aria-label="标签输入"
        value={draft}
        placeholder={tags.length ? '' : placeholder}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => commit()}
        onKeyDown={handleKeyDown}
        onPaste={(event) => {
          const text = event.clipboardData.getData('text');
          if (/[，,]/.test(text)) {
            event.preventDefault();
            commit(text);
          }
        }}
      />
    </div>
  );
}
