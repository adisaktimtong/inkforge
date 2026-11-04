// Small DOM repairs keep the native adapter's supported block semantics consistent.
// The browser still owns text editing, inline commands and history.
export function selected(range: Range, element: Node): boolean {
  if (!range.intersectsNode(element)) return false;
  if (range.collapsed) return element.contains(range.startContainer);
  if (element.nodeType !== 3 && element.childNodes.length)
    return Array.from(element.childNodes).some((child) => selected(range, child));
  const contents = element.ownerDocument!.createRange();
  if (element.nodeType === 3) contents.selectNodeContents(element);
  else contents.selectNode(element);
  return (
    range.compareBoundaryPoints(1, contents) > 0 && range.compareBoundaryPoints(3, contents) < 0
  );
}

function selectedItems(root: HTMLElement, range: Range) {
  const items = Array.from(root.querySelectorAll('li')).filter((item) => {
    if (range.collapsed)
      return (
        (range.startContainer.nodeType === 1
          ? (range.startContainer as Element)
          : range.startContainer.parentElement
        )?.closest('li') === item
      );
    return Array.from(item.childNodes).some(
      (child) => !/^(?:UL|OL)$/.test(child.nodeName) && selected(range, child),
    );
  });
  return items.filter((item) => !items.some((other) => other !== item && other.contains(item)));
}

export function preserve(range: Range, change: () => void) {
  // Markers move with inline content and also survive element-boundary selections.
  const doc = range.startContainer.ownerDocument!;
  const start = doc.createComment('selection-start');
  const end = doc.createComment('selection-end');
  const tail = range.cloneRange();
  tail.collapse(false);
  tail.insertNode(end);
  const head = range.cloneRange();
  head.collapse(true);
  head.insertNode(start);
  change();
  if (start.isConnected && end.isConnected) {
    range.setStartAfter(start);
    range.setEndBefore(end);
  }
  start.remove();
  end.remove();
}

const blockName = /^(?:P|H[1-6]|DIV|UL|OL)$/;

function inheritPresentation(item: Element, block: Element) {
  const classes = [...new Set([...item.classList, ...block.classList])];
  if (classes.length) block.setAttribute('class', classes.join(' '));
  const source = (item as HTMLElement).style;
  const target = (block as HTMLElement).style;
  for (const property of Array.from(source)) {
    if (!target.getPropertyValue(property))
      target.setProperty(
        property,
        source.getPropertyValue(property),
        source.getPropertyPriority(property),
      );
  }
}

export function blockStyle(root: HTMLElement, range: Range) {
  const tags = new Set(
    Array.from(root.querySelectorAll('p,h1,h2,h3,h4,h5,h6,div'))
      .filter(
        (element) =>
          !element.querySelector('p,h1,h2,h3,h4,h5,h6,div,ul,ol') && selected(range, element),
      )
      .map((element) => (element.tagName === 'DIV' ? 'p' : element.tagName.toLowerCase())),
  );
  if (
    selectedItems(root, range).some((item) =>
      Array.from(item.childNodes).some(
        (child) => !blockName.test(child.nodeName) && selected(range, child),
      ),
    )
  )
    tags.add('p');
  return tags.size === 1 ? [...tags][0] : tags.size ? '' : 'p';
}

export function formatBlocks(root: HTMLElement, range: Range, tag: string) {
  const blocks = Array.from(root.querySelectorAll('p,h1,h2,h3,h4,h5,h6,div')).filter(
    (element) =>
      !element.querySelector('p,h1,h2,h3,h4,h5,h6,div,ul,ol') && selected(range, element),
  );
  const inline = new Map<HTMLLIElement, Set<Node>>();
  for (const item of Array.from(root.querySelectorAll('li'))) {
    const children = Array.from(item.childNodes).filter((child) => !blockName.test(child.nodeName));
    const chosen = children.filter((child) => selected(range, child));
    if (
      chosen.length ||
      (!item.childNodes.length && range.collapsed && item === range.startContainer)
    )
      inline.set(item, new Set(chosen));
  }
  if (!blocks.length && !inline.size) return false;
  preserve(range, () => {
    for (const [item, chosen] of inline) {
      let run: Node[] = [];
      const flush = () => {
        if (run.some((child) => chosen.has(child)) || (!chosen.size && run.length)) {
          const replacement = root.ownerDocument.createElement(tag);
          item.insertBefore(replacement, run[0] ?? null);
          for (const child of run) replacement.append(child);
        }
        run = [];
      };
      for (const child of Array.from(item.childNodes)) {
        if (blockName.test(child.nodeName)) flush();
        else run.push(child);
      }
      flush();
    }
    for (const block of blocks) {
      const replacement = root.ownerDocument.createElement(tag);
      for (const attribute of Array.from(block.attributes))
        replacement.setAttribute(attribute.name, attribute.value);
      while (block.firstChild) replacement.append(block.firstChild);
      block.replaceWith(replacement);
    }
  });
  return true;
}

