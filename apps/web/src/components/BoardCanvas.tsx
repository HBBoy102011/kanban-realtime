import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { BoardDto, CardDto, ColumnDto } from "@shared/types";
import { useState, type FormEvent, type KeyboardEvent } from "react";
import { findCard } from "../lib/boardCache";

interface BoardCanvasProps {
  board: BoardDto;
  canEdit: boolean;
  filter: string;
  onMoveCard: (cardId: string, toColumnId: string, overCardId: string | null) => void;
  onOpenCard: (card: CardDto) => void;
  onCreateCard: (columnId: string, title: string) => Promise<void>;
  onRenameColumn: (columnId: string, title: string) => void;
  onDeleteColumn: (columnId: string) => void;
  onMoveColumn: (columnId: string, direction: -1 | 1) => void;
  onCreateColumn: (title: string) => Promise<void>;
}

function formatDue(dueDate: string): { label: string; overdue: boolean } {
  const date = new Date(dueDate);
  const overdue = date.getTime() < Date.now();
  return { label: date.toLocaleDateString("ru-RU", { day: "numeric", month: "short" }), overdue };
}

function SortableCard({ card, canEdit, onOpen }: { card: CardDto; canEdit: boolean; onOpen: (card: CardDto) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
    disabled: !canEdit,
    data: { columnId: card.columnId },
  });

  const due = card.dueDate ? formatDue(card.dueDate) : null;

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
      onClick={() => onOpen(card)}
      className={`group cursor-grab select-none rounded-xl border border-slate-200 bg-white p-3 text-sm shadow-sm transition hover:border-indigo-300 hover:shadow dark:border-slate-700 dark:bg-slate-800 dark:hover:border-indigo-500/60 ${
        isDragging ? "opacity-40" : ""
      } focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500`}
      aria-label={`Карточка ${card.title}`}
    >
      <p className="font-medium leading-snug">{card.title}</p>
      {card.description ? (
        <p className="mt-1 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">{card.description}</p>
      ) : null}
      {due ? (
        <span
          className={`chip mt-2 ${
            due.overdue
              ? "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300"
              : "bg-slate-100 text-slate-600 dark:bg-slate-700/60 dark:text-slate-300"
          }`}
        >
          ⏱ {due.label}
        </span>
      ) : null}
    </li>
  );
}

interface ColumnViewProps {
  column: ColumnDto;
  canEdit: boolean;
  filter: string;
  index: number;
  total: number;
  onOpenCard: (card: CardDto) => void;
  onCreateCard: (columnId: string, title: string) => Promise<void>;
  onRename: (columnId: string, title: string) => void;
  onDelete: (columnId: string) => void;
  onMove: (columnId: string, direction: -1 | 1) => void;
}

