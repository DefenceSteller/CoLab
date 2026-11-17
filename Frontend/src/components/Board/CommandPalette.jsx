import React, { useEffect, useRef, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Search, MousePointer2, Hand, Pencil, Square, Circle, Type, Eraser, ArrowUpRight, Minus, Diamond, Frame, Zap, Image as FortuneIcon, Undo2, Redo2, Scissors, Copy, Trash2, MoveHorizontal, Repeat, Download, Upload } from 'lucide-react';

// ─── command definitions ────────────────────────────────────────────────────

const COMMANDS = [
  // Tools — id matches toolSlice setTool payload
  { id: 'tool-selection',   label: 'Select',       shortcut: 'V', icon: MousePointer2 },
  { id: 'tool-hand',        label: 'Hand',         shortcut: 'H', icon: Hand },
  { id: 'tool-freedraw',    label: 'Draw',         shortcut: 'P', icon: Pencil },
  { id: 'tool-line',        label: 'Line',         shortcut: 'L', icon: Minus },
  { id: 'tool-arrow',       label: 'Arrow',        shortcut: 'A', icon: ArrowUpRight },
  { id: 'tool-rectangle',   label: 'Rectangle',    shortcut: 'R', icon: Square },
  { id: 'tool-ellipse',     label: 'Ellipse',      shortcut: 'O', icon: Circle },
  { id: 'tool-diamond',     label: 'Diamond',      shortcut: 'D', icon: Diamond },
  { id: 'tool-frame',       label: 'Frame',        shortcut: 'F', icon: Frame },
  { id: 'tool-image',       label: 'Image',        shortcut: 'I', icon: FortuneIcon },
  { id: 'tool-laser',       label: 'Laser',        shortcut: null, icon: Zap },
  { id: 'tool-text',        label: 'Text',         shortcut: 'T', icon: Type },
  { id: 'tool-eraser',      label: 'Eraser',       shortcut: 'E', icon: Eraser },
  // Actions
  { id: 'action-cut',       label: 'Cut',          shortcut: '⌘X', icon: Scissors },
  { id: 'action-copy',      label: 'Copy',         shortcut: '⌘C', icon: Copy },
  { id: 'action-paste',     label: 'Paste',        shortcut: '⌘V', icon: Copy },
  { id: 'action-duplicate', label: 'Duplicate',    shortcut: '⌘D', icon: Repeat },
  { id: 'action-delete',    label: 'Delete',       shortcut: 'Del',  icon: Trash2 },
  { id: 'action-select-all',label: 'Select All',   shortcut: '⌘A', icon: MoveHorizontal },
  { id: 'action-undo',      label: 'Undo',         shortcut: '⌘Z', icon: Undo2 },
  { id: 'action-redo',      label: 'Redo',         shortcut: '⇧⌘Z', icon: Redo2 },
  { id: 'action-fit',       label: 'Fit to content', shortcut: '⇧1', icon: null },
  // Export / Import
  { id: 'action-export-png',    label: 'Export as PNG',   shortcut: '⌘S', icon: Download },
  { id: 'action-export-json',   label: 'Export as JSON',  shortcut: null,    icon: Download },
  { id: 'action-import-json',   label: 'Import scene',    shortcut: '⌘O', icon: Upload },
];

const Divider = () => <div className="h-px bg-ink/15 mx-3 my-1" />;

// ─── component ──────────────────────────────────────────────────────────────

