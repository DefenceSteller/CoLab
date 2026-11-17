import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  setColor,
  setBackgroundColor,
  setFillStyle,
  setStrokeStyle,
  setStrokeWidth,
  setRoughness,
  setOpacity,
  setFontFamily,
} from '../../store/slices/toolSlice';
import { beginHistory, setElementStyle } from '../../store/slices/boardSlice';
import { Palette } from 'lucide-react';

// --------------- visual primitives ---------------

const SECTION_LABEL =
  'text-[9px] font-extrabold uppercase tracking-[0.15em] text-ink/60 mb-1.5 select-none';
const rowGutter = 'flex items-center flex-wrap gap-1';

const Btn = ({ active, onClick, title, children }) => (
  <button
    type="button"
    title={title}
    aria-pressed={active}
    className={`tool-btn !py-1 !px-1.5 !rounded-lg !shadow-[2px_2px_0_#101014] ${
      active ? 'active' : '!bg-white hover:!bg-cream'
    }`}
    onClick={onClick}
  >
    {children}
  </button>
);

const Swatch = ({ hex, selected, onClick }) => (
  <button
    type="button"
    title={hex}
    aria-label={`Color ${hex}`}
    className={`swatch ${selected ? 'selected' : ''}`}
    style={{ backgroundColor: hex }}
    onClick={() => onClick(hex)}
  />
);

// Tiny section wrapper
const Section = ({ label, children }) => (
  <div className="flex flex-col gap-1">
    <div className={SECTION_LABEL}>{label}</div>
    {children}
  </div>
);

// --------------- constants ---------------

const COLORS = [
  '#101014', '#ef4444', '#f59e0b', '#22c55e', '#3b82f6',
  '#7c3aed', '#ec4899', '#06b6d4', '#6b7280', '#ffffff',
];

const FILL_STYLES = ['solid', 'hachure', 'cross-hatch', 'zigzag'];
const STROKE_STYLES = ['solid', 'dashed', 'dotted'];
const WIDTHS = [
  { label: 'Thin', val: 1 },
  { label: 'Med', val: 2 },
  { label: 'Bold', val: 4 },
];
const ROUGHNESS = [
  { label: 'A', title: 'Architect (smooth)', val: 0 },
  { label: 'N', title: 'Artist (default)', val: 1 },
  { label: 'C', title: 'Cartoonist (rough)', val: 2 },
];
const FONTS = [
  { label: 'Sans', val: 'sans', title: 'Space Grotesk' },
  { label: 'Mono', val: 'mono', title: 'JetBrains Mono' },
];

// --------------- main component ---------------