function ColumnView({
  column,
  canEdit,
  filter,
  index,
  total,
  onOpenCard,
  onCreateCard,
  onRename,
  onDelete,
  onMove,
}: ColumnViewProps) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id, disabled: !canEdit || Boolean(filter) });
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(column.title);
  const [busy, setBusy] = useState(false);

  const normalizedFilter = filter.trim().toLowerCase();
  const cards = normalizedFilter
    ? column.cards.filter(
        (card) =>
          card.title.toLowerCase().includes(normalizedFilter) ||
          card.description.toLowerCase().includes(normalizedFilter),
      )
    : column.cards;

  async function submitCard(event?: FormEvent) {
    event?.preventDefault();
    const value = draft.trim();
    if (!value || busy) return;
    setBusy(true);
    try {
      await onCreateCard(column.id, value);
      setDraft("");
      setAdding(false);
    } catch (cause) {
      window.alert(cause instanceof Error ? cause.message : "Не удалось создать карточку");
    } finally {
      setBusy(false);
    }
  }

  function onDraftKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void submitCard();
    }
    if (event.key === "Escape") {
      setAdding(false);
      setDraft("");
    }
  }

  function commitTitle() {
    const value = titleDraft.trim();
    setEditingTitle(false);
    if (value && value !== column.title) onRename(column.id, value);
    else setTitleDraft(column.title);
  }

  return (
    <section
      className={`flex max-h-full w-[85vw] shrink-0 snap-start flex-col rounded-2xl border p-2 transition sm:w-72 ${
        isOver
          ? "border-indigo-400 bg-indigo-50/70 dark:border-indigo-500 dark:bg-indigo-500/10"
          : "border-slate-200 bg-slate-50/80 dark:border-slate-800 dark:bg-slate-900/70"
      }`}
      aria-label={`Колонка ${column.title}`}
    >
      <header className="flex items-center gap-1 px-2 py-1.5">
        {editingTitle ? (
          <input
            autoFocus
            className="input py-0.5 text-sm font-semibold"
            value={titleDraft}
            maxLength={80}
            onChange={(event) => setTitleDraft(event.target.value)}
            onBlur={commitTitle}
            onKeyDown={(event) => {
              if (event.key === "Enter") commitTitle();
              if (event.key === "Escape") {
                setTitleDraft(column.title);
                setEditingTitle(false);
              }
            }}
          />
        ) : (
          <button
            type="button"
            className="flex-1 truncate text-left text-sm font-semibold"
            onClick={() => canEdit && setEditingTitle(true)}
            title={canEdit ? "Переименовать колонку" : column.title}
          >
            {column.title}
            <span className="ml-2 text-xs font-normal text-slate-400">{column.cards.length}</span>
          </button>
        )}
        {canEdit ? (
          <div className="flex shrink-0 items-center">
            <button
              type="button"
              className="rounded px-1 text-xs text-slate-400 hover:bg-slate-200 disabled:opacity-30 dark:hover:bg-slate-800"
              disabled={index === 0}
              onClick={() => onMove(column.id, -1)}
              aria-label="Переместить колонку влево"
              title="Влево"
            >
              ◀
            </button>
            <button
              type="button"
              className="rounded px-1 text-xs text-slate-400 hover:bg-slate-200 disabled:opacity-30 dark:hover:bg-slate-800"
              disabled={index === total - 1}
              onClick={() => onMove(column.id, 1)}
              aria-label="Переместить колонку вправо"
              title="Вправо"
            >
              ▶
            </button>
            <button
              type="button"
              className="rounded px-1 text-xs text-slate-400 hover:bg-rose-100 hover:text-rose-600 dark:hover:bg-rose-500/10"
              onClick={() => onDelete(column.id)}
              aria-label={`Удалить колонку ${column.title}`}
              title="Удалить колонку"
            >
              ✕
            </button>
          </div>
        ) : null}
      </header>

      <div ref={setNodeRef} className="min-h-[60px] flex-1 overflow-y-auto px-1 pb-1">
        <SortableContext items={cards.map((card) => card.id)} strategy={verticalListSortingStrategy}>
          <ul className={`space-y-2 ${cards.length === 0 ? "grid h-[60px] place-items-center" : ""}`}>
            {cards.map((card) => (
              <SortableCard key={card.id} card={card} canEdit={canEdit && !normalizedFilter} onOpen={onOpenCard} />
            ))}
            {cards.length === 0 ? (
              <li className="text-xs text-slate-400 dark:text-slate-500">
                {normalizedFilter ? "Ничего не найдено" : "Перетащите карточку сюда"}
              </li>
            ) : null}
          </ul>
        </SortableContext>
      </div>

      {canEdit ? (
        <div className="px-1 pt-1">
          {adding ? (
            <form onSubmit={(event) => void submitCard(event)} className="space-y-1.5">
              <textarea
                autoFocus
                className="input min-h-[64px] resize-none text-sm"
                placeholder="Название карточки"
                maxLength={160}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={onDraftKeyDown}
              />
              <div className="flex gap-1">
                <button className="btn btn-primary flex-1" disabled={busy || !draft.trim()}>
                  Добавить
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => {
                    setAdding(false);
                    setDraft("");
                  }}
                >
                  Отмена
                </button>
              </div>
            </form>
          ) : (
            <button type="button" className="btn btn-ghost w-full justify-start" onClick={() => setAdding(true)}>
              + Добавить карточку
            </button>
          )}
        </div>
      ) : null}
    </section>
  );
}

