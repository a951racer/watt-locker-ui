export function computeTotalPages(totalItems: number, pageSize: number): number {
  if (totalItems <= 0 || pageSize <= 0) return 0;
  return Math.ceil(totalItems / pageSize);
}

export function getPageBounds(
  page: number,
  pageSize: number,
  totalItems: number
): { start: number; end: number } {
  const start = (page - 1) * pageSize;
  const end = Math.min(start + pageSize, totalItems);
  return { start, end };
}
