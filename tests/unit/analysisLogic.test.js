import test from 'node:test';
import assert from 'node:assert/strict';

import { GuruAnalysisInterface } from '../../js/modules/guruAnalysisInterface.js';
import { makeMergedGuruSheet, makeDeckNotesSheet, makeSheetData } from '../fixtures/sheetData.js';

/**
 * These tests exercise GuruAnalysisInterface's logic without touching the DOM
 * or Google. The constructor calls bindEvents(), which requires a browser, so we
 * borrow the prototype instead of constructing an instance.
 *
 * Anything requiring real instance state is set explicitly on the object under
 * test, which keeps the tested surface honest.
 */
function logic() {
    return Object.create(GuruAnalysisInterface.prototype);
}

function withState(state) {
    return Object.assign(logic(), state);
}

// --- Scoring: calculateOutcomeFromAnalyses -----------------------------------

test('outcome is the agreed value when all three gurus match', () => {
    const { calculateOutcomeFromAnalyses } = logic();
    assert.equal(calculateOutcomeFromAnalyses('1', '1', '1'), '1');
    assert.equal(calculateOutcomeFromAnalyses('0.5', '0.5', '0.5'), '0.5');
    assert.equal(calculateOutcomeFromAnalyses('0', '0', '0'), '0');
});

test('outcome is Incomplete when any guru has not scored', () => {
    const { calculateOutcomeFromAnalyses } = logic();
    assert.equal(calculateOutcomeFromAnalyses('1', '', '1'), 'Incomplete');
    assert.equal(calculateOutcomeFromAnalyses('', '', ''), 'Incomplete');
    assert.equal(calculateOutcomeFromAnalyses('1', '1', undefined), 'Incomplete');
});

test('outcome is Discrepancy when gurus disagree', () => {
    const { calculateOutcomeFromAnalyses } = logic();
    assert.equal(calculateOutcomeFromAnalyses('1', '0.5', '0'), 'Discrepancy');
    assert.equal(calculateOutcomeFromAnalyses('1', '0', '0'), 'Discrepancy');
});

test('outcome ignores surrounding whitespace', () => {
    const { calculateOutcomeFromAnalyses } = logic();
    assert.equal(calculateOutcomeFromAnalyses(' 1 ', '1', ' 1'), '1');
    assert.equal(calculateOutcomeFromAnalyses(' ', '', ''), 'Incomplete');
});

test('outcome compares raw strings, so formatted variants are a discrepancy', () => {
    // Characterization: '1.0' and '1' are both Win but are treated as different
    // analyses because comparison happens before normalisation.
    const { calculateOutcomeFromAnalyses } = logic();
    assert.equal(calculateOutcomeFromAnalyses('1.0', '1', '1'), 'Discrepancy');
});

// --- Normalisation -----------------------------------------------------------

test('normalizeAnalysisForComparison collapses equivalent numeric formats', () => {
    const { normalizeAnalysisForComparison } = logic();
    assert.equal(normalizeAnalysisForComparison('1.0'), '1');
    assert.equal(normalizeAnalysisForComparison(1), '1');
    assert.equal(normalizeAnalysisForComparison('0.50'), '0.5');
    assert.equal(normalizeAnalysisForComparison(' Discrepancy '), 'discrepancy');
    assert.equal(normalizeAnalysisForComparison(''), '');
    assert.equal(normalizeAnalysisForComparison(null), '');
    assert.equal(normalizeAnalysisForComparison(undefined), '');
});

test('getGuruAnalysisValues always returns three slots', () => {
    const { getGuruAnalysisValues } = logic();
    assert.deepEqual(getGuruAnalysisValues({ redAnalysis: '1', blueAnalysis: '', greenAnalysis: '0' }), ['1', '', '0']);
    assert.deepEqual(getGuruAnalysisValues({}), ['', '', '']);
    assert.deepEqual(getGuruAnalysisValues(null), []);
});

test('allGurusHaveMatchingResults requires three present, equal analyses', () => {
    const instance = logic();
    assert.equal(instance.allGurusHaveMatchingResults({ redAnalysis: '1', blueAnalysis: '1.0', greenAnalysis: '1' }), true);
    assert.equal(instance.allGurusHaveMatchingResults({ redAnalysis: '1', blueAnalysis: '1', greenAnalysis: '' }), false);
    assert.equal(instance.allGurusHaveMatchingResults({ redAnalysis: '1', blueAnalysis: '0', greenAnalysis: '1' }), false);
});

