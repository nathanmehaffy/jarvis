'use client';

import { useEffect, useRef, useState } from 'react';

interface WindowProps {
	children: React.ReactNode;
	id: string;
	title: string;
	initialX: number;
	initialY: number;
	width: number;
	height: number;
	isActive: boolean;
	onClose: () => void;
	onMinimize?: () => void;
	onFocus: () => void;
}

export function Window({
	children,
	id,
	title,
	initialX,
	initialY,
	width,
	height,
	isActive,
	onClose,
	onMinimize,
	onFocus
}: WindowProps) {
	const windowRef = useRef<HTMLDivElement>(null);
	const [position, setPosition] = useState({ x: initialX, y: initialY });
	const [size, setSize] = useState({ width, height });
	const [isMinimized, setIsMinimized] = useState(false);
	const isDraggingRef = useRef(false);
	const dragOffsetRef = useRef({ x: 0, y: 0 });

	useEffect(() => {
		setPosition({ x: initialX, y: initialY });
	}, [initialX, initialY]);

	useEffect(() => {
		setSize({ width, height });
	}, [width, height]);

	const handleMinimize = () => {
		setIsMinimized(true);
		onMinimize?.();
	};

	const handleClose = () => {
		onClose();
	};

	const handleRestore = () => {
		setIsMinimized(false);
		onFocus();
	};

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
		setPosition({
			x: e.clientX - dragOffsetRef.current.x,
			y: e.clientY - dragOffsetRef.current.y
		});
	};

	const onMouseUp = () => {
		isDraggingRef.current = false;
		document.removeEventListener('mousemove', onMouseMove);
		document.removeEventListener('mouseup', onMouseUp);
	};

	return (
		<div
			ref={windowRef}
			data-window-id={id}
			className="absolute bg-white rounded-xl shadow-2xl overflow-hidden border border-black/5"
			style={{ left: position.x, top: position.y, width: size.width, height: size.height }}
			onMouseDown={() => onFocus()}
		>
			<div
				className={`flex items-center justify-between px-3 py-2 select-none ${isMinimized ? 'cursor-pointer' : 'cursor-move'} ${isActive ? 'bg-gray-100' : 'bg-gray-50'}`}
				onMouseDown={isMinimized ? handleRestore : onMouseDown}
				title={isMinimized ? 'Click to restore' : 'Drag to move'}
			>
				<div className="flex items-center space-x-2">
					<button
						onClick={handleClose}
						className="w-3 h-3 rounded-full bg-red-400 hover:bg-red-500 flex items-center justify-center"
						title="Close window"
					>
						<span className="text-white text-xs">×</span>
					</button>
					<button
						onClick={handleMinimize}
						className="w-3 h-3 rounded-full bg-yellow-400 hover:bg-yellow-500 flex items-center justify-center"
						title="Minimize window"
					>
						<span className="text-white text-xs">−</span>
					</button>
					<span className="w-3 h-3 rounded-full bg-green-400"></span>
					<span className="ml-2 text-sm font-medium text-gray-800">{title}</span>
				</div>
			</div>
			<div className={`w-full bg-white ${isMinimized ? 'h-8 overflow-hidden' : 'h-[calc(100%-36px)]'}`}>
				{!isMinimized && children}
				{isMinimized && (
					<div className="flex items-center justify-center h-full text-gray-500 text-xs">
						Minimized
					</div>
				)}
			</div>
		</div>
	);
}

export default Window;