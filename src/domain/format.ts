export const money = (n: number) => `${n.toLocaleString('ru-RU').replace(/\s/g, ' ')} ₸`;

/** Russian plural: 1 позиция, 2 позиции, 5 позиций. */
export function plural(n: number, one: string, few: string, many: string) {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b === 1) return one;
  if (b >= 2 && b <= 4) return few;
  return many;
}
