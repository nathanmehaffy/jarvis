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
		const baseClasses = 'absolute bg-black/40 backdrop-blur-2xl rounded-2xl shadow-2xl border border-cyan-400/30 overflow-hidden hover:shadow-cyan-400/20 hover:shadow-2xl hover:bg-black/50 will-change-transform transition-all duration-300';
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
			style={{ 
				'--window-x': `${position.x}px`,
				'--window-y': `${position.y}px`,
				transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
				width: size.width, 
				height: size.height
			} as React.CSSProperties}
			onMouseDown={(e) => {
				e.stopPropagation();
				onFocus();
			}}
		>
			{/* Window controls in top-right corner */}
			<div className="absolute top-3 right-3 flex space-x-1 z-30">
				<button
					onClick={onClose}
					className="w-3 h-3 rounded-full bg-gradient-to-br from-purple-400 to-violet-600 hover:from-purple-300 hover:to-violet-500 transition-all duration-200 flex-shrink-0 flex items-center justify-center shadow-sm hover:shadow-purple-400/60 hover:shadow-lg transform hover:scale-110 ring-0 hover:ring-1 hover:ring-purple-400/60 neon-glow-purple"
					title="Close"
					style={{
						boxShadow: '0 0 8px rgba(168, 85, 247, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
					}}
				>
					<span className="text-[10px] text-white font-bold leading-none opacity-80 group-hover:opacity-100 transition-opacity duration-200 drop-shadow-sm">
						×
					</span>
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
