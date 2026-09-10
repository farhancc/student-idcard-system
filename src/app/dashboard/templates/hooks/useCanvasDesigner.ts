import { useState } from 'react';

export function useCanvasDesigner() {
  const [showGrid, setShowGrid] = useState(false);
  const [gridSize, setGridSize] = useState(20);
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [snapToGuides, setSnapToGuides] = useState(true);
  const [frontGuides, setFrontGuides] = useState<{ id: string; type: 'horizontal' | 'vertical'; value: number }[]>([]);
  const [backGuides, setBackGuides] = useState<{ id: string; type: 'horizontal' | 'vertical'; value: number }[]>([]);
  const [activeGuideDrag, setActiveGuideDrag] = useState<{ id: string; side: 'front' | 'back'; type: 'horizontal' | 'vertical'; isNew?: boolean } | null>(null);
  
  const [showBleedGuides, setShowBleedGuides] = useState(false);
  const [zoom, setZoom] = useState(1);
  const BLEED_PX = 18;
  const SAFE_PX = 35;

  const [previewId, setPreviewId] = useState<number | null>(null);
  const [previewSide, setPreviewSide] = useState<'front' | 'back'>('front');
  const [isFullView, setIsFullView] = useState(false);
  const [showTestData, setShowTestData] = useState(false);
  const [testData, setTestData] = useState<Record<string, string>>({});

  const [selectedFieldIndex, setSelectedFieldIndex] = useState<number | null>(null);
  const [selectedSide, setSelectedSide] = useState<'front' | 'back'>('front');
  const [activeTooltipIndex, setActiveTooltipIndex] = useState<number | null>(null);
  const [activeTooltipSide, setActiveTooltipSide] = useState<'front' | 'back' | null>(null);
  const [dragState, setDragState] = useState<{
    index: number;
    side: 'front' | 'back';
    type: 'move' | 'resize';
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    origW: number;
    origH: number;
  } | null>(null);

  return {
    showGrid, setShowGrid,
    gridSize, setGridSize,
    snapToGrid, setSnapToGrid,
    snapToGuides, setSnapToGuides,
    frontGuides, setFrontGuides,
    backGuides, setBackGuides,
    activeGuideDrag, setActiveGuideDrag,
    showBleedGuides, setShowBleedGuides,
    zoom, setZoom,
    BLEED_PX, SAFE_PX,
    previewId, setPreviewId,
    previewSide, setPreviewSide,
    isFullView, setIsFullView,
    showTestData, setShowTestData,
    testData, setTestData,
    selectedFieldIndex, setSelectedFieldIndex,
    selectedSide, setSelectedSide,
    activeTooltipIndex, setActiveTooltipIndex,
    activeTooltipSide, setActiveTooltipSide,
    dragState, setDragState
  };
}