export function BoardCanvas({
  board,
  canEdit,
  filter,
  onMoveCard,
  onOpenCard,
  onCreateCard,
  onRenameColumn,
  onDeleteColumn,
  onMoveColumn,
  onCreateColumn,
}: BoardCanvasProps) {
  const [activeCard, setActiveCard] = useState<CardDto | null>(null);
  const [addingColumn, setAddingColumn] = useState(false);
  const [columnDraft, setColumnDraft] = useState("");
  const [creatingColumn, setCreatingColumn] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragStart(event: DragStartEvent) {
    setActiveCard(findCard(board, String(event.active.id)));
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveCard(null);
    const { active, over } = event;
    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);
    const source = board.columns.find((column) => column.cards.some((card) => card.id === activeId));
    if (!source) return;

    const target =
      board.columns.find((column) => column.id === overId) ??
      board.columns.find((column) => column.cards.some((card) => card.id === overId));
    if (!target) return;
    if (target.id === source.id && overId === activeId) return;

    onMoveCard(activeId, target.id, overId === target.id ? null : overId);
  }

  async function submitColumn(event: FormEvent) {
    event.preventDefault();
    const value = columnDraft.trim();
    if (!value || creatingColumn) return;
    setCreatingColumn(true);
    try {
      await onCreateColumn(value);
      setColumnDraft("");
      setAddingColumn(false);
    } catch (cause) {
      window.alert(cause instanceof Error ? cause.message : "Не удалось создать колонку");
    } finally {
      setCreatingColumn(false);
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveCard(null)}
    >
      <div className="flex h-full snap-x gap-3 overflow-x-auto px-3 pb-4 pt-2 sm:px-4">
        {board.columns.map((column, index) => (
          <ColumnView
            key={column.id}
            column={column}
            index={index}
            total={board.columns.length}
            canEdit={canEdit && !filter}
            filter={filter}
            onOpenCard={onOpenCard}
            onCreateCard={onCreateCard}
            onRename={onRenameColumn}
            onDelete={onDeleteColumn}
            onMove={onMoveColumn}
          />
        ))}

        {canEdit ? (
          <div className="w-[85vw] shrink-0 snap-start sm:w-72">
            {addingColumn ? (
              <form onSubmit={(event) => void submitColumn(event)} className="surface space-y-2 p-3">
                <input
                  autoFocus
                  className="input"
                  placeholder="Название колонки"
                  maxLength={80}
                  value={columnDraft}
                  onChange={(event) => setColumnDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      setAddingColumn(false);
                      setColumnDraft("");
                    }
                  }}
                />
                <div className="flex gap-1">
                  <button className="btn btn-primary flex-1" disabled={creatingColumn || !columnDraft.trim()}>
                    Добавить
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => {
                      setAddingColumn(false);
                      setColumnDraft("");
                    }}
                  >
                    Отмена
                  </button>
                </div>
              </form>
            ) : (
              <button
                type="button"
                className="w-full rounded-2xl border border-dashed border-slate-300 px-4 py-6 text-sm text-slate-500 transition hover:border-indigo-400 hover:text-indigo-600 dark:border-slate-700 dark:text-slate-400 dark:hover:border-indigo-500 dark:hover:text-indigo-300"
                onClick={() => setAddingColumn(true)}
              >
                + Добавить колонку
              </button>
            )}
          </div>
        ) : null}
      </div>

      <DragOverlay dropAnimation={null}>
        {activeCard ? (
          <div className="w-72 rotate-2 rounded-xl border border-indigo-300 bg-white p-3 text-sm shadow-xl dark:border-indigo-500/60 dark:bg-slate-800">
            <p className="font-medium leading-snug">{activeCard.title}</p>
            {activeCard.description ? (
              <p className="mt-1 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">{activeCard.description}</p>
            ) : null}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