// --- Column detection --------------------------------------------------------

test('findColumnIndex matches case-insensitively on substrings', () => {
    const { findColumnIndex } = logic();
    const header = ['ID', 'Player 1', 'Player 2', 'Red Analysis', 'Red Signature'];
    assert.equal(findColumnIndex(header, ['Player 1', 'Player1']), 1);
    assert.equal(findColumnIndex(header, ['red analysis']), 3);
    assert.equal(findColumnIndex(header, ['Missing']), -1);
});

test('findColumnIndex falls back to later aliases and skips blank headers', () => {
    const { findColumnIndex } = logic();
    const header = ['ID', 'Player1', ''];
    assert.equal(findColumnIndex(header, ['Player 1', 'Player1']), 1);
    assert.equal(findColumnIndex([null, undefined, ''], ['Player 1']), -1);
});

// --- Row parsing -------------------------------------------------------------

test('processMergedGuruSheet maps columns and computes outcomes', () => {
    const sheet = makeMergedGuruSheet([
        ['1', 'Deck A', 'Deck B', '1', 'alice', '1', 'bob', '1', 'carol'],
        ['2', 'Deck A', 'Deck C', '0', 'alice', '', '', '', '']
    ]);
    const instance = withState({ allRows: [], numDiscrepancies: 0, currentGuruColor: 'red', guruSignature: '' });

    instance.processMergedGuruSheet(sheet, 0);

    assert.equal(instance.allRows.length, 2);
    assert.equal(instance.redAnalysisColIndex, 3);
    assert.equal(instance.greenSignatureColIndex, 8);
    assert.deepEqual(instance.allRows[0], {
        sheetIndex: 0,
        sheetTitle: 'Merged Gurus',
        sheetId: sheet.sheetId,
        rowIndex: 1,
        player1: 'Deck A',
        player2: 'Deck B',
        outcomeValue: '1',
        redAnalysis: '1',
        blueAnalysis: '1',
        greenAnalysis: '1',
        redSignature: 'alice',
        blueSignature: 'bob',
        greenSignature: 'carol',
        originalRowIndex: 1
    });
    assert.equal(instance.allRows[1].outcomeValue, 'Incomplete');
});

test('processMergedGuruSheet skips rows with no player data', () => {
    const sheet = makeMergedGuruSheet([
        ['1', '', '', '', '', '', '', '', ''],
        ['2', 'Deck A', 'Deck B', '1', '', '1', '', '1', '']
    ]);
    const instance = withState({ allRows: [], numDiscrepancies: 0, currentGuruColor: 'red', guruSignature: '' });

    instance.processMergedGuruSheet(sheet, 0);

    assert.equal(instance.allRows.length, 1);
    assert.equal(instance.allRows[0].player1, 'Deck A');
});

test('processMergedGuruSheet throws a helpful error when columns are missing', () => {
    const sheet = { title: 'Merged Gurus', sheetId: 1, values: [['ID', 'Player 1']] };
    const instance = withState({ allRows: [], numDiscrepancies: 0, currentGuruColor: 'red', guruSignature: '' });

    assert.throws(() => instance.processMergedGuruSheet(sheet, 0), /required columns are missing/);
});

test('processMergedGuruSheet counts my discrepancies only for claimed rows', () => {
    const sheet = makeMergedGuruSheet([
        // Discrepancy on a row alice has claimed and scored.
        ['1', 'Deck A', 'Deck B', '1', 'alice', '0', 'bob', '0', 'carol'],
        // Discrepancy on a row alice has NOT claimed.
        ['2', 'Deck C', 'Deck D', '1', '', '0', 'bob', '0', 'carol'],
        // No discrepancy.
        ['3', 'Deck E', 'Deck F', '1', 'alice', '1', 'bob', '1', 'carol']
    ]);
    const instance = withState({ allRows: [], numDiscrepancies: 0, currentGuruColor: 'red', guruSignature: 'alice' });

    instance.processMergedGuruSheet(sheet, 0);

    assert.equal(instance.numDiscrepancies, 1);
});

test('processSheet ignores non-guru sheets', () => {
    const instance = withState({ allRows: [], numDiscrepancies: 0, currentGuruColor: 'red', guruSignature: '' });
    instance.processSheet({ title: 'Deck Notes', values: [['Decklists']] }, 0);
    assert.equal(instance.allRows.length, 0);
});

// --- Deck notes parsing ------------------------------------------------------

