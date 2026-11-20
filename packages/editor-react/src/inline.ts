import { selected, preserve } from './formatting.js';
// Private, selection-scoped DOM operations. No placeholder text enters the document.
const inlineTags = /^(?:A|SPAN|STRONG|B|EM|I|U|S|STRIKE|CODE|SUB|SUP|FONT)$/;
/** Selector matching the elements that carry a toolbar-managed mark. */
export const markSelector = (mark: NonNullable<InlineEdit['mark']>) =>
  mark === 's' ? 's,strike' : mark;
export function ancestor(node: Node, root: HTMLElement, selector: string): HTMLElement | null {
  const element = node.nodeType === 1 ? (node as HTMLElement) : node.parentElement;
  const found = element?.closest<HTMLElement>(selector);
  return found && root.contains(found) ? found : null;
}
function isolate(text: Text, root: HTMLElement) {
  let node: Node = text;
  while (
    node.parentElement &&
    node.parentElement !== root &&
    inlineTags.test(node.parentElement.tagName)
  ) {
    const parent = node.parentElement;
    const before = parent.cloneNode(false);
    const after = parent.cloneNode(false);
    while (parent.firstChild && parent.firstChild !== node) before.appendChild(parent.firstChild);
    while (node.nextSibling) after.appendChild(node.nextSibling);
    if (before.hasChildNodes()) parent.before(before);
    if (after.hasChildNodes()) parent.after(after);
    node = parent;
  }
}
export type InlineEdit = {
  mark?: 's' | 'code' | 'sub' | 'sup';
  enabled?: boolean;
  property?: 'color' | 'background-color';
  value?: string;
  clear?: boolean;
  href?: string | null;
};
export function editInline(root: HTMLElement, range: Range, edit: InlineEdit) {
  const doc = root.ownerDocument;
  const leaves = selectedLeaves(root, range);
  const selected: Text[] = [];
  for (let text of leaves) {
    const end = text === range.endContainer ? range.endOffset : text.length;
    const start = text === range.startContainer ? range.startOffset : 0;
    if (end < text.length) text.splitText(end);
    if (start) text = text.splitText(start);
    if (text.length) selected.push(text);
  }
  const removeMark =
    edit.enabled === false ||
    (edit.enabled !== true &&
      !!edit.mark &&
      selected.length > 0 &&
      selected.every((text) => ancestor(text, root, markSelector(edit.mark!))));
  for (const text of selected) {
    isolate(text, root);
    let element = text.parentElement;
    while (element && element !== root && inlineTags.test(element.tagName)) {
      const parent = element.parentElement;
      if (edit.href && element.tagName === 'A') element.setAttribute('href', edit.href);
      else if (
        (edit.clear && element.tagName !== 'A') ||
        (edit.mark &&
          (element.tagName.toLowerCase() === edit.mark ||
            (edit.mark === 's' && element.tagName === 'STRIKE') ||
            // Text is either subscript or superscript, never both.
            (edit.mark === 'sub' && element.tagName === 'SUP') ||
            (edit.mark === 'sup' && element.tagName === 'SUB'))) ||
        (edit.href !== undefined && element.tagName === 'A')
      ) {
        if (
          edit.href !== undefined &&
          element.tagName === 'A' &&
          (element.hasAttribute('style') || element.hasAttribute('class'))
        ) {
          const presentation = doc.createElement('span');
          for (const attribute of ['style', 'class'])
            if (element.hasAttribute(attribute))
              presentation.setAttribute(attribute, element.getAttribute(attribute)!);
          presentation.append(...element.childNodes);
          element.replaceWith(presentation);
        } else element.replaceWith(...element.childNodes);
      } else if (edit.property) {
        element.style.removeProperty(edit.property);
        if (!element.getAttribute('style')) element.removeAttribute('style');
      }
      if (edit.clear && element.tagName === 'A') {
        element.removeAttribute('style');
        element.removeAttribute('class');
      }
      element = parent;
    }
    let wrapper: HTMLElement | null = null;
    if (edit.mark && !removeMark) wrapper = doc.createElement(edit.mark);
    if (edit.property && edit.value) {
      wrapper = doc.createElement('span');
      wrapper.style.setProperty(edit.property, edit.value);
    }
    if (edit.href && !ancestor(text, root, 'a')) {
      wrapper = doc.createElement('a');
      wrapper.setAttribute('href', edit.href);
    }
    if (wrapper) {
      text.before(wrapper);
      wrapper.append(text);
    }
  }
  for (const element of Array.from(
    root.querySelectorAll<HTMLElement>('a,span,strong,b,em,i,u,s,strike,code,sub,sup,font'),
  ).reverse()) {
    if (!element.textContent && !element.querySelector('br')) element.remove();
  }
  if (selected.length) {
    range.setStart(selected[0]!, 0);
    const last = selected[selected.length - 1]!;
    range.setEnd(last, last.length);
  }
}
export function alignBlocks(root: HTMLElement, range: Range, alignment: string) {
  preserve(range, () => {
    for (const item of Array.from(root.querySelectorAll('li'))) {
      if (!item.querySelector('p,h1,h2,h3,h4,h5,h6,ul,ol')) continue;
      let run: Node[] = [];
      const flush = () => {
        if (run.some((node) => node.nodeType !== 8 && selected(range, node))) {
          const paragraph = root.ownerDocument.createElement('p');
          item.insertBefore(paragraph, run[0]!);
          paragraph.append(...run);
          paragraph.style.textAlign = alignment;
        }
        run = [];
      };
      for (const child of Array.from(item.childNodes)) {
        if (/^(?:P|H[1-6]|UL|OL|DIV)$/.test(child.nodeName)) flush();
        else run.push(child);
      }
      flush();
    }
    for (const block of Array.from(
      root.querySelectorAll<HTMLElement>('p,h1,h2,h3,h4,h5,h6,li,div'),
    )) {
      if (block.querySelector('p,h1,h2,h3,h4,h5,h6,li,div,ul,ol')) continue;
      if (selected(range, block)) block.style.textAlign = alignment;
    }
  });
}

