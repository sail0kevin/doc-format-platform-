"use client";

import { ReactNode, useEffect, useState } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";

interface ThreePanelLayoutProps {
  left: ReactNode;
  middle: ReactNode;
  right: ReactNode;
  leftCollapsed?: boolean;
  onLeftToggle?: () => void;
  defaultLeftSize?: number;
  defaultMiddleSize?: number;
}

const STORAGE_KEY = "doc-format-panel-layout";

function loadLayout(): [number, number] | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length === 2) return parsed as [number, number];
  } catch {}
  return null;
}

function saveLayout(sizes: [number, number]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sizes));
}

export default function ThreePanelLayout({
  left, middle, right,
  leftCollapsed = false,
  defaultLeftSize = 19,
  defaultMiddleSize = 31,
}: ThreePanelLayoutProps) {
  const [sizes, setSizes] = useState<[number, number] | null>(null);

  useEffect(() => {
    const saved = loadLayout();
    setSizes(saved ?? [defaultLeftSize, defaultMiddleSize]);
  }, [defaultLeftSize, defaultMiddleSize]);

  const handleResize = (panelSizes: number[]) => {
    if (panelSizes.length >= 2) {
      saveLayout([panelSizes[0], panelSizes[1]]);
    }
  };

  if (!sizes) {
    return (
      <div className="flex h-full">
        <div className="flex-1" />
      </div>
    );
  }

  return (
    <PanelGroup direction="horizontal" onLayout={handleResize}>
      {!leftCollapsed && (
        <>
          <Panel defaultSize={sizes[0]} minSize={10} maxSize={40}>
            <div className="h-full overflow-y-auto border-r border-border/60">
              {left}
            </div>
          </Panel>
          <PanelResizeHandle className="w-1.5 cursor-col-resize bg-transparent hover:bg-primary/20 active:bg-primary/30 transition-colors flex items-center justify-center group">
            <div className="w-0.5 h-8 rounded-full bg-border/40 group-hover:bg-primary/40 transition-colors" />
          </PanelResizeHandle>
        </>
      )}
      <Panel defaultSize={!leftCollapsed ? sizes[1] : 100} minSize={25}>
        <div className="h-full overflow-y-auto border-r border-border/60">
          {middle}
        </div>
      </Panel>
      <PanelResizeHandle className="w-1.5 cursor-col-resize bg-transparent hover:bg-primary/20 active:bg-primary/30 transition-colors flex items-center justify-center group">
        <div className="w-0.5 h-8 rounded-full bg-border/40 group-hover:bg-primary/40 transition-colors" />
      </PanelResizeHandle>
      <Panel minSize={30}>
        <div className="h-full overflow-y-auto">
          {right}
        </div>
      </Panel>
    </PanelGroup>
  );
}
