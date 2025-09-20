'use client';

import { useRef, useState, useEffect } from 'react';
import { WindowData } from '../windowManager/windowManager.types';

interface Connection {
  windowId1: string;
  windowId2: string;
  score: number;
  keywords: string[];
}

interface ConnectionRendererProps {
  windows: WindowData[];
  connections: Connection[];
  isVisible: boolean;
  minSimilarityThreshold: number;
  onDeleteConnection?: (connection: Connection) => void;
}

export function ConnectionRenderer({
  windows,
  connections,
  isVisible,
  minSimilarityThreshold,
  onDeleteConnection
}: ConnectionRendererProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoveredConnection, setHoveredConnection] = useState<Connection | null>(null);
  const [selectedConnection, setSelectedConnection] = useState<Connection | null>(null);
  const [, forceUpdate] = useState({});
  const isDraggingRef = useRef(false);
  const animationFrameRef = useRef<number>();

  // Force re-render when windows array changes (positions, etc)
  useEffect(() => {
    console.log('🔄 ConnectionRenderer: Windows changed, re-rendering connections');
    // Use requestAnimationFrame for smoother updates during dragging
    const animationFrame = requestAnimationFrame(() => {
      forceUpdate({});
    });

    return () => cancelAnimationFrame(animationFrame);
  }, [windows]);

  // Additional effect to handle real-time position updates during dragging
  useEffect(() => {
    const handleWindowMove = () => {
      if (isVisible) {
        requestAnimationFrame(() => {
          forceUpdate({});
        });
      }
    };

    // Listen for window position updates via event bus
    let unsubscribe: (() => void) | null = null;

    import('@/lib/eventBus').then(({ eventBus }) => {
      unsubscribe = eventBus.on('window:position_changed', handleWindowMove);
    });

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [isVisible]);

  // High-frequency updates during window dragging using MutationObserver and mouse events
  useEffect(() => {
    if (!isVisible) return;

    let animationFrameId: number;
    let isDragging = false;
    let dragTimeout: NodeJS.Timeout;

    const forceConnectionUpdate = () => {
      if (!isDraggingRef.current) return;
      updateConnectionsDirectly();
      animationFrameRef.current = requestAnimationFrame(forceConnectionUpdate);
    };

    const startDragUpdates = () => {
      if (isDraggingRef.current) return;
      isDraggingRef.current = true;
      forceConnectionUpdate();
    };

    const stopDragUpdates = () => {
      isDraggingRef.current = false;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (dragTimeout) {
        clearTimeout(dragTimeout);
      }
    };

    // Watch for style changes on window elements (position updates) and new windows
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        // Handle style changes (position updates)
        if (mutation.type === 'attributes' &&
            mutation.attributeName === 'style' &&
            mutation.target instanceof HTMLElement &&
            mutation.target.hasAttribute('data-window-id')) {

          // Trigger immediate update when window position changes
          updateConnectionsDirectly();

          // Start continuous updates if not already running
          if (!isDraggingRef.current) {
            startDragUpdates();

            // Stop updates after a short delay if no more changes
            if (dragTimeout) clearTimeout(dragTimeout);
            dragTimeout = setTimeout(stopDragUpdates, 100);
          }
        }

        // Handle new window elements being added
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach(node => {
            if (node instanceof HTMLElement) {
              // Check if the added element is a window or contains windows
              const windowElements = node.hasAttribute?.('data-window-id')
                ? [node]
                : node.querySelectorAll?.('[data-window-id]') || [];

              windowElements.forEach(element => {
                observer.observe(element, {
                  attributes: true,
                  attributeFilter: ['style']
                });
              });
            }
          });
        }
      });
    });

    // Observe the document body for new windows and existing windows for style changes
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    // Also observe existing window elements
    const windowElements = document.querySelectorAll('[data-window-id]');
    windowElements.forEach(element => {
      observer.observe(element, {
        attributes: true,
        attributeFilter: ['style']
      });
    });

    // High-frequency mouse tracking for real-time updates during dragging
    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const windowElement = target.closest('[data-window-id]');

      // Check if we're clicking on a draggable area (title bar)
      if (windowElement && (target.classList.contains('cursor-move') || target.closest('.cursor-move'))) {
        startDragUpdates();
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      // If any mouse button is pressed, update connections immediately
      if (e.buttons > 0) {
        // Force immediate update on every mousemove during drag
        updateConnectionsDirectly();

        // Also ensure continuous updates are running
        if (!isDraggingRef.current) {
          startDragUpdates();
        }
      }
    };

    const handleMouseUp = () => {
      // Delay stopping to catch any final position updates
      if (dragTimeout) clearTimeout(dragTimeout);
      dragTimeout = setTimeout(stopDragUpdates, 100);
    };

    // Use high frequency event listeners
    document.addEventListener('mousedown', handleMouseDown, { passive: true });
    document.addEventListener('mousemove', handleMouseMove, { passive: true });
    document.addEventListener('mouseup', handleMouseUp, { passive: true });

    return () => {
      observer.disconnect();
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      stopDragUpdates();
    };
  }, [isVisible]); // Keep dependencies stable

  const getWindowCenter = (windowId: string) => {
    // First try to get the actual DOM position for real-time updates during dragging
    const windowElement = document.querySelector(`[data-window-id="${windowId}"]`) as HTMLElement;
    if (windowElement) {
      const rect = windowElement.getBoundingClientRect();
      const scrollX = globalThis.window.scrollX || document.documentElement.scrollLeft;
      const scrollY = globalThis.window.scrollY || document.documentElement.scrollTop;

      return {
        x: rect.left + scrollX + rect.width / 2,
        y: rect.top + scrollY + rect.height / 2
      };
    }

    // Fallback to stored window data if DOM element not found
    const windowData = windows.find(w => w.id === windowId);
    if (!windowData) return { x: 0, y: 0 };

    return {
      x: windowData.x + windowData.width / 2,
      y: windowData.y + windowData.height / 2
    };
  };

  // Direct SVG update function that bypasses React rendering
  const updateConnectionsDirectly = () => {
    if (!svgRef.current || !isVisible) return;

    const filteredConnections = connections.filter(
      conn => conn.score >= minSimilarityThreshold
    );

    filteredConnections.forEach((connection, index) => {
      const pathId = `connection-${connection.windowId1}-${connection.windowId2}`;
      const pathElement = svgRef.current?.querySelector(`[data-connection-id="${pathId}"]`) as SVGPathElement;

      if (pathElement) {
        const start = getWindowCenter(connection.windowId1);
        const end = getWindowCenter(connection.windowId2);

        if (start.x !== 0 || start.y !== 0 || end.x !== 0 || end.y !== 0) {
          // Create curved path
          const midX = (start.x + end.x) / 2;
          const midY = (start.y + end.y) / 2;
          const distance = Math.sqrt(Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2));
          const curvature = Math.min(distance * 0.2, 50);

          const angle = Math.atan2(end.y - start.y, end.x - start.x);
          const perpAngle = angle + Math.PI / 2;
          const controlX = midX + Math.cos(perpAngle) * curvature;
          const controlY = midY + Math.sin(perpAngle) * curvature;

          const pathData = `M ${start.x} ${start.y} Q ${controlX} ${controlY} ${end.x} ${end.y}`;
          pathElement.setAttribute('d', pathData);
        }
      }
    });
  };

  // Generate consistent colors for connection groups
  const getConnectionGroupColor = (connectionIndex: number) => {
    const colors = [
      '#3B82F6', // Blue
      '#EF4444', // Red
      '#10B981', // Green
      '#F59E0B', // Yellow
      '#8B5CF6', // Purple
      '#EC4899', // Pink
      '#06B6D4', // Cyan
      '#F97316', // Orange
      '#84CC16', // Lime
      '#6366F1', // Indigo
    ];
    return colors[connectionIndex % colors.length];
  };

  const getConnectionWidth = (score: number) => {
    // Much more dramatic thickness variation: 1px to 8px
    return Math.max(1, Math.round(score * 8));
  };

  // Group connections by connected components
  const getConnectionGroups = () => {
    const filteredConnections = connections.filter(
      conn => conn.score >= minSimilarityThreshold
    );

    if (filteredConnections.length === 0) return [];

    // Create adjacency map
    const adjacency = new Map<string, Set<string>>();

    filteredConnections.forEach(conn => {
      if (!adjacency.has(conn.windowId1)) {
        adjacency.set(conn.windowId1, new Set());
      }
      if (!adjacency.has(conn.windowId2)) {
        adjacency.set(conn.windowId2, new Set());
      }
      adjacency.get(conn.windowId1)!.add(conn.windowId2);
      adjacency.get(conn.windowId2)!.add(conn.windowId1);
    });

    // Find connected components using DFS
    const visited = new Set<string>();
    const groups: string[][] = [];

    const dfs = (windowId: string, currentGroup: string[]) => {
      if (visited.has(windowId)) return;
      visited.add(windowId);
      currentGroup.push(windowId);

      const neighbors = adjacency.get(windowId) || new Set();
      neighbors.forEach(neighbor => {
        if (!visited.has(neighbor)) {
          dfs(neighbor, currentGroup);
        }
      });
    };

    adjacency.forEach((_, windowId) => {
      if (!visited.has(windowId)) {
        const group: string[] = [];
        dfs(windowId, group);
        if (group.length > 0) {
          groups.push(group);
        }
      }
    });

    return groups;
  };

  const connectionGroups = getConnectionGroups();

  // Create mapping from windowId to group index
  const windowToGroupIndex = new Map<string, number>();
  connectionGroups.forEach((group, groupIndex) => {
    group.forEach(windowId => {
      windowToGroupIndex.set(windowId, groupIndex);
    });
  });

  const filteredConnections = connections.filter(
    conn => conn.score >= minSimilarityThreshold
  );

  const renderInfo = {
    isVisible,
    connectionsTotal: connections.length,
    filteredConnections: filteredConnections.length,
    threshold: minSimilarityThreshold,
    allConnections: connections.map(c => ({
      ...c,
      scorePercent: Math.round(c.score * 100) + '%'
    }))
  };

  console.log('🎨 ConnectionRenderer:', renderInfo);

  // Send to system output
  import('@/lib/eventBus').then(({ eventBus }) => {
    eventBus.emit('system:output', {
      text: `🎨 ConnectionRenderer:\n${JSON.stringify(renderInfo, null, 2)}\n\n`
    });
  });

  if (!isVisible || filteredConnections.length === 0) {
    const noRenderInfo = { isVisible, filteredLength: filteredConnections.length };
    console.log('❌ No connections to render:', noRenderInfo);

    import('@/lib/eventBus').then(({ eventBus }) => {
      eventBus.emit('system:output', {
        text: `❌ No connections to render:\n${JSON.stringify(noRenderInfo, null, 2)}\n\n`
      });
    });

    return null;
  }

  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1920;
  const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 1080;

  return (
    <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 5 }}>
      <svg
        ref={svgRef}
        className="w-full h-full"
        width={viewportWidth}
        height={viewportHeight}
        viewBox={`0 0 ${viewportWidth} ${viewportHeight}`}
        style={{ pointerEvents: 'auto' }}
        onClick={() => setSelectedConnection(null)}
      >
        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>


        {filteredConnections.map((connection, index) => {
          const start = getWindowCenter(connection.windowId1);
          const end = getWindowCenter(connection.windowId2);

          if (index === 0) {
            console.log('🎯 First connection coordinates:', {
              windowId1: connection.windowId1,
              windowId2: connection.windowId2,
              start,
              end
            });
          }

          if (start.x === 0 && start.y === 0 || end.x === 0 && end.y === 0) {
            return null;
          }

          const isHovered = hoveredConnection?.windowId1 === connection.windowId1 &&
                           hoveredConnection?.windowId2 === connection.windowId2;
          const isSelected = selectedConnection?.windowId1 === connection.windowId1 &&
                           selectedConnection?.windowId2 === connection.windowId2;

          // Get group color based on window group or use gray for deleted connections
          const groupIndex = windowToGroupIndex.get(connection.windowId1) || 0;
          const connectionColor = connection.score === 0
            ? '#6B7280' // Gray color for deleted connections (0%)
            : getConnectionGroupColor(groupIndex);

          // Create a curved path for better aesthetics
          const midX = (start.x + end.x) / 2;
          const midY = (start.y + end.y) / 2;
          const distance = Math.sqrt(Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2));
          const curvature = Math.min(distance * 0.2, 50);

          // Calculate perpendicular offset for curve
          const angle = Math.atan2(end.y - start.y, end.x - start.x);
          const perpAngle = angle + Math.PI / 2;
          const controlX = midX + Math.cos(perpAngle) * curvature;
          const controlY = midY + Math.sin(perpAngle) * curvature;

          const pathData = `M ${start.x} ${start.y} Q ${controlX} ${controlY} ${end.x} ${end.y}`;

          // Calculate the exact point on the Bézier curve at t=0.5 (midpoint)
          const t = 0.5;
          const curvePointX = (1 - t) * (1 - t) * start.x + 2 * (1 - t) * t * controlX + t * t * end.x;
          const curvePointY = (1 - t) * (1 - t) * start.y + 2 * (1 - t) * t * controlY + t * t * end.y;

          const connectionId = `connection-${connection.windowId1}-${connection.windowId2}`;

          return (
            <g key={`${connection.windowId1}-${connection.windowId2}`}>
              {/* Invisible wider hover and click area */}
              <path
                d={pathData}
                stroke="transparent"
                strokeWidth={connection.score === 0 ? 10 : getConnectionWidth(connection.score) * 5}
                fill="none"
                style={{
                  pointerEvents: 'stroke',
                  strokeLinecap: 'round',
                  cursor: connection.score === 0 ? 'default' : 'pointer'
                }}
                onMouseEnter={() => setHoveredConnection(connection)}
                onMouseLeave={() => setHoveredConnection(null)}
                onClick={(e) => {
                  e.stopPropagation();
                  if (connection.score > 0) { // Only allow selection of non-deleted connections
                    setSelectedConnection(isSelected ? null : connection);
                  }
                }}
              />

              {/* Main connection line */}
              <path
                data-connection-id={connectionId}
                d={pathData}
                stroke={connectionColor}
                strokeWidth={connection.score === 0 ? 1 : getConnectionWidth(connection.score)}
                fill="none"
                opacity={connection.score === 0 ? 0.4 : (isSelected ? 1.0 : (isHovered ? 0.9 : 0.8))}
                filter={isSelected || isHovered ? "url(#glow)" : undefined}
                strokeDasharray={connection.score === 0 ? "3,6" : (isSelected ? "8,4" : (isHovered ? "5,5" : undefined))}
                className="transition-all duration-300"
                style={{
                  pointerEvents: 'none',
                  strokeLinecap: 'round'
                }}
              />


              {/* Similarity score label on hover */}
              {isHovered && !isSelected && (
                <g>
                  <rect
                    x={midX - 35}
                    y={midY - 30}
                    width="70"
                    height="25"
                    fill="rgba(0, 0, 0, 0.85)"
                    rx="6"
                  />
                  <text
                    x={midX}
                    y={midY - 12}
                    textAnchor="middle"
                    fill="white"
                    fontSize="13"
                    fontWeight="bold"
                  >
                    {Math.round(connection.score * 100)}%
                  </text>
                </g>
              )}

              {/* Selected connection info and delete button */}
              {isSelected && (
                <g>
                  {/* Score tooltip */}
                  <rect
                    x={midX - 35}
                    y={midY - 45}
                    width="70"
                    height="25"
                    fill="rgba(0, 0, 0, 0.85)"
                    rx="6"
                  />
                  <text
                    x={midX}
                    y={midY - 27}
                    textAnchor="middle"
                    fill="white"
                    fontSize="13"
                    fontWeight="bold"
                  >
                    {Math.round(connection.score * 100)}%
                  </text>

                  {/* Delete button */}
                  {onDeleteConnection && (
                    <g>
                      <circle
                        cx={midX}
                        cy={midY - 5}
                        r="12"
                        fill="rgba(239, 68, 68, 0.9)"
                        stroke="white"
                        strokeWidth="2"
                        style={{ cursor: 'pointer' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteConnection(connection);
                          setSelectedConnection(null);
                        }}
                      />
                      <text
                        x={midX}
                        y={midY - 1}
                        textAnchor="middle"
                        fill="white"
                        fontSize="14"
                        fontWeight="bold"
                        style={{
                          cursor: 'pointer',
                          pointerEvents: 'none',
                          userSelect: 'none'
                        }}
                      >
                        ×
                      </text>
                    </g>
                  )}
                </g>
              )}
            </g>
          );
        })}
      </svg>

      {/* Tooltip for hovered connection */}
      {hoveredConnection && (
        <div className="absolute top-4 left-4 bg-black/80 text-white p-3 rounded-lg shadow-lg max-w-xs pointer-events-none z-10">
          <div className="text-sm font-semibold mb-1">
            Similarity: {Math.round(hoveredConnection.score * 100)}%
          </div>
          {hoveredConnection.keywords.length > 0 && (
            <div className="text-xs">
              <div className="mb-1">Common keywords:</div>
              <div className="flex flex-wrap gap-1">
                {hoveredConnection.keywords.slice(0, 5).map((keyword, i) => (
                  <span key={i} className="bg-blue-600 px-1 py-0.5 rounded text-xs">
                    {keyword}
                  </span>
                ))}
                {hoveredConnection.keywords.length > 5 && (
                  <span className="text-gray-400 text-xs">
                    +{hoveredConnection.keywords.length - 5} more
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}