export default function PropertyPanel() {
  const dispatch = useDispatch();

  // Current TOOL defaults
  const {
    color,
    backgroundColor,
    fillStyle,
    strokeStyle,
    strokeWidth,
    roughness,
    opacity,
    fontFamily,
  } = useSelector((s) => s.tool);

  // Selected ELEMENTS — their current values take precedence over tool defaults.
  const selectedIds = useSelector((s) => s.board.selectedIds);
  const elements = useSelector((s) => s.board.elements);
  const el = elements.find((x) => x.id === selectedIds[0]) ?? null;
  const selCount = selectedIds.length;

  // For multi-select we show the *first* element's values as a representative sample;
  // changing a property updates ALL selected elements uniformly (Excalidraw behavior).
  const pick = (prop, def) =>
    el != null && el[prop] !== undefined ? el[prop] : def;

  const applyToSelection = (changes) => {
    if (!selCount) return;
    dispatch(beginHistory());
    dispatch(setElementStyle({ ids: selectedIds, changes }));
  };

  const isText = el?.type === 'text';
  const isShape = !!el && ['rectangle', 'ellipse', 'diamond', 'frame'].includes(el.type);

  // Never show when there's literally nothing selected AND nothing to draw (optional: could also
  // show when no selection to let users tweak tool defaults — kept minimal here).
  if (selCount === 0) return null;

  return (
    <div
      className="absolute top-3 right-3 z-20 w-48 bg-cream border-2 border-ink rounded-xl shadow-[4px_4px_0_#101014] p-2.5 flex flex-col gap-3"
      data-testid="property-panel"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-extrabold uppercase tracking-widest text-ink/70">
          {selCount > 1 ? `${selCount} items` : 'Properties'}
        </span>
      </div>

      {/* ── Stroke Color ─────────────────────── */}
      <Section label="Stroke">
        <div className={rowGutter}>
          {COLORS.map((c) => (
            <Swatch
              key={c}
              hex={c}
              selected={color === c}
              onClick={(hex) => {
                dispatch(setColor(hex));
                applyToSelection({ strokeColor: hex });
              }}
            />
          ))}
          <label
            className="relative w-6 h-6 rounded-full border-2 border-ink bg-white shadow-[2px_2px_0_#101014] cursor-pointer grid place-items-center hover:bg-sun transition-colors shrink-0"
            title="Custom color"
          >
            <Palette size={11} />
            <input
              type="color"
              value={color}
              onChange={(e) => {
                const v = e.target.value;
                dispatch(setColor(v));
                applyToSelection({ strokeColor: v });
              }}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
          </label>
        </div>
      </Section>

      {/* ── Fill — only on closed shapes ─────── */}
      {isShape && (
        <Section label="Fill">
          {(pick('backgroundColor') ?? 'transparent') !== 'transparent' && (
            <div className={rowGutter}>
              {COLORS.map((c) => (
                <Swatch
                  key={c}
                  hex={c}
                  selected={pick('backgroundColor') === c}
                  onClick={(hex) => {
                    dispatch(setBackgroundColor(hex));
                    applyToSelection({ backgroundColor: hex });
                  }}
                />
              ))}
            </div>
          )}
          <div className={`${rowGutter} mt-1`}>
            {FILL_STYLES.map((fs) => (
              <Btn
                key={fs}
                active={pick('fillStyle') === fs}
                onClick={() => {
                  dispatch(setFillStyle(fs));
                  applyToSelection({ fillStyle: fs });
                }}
                title={fs}
              >
                <span className="text-[10px] font-extrabold uppercase">
                  {fs.slice(0, 3)}
                </span>
              </Btn>
            ))}
            <Btn
              active={pick('backgroundColor') === 'transparent'}
              onClick={() => {
                dispatch(setBackgroundColor('transparent'));
                applyToSelection({ backgroundColor: 'transparent' });
              }}
              title="No fill"
            >
              <span className="text-[10px] font-black">⊘</span>
            </Btn>
          </div>
        </Section>
      )}

      {/* ── Stroke Style & Width ─────────────── */}
      <Section label="Line">
        <div className={rowGutter}>
          {STROKE_STYLES.map((ss) => (
            <Btn
              key={ss}
              active={pick('strokeStyle') === ss}
              onClick={() => {
                dispatch(setStrokeStyle(ss));
                applyToSelection({ strokeStyle: ss });
              }}
              title={ss}
            >
              {ss === 'solid' && (
                <span className="inline-block w-4 h-0.5 bg-ink rounded-sm" />
              )}
              {ss === 'dashed' && (
                <svg width={16} height={6} viewBox="0 0 16 6">
                  <line
                    x1="0" y1="3" x2="16" y2="3"
                    stroke="#101014" strokeWidth={2}
                    strokeDasharray="4,3"
                  />
                </svg>
              )}
              {ss === 'dotted' && (
                <svg width={16} height={6} viewBox="0 0 16 6">
                  <circle cx="2" cy="3" r="1.5" fill="#101014" />
                  <circle cx="8" cy="3" r="1.5" fill="#101014" />
                  <circle cx="14" cy="3" r="1.5" fill="#101014" />
                </svg>
              )}
            </Btn>
          ))}
        </div>
        <div className={`${rowGutter} mt-1`}>
          {WIDTHS.map((w) => (
            <Btn
              key={w.val}
              active={pick('strokeWidth') === w.val}
              onClick={() => {
                dispatch(setStrokeWidth(w.val));
                applyToSelection({ strokeWidth: w.val });
              }}
              title={`${w.label} stroke (${w.val}px)`}
            >
              <span
                className="inline-block bg-ink rounded-sm"
                style={{ width: '16px', height: `${w.val * 3}px` }}
              />
            </Btn>
          ))}
        </div>
      </Section>

      {/* ── Roughness ────────────────────────── */}
      <Section label="Sketch">
        <div className={rowGutter}>
          {ROUGHNESS.map((r) => (
            <Btn
              key={r.val}
              active={pick('roughness') === r.val}
              onClick={() => {
                dispatch(setRoughness(r.val));
                applyToSelection({ roughness: r.val });
              }}
              title={r.title}
            >
              <span className="text-[10px] font-black">{r.label}</span>
            </Btn>
          ))}
        </div>
      </Section>

      {/* ── Opacity ──────────────────────────── */}
      <Section label="Opacity">
        <div className="flex items-center gap-2">
          <input
            type="range"
            min="0"
            max="100"
            value={pick('opacity', 100)}
            onChange={(e) => {
              const v = parseInt(e.target.value, 10);
              dispatch(setOpacity(v));
              applyToSelection({ opacity: v });
            }}
            className="size-slider flex-1"
            aria-label="Opacity"
          />
          <span className="text-xs font-bold tabular-nums w-8 text-right">
            {pick('opacity', 100)}%
          </span>
        </div>
      </Section>

      {/* ── Text props (only when selected element is text) ─── */}
      {isText && (
        <Section label="Font">
          <div className={rowGutter}>
            {FONTS.map((f) => (
              <Btn
                key={f.val}
                active={pick('fontFamily') === f.val}
                onClick={() => {
                  dispatch(setFontFamily(f.val));
                  applyToSelection({ fontFamily: f.val });
                }}
                title={f.title}
              >
                <span className="text-[10px] font-bold">{f.label}</span>
              </Btn>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}
