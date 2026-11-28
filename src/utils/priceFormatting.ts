const PRICE_MAX_CHARS = 7;

export function formatCompactPrice(value: number, decimalSep = '.'): string {
	if (!Number.isFinite(value)) return '—';
	const sign = value < 0 ? '-' : '';
	const absValue = Math.abs(value);
	const intPart = Math.trunc(absValue).toString();
	const intLengthWithSign = sign.length + intPart.length;

	if (intLengthWithSign >= PRICE_MAX_CHARS) {
		return `${sign}${Math.round(absValue).toString()}`;
	}

	const remainingForDecimalAndFraction = PRICE_MAX_CHARS - intLengthWithSign;
	if (remainingForDecimalAndFraction <= 1) {
		return `${sign}${Math.round(absValue).toString()}`;
	}

	const maxDecimals = remainingForDecimalAndFraction - 1;
	const factor = 10 ** maxDecimals;
	const roundedAbs = Math.round(absValue * factor) / factor;

	const roundedInt = Math.trunc(roundedAbs).toString();
	if (sign.length + roundedInt.length >= PRICE_MAX_CHARS) {
		return `${sign}${Math.round(roundedAbs).toString()}`;
	}

	const fixed = roundedAbs.toFixed(maxDecimals).replace(/\.?0+$/, '');
	const result = `${sign}${fixed}`.replace('.', decimalSep);
	return result.slice(0, PRICE_MAX_CHARS);
}
