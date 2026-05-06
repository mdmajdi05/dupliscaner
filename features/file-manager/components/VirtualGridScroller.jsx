'use client';
// VirtualGridScroller.jsx - Efficient grid rendering for thousands of items
import { useState, useRef, useCallback } from 'react';

/**
 * VirtualGridScroller - Renders only visible grid items
 * Props:
 *   items: Array of items
 *   colWidth: Width of each column (px)
 *   itemHeight: Height of each item (px)
 *   containerHeight: Height of container (px)
 *   gap: Gap between items (px)
 *   renderItem: (item, index) => ReactNode
 *   buffer: Number of items outside viewport to render (default: 10)
 *   onEndReached: Callback when scrolled to end
 *   className: CSS class for container
 */
export default function VirtualGridScroller({
  items = [],
  colWidth = 120,
  itemHeight = 140,
  containerHeight = 600,
  gap = 8,
  renderItem,
  buffer = 10,
  onEndReached,
  className = '',
}) {
  const containerRef = useRef(null);
  const [scrollTop, setScrollTop] = useState(0);

  // Calculate columns
  const containerWidth = containerRef.current?.clientWidth || 800;
  const cols = Math.max(1, Math.floor(containerWidth / (colWidth + gap)));

  // Calculate visible rows
  const rowHeight = itemHeight + gap;
  const visibleRows = Math.ceil(containerHeight / rowHeight);
  const startRow = Math.max(0, Math.floor(scrollTop / rowHeight) - Math.ceil(buffer / cols));
  const endRow = startRow + visibleRows + Math.ceil(buffer / cols);

  const totalRows = Math.ceil(items.length / cols);
  const startIdx = startRow * cols;
  const endIdx = Math.min(items.length, endRow * cols);

  const visibleItems = items.slice(startIdx, endIdx);
  const offsetY = startRow * rowHeight;

  const handleScroll = useCallback((e) => {
    const el = e.target;
    setScrollTop(el.scrollTop);

    // Trigger end-reached callback
    if (
      onEndReached &&
      el.scrollHeight - el.scrollTop - el.clientHeight < 200
    ) {
      onEndReached();
    }
  }, [onEndReached]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        height: containerHeight,
        overflow: 'auto',
        position: 'relative',
      }}
      onScroll={handleScroll}
    >
      {/* Total height container */}
      <div
        style={{
          height: totalRows * rowHeight,
          position: 'relative',
        }}
      >
        {/* Grid container */}
        <div
          style={{
            transform: `translateY(${offsetY}px)`,
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            display: 'grid',
            gridTemplateColumns: `repeat(${cols}, 1fr)`,
            gap: `${gap}px`,
            padding: gap,
            boxSizing: 'border-box',
          }}
        >
          {visibleItems.map((item, idx) => (
            <div key={startIdx + idx}>
              {renderItem(item, startIdx + idx)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
