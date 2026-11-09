/** Stable content classes are shared by authoring preview and the public website. */
export interface ContentToken {
  readonly id: string;
  readonly kind: 'typography' | 'text' | 'background' | 'font';
  readonly values: Readonly<
    Record<
      string,
      Readonly<
        Partial<
          Record<
            | 'fontSize'
            | 'lineHeight'
            | 'fontWeight'
            | 'fontFamily'
            | 'letterSpacing'
            | 'color'
            | 'backgroundColor',
            string
          >
        >
      >
    >
  >;
}
export interface ContentTheme {
  readonly classPrefix?: string;
  readonly scopeClass?: string;
  /** Mobile first. base is implicit; named widths must be unique. */
  readonly breakpoints?: Readonly<Record<string, number>>;
  readonly tokens: readonly ContentToken[];
}
export interface ContentStylesheet {
  readonly version: 1;
  readonly classPrefix: string;
  readonly scopeClass: string;
  readonly tokenClasses: readonly string[];
  readonly cssText: string;
}
const properties = {
  fontSize: 'font-size',
  lineHeight: 'line-height',
  fontWeight: 'font-weight',
  fontFamily: 'font-family',
  letterSpacing: 'letter-spacing',
  color: 'color',
  backgroundColor: 'background-color',
} as const;
const kinds = {
  typography: ['fontSize', 'lineHeight', 'fontWeight', 'letterSpacing', 'fontFamily'],
  text: ['color'],
  background: ['backgroundColor'],
  font: ['fontFamily'],
} as const;
function safeValue(key: keyof typeof properties, value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 256) return false;
  if (/^var\(--[a-zA-Z][a-zA-Z0-9_-]*\)$/.test(value)) return true;
  if (key === 'color' || key === 'backgroundColor')
    return /^(?:#[0-9a-fA-F]{3,4}|#[0-9a-fA-F]{6}|#[0-9a-fA-F]{8}|transparent|currentColor)$/.test(
      value,
    );
  if (key === 'fontFamily')
    return /^(?:[A-Za-z][A-Za-z0-9 -]*)(?:,\s*[A-Za-z][A-Za-z0-9 -]*)*$/.test(value);
  if (key === 'fontWeight') return /^(?:[1-9]00|normal|bold)$/.test(value);
  if (key === 'lineHeight') return /^(?:normal|[0-9]+(?:\.[0-9]+)?(?:rem|em|px|%)?)$/.test(value);
  return /^-?[0-9]+(?:\.[0-9]+)?(?:rem|em|px)$/.test(value);
}
export function createContentStylesheet(theme: ContentTheme): ContentStylesheet {
  const prefix = theme.classPrefix ?? 'rte-',
    scope = theme.scopeClass ?? 'inkforge-content';
  if (!/^[A-Za-z][A-Za-z0-9_-]*-$/.test(prefix) || !/^[A-Za-z][A-Za-z0-9_-]*$/.test(scope))
    throw new Error('Invalid content namespace');
  const breakpoints = Object.entries(theme.breakpoints ?? {}).sort(([, a], [, b]) => a - b);
  if (
    breakpoints.length > 8 ||
    new Set(breakpoints.map(([, v]) => v)).size !== breakpoints.length ||
    breakpoints.some(
      ([key, v]) =>
        key === 'base' ||
        !/^[a-z][a-z0-9-]*$/.test(key) ||
        !Number.isSafeInteger(v) ||
        v < 1 ||
        v > 10000,
    )
  )
    throw new Error('Invalid content breakpoints');
  if (theme.tokens.length > 256) throw new Error('Content token budget exceeded');
  const classes: string[] = [],
    rules = new Map<string, string[]>();
  for (const token of theme.tokens) {
    if (!Object.hasOwn(kinds, token.kind) || !/^[a-z][a-z0-9-]*$/.test(token.id))
      throw new Error('Invalid content token');
    const name =
      prefix +
      { typography: 'typo', text: 'text', background: 'bg', font: 'font' }[token.kind] +
      '-' +
      token.id;
    if (classes.includes(name)) throw new Error('Duplicate content token');
    classes.push(name);
    if (!Object.hasOwn(token.values, 'base')) throw new Error('Every token needs a base variant');
    for (const [variant, values] of Object.entries(token.values)) {
      if (variant !== 'base' && !breakpoints.some(([key]) => key === variant))
        throw new Error('Unknown responsive variant');
      const declarations = Object.entries(values)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, value]) => {
          if (
            !(kinds[token.kind] as readonly string[]).includes(key) ||
            !safeValue(key as keyof typeof properties, value)
          )
            throw new Error('Unsupported content token value');
          return properties[key as keyof typeof properties] + ':' + value + ';';
        })
        .join('');
      if (!declarations) throw new Error('Empty content token');
      const list = rules.get(variant) ?? [];
      list.push(`.${scope} .${name},.${scope}.${name}{${declarations}}`);
      rules.set(variant, list);
    }
  }
  let cssText = (rules.get('base') ?? []).sort().join('\n');
  for (const [variant, width] of breakpoints)
    if (rules.has(variant))
      cssText += `\n@media (min-width:${width}px){${rules.get(variant)!.sort().join('\n')}}`;
  return Object.freeze({
    version: 1,
    classPrefix: prefix,
    scopeClass: scope,
    tokenClasses: Object.freeze(classes.sort()),
    cssText,
  });
}
/** An opt-in example only. The CMS host owns the actual theme and token registry. */
export const defaultContentStylesheet = createContentStylesheet({
  tokens: [
    { kind: 'typography', id: 'body', values: { base: { fontSize: '1rem', lineHeight: '1.6' } } },
    {
      kind: 'typography',
      id: 'lead',
      values: { base: { fontSize: '1.25rem', lineHeight: '1.6' } },
    },
    { kind: 'text', id: 'brand', values: { base: { color: 'var(--content-brand)' } } },
  ],
});
