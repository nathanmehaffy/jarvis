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
	onPositionChange
}: WindowProps) {
	const windowRef = useRef<HTMLDivElement>(null);
	const [position, setPosition] = useState({ x: initialX, y: initialY });
	const [size, setSize] = useState({ width, height });
	const isDraggingRef = useRef(false);
	const dragOffsetRef = useRef({ x: 0, y: 0 });
	const currentPositionRef = useRef({ x: initialX, y: initialY });

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
		</div>
	);
}

export default Window;