test('processDeckNotes builds a map keyed by decklist', () => {
    const sheetData = makeSheetData({
        deckNotesRows: [
            ['Deck A | Deck B', '5', 'alice', 'some notes', 'more notes'],
            ['Deck C', '', '', '', ''],
            ['', '1', '', '', '']
        ]
    });
    const instance = logic();

    const result = instance.processDeckNotes(sheetData);

    assert.equal(result.columnMap.decklists, 0);
    assert.equal(result.deckNotesMap.size, 2);
    assert.deepEqual(result.deckNotesMap.get('Deck A | Deck B'), {
        row: 1,
        goldfishClock: '5',
        goldfishSignature: 'alice',
        notes: 'some notes',
        additionalNotes: 'more notes'
    });
    assert.deepEqual(result.deckNotesMap.get('Deck C'), { row: 2 });
});

test('processDeckNotes returns an empty map when the sheet is absent', () => {
    const instance = logic();
    assert.equal(instance.processDeckNotes(makeSheetData({ guruRows: [] })).size, 0);
    assert.equal(instance.processDeckNotes({}).size, 0);
    assert.equal(instance.processDeckNotes({ sheets: [{ title: 'Deck Notes', values: [['Decklists']] }] }).size, 0);
});

// --- Signature / colour helpers ---------------------------------------------

test('getCurrentColor* selects the right column per guru colour', () => {
    const row = { redAnalysis: '1', blueAnalysis: '0.5', greenAnalysis: '0', redSignature: 'r', blueSignature: 'b', greenSignature: 'g' };

    for (const [color, analysis, signature] of [['red', '1', 'r'], ['blue', '0.5', 'b'], ['green', '0', 'g']]) {
        const instance = withState({ currentGuruColor: color });
        assert.equal(instance.getCurrentColorAnalysis(row), analysis);
        assert.equal(instance.getCurrentColorSignature(row), signature);
    }
});

test('getCurrentColorAnalysis returns empty string for unknown colour', () => {
    const instance = withState({ currentGuruColor: null });
    assert.equal(instance.getCurrentColorAnalysis({ redAnalysis: '1' }), '');
    assert.equal(instance.getCurrentColorSignature({ redSignature: 'r' }), '');
});

test('signature predicates require a configured signature', () => {
    const row = { redSignature: 'alice', blueSignature: '', greenSignature: '' };

    const anonymous = withState({ currentGuruColor: 'red', guruSignature: '' });
    assert.equal(anonymous.rowHasCurrentGuruSignature(row), false);
    assert.equal(anonymous.rowHasCurrentGuruSignatureInColor(row), false);

    const alice = withState({ currentGuruColor: 'red', guruSignature: 'alice' });
    assert.equal(alice.rowHasCurrentGuruSignature(row), true);
    assert.equal(alice.rowHasCurrentGuruSignatureInColor(row), true);
    assert.equal(alice.rowHasEmptySignature(row), false);

    const bob = withState({ currentGuruColor: 'blue', guruSignature: 'bob' });
    assert.equal(bob.rowHasCurrentGuruSignature(row), false);
    assert.equal(bob.rowHasEmptySignature(row), true);
});

test('getGuruColorInRow reports which colour the guru claimed', () => {
    const instance = withState({ guruSignature: 'alice' });
    assert.equal(instance.getGuruColorInRow({ redSignature: '', blueSignature: 'alice', greenSignature: '' }), 'blue');
    assert.equal(instance.getGuruColorInRow({ redSignature: 'alice' }), 'red');
    assert.equal(instance.getGuruColorInRow({ redSignature: 'bob' }), null);
});

test('isMatchAvailableForAnalysis covers claimed, unclaimed and done rows', () => {
    const instance = withState({ currentGuruColor: 'red', guruSignature: 'alice' });

    // Unclaimed and unscored: available.
    assert.equal(instance.isMatchAvailableForAnalysis({ redSignature: '', redAnalysis: '' }), true);
    // Mine and unscored: available.
    assert.equal(instance.isMatchAvailableForAnalysis({ redSignature: 'alice', redAnalysis: '' }), true);
    // Mine but already scored: not available.
    assert.equal(instance.isMatchAvailableForAnalysis({ redSignature: 'alice', redAnalysis: '1' }), false);
    // Claimed by someone else: not available.
    assert.equal(instance.isMatchAvailableForAnalysis({ redSignature: 'bob', redAnalysis: '' }), false);
});

// --- Discrepancy predicates --------------------------------------------------

