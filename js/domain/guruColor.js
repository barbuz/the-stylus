/**
 * Pure guru-colour helpers.
 *
 * A row carries one analysis and one signature per colour (Red/Blue/Green).
 * These helpers resolve a colour to the right field, column or label without
 * knowing anything about the DOM, gapi, or the interface instance.
 */

export const GURU_COLORS = ['red', 'blue', 'green'];

const KIND_FIELD_SUFFIX = { analysis: 'Analysis', signature: 'Signature' };

/**
 * The row/column field name for a colour and kind ('analysis' | 'signature'),
 * e.g. ('red', 'analysis') -> 'redAnalysis'. Returns null for unknown inputs.
 */
export function colourField(colour, kind) {
    if (!GURU_COLORS.includes(colour) || !Object.prototype.hasOwnProperty.call(KIND_FIELD_SUFFIX, kind)) {
        return null;
    }
    return colour + KIND_FIELD_SUFFIX[kind];
}

/** The colour with an initial capital, e.g. 'red' -> 'Red'. */
export function colourLabel(colour) {
    if (!colour) {
        return '';
    }
    return colour.charAt(0).toUpperCase() + colour.slice(1);
}

/** The current colour's analysis value on a row ('' when unset or unknown colour). */
export function getCurrentColorAnalysis(row, colour) {
    const field = colourField(colour, 'analysis');
    return field ? (row[field] || '') : '';
}

/** The current colour's signature on a row ('' when unset or unknown colour). */
export function getCurrentColorSignature(row, colour) {
    const field = colourField(colour, 'signature');
    return field ? (row[field] || '') : '';
}

/** Write the current colour's analysis on a row. No-op for an unknown colour. */
export function setColourAnalysis(row, colour, value) {
    const field = colourField(colour, 'analysis');
    if (field) {
        row[field] = value;
    }
}

/** Write the current colour's signature on a row. No-op for an unknown colour. */
export function setColourSignature(row, colour, value) {
    const field = colourField(colour, 'signature');
    if (field) {
        row[field] = value;
    }
}

/** A fresh per-colour column index, every entry -1 (not resolved). */
export function emptyColumnIndex() {
    const index = {};
    for (const colour of GURU_COLORS) {
        index[colour] = { analysis: -1, signature: -1 };
    }
    return index;
}

/**
 * Convert the flat `columnIndices` returned by `buildMatchRows` (keys such as
 * `redAnalysis`) into the nested `{ colour: { analysis, signature } }` shape.
 */
export function buildColumnIndex(flatIndices) {
    const index = emptyColumnIndex();
    for (const colour of GURU_COLORS) {
        index[colour].analysis = flatIndices[colourField(colour, 'analysis')] ?? -1;
        index[colour].signature = flatIndices[colourField(colour, 'signature')] ?? -1;
    }
    return index;
}

/**
 * Column index for a colour and kind ('analysis' or 'signature'), or -1 for an
 * unknown colour, kind, or unresolved index. `columnIndex` uses the nested
 * shape produced by `buildColumnIndex`.
 */
export function getCurrentGuruColIndex(colour, columnIndex, kind = 'analysis') {
    return columnIndex?.[colour]?.[kind] ?? -1;
}

/**
 * The colour the signature claimed in a row, or null when the signature is not
 * present in that row.
 */
export function getGuruColorInRow(row, signature) {
    for (const colour of GURU_COLORS) {
        if (getCurrentColorSignature(row, colour) === signature) {
            return colour;
        }
    }

    return null;
}