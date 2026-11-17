import React, { useEffect, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useCanvas } from '../../hooks/useCanvas';
import { useSocket } from '../../hooks/useSocket';
import { screenFromWorld } from '../../utils/viewport';
import ZoomControls from './ZoomControls';
import PropertyPanel from './PropertyPanel';
import ContextMenu from './ContextMenu';
import CommandPalette from './CommandPalette';

const CURSOR = {
  text: 'text',
  hand: 'grab',
  selection: 'default',
  eraser: 'cell',
  laser: 'crosshair',
};

const Canvas = () => {
  const dispatch = useDispatch();
  const { emitDraw, emitCursorMove, emitDeleteElements, emitUpdateElements } = useSocket();
  const {
    containerRef,
    baseRef,
    overlayRef,
    hoverId,
    textInput,
    onTextChange,
    commitText,
    cancelText,
    handleTextBlur,
  } = useCanvas({ emitDraw, emitCursorMove, emitDelete: emitDeleteElements, emitUpdateElements });

  const activeTool = useSelector((state) => state.tool.activeTool);
  const color = useSelector((state) => state.tool.color);
  const fontSize = useSelector((state) => state.tool.fontSize);
  const viewport = useSelector((state) => state.viewport);
  const { panning, spaceHeld } = viewport;
  const selectedIds = useSelector((state) => state.board.selectedIds);
  const elements = useSelector((state) => state.board.elements);

  const cursor = panning
    ? 'grabbing'
    : spaceHeld
      ? 'grab'
      : activeTool === 'selection' && hoverId
        ? 'move'
        : CURSOR[activeTool] || 'crosshair';

  const anchor = textInput ? screenFromWorld(textInput.x, textInput.y, viewport) : null;
  const editorFontSize = Math.max(10, fontSize * viewport.zoom);

  // ─── context menu state ──────────────────────────────────────────────────
  const [ctxMenu, setCtxMenu] = React.useState(null);
  const ctxCloseRef = useRef(() => {});
  useEffect(() => {
    ctxCloseRef.current = () => setCtxMenu(null);
  }, []);

  // Right-click → open context menu at click position
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onContext = (e) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      setCtxMenu({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    };

    const onKeyDown = (e) => {
      if (e.key === 'Escape') setCtxMenu(null);
    };

    const onClickOutside = (e) => {
      if (ctxMenu && !e.target.closest('[data-context-menu]')) {
        setCtxMenu(null);
      }
    };

    el.addEventListener('contextmenu', onContext);
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onClickOutside);
    return () => {
      el.removeEventListener('contextmenu', onContext);
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onClickOutside);
    };
  }, [containerRef, ctxMenu]);

  // ─── command palette toggle (Ctrl+K / Cmd+K) ─────────────────────────────
  const [cmdOpen, setCmdOpen] = React.useState(false);
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setCmdOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // ─── export / import listeners ───────────────────────────────────────────
  // Export PNG (triggered by Ctrl+S or toolbar button)
  useEffect(() => {
    const handler = () => window.__EXPORT_PNG?.();
    document.addEventListener('colab-export-png', handler);
    return () => document.removeEventListener('colab-export-png', handler);
  }, []);

  // Import JSON dialog (triggered by Ctrl+O, toolbar button, or command palette)
  const [importOpen, setImportOpen] = React.useState(false);
  useEffect(() => {
    const handler = () => setImportOpen(true);
    document.addEventListener('colab-open-import-dialog', handler);
    return () => document.removeEventListener('colab-open-import-dialog', handler);
  }, []);

  // Handle file drop + paste (images go through image tool, JSON files go through this path)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onDrop = async (e) => {
      e.preventDefault();
      const files = Array.from(e.dataTransfer.files);
      for (const file of files) {
        if (file.type.startsWith('image/')) {
          // Let the image tool handle it — just switch tool
          dispatch({ type: 'tool/setTool', payload: 'image' });
          // Store file reference for the image tool to pick up
          window.__COLAB_PENDING_IMAGE_FILE = file;
          return;
        }
        if (file.name.endsWith('.json')) {
          try {
            const text = await file.text();
            document.dispatchEvent(new CustomEvent('colab-raw-scene-json', { detail: text }));
          } catch { /* ignore */ }
        }
      }
    };

    // Ctrl+V with image data
    const onPaste = async (e) => {
      const items = Array.from(e.clipboardData?.items ?? []);
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const blob = item.getAsFile();
          if (!blob) continue;
          const reader = new FileReader();
          reader.onload = () => {
            window.__COLAB_PENDING_IMAGE_DATAURL = reader.result;
            dispatch({ type: 'tool/setTool', payload: 'image' });
          };
          reader.readAsDataURL(blob);
          return;
        }
        if (item.kind === 'string' && item.type === 'text/plain') {
          item.getAsString(async (text) => {
            try {
              JSON.parse(text); // must be valid JSON
              document.dispatchEvent(new CustomEvent('colab-raw-scene-json', { detail: text }));
            } catch { /* not JSON */ }
          });
        }
      }
    };

    el.addEventListener('drop', onDrop);
    document.addEventListener('paste', onPaste);
    return () => {
      el.removeEventListener('drop', onDrop);
      document.removeEventListener('paste', onPaste);
    };
  }, [containerRef, dispatch]);

  // Handle scene JSON payload → load into board
  useEffect(() => {
    const handler = (e) => {
      const text = e?.detail;
      if (!text) return;
      try {
        // Use the global deserializer — imported lazily via the same path
        const result = window.__DESERIALIZE_SCENE?.(text);
        if (!result) return;
        dispatch({ type: 'board/loadBoard', payload: result.elements });
        if (result.viewport) dispatch({ type: 'viewport/setViewport', payload: result.viewport });
        setImportOpen(false);
      } catch { /* ignore invalid JSON */ }
    };
    document.addEventListener('colab-raw-scene-json', handler);
    return () => document.removeEventListener('colab-raw-scene-json', handler);
  }, [dispatch]);

  return (
    <div
      ref={containerRef}
      data-canvas-container
      className="relative w-full h-full bg-white border-2 border-ink rounded-xl overflow-hidden shadow-[6px_6px_0_#101014]"
      style={{ cursor }}
    >
      {/* base layer: committed elements */}
      <canvas ref={baseRef} className="absolute inset-0 w-full h-full block" />
      {/* overlay layer: in-progress preview / interaction */}
      <canvas
        ref={overlayRef}
        className="absolute inset-0 w-full h-full block"
        style={{ pointerEvents: 'none' }}
      />

      {/* zoom widget */}
      <ZoomControls containerRef={containerRef} />

      {/* property panel */}
      {selectedIds.length > 0 && <PropertyPanel />}

      {/* right-click context menu */}
      {ctxMenu && (
        <div
          data-context-menu
          data-ui
          style={{ position: 'absolute', left: ctxMenu.x, top: ctxMenu.y, zIndex: 50 }}
        >
          <ContextMenu
            selectedIds={selectedIds}
            elements={elements}
            dispatch={dispatch}
            onDismiss={ctxCloseRef.current}
          />
        </div>
      )}

      {/* inline text editor */}
      {textInput && anchor && (
        <input
          key={textInput.id}
          autoFocus
          value={textInput.value}
          onChange={(e) => onTextChange(e.target.value)}
          onBlur={() => handleTextBlur(textInput.id)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); commitText(); }
            else if (e.key === 'Escape') { e.preventDefault(); cancelText(); }
          }}
          placeholder="Type…  Enter to place"
          className="absolute z-10 px-1.5 py-0.5 bg-white/90 outline-none border-2 border-ink rounded-md shadow-[3px_3px_0_#101014] font-semibold placeholder:text-gray-400 placeholder:font-normal"
          style={{
            left: anchor.x,
            top: Math.max(0, anchor.y - 4),
            color,
            fontSize: `${editorFontSize}px`,
            minWidth: '10rem',
            width: `${Math.max(12, textInput.value.length + 4)}ch`,
          }}
        />
      )}

      {/* command palette */}
      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} />

      {/* hidden import dialog — rendered outside canvas so clicks don't trigger canvas gestures */}
      {importOpen && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/30">
          <div className="bg-cream border-2 border-ink rounded-xl shadow-[6px_6px_0_#101014] p-5 w-full max-w-sm">
            <h3 className="text-sm font-bold mb-3">Import Scene</h3>
            <p className="text-xs opacity-60 mb-4">
              Paste a CoLab JSON scene below, or drag &amp; drop a .json file onto the canvas.
            </p>
            <textarea
              id="import-textarea"
              className="w-full h-32 p-2 text-xs font-mono border-2 border-ink rounded-lg bg-white resize-none focus:outline-none focus:ring-2 focus:ring-violet-500"
              placeholder='{"version":1,"elements":[...]}'
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  const text = e.target.value;
                  if (text.trim()) document.dispatchEvent(new CustomEvent('colab-raw-scene-json', { detail: text }));
                }
              }}
            />
            <div className="flex items-center gap-2 mt-3">
              <label className="tool-btn">
                <input
                  type="file"
                  accept=".json,application/json"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = () => {
                      document.dispatchEvent(new CustomEvent('colab-raw-scene-json', { detail: reader.result }));
                    };
                    reader.readAsText(file);
                  }}
                />
                📁 Open file…
              </label>
              <button className="tool-btn" onClick={() => {
                const text = document.getElementById('import-textarea')?.value ?? '';
                if (text.trim()) document.dispatchEvent(new CustomEvent('colab-raw-scene-json', { detail: text }));
              }}>
                Import
              </button>
              <button className="tool-btn danger" onClick={() => setImportOpen(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Canvas;
