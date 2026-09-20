import test from 'node:test';
import assert from 'node:assert/strict';

import { isValidGoogleSheetsUrl, extractSheetId, sanitizeUrlParam } from '../../js/utils/urlUtils.js';
import { podNameToCode, podCodeToName } from '../../js/utils/podUtils.js';
import { ANALYSIS_VALUES, STATUS_TYPES } from '../../js/utils/constants.js';

test('urlUtils: isValidGoogleSheetsUrl', () => {
    assert.equal(isValidGoogleSheetsUrl('https://docs.google.com/spreadsheets/d/ABC123/edit'), true);
    assert.equal(isValidGoogleSheetsUrl('https://docs.google.com/spreadsheets/d/ABC-1_2'), true);
    assert.equal(isValidGoogleSheetsUrl('https://example.com/spreadsheets/d/ABC'), false);
    assert.equal(isValidGoogleSheetsUrl('http://docs.google.com/spreadsheets/d/ABC'), false);
    assert.equal(isValidGoogleSheetsUrl(''), false);
});

test('urlUtils: extractSheetId', () => {
    assert.equal(extractSheetId('https://docs.google.com/spreadsheets/d/ABC-123_x/edit#gid=0'), 'ABC-123_x');
    assert.equal(extractSheetId('ABC-123_x'), 'ABC-123_x');
    assert.equal(extractSheetId('https://example.com/not-a-sheet'), null);
    assert.equal(extractSheetId(''), null);
    assert.equal(extractSheetId(null), null);
});

test('urlUtils: sanitizeUrlParam strips Discord-style trailing junk', () => {
    assert.equal(sanitizeUrlParam('ABC-123),'), 'ABC-123');
    assert.equal(sanitizeUrlParam('  ABC-123  '), 'ABC-123');
    assert.equal(sanitizeUrlParam('ABC-123),)'), 'ABC-123');
    assert.equal(sanitizeUrlParam(null), null);
    assert.equal(sanitizeUrlParam(undefined), null);
    assert.equal(sanitizeUrlParam(''), '');
});

test('podUtils: podNameToCode', () => {
    assert.equal(podNameToCode('Aspirant II'), 'A II');
    assert.equal(podNameToCode('Exemplar'), 'E');
    assert.equal(podNameToCode('Novice I'), 'N I');
    assert.equal(podNameToCode('  contender   iii  '), 'C iii');
    assert.throws(() => podNameToCode('A B C'), /too many words/);
    assert.throws(() => podNameToCode(''), /non-empty string/);
    assert.throws(() => podNameToCode(null), /non-empty string/);
});

test('podUtils: podCodeToName', () => {
    assert.equal(podCodeToName('A II'), 'Aspirant II');
    assert.equal(podCodeToName('E'), 'Exemplar');
    assert.equal(podCodeToName('n i'), 'Novice i');
    assert.throws(() => podCodeToName('X I'), /Unknown pod code prefix/);
});

test('constants: analysis values are the scoring contract', () => {
    assert.deepEqual(ANALYSIS_VALUES, { WIN: 1.0, TIE: 0.5, LOSS: 0.0 });
    assert.equal(STATUS_TYPES.ERROR, 'error');
});
