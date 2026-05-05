'use client';
// VirtualScroller.jsx - Efficient rendering of thousands of items
import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * VirtualScroller - Renders only visible items to support thousands of files
 * Props:
 *   items: Array of items to render
 *   itemHeight: Height of each item (px)
 *   renderItem: (item, index) => ReactNode
 *   containerHeight: Height of container (px)
 *   buffer: Number of items to render outside viewport (default: 5)
 *   onEndReached: Callback when scrolled to end
 *   className: CSS class for container
 */
export default function VirtualScroller({
  items = [],
  itemHeight = 60,
  renderItem,
  containerHeight = 600,
  buffer = 5,
  onEndReached,
  className = '',
}) {
  const containerRef = useRef(null);
  const [scrollTop, setScrollTop] = useState(0);

  // Calculate visible range
  const visibleCount = Math.ceil(containerHeight / itemHeight);
  const startIdx = Math.max(0, Math.floor(scrollTop / itemHeight) - buffer);
  const endIdx = Math.min(items.length, startIdx + visibleCount + buffer * 2);

  const visibleItems = items.slice(startIdx, endIdx);
  const offsetY = startIdx * itemHeight;

  const handleScroll = useCallback((e) => {
    const el = e.target;
    setScrollTop(el.scrollTop);

    // Trigger end-reached callback
    if (
      onEndReached &&
      el.scrollHeight - el.scrollTop - el.clientHeight < 100
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
          height: items.length * itemHeight,
          position: 'relative',
        }}
      >
        {/* Visible items wrapper */}
        <div
          style={{
            transform: `translateY(${offsetY}px)`,
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
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
