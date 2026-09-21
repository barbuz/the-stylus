/**
 * Pure inverse-check helpers.
 *
 * A mirror (inverse) pair is the same matchup with the players swapped: one
 * deck wins on the play, the other on the draw. Both sides being Loss, or a
 * Tie beside a Loss, is what the sheet flags as a suspected inverse error.
 */

/**
 * Whether two outcomes can be compared as an inverse pair at all: both must be
 * numeric. 'Incomplete', 'Discrepancy', blanks and null are not.
 */
export function isOutcomeValueValidForInverse(value) {
    if (value == null) {
        return false;
    }
    const str = value.toString().trim();
    if (!str) {
        return false;
    }
    const lower = str.toLowerCase();
    if (lower === 'incomplete' || lower === 'discrepancy') {
        return false;
    }
    const num = parseFloat(str);
    return !isNaN(num);
}

/** Whether a current/inverse outcome pair looks like a suspected inverse error. */
export function isSuspectedInversePair(currentOutcome, inverseOutcome) {
    if (!isOutcomeValueValidForInverse(currentOutcome) ||
        !isOutcomeValueValidForInverse(inverseOutcome)) {
        return false;
    }

    const currentNum = parseFloat(currentOutcome);
    const inverseNum = parseFloat(inverseOutcome);

    return (
        (currentNum === 0.0 || inverseNum === 0.0) &&
        currentNum !== 1.0 &&
        inverseNum !== 1.0
    );
}

/**
 * Inverse error for the row at `rowIndex`: find its mirror and compare
 * outcomes. `rows` is the whole row list; `findMirror` is passed in to avoid a
 * circular import with matchRows.
 */
export function isInverseErrorSuspected(rows, rowIndex, findMirror) {
    if (rowIndex == null || rowIndex < 0 || rowIndex >= rows.length) {
        return false;
    }

    const currentRow = rows[rowIndex];
    if (!currentRow) {
        return false;
    }

    const mirrorIndex = findMirror(rowIndex);
    if (mirrorIndex === -1) {
        return false;
    }

    const inverseRow = rows[mirrorIndex];
    if (!inverseRow) {
        return false;
    }

    return isSuspectedInversePair(currentRow.outcomeValue, inverseRow.outcomeValue);
}