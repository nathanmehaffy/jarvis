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
	onClose = () => {},
	onMinimize,
	onRestore,
	onFullscreen = () => {},
	onFocus = () => {},
	onPositionChange,
	lockAspectRatio = false,
	headerStyle = 'standard',
	resizable = false
}: WindowProps) {
	const windowRef = useRef<HTMLDivElement>(null);
	const [position, setPosition] = useState({ x: initialX, y: initialY });
	const [size, setSize] = useState({ width, height });
	const isDraggingRef = useRef(false);
	const dragOffsetRef = useRef({ x: 0, y: 0 });
	const currentPositionRef = useRef({ x: initialX, y: initialY });
	const isResizingRef = useRef(false);
	const resizeStartRef = useRef({ x: 0, y: 0, width: 0, height: 0 });

	useEffect(() => {
		setPosition({ x: initialX, y: initialY });
		currentPositionRef.current = { x: initialX, y: initialY };
	}, [initialX, initialY]);

	useEffect(() => {
		setSize({ width, height });
	}, [width, height]);

	const onMouseDown = (e: React.MouseEvent) => {
		onFocus();
		isDraggingRef.current = true;
		dragOffsetRef.current = {
			x: e.clientX - position.x,
			y: e.clientY - position.y
		};
		document.addEventListener('mousemove', onMouseMove);
		document.addEventListener('mouseup', onMouseUp);
	};

	const onResizeMouseDown = (e: React.MouseEvent) => {
		e.stopPropagation();
		onFocus();
		isResizingRef.current = true;
		resizeStartRef.current = {
			x: e.clientX,
			y: e.clientY,
			width: size.width,
			height: size.height
		};
		document.addEventListener('mousemove', onResizeMouseMove);
		document.addEventListener('mouseup', onResizeMouseUp);
	};

	const onMouseMove = (e: MouseEvent) => {
		if (!isDraggingRef.current) return;
		const newPosition = {
			x: e.clientX - dragOffsetRef.current.x,
			y: e.clientY - dragOffsetRef.current.y
		};
		setPosition(newPosition);
		currentPositionRef.current = newPosition;
	};

	const onMouseUp = () => {
		isDraggingRef.current = false;
		document.removeEventListener('mousemove', onMouseMove);
		document.removeEventListener('mouseup', onMouseUp);

		if (onPositionChange) {
			onPositionChange(id, currentPositionRef.current.x, currentPositionRef.current.y);
		}
	};

	const onResizeMouseMove = (e: MouseEvent) => {
		if (!isResizingRef.current) return;
		const deltaX = e.clientX - resizeStartRef.current.x;
		const deltaY = e.clientY - resizeStartRef.current.y;

		let newWidth = Math.max(200, resizeStartRef.current.width + deltaX);
		let newHeight = Math.max(150, resizeStartRef.current.height + deltaY);

		if (lockAspectRatio) {
			const ratio = resizeStartRef.current.width / Math.max(1, resizeStartRef.current.height);
			if (Math.abs(deltaX) > Math.abs(deltaY)) {
				newHeight = newWidth / ratio;
			} else {
				newWidth = newHeight * ratio;
			}
		}

		setSize({ width: newWidth, height: newHeight });
	};

	const onResizeMouseUp = () => {
		isResizingRef.current = false;
		document.removeEventListener('mousemove', onResizeMouseMove);
		document.removeEventListener('mouseup', onResizeMouseUp);
	};

	const handleMinimizeClick = () => {
		if (isMinimized) {
			onRestore();
		} else {
			onMinimize();
		}
	};

	return (
		<div
			ref={windowRef}
			data-window-id={id}
			className={`absolute bg-white rounded-xl shadow-2xl overflow-hidden border border-black/5 ${isFullscreen ? 'fixed inset-0 rounded-none z-50' : ''}`}
			style={isFullscreen ? {} : {
				left: position.x,
				top: position.y,
				width: size.width,
				height: isMinimized ? 'auto' : size.height
			}}
			onMouseDown={() => onFocus()}
		>
			{headerStyle === 'standard' ? (
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
			) : (
				<div className="absolute top-3 right-3 flex space-x-2 z-30">
					<button
						onClick={onClose}
						className="w-6 h-6 rounded-full bg-red-500/40 hover:bg-red-600/60 backdrop-blur-sm flex items-center justify-center transition-all duration-200 hover:scale-110"
						title="Close"
					>
						<svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
						</svg>
					</button>
				</div>
			)}
			{!isMinimized && (
				<div className={`w-full bg-white ${isFullscreen ? 'h-[calc(100vh-36px)]' : 'h-[calc(100%-36px)]'}`}>
					{children}
					{resizable && !isFullscreen && (
						<div
							className="absolute bottom-0 right-0 w-6 h-6 cursor-se-resize z-20"
							onMouseDown={onResizeMouseDown}
							style={{
								background: 'linear-gradient(-45deg, transparent 30%, rgba(0,0,0,0.1) 30%, rgba(0,0,0,0.1) 70%, transparent 70%)'
							}}
						/>
					)}
				</div>
			)}
		</div>
	);
}

export default Window;