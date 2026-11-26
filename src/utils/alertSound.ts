export function playAlertSound(): void {
	try {
		const AudioCtx =
			window.AudioContext ||
			(window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
		if (!AudioCtx) return;

		const ctx = new AudioCtx();
		const now = ctx.currentTime;

		const tones = [
			{ freq: 880, start: now, duration: 0.12 },
			{ freq: 1174.66, start: now + 0.15, duration: 0.18 },
		];

		for (const tone of tones) {
			const osc = ctx.createOscillator();
			const gain = ctx.createGain();

			osc.type = 'sine';
			osc.frequency.setValueAtTime(tone.freq, tone.start);

			gain.gain.setValueAtTime(0.0001, tone.start);
			gain.gain.exponentialRampToValueAtTime(0.12, tone.start + 0.02);
			gain.gain.exponentialRampToValueAtTime(0.0001, tone.start + tone.duration);

			osc.connect(gain);
			gain.connect(ctx.destination);

			osc.start(tone.start);
			osc.stop(tone.start + tone.duration + 0.02);
		}

		window.setTimeout(() => {
			void ctx.close();
		}, 600);
	} catch {
		// Игнорируем ограничения автовоспроизведения браузера
	}
}