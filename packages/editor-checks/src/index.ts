/** Content-only review. No claim about page metadata or whole-site WCAG conformance. */
export type RuleStatus = 'passed' | 'failed' | 'manual-review' | 'not-evaluated';
export interface ContentIssue {
  readonly checker: 'accessibility' | 'seo';
  readonly ruleId: string;
  readonly message: string;
  /** JSON pointer, valid only for the reported session/revision. */
  readonly nodeId: string;
  readonly level: 'error' | 'warning';
  readonly status: Exclude<RuleStatus, 'passed'>;
  readonly standardReference?: string;
}
export interface CheckSnapshot {
  readonly sessionId: string;
  readonly revision: number;
  readonly document: unknown;
}
export interface RuleResult {
  readonly ruleId: string;
  readonly status: RuleStatus;
}
export interface CheckReport {
  readonly sessionId: string;
  readonly revision: number;
  readonly status: 'complete' | 'cancelled' | 'failed';
  readonly rules: readonly RuleResult[];
  readonly issues: readonly ContentIssue[];
}
export interface CheckOptions {
  readonly signal?: AbortSignal;
  /** The host must inspect ALL declared themes/responsive variants, not only the active theme. */
  readonly contrast?: (context: {
    readonly tokenClasses: readonly string[];
    readonly signal?: AbortSignal;
  }) => Promise<readonly { readonly variant: string; readonly status: RuleStatus }[]>;
}
const object = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
function abortable<T>(work: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return work;
  return new Promise((resolve, reject) => {
    const cleanup = () => signal.removeEventListener('abort', cancel);
    const cancel = () => {
      cleanup();
      reject(new Error('CHECK_CANCELLED'));
    };
    signal.addEventListener('abort', cancel, { once: true });
    work.then(
      (value) => {
        cleanup();
        resolve(value);
      },
      (error) => {
        cleanup();
        reject(error);
      },
    );
    if (signal.aborted) cancel();
  });
}
const ruleIds = [
  'semantic-structure',
  'heading-structure',
  'descriptive-links',
  'image-alternatives',
  'contrast',
  'color-meaning',
] as const;
export function isCheckReportCurrent(report: CheckReport, snapshot: CheckSnapshot): boolean {
  return report.sessionId === snapshot.sessionId && report.revision === snapshot.revision;
}
export async function runContentChecks(
  snapshot: CheckSnapshot,
  options: CheckOptions = {},
): Promise<CheckReport> {
  const sessionId = snapshot.sessionId,
    revision = snapshot.revision;
  const rules = new Map<string, RuleStatus>(ruleIds.map((id) => [id, 'not-evaluated']));
  const issues: ContentIssue[] = [];
  const report = (status: CheckReport['status']): CheckReport =>
    Object.freeze({
      sessionId,
      revision,
      status,
      rules: Object.freeze([...rules].map(([ruleId, status]) => Object.freeze({ ruleId, status }))),
      issues: Object.freeze(issues.map((issue) => Object.freeze(issue))),
    });
  if (options.signal?.aborted) return report('cancelled');
  // Isolate the input before the first asynchronous callback.
  let document: unknown;
  try {
    document = JSON.parse(JSON.stringify(snapshot.document)) as unknown;
  } catch {
    return report('failed');
  }
  const classes = new Set<string>();
  const seen = new Set<unknown>();
  let count = 0,
    previousHeading = 0,
    invalid = false;
  rules.set('semantic-structure', 'passed');
  rules.set('heading-structure', 'passed');
  rules.set('descriptive-links', 'passed');
  function issue(
    ruleId: string,
    nodeId: string,
    message: string,
    status: ContentIssue['status'] = 'failed',
    reference?: string,
  ) {
    const prior = rules.get(ruleId);
    if (ruleId !== 'contrast' && (prior !== 'failed' || status === 'failed'))
      rules.set(ruleId, status);
    for (const checker of ruleId === 'contrast' || ruleId === 'color-meaning'
      ? (['accessibility'] as const)
      : (['accessibility', 'seo'] as const))
      issues.push({
        checker,
        ruleId,
        nodeId,
        message,
        status,
        level: status === 'failed' ? 'error' : 'warning',
        ...(reference ? { standardReference: reference } : {}),
      });
  }
  const text = (node: Record<string, unknown>): string => {
    let output = '',
      visited = 0;
    const pending: [Record<string, unknown>, number][] = [[node, 0]];
    while (pending.length) {
      const [current, depth] = pending.pop()!;
      if (++visited > 10000 || depth > 64) {
        invalid = true;
        break;
      }
      if (typeof current.text === 'string') output += current.text;
      else if (Array.isArray(current.children))
        for (const child of [...current.children].reverse())
          if (object(child)) pending.push([child, depth + 1]);
    }
    return output;
  };
  function visit(node: unknown, path: string, depth: number, allowed: readonly string[]): void {
    if (
      ++count > 10000 ||
      depth > 64 ||
      !object(node) ||
      seen.has(node) ||
      typeof node.type !== 'string' ||
      !allowed.includes(node.type)
    ) {
      invalid = true;
      return;
    }
    seen.add(node);
    if (typeof node.className === 'string')
      node.className
        .split(/\s+/)
        .filter(Boolean)
        .forEach((c) => classes.add(c));
    if (node.type === 'heading') {
      const level = Number(node.level);
      if (!Number.isInteger(level) || level < 1 || level > 6) {
        invalid = true;
        return;
      }
      if (!text(node).trim())
        issue(
          'heading-structure',
          path,
          'Heading has no accessible text',
          'failed',
          'WCAG 2.2 2.4.6',
        );
      if (previousHeading && level > previousHeading + 1)
        issue('heading-structure', path, 'Heading skips a level', 'failed', 'WCAG 2.2 1.3.1');
      previousHeading = level;
    }
    if (node.type === 'text' && typeof node.text !== 'string') {
      invalid = true;
      return;
    }
    if (node.type === 'link') {
      const label = text(node).trim();
      if (!label)
        issue('descriptive-links', path, 'Link has no accessible name', 'failed', 'WCAG 2.2 2.4.4');
      else if (/^(?:click here|read more|more|ที่นี่|คลิกที่นี่|อ่านเพิ่มเติม)$/iu.test(label))
        issue(
          'descriptive-links',
          path,
          'Review the link purpose in its surrounding context',
          'manual-review',
          'WCAG 2.2 2.4.4',
        );
      if (typeof node.href !== 'string' || !node.href.trim()) invalid = true;
    }
    if (['document', 'paragraph', 'heading', 'link', 'list-item', 'list'].includes(node.type)) {
      const children = node.type === 'list' ? node.items : node.children;
      if (!Array.isArray(children)) {
        invalid = true;
        return;
      }
      children.forEach((child, i) =>
        visit(
          child,
          `${path}/${node.type === 'list' ? 'items' : 'children'}/${i}`,
          depth + 1,
          node.type === 'list'
            ? ['list-item']
            : ['paragraph', 'heading', 'link'].includes(node.type as string)
              ? ['text', 'link', 'hard-break']
              : ['paragraph', 'heading', 'list'],
        ),
      );
    }
  }
  visit(document, '', 0, ['document']);
  if (invalid) {
    issue('semantic-structure', '', 'Document is outside the supported model');
    return report('failed');
  }
  issue(
    'color-meaning',
    '',
    'A person must verify that meaning does not depend on color alone',
    'manual-review',
    'WCAG 2.2 1.4.1',
  );
  // No image node exists in the v1 text model. Do not certify unsupported image content.
  issue(
    'image-alternatives',
    '',
    'Image content is outside this model version',
    'not-evaluated',
    'WCAG 2.2 1.1.1',
  );
  if (options.contrast) {
    try {
      const results = await abortable(
        options.contrast({
          tokenClasses: Object.freeze([...classes].sort()),
          ...(options.signal ? { signal: options.signal } : {}),
        }),
        options.signal,
      );
      if (options.signal?.aborted) return report('cancelled');
      if (
        results.length &&
        results.every(
          (r) =>
            r.variant && ['passed', 'failed', 'manual-review', 'not-evaluated'].includes(r.status),
        ) &&
        new Set(results.map((r) => r.variant)).size === results.length
      ) {
        const status = results.some((r) => r.status === 'failed')
          ? 'failed'
          : results.some((r) => r.status === 'not-evaluated')
            ? 'not-evaluated'
            : results.some((r) => r.status === 'manual-review')
              ? 'manual-review'
              : 'passed';
        rules.set('contrast', status);
        for (const result of results)
          if (result.status !== 'passed')
            issue(
              'contrast',
              '',
              `Contrast review: ${result.variant}`,
              result.status,
              'WCAG 2.2 1.4.3',
            );
      } else
        issue(
          'contrast',
          '',
          'No complete variant results were supplied',
          'not-evaluated',
          'WCAG 2.2 1.4.3',
        );
    } catch {
      if (options.signal?.aborted) return report('cancelled');
      return report('failed');
    }
  } else
    issue(
      'contrast',
      '',
      'Theme and responsive contrast values were not supplied',
      'not-evaluated',
      'WCAG 2.2 1.4.3',
    );
  return report(options.signal?.aborted ? 'cancelled' : 'complete');
}
