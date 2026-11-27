export interface AlertBadgeSnapshot {
	y: number;
	text: string;
	active: boolean;
}

export interface CaptureChartOptions {
	stageEl: HTMLElement | null;
	alertBadges?: readonly AlertBadgeSnapshot[];
}

const SNAPSHOT_FONT_FAMILY = "Calibri, Carlito, Arial, sans-serif";
const SNAPSHOT_SVG_FONT_SIZE = '9';
const SNAPSHOT_BADGE_FONT = `9px ${SNAPSHOT_FONT_FAMILY}`;

async function loadImageFromSvgElement(
	svgEl: SVGSVGElement,
	width: number,
	height: number
): Promise<HTMLImageElement> {
	const cloned = svgEl.cloneNode(true) as SVGSVGElement;
	cloned.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
	cloned.setAttribute('width', String(Math.max(1, Math.round(width))));
	cloned.setAttribute('height', String(Math.max(1, Math.round(height))));

	const textNodes = Array.from(cloned.querySelectorAll('text'));
	for (const txt of textNodes) {
		txt.setAttribute('font-family', SNAPSHOT_FONT_FAMILY);
		txt.setAttribute('font-size', SNAPSHOT_SVG_FONT_SIZE);
	}

	const serializer = new XMLSerializer();
	const svgString = serializer.serializeToString(cloned);
	const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
	const url = URL.createObjectURL(blob);

	try {
		return await new Promise<HTMLImageElement>((resolve, reject) => {
			const img = new Image();
			img.onload = () => resolve(img);
			img.onerror = () => reject(new Error('Не удалось отрисовать SVG-слой на снимке'));
			img.src = url;
		});
	} finally {
		URL.revokeObjectURL(url);
	}
}

function drawAlertBadges(
	ctx: CanvasRenderingContext2D,
	badges: readonly AlertBadgeSnapshot[],
	dpr: number
) {
	if (badges.length === 0) return;

	ctx.save();
	ctx.scale(dpr, dpr);
	ctx.font = SNAPSHOT_BADGE_FONT;
	ctx.textBaseline = 'middle';

	for (const badge of badges) {
		if (!Number.isFinite(badge.y) || !badge.text) continue;
		const textWidth = ctx.measureText(badge.text).width;
		const padX = 5;
		const boxW = Math.ceil(textWidth + padX * 2);
		const boxH = 15;
		const x = 10;
		const y = Math.round(badge.y - boxH / 2);

		ctx.fillStyle = 'rgba(22, 22, 22, 0.95)';
		ctx.strokeStyle = badge.active ? 'rgba(245, 158, 11, 0.65)' : 'rgba(100, 116, 139, 0.7)';
		ctx.lineWidth = 1;

		ctx.beginPath();
		ctx.roundRect(x, y, boxW, boxH, 4);
		ctx.fill();
		ctx.stroke();

		ctx.fillStyle = badge.active ? '#fcd34d' : '#94a3b8';
		ctx.fillText(badge.text, x + padX, y + boxH / 2 + 0.5);
	}

	ctx.restore();
}

export async function captureChartAreaBlob({
	stageEl,
	alertBadges = [],
}: CaptureChartOptions): Promise<Blob> {
	if (!stageEl) {
		throw new Error('Область графика не найдена');
	}

	const rect = stageEl.getBoundingClientRect();
	const width = Math.max(1, Math.round(rect.width));
	const height = Math.max(1, Math.round(rect.height));
	const dpr = Math.min(window.devicePixelRatio || 1, 2);

	const canvas = document.createElement('canvas');
	canvas.width = Math.round(width * dpr);
	canvas.height = Math.round(height * dpr);

	const ctx = canvas.getContext('2d');
	if (!ctx) {
		throw new Error('Не удалось создать контекст холста для скриншота');
	}

	// Базовый фон графика
	ctx.fillStyle = '#161616';
	ctx.fillRect(0, 0, canvas.width, canvas.height);

	// 1. Холсты Lightweight Charts
	const canvases = Array.from(stageEl.querySelectorAll('canvas'));
	for (const srcCanvas of canvases) {
		if (srcCanvas.width === 0 || srcCanvas.height === 0) continue;
		const cRect = srcCanvas.getBoundingClientRect();
		if (cRect.width <= 0 || cRect.height <= 0) continue;

		const dx = (cRect.left - rect.left) * dpr;
		const dy = (cRect.top - rect.top) * dpr;
		const dw = cRect.width * dpr;
		const dh = cRect.height * dpr;

		ctx.drawImage(srcCanvas, 0, 0, srcCanvas.width, srcCanvas.height, dx, dy, dw, dh);
	}

	// 2. SVG-слои рисунков и линий алертов
	const svgs = Array.from(stageEl.querySelectorAll('svg'));
	for (const svgEl of svgs) {
		const sRect = svgEl.getBoundingClientRect();
		if (sRect.width <= 0 || sRect.height <= 0) continue;

		const img = await loadImageFromSvgElement(svgEl, sRect.width, sRect.height);

		const dx = (sRect.left - rect.left) * dpr;
		const dy = (sRect.top - rect.top) * dpr;
		const dw = sRect.width * dpr;
		const dh = sRect.height * dpr;

		ctx.drawImage(img, dx, dy, dw, dh);
	}

	// 3. Бейджи цен на линиях алертов
	drawAlertBadges(ctx, alertBadges, dpr);

	return new Promise<Blob>((resolve, reject) => {
		canvas.toBlob((blob) => {
			if (!blob) {
				reject(new Error('Не удалось сформировать PNG-изображение'));
				return;
			}
			resolve(blob);
		}, 'image/png');
	});
}