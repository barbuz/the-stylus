/**
 * A trimmed but structurally faithful excerpt of a real pod spreadsheet.
 *
 * Provenance: "Novice I - September 2026 - Game Gurus.xlsx", exported from the
 * live sheet a pod actually uses. Values below are copied verbatim; only the
 * row count is reduced (6 of 450) and the trailing helper columns are dropped.
 *
 * What makes this worth keeping separate from sheetData.js is that it encodes
 * conventions the hand-written fixtures guessed wrong:
 *
 *  1. Guru sheets have 13 columns (A:M), not 6. Analysis/signature live in E/F;
 *     G:I hold the *other* gurus' readings; K/L are Inverse Check and Inverse
 *     ID#; M is a Discord Thread link. The app only reads A:C and E:F, but the
 *     real width matters for range assertions.
 *  2. Header cells are descriptive prose, not short labels: "Player 1 (On the
 *     Play)", "Player 2 (On the Draw)", "ID#", "Guru Analysis". Matching is
 *     substring-based, so these must keep working.
 *  3. IDs and outcomes arrive as strings ("1", "22", "0.5"), never numbers.
 *     The app never sets valueRenderOption, so the Sheets API defaults to
 *     FORMATTED_VALUE. The exported .xlsx stores them as floats, which is why
 *     reading the file with openpyxl shows 22.0 and 1.0; that is a property of
 *     the file format, not of what the app receives. Do not "fix" the strings
 *     below to numbers.
 *  4. The metadata sheet is *headerless*: row 1 is already data ("Pod Name").
 *     There is no "Variable Name" header row, so the app's "skip header"
 *     comment describes behaviour that never triggers on real data.
 *  5. Deck Notes header order is Decklists | Goldfish Clock | Signature |
 *     Notes | Additional Notes, and "Signature" (col C) is the *goldfish*
 *     signature. Notes are frequently blank, Additional Notes almost always so.
 *
 * Swapping guru sheets between rows also encodes the real colour convention:
 * each sheet's E/F is its own colour, and columns G:I mirror the other two.
 */

export const REAL_POD_HEADER = [
    'ID#',
    'Player 1 (On the Play)',
    'Player 2 (On the Draw)',
    'Outcome',
    'Guru Analysis',
    'Guru Signature',
    'Blue Analysis',
    'Partner Signature',
    'Green Analysis',
    'Partner 2 Signature',
    'Inverse Check',
    'Inverse ID#',
    'Thread'
];

export const REAL_DECK_NOTES_HEADER = [
    'Decklists', 'Goldfish Clock', 'Signature', 'Notes', 'Additional Notes'
];

/** Decklists referenced by the rows below, in first-appearance order. */
export const REAL_DECKS = {
    bluffs: 'Abraded Bluffs | Erode | Wayward Guide-Beast',
    admonition: 'Admonition Angel | Aether Vial | Oboro, Palace in the Clouds',
    crypt: 'Ancient Tomb | Cryptic Trilobite | Lazotep Quarry',
    elixir: 'Ancient Tomb | Elixir of Immortality | The Filigree Sylex'
};

/**
 * Six match rows, taken verbatim from the workbook.
 *
 * Rows 1/22, 2/43 and 3/64 are mirror pairs: the players are swapped and the
 * outcome inverts (W<->L) or holds (T<->T). They are contiguous in the real
 * sheet too, which is why the app can offer a "jump to mirror" button.
 *
 * IDs and outcomes are strings because that is the API's wire format. See the
 * header comment: the .xlsx floats are not what the app sees.
 */
export const REAL_MATCH_ROWS = [
    { id: '1', player1: REAL_DECKS.bluffs, player2: REAL_DECKS.admonition, outcome: '1', inverse: '22' },
    { id: '22', player1: REAL_DECKS.admonition, player2: REAL_DECKS.bluffs, outcome: '0', inverse: '1' },
    { id: '2', player1: REAL_DECKS.bluffs, player2: REAL_DECKS.crypt, outcome: '0.5', inverse: '43' },
    { id: '43', player1: REAL_DECKS.crypt, player2: REAL_DECKS.bluffs, outcome: '0.5', inverse: '2' },
    { id: '3', player1: REAL_DECKS.bluffs, player2: REAL_DECKS.elixir, outcome: '0', inverse: '64' },
    { id: '64', player1: REAL_DECKS.elixir, player2: REAL_DECKS.bluffs, outcome: '1', inverse: '3' }
];

