'use client';

import { useEffect, useRef, useState } from 'react';

interface ImageWindowProps {
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
	imageUrl?: string;
}

export function ImageWindow({
	children,
	id,
	initialX,
	initialY,
	width,
	height,
	isActive,
	onClose,
	onFocus
}: ImageWindowProps) {
	const windowRef = useRef<HTMLDivElement>(null);
	const [position, setPosition] = useState({ x: initialX, y: initialY });
	const [size, setSize] = useState({ width, height });
	const isDraggingRef = useRef(false);
	const isResizingRef = useRef(false);
	const dragOffsetRef = useRef({ x: 0, y: 0 });
	const resizeStartRef = useRef({ x: 0, y: 0, width: 0, height: 0, startX: 0, startY: 0 });
	const resizeDirectionRef = useRef<string>('');

	useEffect(() => {
		setPosition({ x: initialX, y: initialY });
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

	const onResizeMouseDown = (e: React.MouseEvent, direction: string) => {
		e.stopPropagation();
		e.preventDefault();
		onFocus();
		isResizingRef.current = true;
		resizeDirectionRef.current = direction;
		resizeStartRef.current = {
			x: e.clientX,
			y: e.clientY,
			width: size.width,
			height: size.height,
			startX: position.x,
			startY: position.y
		};
		document.addEventListener('mousemove', onResizeMouseMove);
		document.addEventListener('mouseup', onResizeMouseUp);
	};

	const onMouseMove = (e: MouseEvent) => {
		if (isDraggingRef.current) {
			setPosition({
				x: e.clientX - dragOffsetRef.current.x,
				y: e.clientY - dragOffsetRef.current.y
			});
		}
	};

	const onResizeMouseMove = (e: MouseEvent) => {
		if (!isResizingRef.current) return;
		e.preventDefault();
		const deltaX = e.clientX - resizeStartRef.current.x;
		const deltaY = e.clientY - resizeStartRef.current.y;
		
		// Calculate the aspect ratio from the original size
		const originalAspectRatio = resizeStartRef.current.width / resizeStartRef.current.height;
		
		let newWidth, newHeight, newX = resizeStartRef.current.startX, newY = resizeStartRef.current.startY;
		
		// Use the larger delta for diagonal scaling (preserves aspect ratio)
		const scaleFactor = Math.max(Math.abs(deltaX), Math.abs(deltaY));
		const scaleDirection = (deltaX + deltaY) >= 0 ? 1 : -1;
		const actualDelta = scaleFactor * scaleDirection;
		
		switch (resizeDirectionRef.current) {
			case 'se': // Bottom-right
				newWidth = Math.max(200, resizeStartRef.current.width + actualDelta);
				newHeight = newWidth / originalAspectRatio;
				newX = resizeStartRef.current.startX;
				newY = resizeStartRef.current.startY;
				break;
			case 'sw': // Bottom-left
				newWidth = Math.max(200, resizeStartRef.current.width - actualDelta);
				newHeight = newWidth / originalAspectRatio;
				newX = resizeStartRef.current.startX + (resizeStartRef.current.width - newWidth);
				newY = resizeStartRef.current.startY;
				break;
			case 'ne': // Top-right
				newWidth = Math.max(200, resizeStartRef.current.width + actualDelta);
				newHeight = newWidth / originalAspectRatio;
				newX = resizeStartRef.current.startX;
				newY = resizeStartRef.current.startY + (resizeStartRef.current.height - newHeight);
				break;
			case 'nw': // Top-left
				newWidth = Math.max(200, resizeStartRef.current.width - actualDelta);
				newHeight = newWidth / originalAspectRatio;
				newX = resizeStartRef.current.startX + (resizeStartRef.current.width - newWidth);
				newY = resizeStartRef.current.startY + (resizeStartRef.current.height - newHeight);
				break;
			default:
				return;
		}
		
		// Ensure minimum dimensions
		newWidth = Math.max(200, newWidth);
		newHeight = Math.max(150, newHeight);
		
		setSize({ width: newWidth, height: newHeight });
		setPosition({ x: newX, y: newY });
	};

	const onMouseUp = () => {
		isDraggingRef.current = false;
		document.removeEventListener('mousemove', onMouseMove);
		document.removeEventListener('mouseup', onMouseUp);
	};

	const onResizeMouseUp = () => {
		isResizingRef.current = false;
		document.removeEventListener('mousemove', onResizeMouseMove);
		document.removeEventListener('mouseup', onResizeMouseUp);
	};

	return (
		<div
			ref={windowRef}
			data-window-id={id}
			className={`absolute rounded-2xl shadow-2xl overflow-hidden border-2 backdrop-blur-sm bg-black/20 transition-colors duration-150 select-none ${
				isActive ? 'border-blue-400/80 shadow-blue-400/20' : 'border-white/20'
			}`}
			style={{ 
				left: position.x, 
				top: position.y, 
				width: size.width, 
				height: size.height
			}}
			onMouseDown={(e) => {
				e.stopPropagation();
				onFocus();
			}}
		>
			{/* Minimal window controls in top-right corner */}
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

			{/* Resize handles - all 4 corners */}
			{/* Bottom-right */}
			<div
				className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize z-20 select-none"
				onMouseDown={(e) => onResizeMouseDown(e, 'se')}
				style={{
					background: 'linear-gradient(-45deg, transparent 40%, rgba(255,255,255,0.2) 40%, rgba(255,255,255,0.2) 60%, transparent 60%)'
				}}
			/>
			
			{/* Bottom-left */}
			<div
				className="absolute bottom-0 left-0 w-4 h-4 cursor-sw-resize z-20 select-none"
				onMouseDown={(e) => onResizeMouseDown(e, 'sw')}
				style={{
					background: 'linear-gradient(45deg, transparent 40%, rgba(255,255,255,0.2) 40%, rgba(255,255,255,0.2) 60%, transparent 60%)'
				}}
			/>
			
			{/* Top-right */}
			<div
				className="absolute top-0 right-0 w-4 h-4 cursor-ne-resize z-20 select-none"
				onMouseDown={(e) => onResizeMouseDown(e, 'ne')}
				style={{
					background: 'linear-gradient(45deg, transparent 40%, rgba(255,255,255,0.2) 40%, rgba(255,255,255,0.2) 60%, transparent 60%)'
				}}
			/>
			
			{/* Top-left */}
			<div
				className="absolute top-0 left-0 w-4 h-4 cursor-nw-resize z-20 select-none"
				onMouseDown={(e) => onResizeMouseDown(e, 'nw')}
				style={{
					background: 'linear-gradient(-45deg, transparent 40%, rgba(255,255,255,0.2) 40%, rgba(255,255,255,0.2) 60%, transparent 60%)'
				}}
			/>

			{/* Content area - this is the main draggable area */}
			<div 
				className="relative w-full h-full cursor-move"
				onMouseDown={(e) => {
					e.stopPropagation();
					onMouseDown(e);
				}}
			>
				{children}
			</div>
		</div>
	);
}

export default ImageWindow;
