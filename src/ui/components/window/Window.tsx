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
	onFocus: () => void;
	onPositionChange?: (id: string, x: number, y: number) => void;
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
	onFocus,
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

		// Notify parent of position change after drag using the current position ref
		if (onPositionChange) {
			onPositionChange(id, currentPositionRef.current.x, currentPositionRef.current.y);
		}
	};

	return (
		<div
			ref={windowRef}
			data-window-id={id}
			className="absolute bg-white rounded-xl shadow-2xl overflow-hidden border border-black/5"
			style={{ left: position.x, top: position.y, width: size.width, height: size.height }}
			onMouseDown={() => onFocus()}
		>
			<div className={`flex items-center justify-between px-3 py-2 select-none cursor-move ${isActive ? 'bg-gray-100' : 'bg-gray-50'}`} onMouseDown={onMouseDown}>
				<div className="flex items-center">
					<span className="text-sm font-medium text-gray-800">{title}</span>
				</div>
				<button
					onClick={onClose}
					className="w-3 h-3 rounded-full bg-red-400 hover:bg-red-500 transition-colors duration-150 flex-shrink-0"
					onMouseDown={(e) => e.stopPropagation()}
				></button>
			</div>
			<div className="w-full h-[calc(100%-36px)] bg-white">
				{children}
			</div>
		</div>
	);
}

export default Window;