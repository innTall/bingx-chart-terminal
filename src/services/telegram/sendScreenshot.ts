export interface SendScreenshotParams {
	blob: Blob;
	symbol: string;
	timeframe: string;
	source?: string;
	lastPrice?: number | null;
	fileName?: string;
}

export interface SendScreenshotResult {
	ok: boolean;
	error?: string;
}

function escapeHtml(value: string): string {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;');
}

function buildCaption(params: SendScreenshotParams): string {
	const sym = escapeHtml(params.symbol.trim().toUpperCase());
	const tf = escapeHtml(params.timeframe.trim());
	const src = params.source ? escapeHtml(params.source.toUpperCase()) : '';
	const pricePart =
		typeof params.lastPrice === 'number' && Number.isFinite(params.lastPrice)
			? `\nPrice: <code>${params.lastPrice}</code>`
			: '';
	const sourcePart = src ? ` · ${src}` : '';

	return `<b>${sym}</b> (${tf}${sourcePart})${pricePart}`;
}

export async function sendScreenshotToTelegram(
	params: SendScreenshotParams
): Promise<SendScreenshotResult> {
	const botToken = String(import.meta.env.VITE_TELEGRAM_BOT_TOKEN ?? '').trim();
	const chatId = String(import.meta.env.VITE_TELEGRAM_CHAT_ID ?? '').trim();

	if (!botToken || !chatId) {
		return {
			ok: false,
			error: 'Не заданы VITE_TELEGRAM_BOT_TOKEN или VITE_TELEGRAM_CHAT_ID в .env',
		};
	}

	try {
		const formData = new FormData();
		const fileName =
			params.fileName ?? `${params.symbol.toLowerCase()}_${params.timeframe}.png`;

		formData.append('chat_id', chatId);
		formData.append('photo', params.blob, fileName);
		formData.append('caption', buildCaption(params));
		formData.append('parse_mode', 'HTML');

		const endpoint = `https://api.telegram.org/bot${encodeURIComponent(botToken)}/sendPhoto`;
		const response = await fetch(endpoint, {
			method: 'POST',
			body: formData,
		});

		const payload = (await response.json().catch(() => null)) as
			| { ok?: boolean; description?: string }
			| null;

		if (!response.ok || !payload?.ok) {
			return {
				ok: false,
				error: payload?.description || `Ошибка Telegram API (${response.status})`,
			};
		}

		return { ok: true };
	} catch (err) {
		return {
			ok: false,
			error: err instanceof Error ? err.message : 'Сетевая ошибка при отправке в Telegram',
		};
	}
}