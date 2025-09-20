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
	animationState?: 'opening' | 'closing' | 'none';
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
	onFocus,
	animationState = 'none'
}: ImageWindowProps) {
	const windowRef = useRef<HTMLDivElement>(null);
	const [position, setPosition] = useState({ x: initialX, y: initialY });
	const [size, setSize] = useState({ width, height });
	const isDraggingRef = useRef(false);
	const isResizingRef = useRef(false);
	const dragOffsetRef = useRef({ x: 0, y: 0 });
	const resizeStartRef = useRef({ x: 0, y: 0, width: 0, height: 0 });

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
		if (isDraggingRef.current) {
			setPosition({
				x: e.clientX - dragOffsetRef.current.x,
				y: e.clientY - dragOffsetRef.current.y
			});
		}
	};

	const onResizeMouseMove = (e: MouseEvent) => {
		if (!isResizingRef.current) return;
		const deltaX = e.clientX - resizeStartRef.current.x;
		const deltaY = e.clientY - resizeStartRef.current.y;
		
		// Calculate the aspect ratio from the original size
		const originalAspectRatio = resizeStartRef.current.width / resizeStartRef.current.height;
		
		// Calculate new dimensions based on the larger delta to maintain aspect ratio
		const deltaWidth = resizeStartRef.current.width + deltaX;
		const deltaHeight = resizeStartRef.current.height + deltaY;
		
		let newWidth, newHeight;
		
		// Determine which dimension to use as the primary (larger change)
		if (Math.abs(deltaX) > Math.abs(deltaY)) {
			// Width is the primary dimension
			newWidth = Math.max(200, deltaWidth);
			newHeight = newWidth / originalAspectRatio;
		} else {
			// Height is the primary dimension
			newHeight = Math.max(150, deltaHeight);
			newWidth = newHeight * originalAspectRatio;
		}
		
		// Ensure minimum dimensions
		newWidth = Math.max(200, newWidth);
		newHeight = Math.max(150, newHeight);
		
		setSize({ width: newWidth, height: newHeight });
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

	const getAnimationClasses = () => {
		const baseClasses = 'absolute rounded-2xl shadow-2xl overflow-hidden border-2 backdrop-blur-sm bg-black/20 transition-colors duration-150';
		const borderClasses = isActive ? 'border-blue-400/80 shadow-blue-400/20' : 'border-white/20';

		switch (animationState) {
			case 'opening':
				return `${baseClasses} ${borderClasses} animate-window-open`;
			case 'closing':
				return `${baseClasses} ${borderClasses} animate-window-close`;
			default:
				return `${baseClasses} ${borderClasses}`;
		}
	};

	return (
		<div
			ref={windowRef}
			data-window-id={id}
			className={getAnimationClasses()}
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

			{/* Resize handle - bottom right corner */}
			<div
				className="absolute bottom-0 right-0 w-6 h-6 cursor-se-resize z-20"
				onMouseDown={onResizeMouseDown}
				style={{
					background: 'linear-gradient(-45deg, transparent 30%, rgba(255,255,255,0.4) 30%, rgba(255,255,255,0.4) 70%, transparent 70%)'
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
