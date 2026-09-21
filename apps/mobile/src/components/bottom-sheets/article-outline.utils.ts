import type { OutlineItem } from '@components/screens/article-reader/index';

export interface OutlineRow {
  item: OutlineItem;
  ancestors: string[];
  hasChildren: boolean;
}

export function buildOutlineRows(outline: OutlineItem[]): OutlineRow[] {
  const ancestors: OutlineItem[] = [];
  return outline.map((item, index) => {
    while (ancestors.length && ancestors[ancestors.length - 1].level >= item.level) {
      ancestors.pop();
    }
    const row = {
      item,
      ancestors: ancestors.map((parent) => parent.id),
      hasChildren: (outline[index + 1]?.level ?? 0) > item.level,
    };
    ancestors.push(item);
    return row;
  });
}
