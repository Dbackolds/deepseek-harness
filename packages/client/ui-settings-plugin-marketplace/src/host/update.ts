/** Resolve which profile dependencies /update may touch. */

export function resolveUpdateTarget(
  dependencies: readonly string[],
  rawInput: string,
): { readonly kind: 'all' } | { readonly kind: 'one'; readonly name: string } | { readonly kind: 'none'; readonly query: string } | { readonly kind: 'ambiguous'; readonly matches: readonly string[] } {
  const query = rawInput.trim().toLocaleLowerCase()
  if (query.length === 0) return { kind: 'all' }
  const exact = dependencies.filter(name => name.toLocaleLowerCase() === query)
  const onlyExact = exact[0]
  if (exact.length === 1 && onlyExact !== undefined) return { kind: 'one', name: onlyExact }
  if (exact.length > 1) return { kind: 'ambiguous', matches: exact }
  return { kind: 'none', query: rawInput.trim() }
}