test('rowHasDiscrepancy detects disagreement and the Discrepancy outcome', () => {
    const instance = logic();
    assert.equal(instance.rowHasDiscrepancy({ outcomeValue: 'Discrepancy' }), true);
    assert.equal(instance.rowHasDiscrepancy({ redAnalysis: '1', blueAnalysis: '0', greenAnalysis: '0' }), true);
    assert.equal(instance.rowHasDiscrepancy({ redAnalysis: '1', blueAnalysis: '1', greenAnalysis: '1' }), false);
    // Characterization: two present-but-differing analyses already count as a
    // discrepancy, even though calculateOutcomeFromAnalyses still calls the row
    // Incomplete because the third guru has not scored.
    assert.equal(instance.rowHasDiscrepancy({ redAnalysis: '1', blueAnalysis: '0', greenAnalysis: '' }), true);
    // A single (or no) analysis cannot disagree with itself.
    assert.equal(instance.rowHasDiscrepancy({ redAnalysis: '1' }), false);
    assert.equal(instance.rowHasDiscrepancy({}), false);
});

test('rowHasMyDiscrepancy requires claim, result and disagreement', () => {
    const instance = withState({ currentGuruColor: 'red', guruSignature: 'alice' });
    assert.equal(instance.rowHasMyDiscrepancy({
        redAnalysis: '1', blueAnalysis: '0', greenAnalysis: '0', redSignature: 'alice'
    }), true);
    assert.equal(instance.rowHasMyDiscrepancy({
        redAnalysis: '1', blueAnalysis: '0', greenAnalysis: '0', redSignature: 'bob'
    }), false);
});

// --- Navigation --------------------------------------------------------------

test('findMirrorMatchIndex finds the swapped-fixture row', () => {
    const instance = withState({
        allRows: [
            { player1: 'A', player2: 'B' },
            { player1: 'C', player2: 'D' },
            { player1: 'B', player2: 'A' }
        ]
    });
    assert.equal(instance.findMirrorMatchIndex(0), 2);
    assert.equal(instance.findMirrorMatchIndex(1), -1);
    assert.equal(instance.findMirrorMatchIndex(99), -1);
    assert.equal(instance.findMirrorMatchIndex(-1), -1);
});

test('inverse error is suspected when one side is Loss and neither is Win', () => {
    const rows = [
        { outcomeValue: '0' }, { outcomeValue: '0' },   // both Loss -> suspected
        { outcomeValue: '1' }, { outcomeValue: '0' },   // 1/0 -> fine
        { outcomeValue: '0.5' }, { outcomeValue: '0' }  // tie/loss -> suspected
    ];
    const instance = withState({ allRows: rows });

    assert.equal(instance.isInverseErrorSuspected(0), true);
    assert.equal(instance.isInverseErrorSuspected(2), false);
    assert.equal(instance.isInverseErrorSuspected(4), true);
});

test('inverse checks are skipped for non-numeric outcomes', () => {
    const instance = withState({
        allRows: [
            { player1: 'A', player2: 'B', outcomeValue: 'Discrepancy' },
            { player1: 'B', player2: 'A', outcomeValue: '0' }
        ]
    });
    assert.equal(instance.isOutcomeValueValidForInverse('Discrepancy'), false);
    assert.equal(instance.isOutcomeValueValidForInverse('Incomplete'), false);
    assert.equal(instance.isOutcomeValueValidForInverse(''), false);
    assert.equal(instance.isOutcomeValueValidForInverse('1'), true);
    assert.equal(instance.isInverseErrorSuspected(0), false);
});

// --- Display formatting ------------------------------------------------------

test('getOutcomeDisplayName maps values to labels', () => {
    const instance = logic();
    assert.equal(instance.getOutcomeDisplayName('1'), 'Win');
    assert.equal(instance.getOutcomeDisplayName('0.5'), 'Tie');
    assert.equal(instance.getOutcomeDisplayName('0'), 'Loss');
    assert.equal(instance.getOutcomeDisplayName('Discrepancy'), 'Discrepancy');
    assert.equal(instance.getOutcomeDisplayName(''), '');
    assert.equal(instance.getOutcomeDisplayName('0.25'), 'Custom (0.25)');
});

test('getAnalysisClass exposes css class names', () => {
    const instance = logic();
    assert.equal(instance.getAnalysisClass('1'), 'win');
    assert.equal(instance.getAnalysisClass('0.5'), 'tie');
    assert.equal(instance.getAnalysisClass('0'), 'loss');
    assert.equal(instance.getAnalysisClass(''), 'other');
    assert.equal(instance.getAnalysisClass('Discrepancy'), 'other');
});

