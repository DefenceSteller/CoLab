import React, { useEffect, useRef } from 'react';

const Sep = () => <div className="h-px bg-ink/15 mx-2 my-1" />;

/**
 * Right-click context menu. Renders inside a parent <div data-context-menu>
 * positioned absolutely by Canvas.jsx at the click coordinates.
 */
const ContextMenu = ({ selectedIds, elements, dispatch, onDismiss }) => {
  const hasSel = selectedIds.length > 0;
  const selEls = selectedIds.map((id) => elements.find((el) => el.id === id)).filter(Boolean);
  const emitDelete = window.__COLAB_EMIT_DELETE;

  // Store current selection ids in a ref so actions can read them at execution time
  const selIdsRef = useRef(selectedIds);
  useEffect(() => { selIdsRef.current = selectedIds; }, [selectedIds]);

  const doAction = (fn) => () => { fn(); onDismiss?.(); };

  const doCut = () => {
    if (!hasSel) return;
    const ids = [...selIdsRef.current];
    const els = elements.filter((el) => ids.includes(el.id)).map((el) => ({ ...el }));
    if (window.__COLAB_CLIPBOARD__) {
      window.__COLAB_CLIPBOARD__.els = els;
      let cx = 0, cy = 0, n = 0;
      for (const el of els) { cx += el.x + (el.width || 0) / 2; cy += el.y + (el.height || 0) / 2; n++; }
      window.__COLAB_CLIPBOARD__.cx = n ? cx / n : 0;
      window.__COLAB_CLIPBOARD__.cy = n ? cy / n : 0;
    }
    dispatch({ type: 'board/beginHistory' });
    dispatch({ type: 'board/removeElements', payload: ids });
    emitDelete?.(ids);
  };

  const doCopy = () => {
    if (!hasSel) return;
    const els = elements.filter((el) => selIdsRef.current.includes(el.id)).map((el) => ({ ...el }));
    if (window.__COLAB_CLIPBOARD__) {
      window.__COLAB_CLIPBOARD__.els = els;
      let cx = 0, cy = 0, n = 0;
      for (const el of els) { cx += el.x + (el.width || 0) / 2; cy += el.y + (el.height || 0) / 2; n++; }
      window.__COLAB_CLIPBOARD__.cx = n ? cx / n : 0;
      window.__COLAB_CLIPBOARD__.cy = n ? cy / n : 0;
    }
  };

  const doPaste = () => {
    const cb = window.__COLAB_CLIPBOARD__;
    if (!cb?.els?.length) return;
    const refEl = selEls[0] ?? cb.els[0];
    const ox = refEl ? refEl.x + 20 : 0;
    const oy = refEl ? refEl.y + 20 : 0;
    const newIds = [];
    for (const el of cb.els) {
      const id = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
      newIds.push(id);
      dispatch({ type: 'board/addElement', payload: { ...el, id, x: el.x + ox, y: el.y + oy } });
    }
    dispatch({ type: 'board/setSelection', payload: newIds });
  };

  const doDuplicate = () => {
    if (!hasSel) return;
    const newIds = [];
    for (const el of selEls) {
      const id = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
      newIds.push(id);
      dispatch({ type: 'board/addElement', payload: { ...el, id, x: el.x + 20, y: el.y + 20 } });
    }
    dispatch({ type: 'board/setSelection', payload: newIds });
  };

  const doDelete = () => {
    if (!hasSel) return;
    const ids = [...selIdsRef.current];
    dispatch({ type: 'board/beginHistory' });
    dispatch({ type: 'board/removeElements', payload: ids });
    emitDelete?.(ids);
  };

  const reorder = (direction) => {
    if (!hasSel) return;
    const keep = elements.filter((el) => !selIdsRef.current.includes(el.id));
    const moved = elements.filter((el) => selIdsRef.current.includes(el.id));
    dispatch({ type: 'board/setElements', payload: direction === 'front' ? [...keep, ...moved] : [...moved, ...keep] });
  };

  const storeState = (() => { try { return window.__COLAB_STORE__?.getState(); } catch { return null; } })();
  const canUndo = storeState?.board?.history?.length > 0;
  const canRedo = storeState?.board?.future?.length > 0;

  const Row = ({ label, shortcut, danger, disabled, action }) => (
    <button
      className={`w-full flex items-center justify-between px-3 py-1.5 text-sm font-medium rounded-md transition-colors
        ${disabled ? 'opacity-30 cursor-not-allowed' : danger ? 'hover:bg-red-100 hover:text-red-600' : 'hover:bg-ink hover:text-cream'}
        focus:outline-none`}
      onClick={action}
      disabled={disabled}
    >
      <span>{label}</span>
      {shortcut && <kbd className="text-xs opacity-50 font-mono ml-4">{shortcut}</kbd>}
    </button>
  );

  return (
    <div className="bg-cream border-2 border-ink rounded-lg shadow-[4px_4px_0_#101014] overflow-hidden min-w-[184px]">
      <Row label="Cut" shortcut="⌘X" disabled={!hasSel} action={doAction(doCut)} />
      <Row label="Copy" shortcut="⌘C" disabled={!hasSel} action={doAction(doCopy)} />
      <Row label="Paste" shortcut="⌘V" disabled={!window.__COLAB_CLIPBOARD__?.els?.length} action={doAction(doPaste)} />
      <Row label="Duplicate" shortcut="⌘D" disabled={!hasSel} action={doAction(doDuplicate)} />
      <Row label="Delete" shortcut="Del" danger disabled={!hasSel} action={doAction(doDelete)} />
      <Sep />
      <Row label="Bring to front" shortcut="⇧⌘]" disabled={!hasSel} action={doAction(() => reorder('front'))} />
      <Row label="Send to back" shortcut="⇧⌘[" disabled={!hasSel} action={doAction(() => reorder('back'))} />
      <Sep />
      <Row label="Undo" shortcut="⌘Z" disabled={!canUndo} action={() => { dispatch({ type: 'board/undo' }); onDismiss?.(); }} />
      <Row label="Redo" shortcut="⇧⌘Z" disabled={!canRedo} action={() => { dispatch({ type: 'board/redo' }); onDismiss?.(); }} />
    </div>
  );
};

export default ContextMenu;
