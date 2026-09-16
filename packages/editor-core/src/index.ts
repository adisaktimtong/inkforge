export type Mark = 'bold' | 'italic' | 'underline' | 'strike' | 'code';

export interface TextNode extends PresentationAttributes {
  type: 'text';
  text: string;
  marks?: Mark[];
}
export interface LinkNode extends PresentationAttributes {
  type: 'link';
  href: string;
  children: InlineNode[];
}
export type InlineNode = TextNode | LinkNode;
export interface PresentationAttributes {
  className?: string;
  style?: string;
}
export interface ParagraphNode extends PresentationAttributes {
  type: 'paragraph';
  children: InlineNode[];
}
export interface HeadingNode extends PresentationAttributes {
  type: 'heading';
  level: 1 | 2 | 3 | 4 | 5 | 6;
  children: InlineNode[];
}
export interface ListItemNode extends PresentationAttributes {
  type: 'list-item';
  children: BlockNode[];
}
export interface ListNode extends PresentationAttributes {
  type: 'list';
  ordered: boolean;
  items: ListItemNode[];
}
export type BlockNode = ParagraphNode | HeadingNode | ListNode;
export interface DocumentNode {
  type: 'document';
  children: BlockNode[];
}

export const createDocument = (children: BlockNode[] = []): DocumentNode => ({
  type: 'document',
  children,
});
export const createText = (
  text: string,
  marks?: Mark[],
  presentation: PresentationAttributes = {},
): TextNode => ({
  type: 'text',
  text,
  ...presentation,
  ...(marks?.length ? { marks: [...new Set(marks)] } : {}),
});
export const createLink = (
  href: string,
  children: InlineNode[] = [],
  presentation: PresentationAttributes = {},
): LinkNode => ({
  type: 'link',
  href,
  children,
  ...presentation,
});
export const createParagraph = (
  children: InlineNode[] = [],
  presentation: PresentationAttributes = {},
): ParagraphNode => ({
  type: 'paragraph',
  children,
  ...presentation,
});
export const createHeading = (
  level: HeadingNode['level'],
  children: InlineNode[] = [],
  presentation: PresentationAttributes = {},
): HeadingNode => ({ type: 'heading', level, children, ...presentation });
export const createListItem = (
  children: BlockNode[] = [],
  presentation: PresentationAttributes = {},
): ListItemNode => ({
  type: 'list-item',
  children,
  ...presentation,
});
export const createList = (
  ordered = false,
  items: ListItemNode[] = [],
  presentation: PresentationAttributes = {},
): ListNode => ({
  type: 'list',
  ordered,
  items,
  ...presentation,
});

export const isBlockNode = (node: DocumentNode | BlockNode | InlineNode): node is BlockNode =>
  node.type === 'paragraph' || node.type === 'heading' || node.type === 'list';
export const isInlineNode = (node: DocumentNode | BlockNode | InlineNode): node is InlineNode =>
  node.type === 'text' || node.type === 'link';

export function* walkDocument(
  document: DocumentNode,
): Generator<DocumentNode | BlockNode | ListItemNode | InlineNode> {
  function* visit(
    node: DocumentNode | BlockNode | ListItemNode | InlineNode,
  ): Generator<DocumentNode | BlockNode | ListItemNode | InlineNode> {
    yield node;
    if (node.type === 'document') for (const child of node.children) yield* visit(child);
    else if (node.type === 'paragraph' || node.type === 'heading')
      for (const child of node.children) yield* visit(child);
    else if (node.type === 'list') for (const item of node.items) yield* visit(item);
    else if (node.type === 'list-item') for (const child of node.children) yield* visit(child);
    else if (node.type === 'link') for (const child of node.children) yield* visit(child);
  }
  yield* visit(document);
}

export const traverseDocument = walkDocument;
