import type { MenuItem } from './menu';

/** Chosen quantities: group index → option id → quantity. */
export type Selection = Record<number, Record<string, number>>;

const sum = (values: Record<string, number> = {}) => Object.values(values).reduce((a, b) => a + b, 0);

/** Default choice for each group: the venue's default, else the only free option. */
export function defaultSelection(item: MenuItem): Selection {
  const sel: Selection = {};
  item.groups.forEach((g, i) => {
    if (g.kind === 'set') {
      sel[i] = Object.fromEntries(g.options.map((o) => [o.id, 1]));
      return;
    }
    const preset = g.options.filter((o) => o.defaultQty > 0);
    if (preset.length) {
      sel[i] = Object.fromEntries(preset.map((o) => [o.id, g.kind === 'one' ? 1 : o.defaultQty]));
      return;
    }
    const free = g.options.filter((o) => o.price === 0);
    sel[i] = g.kind === 'one' && g.required && free.length === 1 ? { [free[0].id]: 1 } : {};
  });
  return sel;
}

/** Index of the first required group that is still empty, or -1. */
export function firstMissing(item: MenuItem, sel: Selection) {
  return item.groups.findIndex((g, i) => g.required && g.kind !== 'set' && sum(sel[i]) < Math.max(1, g.min));
}

export function unitPrice(item: MenuItem, sel: Selection) {
  let price = item.price;
  item.groups.forEach((g, i) => {
    if (g.kind === 'set') return;
    for (const o of g.options) price += o.price * (sel[i]?.[o.id] ?? 0);
  });
  return price;
}

export function selectionText(item: MenuItem, sel: Selection) {
  const parts: string[] = [];
  item.groups.forEach((g, i) => {
    if (g.kind === 'set') return;
    for (const o of g.options) {
      const q = sel[i]?.[o.id];
      if (q) parts.push(q > 1 ? `${o.name} ×${q}` : o.name);
    }
  });
  return parts.join(' · ');
}

export function pickOption(sel: Selection, item: MenuItem, groupIndex: number, optionId: string): Selection {
  const g = item.groups[groupIndex];
  const current = { ...sel[groupIndex] };
  if (g.kind === 'one') {
    return { ...sel, [groupIndex]: current[optionId] && !g.required ? {} : { [optionId]: 1 } };
  }
  if (sum(current) >= g.max) return sel;
  current[optionId] = (current[optionId] ?? 0) + 1;
  return { ...sel, [groupIndex]: current };
}

export function dropOption(sel: Selection, groupIndex: number, optionId: string): Selection {
  const current = { ...sel[groupIndex] };
  current[optionId] = Math.max(0, (current[optionId] ?? 0) - 1);
  return { ...sel, [groupIndex]: current };
}
