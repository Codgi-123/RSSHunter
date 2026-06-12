import { splitTags } from '../utils/format';

export default function TagList({ tags = [], empty = '-' }) {
  const items = splitTags(tags);
  if (!items.length) return <span className="muted-text">{empty}</span>;
  return <div className="tag-list">{items.map((tag) => <span className="tag-chip" key={tag}>{tag}</span>)}</div>;
}