const CommandPalette = ({ open, onClose }) => {
  const dispatch = useDispatch();
  const clipboardRef = useRef(null); // local clipboard for cut/copy/paste/dup
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef(null);
  const overlayRef = useRef(null);

  const elements = useSelector((s) => s.board.elements);
  const selectedIds = useSelector((s) => s.board.selectedIds);
  const historyLen = useSelector((s) => s.board.history.length);
  const futureLen = useSelector((s) => s.board.future.length);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setActiveIdx(0);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  // Keyboard navigation + execution
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') { onClose(); return; }
      const matches = filtered();
      if (e.key === 'Enter' && matches[activeIdx]) {
        e.preventDefault();
        execute(matches[activeIdx].id);
        return;
      }
      if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx((i) => Math.min(i + 1, matches.length - 1)); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx((i) => Math.max(i - 1, 0)); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, activeIdx, onClose]);

  // Click-outside dismiss
  useEffect(() => {
    if (!open) return;
    const onClick = (e) => {
      if (overlayRef.current && !overlayRef.current.contains(e.target)) onClose();
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open, onClose]);

  const filtered = () => {
    const q = query.toLowerCase().trim();
    if (!q) return COMMANDS;
    return COMMANDS.filter((c) => c.label.toLowerCase().includes(q) || c.shortcut?.toLowerCase().includes(q));
  };

  const doCut = () => {
    if (!selectedIds.length) return;
    const ids = [...selectedIds];
    const els = elements.filter((el) => ids.includes(el.id)).map((el) => ({ ...el }));
    clipboardRef.current = els;
    dispatch({ type: 'board/beginHistory' });
    dispatch({ type: 'board/removeElements', payload: ids });
  };

  const doCopy = () => {
    if (!selectedIds.length) return;
    const els = elements.filter((el) => selectedIds.includes(el.id)).map((el) => ({ ...el }));
    clipboardRef.current = els;
  };

  const doPaste = () => {
    if (!clipboardRef.current?.length) return;
    // Offset by 20 px from top-left of first copied element
    const ref = clipboardRef.current[0];
    const dx = elements.find((e) => e.id === selectedIds[0])?.x ?? 0;
    const dy = elements.find((e) => e.id === selectedIds[0])?.y ?? 0;
    const newIds = [];
    for (const el of clipboardRef.current) {
      const id = `${Date.now()}-${Math.random()}`;
      newIds.push(id);
      dispatch({
        type: 'board/addElement',
        payload: { ...el, id, x: el.x + dx + 20, y: el.y + dy + 20 },
      });
    }
    dispatch({ type: 'board/setSelection', payload: newIds });
  };

  const doDuplicate = () => {
    if (!selectedIds.length) return;
    const newIds = [];
    for (const el of elements.filter((e) => selectedIds.includes(e.id))) {
      const id = `${Date.now()}-${Math.random()}`;
      newIds.push(id);
      dispatch({
        type: 'board/addElement',
        payload: { ...el, id, x: el.x + 20, y: el.y + 20 },
      });
    }
    dispatch({ type: 'board/setSelection', payload: newIds });
  };

  const doDelete = () => {
    if (!selectedIds.length) return;
    const ids = [...selectedIds];
    dispatch({ type: 'board/beginHistory' });
    dispatch({ type: 'board/removeElements', payload: ids });
  };

  const doSelectAll = () => {
    dispatch({ type: 'board/setSelection', payload: elements.map((e) => e.id) });
  };

  const execute = (id) => {
    onClose();
    if (id.startsWith('tool-')) {
      dispatch({ type: 'tool/setTool', payload: id.replace('tool-', '') });
    } else if (id === 'action-undo') {
      if (historyLen > 0) dispatch({ type: 'board/undo' });
    } else if (id === 'action-redo') {
      if (futureLen > 0) dispatch({ type: 'board/redo' });
    } else if (id === 'action-cut') { doCut(); }
    else if (id === 'action-copy') { doCopy(); }
    else if (id === 'action-paste') { doPaste(); }
    else if (id === 'action-duplicate') { doDuplicate(); }
    else if (id === 'action-delete') { doDelete(); }
    else if (id === 'action-select-all') { doSelectAll(); }
    else if (id === 'action-fit') {
      window.__FIT_TO_CONTENT?.();
    } else if (id === 'action-export-png') {
      window.__EXPORT_PNG?.();
    } else if (id === 'action-export-json') {
      window.__EXPORT_JSON?.();
    } else if (id === 'action-import-json') {
      window.__OPEN_IMPORT_DIALOG?.();
    }
  };

  const matches = filtered();

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[18vh]">
      {/* Backdrop */}
      <div ref={overlayRef} className="absolute inset-0 bg-black/30" />
      {/* Palette */}
      <div className="relative w-full max-w-lg bg-cream border-2 border-ink rounded-xl shadow-[6px_6px_0_#101014] overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b-2 border-ink">
          <Search size={18} className="text-ink/50 shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setActiveIdx(0); }}
            placeholder="Search commands…"
            className="flex-1 bg-transparent outline-none text-sm font-medium placeholder:text-ink/40"
          />
          <kbd className="text-xs opacity-40 font-mono border border-ink/20 rounded px-1">ESC</kbd>
        </div>
        <div className="max-h-[60vh] overflow-y-auto py-2">
          {matches.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm opacity-40">No results</div>
          ) : (
            matches.map((cmd, i) => {
              const Icon = cmd.icon;
              return (
                <button
                  key={cmd.id}
                  onClick={() => execute(cmd.id)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors focus:outline-none
                    ${i === activeIdx ? 'bg-ink text-cream' : 'hover:bg-ink/5'}`}
                >
                  {Icon && <Icon size={16} className="shrink-0" />}
                  <span className="flex-1 text-left font-medium">{cmd.label}</span>
                  {cmd.shortcut && (
                    <kbd className={`text-xs font-mono opacity-50 ${i === activeIdx ? 'opacity-70' : ''}`}>
                      {cmd.shortcut}
                    </kbd>
                  )}
                </button>
              );
            })
          )}
        </div>
        <div className="px-4 py-2 border-t-2 border-ink bg-ink/5 flex items-center gap-4 text-xs opacity-50">
          <span>↑↓ navigate</span><span>↵ select</span><span>esc close</span>
        </div>
      </div>
    </div>
  );
};

export default CommandPalette;