test('formatAnalysisValue is human readable', () => {
    const instance = logic();
    assert.equal(instance.formatAnalysisValue('1'), 'Win (1.0)');
    assert.equal(instance.formatAnalysisValue('0.5'), 'Tie (0.5)');
    assert.equal(instance.formatAnalysisValue('0'), 'Loss (0.0)');
    assert.equal(instance.formatAnalysisValue(''), 'Not set');
});

test('getCurrentGuruColIndex maps colour and type to column indices', () => {
    const instance = withState({
        currentGuruColor: 'green',
        redAnalysisColIndex: 3, blueAnalysisColIndex: 5, greenAnalysisColIndex: 7,
        redSignatureColIndex: 4, blueSignatureColIndex: 6, greenSignatureColIndex: 8
    });
    assert.equal(instance.getCurrentGuruColIndex('analysis'), 7);
    assert.equal(instance.getCurrentGuruColIndex('signature'), 8);
    assert.equal(instance.getCurrentGuruColIndex(), 7);
});

test('getCurrentGuruColIndex returns -1 for unknown inputs', () => {
    const instance = withState({ currentGuruColor: 'purple', redAnalysisColIndex: 3 });
    assert.equal(instance.getCurrentGuruColIndex('analysis'), -1);
    assert.equal(instance.getCurrentGuruColIndex('nonsense'), -1);
});

// --- Thread id helpers -------------------------------------------------------

test('getRowThreadId prefers rowIndex, then originalRowIndex, then position', () => {
    const instance = logic();
    assert.equal(instance.getRowThreadId({ rowIndex: 7, originalRowIndex: 2 }, 0), 7);
    assert.equal(instance.getRowThreadId({ originalRowIndex: 4 }, 0), 4);
    assert.equal(instance.getRowThreadId({}, 0), 1);
    assert.equal(instance.getRowThreadId(null, 9), 10);
});

test('hasDiscordThreadForRow copes with a missing thread map', () => {
    const instance = logic();
    assert.equal(instance.hasDiscordThreadForRow(null, { rowIndex: 1 }, 0), false);
    assert.equal(instance.hasDiscordThreadForRow({ has: () => true }, { rowIndex: 1 }, 0), true);
    assert.equal(instance.hasDiscordThreadForRow(new Map([[1, 'thread']]), { rowIndex: 1 }, 0), true);
});

// --- Colour detection from sheet ---------------------------------------------

test('determineGuruColorFromSheet finds the colour a signature is claimed under', () => {
    const sheetData = makeSheetData({ guruRows: [
        ['1', 'Deck A', 'Deck B', '1', 'bob', '1', 'alice', '1', 'carol']
    ]});
    const instance = withState({ guruSignature: 'alice', currentRowIndex: -1 });
    assert.equal(instance.determineGuruColorFromSheet(sheetData), 'blue');
});

test('determineGuruColorFromSheet defaults to red without a signature', () => {
    const instance = withState({ guruSignature: '', currentRowIndex: -1 });
    assert.equal(instance.determineGuruColorFromSheet(makeSheetData({ guruRows: [] })), 'red');
});

test('determineGuruColorFromSheet throws when the signature is nowhere', () => {
    const sheetData = makeSheetData({ guruRows: [
        ['1', 'Deck A', 'Deck B', '1', 'bob', '1', 'bob', '1', 'bob']
    ]});
    const instance = withState({ guruSignature: 'nobody', currentRowIndex: -1 });
    assert.throws(() => instance.determineGuruColorFromSheet(sheetData), /not found in any analysis column/);
});

// --- Statistics --------------------------------------------------------------

test('getDeckStats counts matches sharing the current player deck', () => {
    const instance = withState({
        currentGuruColor: 'red',
        allRows: [
            { player1: 'Deck A', redSignature: 'alice' },
            { player1: 'Deck A', redSignature: '' },
            { player1: 'Deck A', redSignature: 'bob' },
            { player1: 'Deck B', redSignature: '' }
        ],
        currentRowIndex: 0
    });
    assert.deepEqual(instance.getDeckStats(), { totalMatches: 3, unclaimedMatches: 1 });
});

test('getDeckStats is safe with no selection', () => {
    const instance = withState({ allRows: [{ player1: 'Deck A' }], currentRowIndex: -1 });
    assert.deepEqual(instance.getDeckStats(), { totalMatches: 0, unclaimedMatches: 0 });
});
