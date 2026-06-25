'use client';

import React, { useState, useRef, useEffect } from 'react';

interface ImageCropperProps {
  imageSrc: string;
  onCropComplete: (croppedImgBase64: string) => void;
  onCancel: () => void;
  aspectRatio?: number; // width / height, e.g. 1 (square) or 0.75 (3:4)
  targetWidth?: number;
  targetBorderRadius?: number;
}

export default function ImageCropper({
  imageSrc,
  onCropComplete,
  onCancel,
  aspectRatio = 0.75, // Default 3:4 portrait
  targetWidth,
  targetBorderRadius,
}: ImageCropperProps) {
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  // Crop area dimensions
  const cropWidth = 200;
  const cropHeight = cropWidth / aspectRatio;

  const cropBorderRadius = targetWidth && targetBorderRadius
    ? Math.min((targetBorderRadius / targetWidth) * cropWidth, cropWidth / 2, cropHeight / 2)
    : 4;

  // Reset when image changes
  useEffect(() => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  }, [imageSrc]);

  const handleMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    setIsDragging(true);
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    setDragStart({ x: clientX - offset.x, y: clientY - offset.y });
  };

  const handleMouseMove = (e: MouseEvent | TouchEvent) => {
    if (!isDragging) return;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    setOffset({
      x: clientX - dragStart.x,
      y: clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('touchmove', handleMouseMove);
      window.addEventListener('touchend', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleMouseMove);
      window.removeEventListener('touchend', handleMouseUp);
    };
  }, [isDragging, dragStart]);

  const handleCrop = () => {
    if (!imgRef.current || !containerRef.current) return;

    const img = imgRef.current;
    const container = containerRef.current;

    const containerRect = container.getBoundingClientRect();
    const cropLeft = (containerRect.width - cropWidth) / 2;
    const cropTop = (containerRect.height - cropHeight) / 2;

    const canvas = document.createElement('canvas');
    canvas.width = 300; // Output width
    canvas.height = 300 / aspectRatio; // Output height

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const imgWidth = img.offsetWidth || img.width;
    const imgHeight = img.offsetHeight || img.height;

    // Calculate natural image size under zoom
    const displayedWidth = imgWidth * zoom;
    const displayedHeight = imgHeight * zoom;

    // Position of crop box relative to image top-left
    const imgX = offset.x + (containerRect.width - displayedWidth) / 2;
    const imgY = offset.y + (containerRect.height - displayedHeight) / 2;

    const xInCrop = cropLeft - imgX;
    const yInCrop = cropTop - imgY;

    // Draw image onto canvas mapping crop space to canvas dimensions
    ctx.drawImage(
      img,
      (xInCrop / displayedWidth) * img.naturalWidth,
      (yInCrop / displayedHeight) * img.naturalHeight,
      (cropWidth / displayedWidth) * img.naturalWidth,
      (cropHeight / displayedHeight) * img.naturalHeight,
      0,
      0,
      canvas.width,
      canvas.height
    );

    onCropComplete(canvas.toDataURL('image/png'));
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.85)',
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      backdropFilter: 'blur(8px)',
    }}>
      <div className="card" style={{ width: '100%', maxWidth: '450px', background: 'var(--card-bg)', border: '1px solid var(--glass-border)', padding: '24px', borderRadius: '16px' }}>
        <h3 style={{ marginBottom: '16px', fontSize: '1.2rem', textAlign: 'center' }}>Crop Profile Image</h3>
        
        <div 
          ref={containerRef}
          onMouseDown={handleMouseDown}
          onTouchStart={handleMouseDown}
          style={{
            width: '100%',
            height: '320px',
            background: '#111',
            borderRadius: '12px',
            position: 'relative',
            overflow: 'hidden',
            cursor: 'move',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* Draggable and Zoomable Image */}
          <img
            ref={imgRef}
            src={imageSrc}
            alt="To Crop"
            draggable={false}
            style={{
              transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
              maxHeight: '100%',
              maxWidth: '100%',
              objectFit: 'contain',
              userSelect: 'none',
              pointerEvents: 'none',
              transition: isDragging ? 'none' : 'transform 0.1s ease-out',
            }}
          />

          {/* Crop Overlay Mask */}
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            pointerEvents: 'none',
            display: 'flex',
            flexDirection: 'column',
          }}>
            <div style={{ flex: 1, background: 'rgba(0,0,0,0.5)' }}></div>
            <div style={{ display: 'flex', height: `${cropHeight}px` }}>
              <div style={{ flex: 1, background: 'rgba(0,0,0,0.5)' }}></div>
              <div style={{
                width: `${cropWidth}px`,
                border: '2px solid var(--primary)',
                boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.5)',
                borderRadius: `${cropBorderRadius}px`,
              }}></div>
              <div style={{ flex: 1, background: 'rgba(0,0,0,0.5)' }}></div>
            </div>
            <div style={{ flex: 1, background: 'rgba(0,0,0,0.5)' }}></div>
          </div>
        </div>

        {/* Zoom Slider */}
        <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label style={{ fontSize: '0.8rem', color: 'var(--muted)', display: 'flex', justifyContent: 'space-between' }}>
            <span>Zoom</span>
            <span>{Math.round(zoom * 100)}%</span>
          </label>
          <input
            type="range"
            min="1"
            max="4"
            step="0.05"
            value={zoom}
            onChange={(e) => setZoom(parseFloat(e.target.value))}
            style={{ width: '100%', accentColor: 'var(--primary)' }}
          />
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
          <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" style={{ flex: 1 }} onClick={handleCrop}>
            Apply Crop
          </button>
        </div>
      </div>
    </div>
  );
}
