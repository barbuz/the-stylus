/**
 * Pure guru-colour helpers.
 *
 * A row carries one analysis and one signature per colour (Red/Blue/Green).
 * These helpers resolve a colour to the right field or column without knowing
 * anything about the DOM, gapi, or the interface instance.
 */

export const GURU_COLORS = ['red', 'blue', 'green'];

/** The current colour's analysis value on a row ('' when unset or unknown colour). */
export function getCurrentColorAnalysis(row, colour) {
    switch (colour) {
        case 'red':
            return row.redAnalysis || '';
        case 'blue':
            return row.blueAnalysis || '';
        case 'green':
            return row.greenAnalysis || '';
        default:
            return '';
    }
}

/** The current colour's signature on a row ('' when unset or unknown colour). */
export function getCurrentColorSignature(row, colour) {
    switch (colour) {
        case 'red':
            return row.redSignature || '';
        case 'blue':
            return row.blueSignature || '';
        case 'green':
            return row.greenSignature || '';
        default:
            return '';
    }
}

/**
 * Column index for a colour and type ('analysis' or 'signature'), or -1 for an
 * unknown colour or type. `colIndices` uses the class attribute names, e.g.
 * { redAnalysis, redSignature, ... }.
 */
export function getCurrentGuruColIndex(colour, colIndices, type = 'analysis') {
    let key;
    switch (type) {
        case 'analysis':
            key = { red: 'redAnalysis', blue: 'blueAnalysis', green: 'greenAnalysis' }[colour];
            break;
        case 'signature':
            key = { red: 'redSignature', blue: 'blueSignature', green: 'greenSignature' }[colour];
            break;
        default:
            return -1;
    }
    if (!key) {
        return -1;
    }
    return colIndices[key] ?? -1;
}

/**
 * The colour the signature claimed in a row, or null when the signature is not
 * present in that row.
 */
export function getGuruColorInRow(row, signature) {
    if (row.redSignature === signature) {
        return 'red';
    }
    if (row.blueSignature === signature) {
        return 'blue';
    }
    if (row.greenSignature === signature) {
        return 'green';
    }

    return null;
}