export function removeList(root: HTMLElement, range: Range, ordered: boolean) {
  const outer = selectedItems(root, range);
  const tag = ordered ? 'OL' : 'UL';
  if (!outer.length || outer.some((item) => item.parentElement?.tagName !== tag)) return false;
  const chosen = new Set(outer);
  const lists = new Set(outer.map((item) => item.parentElement!));
  preserve(range, () => {
    for (const list of lists) {
      let remainder: Element | null = null;
      for (const item of Array.from(list.children)) {
        if (!chosen.has(item as HTMLLIElement)) {
          if (!remainder) {
            remainder = list.cloneNode(false) as Element;
            list.before(remainder);
          }
          remainder.append(item);
          continue;
        }
        remainder = null;
        let paragraph: HTMLParagraphElement | null = null;
        let promoted = false;
        const markers: Node[] = [];
        for (const child of Array.from(item.childNodes)) {
          if (child.nodeType === 8 || (child.nodeType === 3 && !child.textContent)) {
            markers.push(child);
            if (paragraph) paragraph.append(child);
            else list.before(child);
          } else if (blockName.test(child.nodeName)) {
            paragraph = null;
            inheritPresentation(item, child as Element);
            list.before(child);
            promoted = true;
          } else {
            if (!paragraph) {
              paragraph = root.ownerDocument.createElement('p');
              inheritPresentation(item, paragraph);
              list.before(paragraph);
            }
            paragraph.append(child);
            promoted = true;
          }
        }
        if (!promoted) {
          paragraph = root.ownerDocument.createElement('p');
          inheritPresentation(item, paragraph);
          list.before(paragraph);
          paragraph.append(...markers);
        }
      }
      list.remove();
    }
  });
  return true;
}

export function formatList(root: HTMLElement, range: Range, ordered: boolean) {
  const tag = ordered ? 'ol' : 'ul';
  const outer = selectedItems(root, range);
  const blocks = Array.from(root.querySelectorAll('p,h1,h2,h3,h4,h5,h6,div')).filter(
    (block) =>
      !block.closest('li') &&
      !block.querySelector('p,h1,h2,h3,h4,h5,h6,div,ul,ol') &&
      selected(range, block),
  );
  if (
    !blocks.length &&
    outer.length &&
    outer.every((item) => item.parentElement?.tagName.toLowerCase() === tag)
  )
    return removeList(root, range, ordered);
  if (!blocks.length && !outer.length) return false;
  const chosen = new Set(outer);
  preserve(range, () => {
    const changed: Element[] = [];
    for (const list of new Set(outer.map((item) => item.parentElement!))) {
      let group: Element | null = null;
      let previousSelected: boolean | null = null;
      for (const item of Array.from(list.children)) {
        const active = chosen.has(item as HTMLLIElement);
        if (!group || active !== previousSelected) {
          group = root.ownerDocument.createElement(active ? tag : list.tagName.toLowerCase());
          for (const attribute of Array.from(list.attributes))
            group.setAttribute(attribute.name, attribute.value);
          list.before(group);
          if (active) changed.push(group);
        }
        group.append(item);
        previousSelected = active;
      }
      list.remove();
    }
    let list: Element | null = null;
    for (const block of blocks) {
      if (!list || list.nextSibling !== block) {
        list = root.ownerDocument.createElement(tag);
        block.before(list);
        changed.push(list);
      }
      const item = root.ownerDocument.createElement('li');
      list.append(item);
      if (block.tagName === 'P' && !block.attributes.length) {
        while (block.firstChild) item.append(block.firstChild);
        block.remove();
      } else item.append(block);
    }
    for (const current of changed) {
      if (!current.isConnected) continue;
      let next = current.nextSibling;
      while (
        next?.nodeName.toLowerCase() === tag &&
        (next as Element).attributes.length === current.attributes.length &&
        Array.from(current.attributes).every(
          (attribute) => (next as Element).getAttribute(attribute.name) === attribute.value,
        )
      ) {
        while (next.firstChild) current.append(next.firstChild);
        next.parentNode!.removeChild(next);
        next = current.nextSibling;
      }
    }
  });
  return true;
}