/**
 * Per-colour analysis and signature, as each guru sheet actually records them.
 *
 * Each sheet stores its OWN reading in E/F (labelled "Guru Analysis" / "Guru
 * Signature" on every sheet) and repeats the other two colours in G:I. The
 * duplicate readings agree here, as they do in the real sheet: all 450 rows
 * have three agreeing non-empty analyses and zero discrepancies.
 */
const REAL_GURU_READINGS = {
    red: [
        ['1.0', 'Oophies'], ['0.0', 'fixdoll'], ['0.5', 'Oophies'],
        ['0.5', 'fixdoll'], ['0.0', 'Oophies'], ['1.0', 'oozoq']
    ],
    blue: [
        ['1.0', 'FortyTwo'], ['0.0', 'FortyTwo'], ['0.5', 'FortyTwo'],
        ['0.5', 'FortyTwo'], ['0.0', 'FortyTwo'], ['1.0', 'Cyrcle']
    ],
    green: [
        ['1.0', 'Imnota'], ['0.0', 'Imnota'], ['0.5', 'Imnota'],
        ['0.5', 'Ploop102'], ['0.0', 'Imnota'], ['1.0', 'Imnota']
    ]
};

/** The two "partner" signatures each sheet repeats for the other colours. */
const REAL_PARTNERS = {
    red: ['FortyTwo', 'Imnota'],
    blue: ['Oophies', 'Imnota'],
    green: ['FortyTwo', 'Oophies']
};

/**
 * Cells for one guru sheet in the real 13-column layout (1-based coords).
 *
 * @param {'red'|'blue'|'green'} colour which sheet's own readings to use in E/F
 * @param {(value: string) => string} stringify applied to every cell, letting
 *        callers choose between the wire format (strings) and raw JSON.
 */
export function realPodGuruCells(colour, stringify = String) {
    const cells = {};
    const put = (row, col, value) => {
        if (value !== '' && value !== null && value !== undefined) {
            cells[`${row}:${col}`] = stringify(value);
        }
    };

    REAL_POD_HEADER.forEach((header, index) => put(1, index + 1, header));

    const readings = REAL_GURU_READINGS[colour];
    const partners = REAL_PARTNERS[colour];
    REAL_MATCH_ROWS.forEach((match, index) => {
        const row = index + 2;
        put(row, 1, match.id);
        put(row, 2, match.player1);
        put(row, 3, match.player2);
        put(row, 4, match.outcome);
        put(row, 5, readings[index][0]);
        put(row, 6, readings[index][1]);
        // G:I are the two other colours plus "Partner Signature" companions.
        put(row, 7, readings[index][0]);
        put(row, 8, partners[0]);
        put(row, 9, readings[index][0]);
        put(row, 10, partners[1]);
        put(row, 11, match.outcome);
        put(row, 12, match.inverse);
    });

    return cells;
}

/** Cells for the real Deck Notes sheet. Columns A:E as in the workbook. */
export function realDeckNotesRows() {
    return [
        REAL_DECK_NOTES_HEADER,
        [REAL_DECKS.bluffs, '8.0', 'Kamatana', 'Can Erode T2 and win T9 if not disrupted', ''],
        [REAL_DECKS.admonition, '11.0', 'Kamatana', '', ''],
        [REAL_DECKS.crypt, '7.0', 'Ploop102', 'can play x=0 to reanimate t2', ''],
        [REAL_DECKS.elixir, '22.0', 'Ploop102', '', '']
    ];
}

/**
 * The metadata sheet exactly as the workbook stores it: headerless.
 *
 * There is no header row, so row 1 is data. The middle column is a tick.
 */
export function realMetadataRows() {
    return [
        ['Pod Name', '\u2714', 'Novice I'],
        ['Guru Hub Link', '\u2714', 'https://docs.google.com/spreadsheets/d/HUB_ID/edit?gid=134887943#gid=134887943'],
        ['', '', '']
    ];
}

export const REAL_POD_SHEET_IDS = { deckNotes: 44, red: 111, blue: 222, green: 333, metadata: 55 };

/**
 * The A1 ranges the app requests against a real-width guru sheet.
 *
 * Because guru sheets are 13 columns wide, the app's A1:C and E1:F windows are
 * strict sub-ranges. Anything asserting on ranges should use these.
 */
export const REAL_GURU_WINDOWS = {
    base: 'A1:C1000',
    analysis: 'E1:F1000'
};