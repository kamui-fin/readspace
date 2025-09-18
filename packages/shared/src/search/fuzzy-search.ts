export function fuzzySearch<T>(
  items: T[],
  term: string,
  keys: (keyof T)[],
): T[] {
  if (!term) return items;
  const lowerTerm = term.toLowerCase();
  return items.filter((item) =>
    keys.some((key) => {
      const value = item[key];
      if (typeof value === "string") {
        return value.toLowerCase().includes(lowerTerm);
      }
      return false;
    }),
  );
}