export function selectedLeaves(root: HTMLElement, range: Range): Text[] {
  const walker = root.ownerDocument.createTreeWalker(root, 4);
  const leaves: Text[] = [];
  let node: Node | null;
  while ((node = walker.nextNode()))
    if (node.textContent && selected(range, node)) leaves.push(node as Text);
  return leaves;
}
export function markActive(root: HTMLElement, range: Range, selector: string) {
  if (range.collapsed) return !!ancestor(range.startContainer, root, selector);
  const leaves = selectedLeaves(root, range);
  return !!leaves.length && leaves.every((leaf) => ancestor(leaf, root, selector));
}
export function alignmentState(root: HTMLElement, range: Range, classPrefix?: string) {
  const blocks = new Set<HTMLElement>();
  if (range.collapsed) {
    const block = ancestor(range.startContainer, root, 'p,h1,h2,h3,h4,h5,h6,li,div');
    if (block) blocks.add(block);
  } else
    for (const leaf of selectedLeaves(root, range)) {
      const block = ancestor(leaf, root, 'p,h1,h2,h3,h4,h5,h6,li,div');
      if (block) blocks.add(block);
    }
  for (const block of Array.from(root.querySelectorAll<HTMLElement>('p,h1,h2,h3,h4,h5,h6,li,div')))
    if (!block.querySelector('p,h1,h2,h3,h4,h5,h6,li,div,ul,ol') && selected(range, block))
      blocks.add(block);
  const values = [...blocks].map((block) => {
    // A strict profile stores alignment as a class; read it without depending on loaded CSS.
    if (classPrefix)
      return (
        Array.from(block.classList)
          .find((name) => name.startsWith(classPrefix))
          ?.slice(classPrefix.length) ?? 'left'
      );
    const value = root.ownerDocument.defaultView?.getComputedStyle(block).textAlign;
    return !value || value === 'start' ? 'left' : value === 'end' ? 'right' : value;
  });
  return values.length && values.every((value) => value === values[0]) ? values[0]! : '';
}
export function unlinkAnchor(anchor: HTMLElement) {
  if (anchor.hasAttribute('style') || anchor.hasAttribute('class')) {
    const span = anchor.ownerDocument.createElement('span');
    for (const attribute of ['style', 'class'])
      if (anchor.hasAttribute(attribute))
        span.setAttribute(attribute, anchor.getAttribute(attribute)!);
    span.append(...anchor.childNodes);
    anchor.replaceWith(span);
  } else anchor.replaceWith(...anchor.childNodes);
}
/** Profile alignment: one registered class per selected text block; choosing it again clears it. */
export function alignBlocksByClass(
  root: HTMLElement,
  range: Range,
  classPrefix: string,
  alignment: string,
) {
  const blocks = Array.from(root.querySelectorAll<HTMLElement>('p,h2,h3,h4,li')).filter(
    (block) => !block.querySelector('p,h2,h3,h4,li,ul,ol') && selected(range, block),
  );
  if (!blocks.length) {
    const block = ancestor(range.startContainer, root, 'p,h2,h3,h4,li');
    if (block) blocks.push(block);
  }
  const target = classPrefix + alignment;
  const clear = blocks.length > 0 && blocks.every((block) => block.classList.contains(target));
  preserve(range, () => {
    for (const block of blocks) {
      for (const name of Array.from(block.classList))
        if (name.startsWith(classPrefix)) block.classList.remove(name);
      if (!clear) block.classList.add(target);
      if (!block.classList.length) block.removeAttribute('class');
    }
  });
}
