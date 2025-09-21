'use client';

import { useEffect, useRef, useState } from 'react';
import { WindowProps } from './window.types';

export function Window({
	children,
	id,
	title,
	initialX = 0,
	initialY = 0,
	width = 500,
	height = 400,
	isActive = false,
	isMinimized,
	isFullscreen = false,
	zIndex = 10,
	onClose = () => {},
	onMinimize,
	onRestore,
	onFullscreen = () => {},
	onFocus = () => {},
	onPositionChange,
	lockAspectRatio = false,
	headerStyle = 'standard',
	resizable = false,
	animationState = 'none'
}: WindowProps) {
	const windowRef = useRef<HTMLDivElement>(null);
	const [position, setPosition] = useState({ x: initialX, y: initialY });
	const [size, setSize] = useState({ width, height });
	const isDraggingRef = useRef(false);
	const isResizingRef = useRef(false);
	const resizeDirectionRef = useRef<string>('');
	const dragOffsetRef = useRef({ x: 0, y: 0 });
	const currentPositionRef = useRef({ x: initialX, y: initialY });
	const resizeStartRef = useRef({ x: 0, y: 0, width: 0, height: 0 });
	const lastUpdateRef = useRef(0);
	const lastPositionChangeRef = useRef(0);

	useEffect(() => {
		setPosition({ x: initialX, y: initialY });
		currentPositionRef.current = { x: initialX, y: initialY };
	}, [initialX, initialY]);

	useEffect(() => {
		setSize({ width, height });
	}, [width, height]);

	// Cleanup animation frames on unmount
	useEffect(() => {
		return () => {
			if (lastUpdateRef.current) {
				cancelAnimationFrame(lastUpdateRef.current);
			}
		};
	}, []);

	const onMouseDown = (e: React.MouseEvent) => {
		if (isResizingRef.current) return;
		onFocus();
		isDraggingRef.current = true;
		dragOffsetRef.current = {
			x: e.clientX - position.x,
			y: e.clientY - position.y
		};
		document.addEventListener('mousemove', onMouseMove);
		document.addEventListener('mouseup', onMouseUp);
	};

// legacy resizer removed in favor of directional resize handles

	const onMouseMove = (e: MouseEvent) => {
		if (isDraggingRef.current) {
			const newPosition = {
				x: e.clientX - dragOffsetRef.current.x,
				y: e.clientY - dragOffsetRef.current.y
			};
			
			// Use requestAnimationFrame for smooth updates
			if (typeof window.requestAnimationFrame === 'function') {
				cancelAnimationFrame(lastUpdateRef.current);
				lastUpdateRef.current = requestAnimationFrame(() => {
					setPosition(newPosition);
					currentPositionRef.current = newPosition;
					
					// Throttle position change callbacks to reduce expensive operations
					const now = Date.now();
					if (now - lastPositionChangeRef.current > 16) { // ~60fps
						lastPositionChangeRef.current = now;
						if (onPositionChange) {
							onPositionChange(id, newPosition.x, newPosition.y);
						}
					}
				});
			} else {
				setPosition(newPosition);
				currentPositionRef.current = newPosition;
				
				// Throttle position change callbacks
				const now = Date.now();
				if (now - lastPositionChangeRef.current > 16) {
					lastPositionChangeRef.current = now;
					if (onPositionChange) {
						onPositionChange(id, newPosition.x, newPosition.y);
					}
				}
			}
		} else if (isResizingRef.current) {
			const direction = resizeDirectionRef.current;
			const deltaX = e.clientX - resizeStartRef.current.x;
			const deltaY = e.clientY - resizeStartRef.current.y;

			let newWidth = resizeStartRef.current.width;
			let newHeight = resizeStartRef.current.height;
			let newX = position.x;
			let newY = position.y;

			if (direction.includes('right')) {
				newWidth = Math.max(200, resizeStartRef.current.width + deltaX);
			}
			if (direction.includes('left')) {
				newWidth = Math.max(200, resizeStartRef.current.width - deltaX);
				newX = resizeStartRef.current.x + (resizeStartRef.current.width - newWidth);
			}
			if (direction.includes('bottom')) {
				newHeight = Math.max(150, resizeStartRef.current.height + deltaY);
			}
			if (direction.includes('top')) {
				newHeight = Math.max(150, resizeStartRef.current.height - deltaY);
				newY = resizeStartRef.current.y + (resizeStartRef.current.height - newHeight);
			}

			setSize({ width: newWidth, height: newHeight });
			if (newX !== position.x || newY !== position.y) {
				setPosition({ x: newX, y: newY });
				currentPositionRef.current = { x: newX, y: newY };
			}
		}
	};

	const onMouseUp = () => {
		isDraggingRef.current = false;
		isResizingRef.current = false;
		resizeDirectionRef.current = '';
		document.removeEventListener('mousemove', onMouseMove);
		document.removeEventListener('mouseup', onMouseUp);

		if (onPositionChange) {
			onPositionChange(id, currentPositionRef.current.x, currentPositionRef.current.y);
		}
	};

	const onResizeStart = (e: React.MouseEvent, direction: string) => {
		e.preventDefault();
		e.stopPropagation();
		onFocus();

		isResizingRef.current = true;
		resizeDirectionRef.current = direction;
		resizeStartRef.current = {
			x: e.clientX,
			y: e.clientY,
			width: size.width,
			height: size.height
		};

		document.addEventListener('mousemove', onMouseMove);
		document.addEventListener('mouseup', onMouseUp);
	};

	const handleMinimizeClick = () => {
		if (isMinimized) {
			onRestore();
		} else {
			onMinimize();
		}
	};

	const getAnimationClasses = () => {
		// Disable transitions during dragging for better performance
		const transitionClasses = isDraggingRef.current || isResizingRef.current 
			? 'will-change-transform' 
			: 'will-change-transform transition-all duration-300';
		
		const baseClasses = `absolute bg-black/40 backdrop-blur-2xl rounded-2xl shadow-2xl border border-cyan-400/30 overflow-hidden hover:shadow-cyan-400/20 hover:shadow-2xl hover:bg-black/50 ${transitionClasses}`;

		if (isFullscreen) {
			return `${baseClasses} fixed inset-0 rounded-none z-50 bg-black/60 border-cyan-400/50`;
		}

		const activeClasses = isActive
			? 'ring-2 ring-cyan-400/50 shadow-cyan-400/30 border-cyan-400/60 shadow-cyan-400/40'
			: 'shadow-black/40';

		switch (animationState) {
			case 'opening':
				return `${baseClasses} ${activeClasses} animate-window-open`;
			case 'closing':
				return `${baseClasses} ${activeClasses} animate-window-close`;
			default:
				return `${baseClasses} ${activeClasses}`;
		}
	};

	return (
		<div
			ref={windowRef}
			data-window-id={id}
			className={getAnimationClasses()}
			style={isFullscreen ? { zIndex } : {
				'--window-x': `${position.x}px`,
				'--window-y': `${position.y}px`,
				transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
				width: size.width,
				height: isMinimized ? 'auto' : size.height,
				zIndex
			} as React.CSSProperties}
			onMouseDown={() => onFocus()}
		>
			{headerStyle === 'standard' ? (
				<div className={`flex items-center px-3 py-2 select-none cursor-move backdrop-blur-sm ${isActive ? 'bg-gradient-to-r from-cyan-900/60 via-blue-900/50 to-purple-900/60 border-b border-cyan-400/40 shadow-inner shadow-cyan-400/20' : 'bg-gradient-to-r from-gray-900/60 via-slate-900/50 to-gray-900/60 border-b border-gray-600/30'}`} onMouseDown={onMouseDown}>
					<div className="flex items-center space-x-1.5">
						<div className="group flex items-center space-x-1">
							<button
								onClick={onClose}
								className="w-3 h-3 rounded-full bg-gradient-to-br from-purple-400 to-violet-600 hover:from-purple-300 hover:to-violet-500 transition-all duration-200 flex-shrink-0 flex items-center justify-center shadow-sm hover:shadow-purple-400/60 hover:shadow-lg transform hover:scale-110 ring-0 hover:ring-1 hover:ring-purple-400/60 neon-glow-purple"
								onMouseDown={(e) => e.stopPropagation()}
								style={{
									boxShadow: '0 0 8px rgba(168, 85, 247, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
								}}
							>
								<span className="text-[10px] text-white font-bold leading-none opacity-80 group-hover:opacity-100 transition-opacity duration-200 drop-shadow-sm">
									×
								</span>
							</button>
							<button
								onClick={handleMinimizeClick}
								className="w-3 h-3 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 transition-all duration-200 flex-shrink-0 flex items-center justify-center shadow-sm hover:shadow-cyan-400/60 hover:shadow-lg transform hover:scale-110 ring-0 hover:ring-1 hover:ring-cyan-400/60 neon-glow-cyan"
								onMouseDown={(e) => e.stopPropagation()}
								title={isMinimized ? 'Restore' : 'Minimize'}
								style={{
									boxShadow: '0 0 8px rgba(34, 211, 238, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
								}}
							>
								<span className="text-[10px] text-white font-bold leading-none opacity-80 group-hover:opacity-100 transition-opacity duration-200 drop-shadow-sm">
									{isMinimized ? '+' : '−'}
								</span>
							</button>
							<button
								onClick={onFullscreen}
								className="w-3 h-3 rounded-full bg-gradient-to-br from-lime-400 to-green-500 hover:from-lime-300 hover:to-green-400 transition-all duration-200 flex-shrink-0 flex items-center justify-center shadow-sm hover:shadow-lime-400/60 hover:shadow-lg transform hover:scale-110 ring-0 hover:ring-1 hover:ring-lime-400/60 neon-glow-lime"
								onMouseDown={(e) => e.stopPropagation()}
								title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
								style={{
									boxShadow: '0 0 8px rgba(163, 230, 53, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
								}}
							>
								<span className="text-[10px] text-white font-bold leading-none opacity-80 group-hover:opacity-100 transition-opacity duration-200 drop-shadow-sm">
									{isFullscreen ? '⤈' : '⤢'}
								</span>
							</button>
						</div>
						<span className={`text-xs font-semibold ${isActive ? 'text-cyan-200 drop-shadow-lg shadow-cyan-400/70' : 'text-cyan-300/90'}`}>{title}</span>
					</div>
				</div>
			) : (
				<>
					{/* Invisible draggable area for minimal header windows */}
					<div 
						className="absolute inset-0 cursor-move z-10"
						onMouseDown={onMouseDown}
						style={{ pointerEvents: 'auto' }}
					/>
					<div className="absolute top-3 right-3 flex space-x-2 z-30">
						<button
							onClick={onClose}
							className="w-6 h-6 rounded-full bg-red-500/40 hover:bg-red-600/60 backdrop-blur-sm flex items-center justify-center transition-all duration-200 hover:scale-110"
							title="Close"
							onMouseDown={(e) => e.stopPropagation()}
						>
							<svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
							</svg>
						</button>
					</div>
				</>
			)}
			{!isMinimized && (
				<div className={`w-full bg-black/30 backdrop-blur-sm border-t border-cyan-400/20 ${isFullscreen ? 'h-[calc(100vh-40px)]' : 'h-[calc(100%-40px)]'}`}>
					<div className="p-1">
						{children}
					</div>
				</div>
			)}

			{/* Resize handles - only show when resizable, not minimized and not fullscreen */}
			{resizable && !isMinimized && !isFullscreen && (
				<>
					{/* Corner handles */}
					<div className="absolute top-0 left-0 w-4 h-4 cursor-nw-resize opacity-0 hover:opacity-100 transition-all duration-200 bg-cyan-400/20 hover:bg-cyan-400/40 hover:shadow-cyan-400/50 hover:shadow-md rounded-br-lg" onMouseDown={(e) => onResizeStart(e, 'top-left')} />
					<div className="absolute top-0 right-0 w-4 h-4 cursor-ne-resize opacity-0 hover:opacity-100 transition-all duration-200 bg-cyan-400/20 hover:bg-cyan-400/40 hover:shadow-cyan-400/50 hover:shadow-md rounded-bl-lg" onMouseDown={(e) => onResizeStart(e, 'top-right')} />
					<div className="absolute bottom-0 left-0 w-4 h-4 cursor-sw-resize opacity-0 hover:opacity-100 transition-all duration-200 bg-cyan-400/20 hover:bg-cyan-400/40 hover:shadow-cyan-400/50 hover:shadow-md rounded-tr-lg" onMouseDown={(e) => onResizeStart(e, 'bottom-left')} />
					<div className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize opacity-0 hover:opacity-100 transition-all duration-200 bg-cyan-400/30 hover:bg-cyan-400/50 hover:shadow-cyan-400/50 hover:shadow-md rounded-tl-lg" onMouseDown={(e) => onResizeStart(e, 'bottom-right')} />

					{/* Edge handles */}
					<div className="absolute top-0 left-4 right-4 h-2 cursor-n-resize opacity-0 hover:opacity-100 transition-all duration-200 bg-cyan-400/10 hover:bg-cyan-400/30 hover:shadow-cyan-400/20 hover:shadow-sm" onMouseDown={(e) => onResizeStart(e, 'top')} />
					<div className="absolute bottom-0 left-4 right-4 h-2 cursor-s-resize opacity-0 hover:opacity-100 transition-all duration-200 bg-cyan-400/10 hover:bg-cyan-400/30 hover:shadow-cyan-400/20 hover:shadow-sm" onMouseDown={(e) => onResizeStart(e, 'bottom')} />
					<div className="absolute top-4 bottom-4 left-0 w-2 cursor-w-resize opacity-0 hover:opacity-100 transition-all duration-200 bg-cyan-400/10 hover:bg-cyan-400/30 hover:shadow-cyan-400/20 hover:shadow-sm" onMouseDown={(e) => onResizeStart(e, 'left')} />
					<div className="absolute top-4 bottom-4 right-0 w-2 cursor-e-resize opacity-0 hover:opacity-100 transition-all duration-200 bg-cyan-400/10 hover:bg-cyan-400/30 hover:shadow-cyan-400/20 hover:shadow-sm" onMouseDown={(e) => onResizeStart(e, 'right')} />
				</>
			)}
		</div>
	);
}

export default Window;