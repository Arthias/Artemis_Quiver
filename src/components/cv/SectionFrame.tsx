import { ChevronDown, ChevronUp, FileDown, GripVertical } from "lucide-react";
import type { CVTheme } from "./cvThemes";
import { SECTION_LABELS } from "./EditComponents";

export function SectionFrame({
  sectionType, pageBreakBefore, visualIdx, total, theme, dragVisualIdx, isCollapsed,
  onDragStart, onDragOver, onDragEnd, onMove, onToggleCollapse, onTogglePageBreak,
  children,
}: {
  sectionType: string;
  pageBreakBefore?: boolean;
  visualIdx: number;
  total: number;
  theme: CVTheme;
  dragVisualIdx: number | null;
  isCollapsed: boolean;
  onDragStart: (i: number) => void;
  onDragOver: (e: React.DragEvent, i: number) => void;
  onDragEnd: () => void;
  onMove: (from: number, to: number) => void;
  onToggleCollapse: (type: string) => void;
  onTogglePageBreak: (type: string) => void;
  children: React.ReactNode;
}) {
  const label = SECTION_LABELS[sectionType] ?? sectionType;
  const titleStyle = { ...theme.sectionTitle, marginBottom: 0 };

  const moveUp = () => onMove(visualIdx, visualIdx - 1);
  const moveDown = () => onMove(visualIdx, visualIdx + 1);

  return (
    <div
      className={`group relative mb-6 ${pageBreakBefore ? 'page-break-before' : ''} ${dragVisualIdx === visualIdx ? 'opacity-50' : ''}`}
      draggable
      onDragStart={() => onDragStart(visualIdx)}
      onDragOver={(e) => onDragOver(e, visualIdx)}
      onDragEnd={onDragEnd}
      style={pageBreakBefore ? { pageBreakBefore: 'always', breakBefore: 'page' } as React.CSSProperties : undefined}
    >
      {pageBreakBefore && (
        <div className="mb-3 flex items-center gap-2 print:hidden">
          <div className="flex-1 border-t-2 border-dashed border-rose-300" />
          <span className="text-xs text-rose-500 font-medium whitespace-nowrap flex items-center gap-1">
            <FileDown className="w-3 h-3" /> Page break
          </span>
          <div className="flex-1 border-t-2 border-dashed border-rose-300" />
        </div>
      )}
      <div className="flex items-center gap-1.5 mb-3">
        <span className="cursor-grab text-gray-300 hover:text-gray-500 shrink-0 print:hidden" title="Drag to reorder">
          <GripVertical className="w-4 h-4" />
        </span>

        <div className="flex items-center gap-0.5 shrink-0 print:hidden">
          <button onClick={moveUp} disabled={visualIdx === 0}
            className="text-gray-300 hover:text-gray-500 disabled:opacity-20 p-0.5">
            <ChevronUp className="w-3 h-3" />
          </button>
          <button onClick={moveDown} disabled={visualIdx === total - 1}
            className="text-gray-300 hover:text-gray-500 disabled:opacity-20 p-0.5">
            <ChevronDown className="w-3 h-3" />
          </button>
        </div>

        <h2 className="text-xs font-bold uppercase tracking-widest" style={titleStyle}>
          {label}
        </h2>

        <button onClick={() => onTogglePageBreak(sectionType)}
          className={`print:hidden p-0.5 ${pageBreakBefore ? 'text-rose-500' : 'text-gray-300 hover:text-gray-500'}`}
          title={pageBreakBefore ? "Remove page break" : "Insert page break before this section"}>
          <FileDown className="w-3.5 h-3.5" />
        </button>

        <button onClick={() => onToggleCollapse(sectionType)}
          className="text-gray-300 hover:text-gray-500 print:hidden ml-auto"
          title={isCollapsed ? "Expand" : "Collapse"}>
          {isCollapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
        </button>
      </div>

      {isCollapsed ? (
        <div className="border border-dashed border-gray-200 rounded p-3">
          <p className="text-xs text-gray-400 italic">Collapsed</p>
        </div>
      ) : (
        children
      )}
    </div>
  );
}
