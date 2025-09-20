'use client';

import { useEffect, useRef, useState } from 'react';
import { WindowProps } from './window.types';

export function Window({
	children,
	id,
	title,
	initialX = 0,
	initialY = 0,
	width = 300,
	height = 200,
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

	useEffect(() => {
		setPosition({ x: initialX, y: initialY });
		currentPositionRef.current = { x: initialX, y: initialY };
	}, [initialX, initialY]);

	useEffect(() => {
		setSize({ width, height });
	}, [width, height]);

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

	const onMouseMove = (e: MouseEvent) => {
		if (isDraggingRef.current) {
			const newPosition = {
				x: e.clientX - dragOffsetRef.current.x,
				y: e.clientY - dragOffsetRef.current.y
			};
			setPosition(newPosition);
			currentPositionRef.current = newPosition;
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
		const baseClasses = 'absolute bg-white rounded-xl shadow-2xl overflow-hidden border border-black/5';

		if (isFullscreen) {
			return `${baseClasses} fixed inset-0 rounded-none z-50 transition-all duration-300 ease-out`;
		}

		switch (animationState) {
			case 'opening':
				return `${baseClasses} animate-window-open`;
			case 'closing':
				return `${baseClasses} animate-window-close`;
			default:
				return baseClasses;
		}
	};

	return (
		<div
			ref={windowRef}
			data-window-id={id}
			className={getAnimationClasses()}
			style={isFullscreen ? { zIndex } : {
				left: position.x,
				top: position.y,
				width: size.width,
				height: isMinimized ? 'auto' : size.height,
				zIndex
			}}
			onMouseDown={() => onFocus()}
		>
			<div className={`flex items-center px-3 py-2 select-none cursor-move ${isActive ? 'bg-gray-100' : 'bg-gray-50'}`} onMouseDown={onMouseDown}>
				<div className="flex items-center space-x-2">
					<div className="group flex items-center space-x-2">
						<button
							onClick={onClose}
							className="w-3 h-3 rounded-full bg-red-400 hover:bg-red-500 transition-colors duration-150 flex-shrink-0 flex items-center justify-center"
							onMouseDown={(e) => e.stopPropagation()}
						>
							<span className="text-xs text-gray-800 font-bold leading-none opacity-0 group-hover:opacity-100 transition-opacity duration-150">
								×
							</span>
						</button>
						<button
							onClick={handleMinimizeClick}
							className="w-3 h-3 rounded-full bg-yellow-400 hover:bg-yellow-500 transition-colors duration-150 flex-shrink-0 flex items-center justify-center"
							onMouseDown={(e) => e.stopPropagation()}
							title={isMinimized ? 'Restore' : 'Minimize'}
						>
							<span className="text-xs text-gray-800 font-bold leading-none opacity-0 group-hover:opacity-100 transition-opacity duration-150">
								{isMinimized ? '+' : '−'}
							</span>
						</button>
						<button
							onClick={onFullscreen}
							className="w-3 h-3 rounded-full bg-green-400 hover:bg-green-500 transition-colors duration-150 flex-shrink-0 flex items-center justify-center"
							onMouseDown={(e) => e.stopPropagation()}
							title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
						>
							<span className="text-xs text-gray-800 font-bold leading-none opacity-0 group-hover:opacity-100 transition-opacity duration-150">
								{isFullscreen ? '⤈' : '⤢'}
							</span>
						</button>
					</div>
					<span className="text-sm font-medium text-gray-800">{title}</span>
				</div>
			</div>
			{!isMinimized && (
				<div className={`w-full bg-white ${isFullscreen ? 'h-[calc(100vh-36px)]' : 'h-[calc(100%-36px)]'}`}>
					{children}
				</div>
			)}

			{/* Resize handles - only show when not minimized and not fullscreen */}
			{!isMinimized && !isFullscreen && (
				<>
					{/* Corner handles */}
					<div
						className="absolute top-0 left-0 w-3 h-3 cursor-nw-resize opacity-0 hover:opacity-100 transition-opacity"
						onMouseDown={(e) => onResizeStart(e, 'top-left')}
					/>
					<div
						className="absolute top-0 right-0 w-3 h-3 cursor-ne-resize opacity-0 hover:opacity-100 transition-opacity"
						onMouseDown={(e) => onResizeStart(e, 'top-right')}
					/>
					<div
						className="absolute bottom-0 left-0 w-3 h-3 cursor-sw-resize opacity-0 hover:opacity-100 transition-opacity"
						onMouseDown={(e) => onResizeStart(e, 'bottom-left')}
					/>
					<div
						className="absolute bottom-0 right-0 w-3 h-3 cursor-se-resize opacity-0 hover:opacity-100 transition-opacity bg-gray-300/50"
						onMouseDown={(e) => onResizeStart(e, 'bottom-right')}
					/>

					{/* Edge handles */}
					<div
						className="absolute top-0 left-3 right-3 h-1 cursor-n-resize opacity-0 hover:opacity-100 transition-opacity"
						onMouseDown={(e) => onResizeStart(e, 'top')}
					/>
					<div
						className="absolute bottom-0 left-3 right-3 h-1 cursor-s-resize opacity-0 hover:opacity-100 transition-opacity"
						onMouseDown={(e) => onResizeStart(e, 'bottom')}
					/>
					<div
						className="absolute top-3 bottom-3 left-0 w-1 cursor-w-resize opacity-0 hover:opacity-100 transition-opacity"
						onMouseDown={(e) => onResizeStart(e, 'left')}
					/>
					<div
						className="absolute top-3 bottom-3 right-0 w-1 cursor-e-resize opacity-0 hover:opacity-100 transition-opacity"
						onMouseDown={(e) => onResizeStart(e, 'right')}
					/>
				</>
			)}
		</div>
	);
}

export default Window;