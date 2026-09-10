import React from 'react';
import { Grid3x3 } from 'lucide-react';

interface DesignerToolbarProps {
  zoom: number;
  setZoom: (v: number) => void;
  showGrid: boolean;
  setShowGrid: (v: boolean) => void;
  gridSize: number;
  setGridSize: (v: number) => void;
  snapToGrid: boolean;
  setSnapToGrid: (v: boolean) => void;
  snapToGuides: boolean;
  setSnapToGuides: (v: boolean) => void;
  showBleedGuides: boolean;
  setShowBleedGuides: (v: boolean) => void;
  showTestData: boolean;
  setShowTestData: (v: boolean) => void;
}

export default function DesignerToolbar({
  zoom, setZoom,
  showGrid, setShowGrid,
  gridSize, setGridSize,
  snapToGrid, setSnapToGrid,
  snapToGuides, setSnapToGuides,
  showBleedGuides, setShowBleedGuides,
  showTestData, setShowTestData
}: DesignerToolbarProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
      {/* Zoom Option */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '8px', 
        fontSize: '0.8rem', 
        background: 'rgba(255,255,255,0.05)', 
        padding: '6px 12px', 
        borderRadius: '8px', 
        border: '1px solid var(--glass-border)',
        userSelect: 'none',
        fontWeight: 500,
      }}>
        <span style={{ color: '#94a3b8' }}>Zoom:</span>
        <select
          value={zoom}
          onChange={e => setZoom(Number(e.target.value))}
          className="form-input"
          style={{ padding: '0px 4px', fontSize: '0.75rem', width: 'auto', minWidth: '70px', background: 'transparent', border: 'none', color: '#fff', outline: 'none', cursor: 'pointer' }}
        >
          <option value={0.5} style={{ background: '#1e293b' }}>50%</option>
          <option value={0.75} style={{ background: '#1e293b' }}>75%</option>
          <option value={1} style={{ background: '#1e293b' }}>100%</option>
          <option value={1.25} style={{ background: '#1e293b' }}>125%</option>
          <option value={1.5} style={{ background: '#1e293b' }}>150%</option>
          <option value={2} style={{ background: '#1e293b' }}>200%</option>
        </select>
      </div>
      {/* Grid Toggle */}
      <label style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '8px', 
        fontSize: '0.8rem', 
        cursor: 'pointer', 
        background: showGrid ? 'rgba(20, 184, 166, 0.15)' : 'rgba(255,255,255,0.05)', 
        padding: '6px 12px', 
        borderRadius: '8px', 
        border: showGrid ? '1px solid rgba(20,184,166,0.7)' : '1px solid var(--glass-border)',
        transition: 'all 0.2s',
        userSelect: 'none',
        fontWeight: 500,
      }}>
        <input 
          type="checkbox" 
          checked={showGrid} 
          onChange={e => setShowGrid(e.target.checked)} 
          style={{ cursor: 'pointer', margin: 0 }}
        />
        <Grid3x3 size={13} />
        <span>Grid</span>
      </label>
      {/* Grid Size Selector — only visible when grid is on */}
      {showGrid && (
        <select
          value={gridSize}
          onChange={e => setGridSize(Number(e.target.value))}
          className="form-input"
          style={{ padding: '5px 8px', fontSize: '0.75rem', width: 'auto', minWidth: '90px' }}
          title="Grid cell size (pixels in canvas space)"
        >
          <option value={10}>10 px fine</option>
          <option value={20}>20 px medium</option>
          <option value={50}>50 px coarse</option>
          <option value={100}>100 px macro</option>
        </select>
      )}

      {/* Snap to Grid */}
      <label style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '8px', 
        fontSize: '0.8rem', 
        cursor: 'pointer', 
        background: snapToGrid ? 'rgba(20, 184, 166, 0.15)' : 'rgba(255,255,255,0.05)', 
        padding: '6px 12px', 
        borderRadius: '8px', 
        border: snapToGrid ? '1px solid rgba(20,184,166,0.7)' : '1px solid var(--glass-border)',
        transition: 'all 0.2s',
        userSelect: 'none',
        fontWeight: 500,
      }} title="Snap fields to grid intersections when dragging or resizing">
        <input 
          type="checkbox" 
          checked={snapToGrid} 
          onChange={e => setSnapToGrid(e.target.checked)} 
          style={{ cursor: 'pointer', margin: 0 }}
        />
        <span>Snap to Grid</span>
      </label>

      {/* Snap to Guides */}
      <label style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '8px', 
        fontSize: '0.8rem', 
        cursor: 'pointer', 
        background: snapToGuides ? 'rgba(20, 184, 166, 0.15)' : 'rgba(255,255,255,0.05)', 
        padding: '6px 12px', 
        borderRadius: '8px', 
        border: snapToGuides ? '1px solid rgba(20,184,166,0.7)' : '1px solid var(--glass-border)',
        transition: 'all 0.2s',
        userSelect: 'none',
        fontWeight: 500,
      }} title="Snap fields to custom guidelines when dragging or resizing">
        <input 
          type="checkbox" 
          checked={snapToGuides} 
          onChange={e => setSnapToGuides(e.target.checked)} 
          style={{ cursor: 'pointer', margin: 0 }}
        />
        <span>Snap to Guides</span>
      </label>

      <span style={{ fontSize: '0.75rem', color: '#64748b', marginLeft: '6px' }}>
        💡 Drag from rulers to place custom guides (units in mm).
      </span>

      {/* Bleed & Safe Area Guide Toggle */}
      <label style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '8px', 
        fontSize: '0.8rem', 
        cursor: 'pointer', 
        background: showBleedGuides ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.05)', 
        padding: '6px 12px', 
        borderRadius: '8px', 
        border: showBleedGuides ? '1px solid rgba(239,68,68,0.7)' : '1px solid var(--glass-border)',
        transition: 'all 0.2s',
        userSelect: 'none',
        fontWeight: 500,
      }} title="Show bleed (red) and safe area (yellow) guides for professional print. Keep critical content inside the yellow line.">
        <input 
          type="checkbox" 
          checked={showBleedGuides} 
          onChange={e => setShowBleedGuides(e.target.checked)} 
          style={{ cursor: 'pointer', margin: 0 }}
        />
        <span>🖨 Bleed Guides</span>
      </label>
      {/* Test Data Toggle */}
      <label style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '8px', 
        fontSize: '0.8rem', 
        cursor: 'pointer', 
        background: showTestData ? 'rgba(59, 130, 246, 0.15)' : 'rgba(255,255,255,0.05)', 
        padding: '6px 12px', 
        borderRadius: '8px', 
        border: showTestData ? '1px solid var(--primary)' : '1px solid var(--glass-border)',
        transition: 'all 0.2s',
        userSelect: 'none',
        fontWeight: 500,
      }}>
        <input 
          type="checkbox" 
          checked={showTestData} 
          onChange={e => setShowTestData(e.target.checked)} 
          style={{ cursor: 'pointer', margin: 0 }}
        />
        <span>Preview Test Data</span>
      </label>
    </div>
  );
}
