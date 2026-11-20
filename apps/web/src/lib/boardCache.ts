import { generateKeyBetween } from "@shared/fractional";
import type { BoardDto, CardDto, ColumnDto } from "@shared/types";

export const sortCards = (cards: CardDto[]): CardDto[] =>
  [...cards].sort((a, b) => a.position.localeCompare(b.position));

const sortColumns = (columns: ColumnDto[]): ColumnDto[] =>
  [...columns].sort((a, b) => a.position.localeCompare(b.position));

export function findCard(board: BoardDto, cardId: string): CardDto | null {
  for (const column of board.columns) {
    const card = column.cards.find((candidate) => candidate.id === cardId);
    if (card) return card;
  }
  return null;
}

export function upsertCard(board: BoardDto, card: CardDto): BoardDto {
  let placed = false;
  const withCard = board.columns.map((column) => {
    const others = column.cards.filter((candidate) => candidate.id !== card.id);
    if (column.id === card.columnId) {
      placed = true;
      return { ...column, cards: sortCards([...others, card]) };
    }
    if (others.length !== column.cards.length) return { ...column, cards: others };
    return column;
  });
  return placed ? { ...board, columns: withCard } : board;
}

export function removeCard(board: BoardDto, cardId: string): BoardDto {
  return {
    ...board,
    columns: board.columns.map((column) =>
      column.cards.some((card) => card.id === cardId)
        ? { ...column, cards: column.cards.filter((card) => card.id !== cardId) }
        : column,
    ),
  };
}

export function upsertColumn(board: BoardDto, column: ColumnDto): BoardDto {
  const exists = board.columns.some((candidate) => candidate.id === column.id);
  const columns = exists
    ? board.columns.map((candidate) => (candidate.id === column.id ? column : candidate))
    : [...board.columns, column];
  return { ...board, columns: sortColumns(columns) };
}

export function removeColumn(board: BoardDto, columnId: string): BoardDto {
  return { ...board, columns: board.columns.filter((column) => column.id !== columnId) };
}

/**
 * Moves a card inside/between columns and computes its fractional position.
 * `overCardId` is the card the dragged card was dropped on (null = end of column).
 */
export function moveCard(
  board: BoardDto,
  cardId: string,
  toColumnId: string,
  overCardId: string | null,
): { board: BoardDto; card: CardDto } | null {
  const from = board.columns.find((column) => column.cards.some((card) => card.id === cardId));
  const to = board.columns.find((column) => column.id === toColumnId);
  const card = from?.cards.find((candidate) => candidate.id === cardId);
  if (!from || !to || !card) return null;

  const remaining = to.cards.filter((candidate) => candidate.id !== cardId);
  let index = remaining.length;
  if (overCardId) {
    const overIndex = remaining.findIndex((candidate) => candidate.id === overCardId);
    if (overIndex >= 0) index = overIndex;
  }

  const position = generateKeyBetween(remaining[index - 1]?.position ?? null, remaining[index]?.position ?? null);
  const moved: CardDto = { ...card, columnId: to.id, position };

  const columns = board.columns.map((column) => {
    if (column.id === from.id && column.id === to.id) {
      return { ...column, cards: [...remaining.slice(0, index), moved, ...remaining.slice(index)] };
    }
    if (column.id === from.id) return { ...column, cards: column.cards.filter((c) => c.id !== cardId) };
    if (column.id === to.id) return { ...column, cards: [...remaining.slice(0, index), moved, ...remaining.slice(index)] };
    return column;
  });

  return { board: { ...board, columns }, card: moved };
}

/** Position for inserting a column at `index` in the current ordering. */
export function columnPositionAt(columns: ColumnDto[], index: number): string {
  const current = sortColumns(columns);
  const previous = current[index - 1]?.position ?? null;
  const next = current[index]?.position ?? null;
  return generateKeyBetween(previous, next);
}
