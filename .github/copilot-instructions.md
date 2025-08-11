# 3CB Visual Guru
Browser-based tool for gurus to edit result sheets for 3 Card Blind MTG matches from 3cardblind.com. This application runs entirely in your browser without requiring a server or build process.

Always reference these instructions first and fallback to search or bash commands only when you encounter unexpected information that does not match the info here.

## Application Logic
3 Card Blind matches consist of two players, each with a deck of 3 cards. The result of the match is determined by human "gurus" who analyse the match and score it as Win/Tie/Loss. Three gurus analyse each match and an agreement must be reached on the final outcome. The three gurus take the roles of Red, Blue, and Green, each analyzing the match from their perspective. The possible results that each guru can pick from are Win, Tie, and Loss.
Before scoring a match the guru must claim it by entering their guru signature. This tells other gurus with the same color that this match is being analysed. Gurus can analyse only matches that they have claimed with their signature.

## Application Architecture
- **Pure client-side application** - no build process, no server dependencies
- **Technology stack**: HTML5, CSS3, ES6 JavaScript modules
- **External APIs**: Google Sheets API, Google OAuth, Scryfall API (MTG card images)
- **Data persistence**: Google Sheets + browser localStorage
- **Authentication**: Google OAuth 2.0

## Common Tasks

### Repository Structure
```
/home/runner/work/3cb-visual-guru/3cb-visual-guru/
├── .git/
├── .gitignore
├── README.md
├── package.json
├── index.html                 # Main entry point
├── js/
│   ├── main.js               # Application bootstrap
│   ├── config.js             # Google API configuration
│   ├── modules/              # Core application modules
│   │   ├── authManager.js
│   │   ├── googleSheetsAPI.js
│   │   ├── guruAnalysisInterface.js
│   │   ├── guruSignature.js
│   │   ├── recentPods.js
│   │   ├── scryfallAPI.js
│   │   ├── uiController.js
│   │   └── userPreferences.js
│   └── utils/                # Utility functions
│       ├── constants.js
│       └── domUtils.js
└── styles/
    └── main.css             # All application styles
```

### Key Files Overview
- **index.html**: Complete single-page application structure
- **js/main.js**: Main application class and initialization
- **js/config.js**: Google API configuration (contains OAuth client ID)
- **js/modules/**: Core functionality modules using ES6 classes
- **js/utils/**: Shared utility functions and constants
- **styles/main.css**: All CSS styling for the application

### Development Environment
- **Required tools**: Node.js v20.19.4, modern web browser
- **No build tools required**: Application uses native ES6 modules
- **No package installation**: All dependencies loaded from CDN
- **Linting**: Use `node -c` for syntax validation (no ESLint configuration present)

### Code changes workflow
1. **Do the changes requested**: Ensure the changes are necessary and align with the application's purpose.
2. **Check this document (copilot-instructions.md)**: If the changes require updates to this document, particularly the Repository Structure, make them as well.
3. **Check the README.md**: Ensure the README reflects any changes made to the application or its usage.
4. **Commit your changes**: Use clear commit messages that describe the changes made.

### Working with the Codebase
- **Entry point**: Always start by examining `index.html` and `js/main.js`
- **Module system**: Uses ES6 import/export - follow import chains to understand dependencies
- **Event handling**: Centralized in `js/modules/uiController.js`
- **API integration**: Google Sheets API in `googleSheetsAPI.js`, Scryfall API in `scryfallAPI.js`
- **State management**: Distributed across modules, Google appData for persistence

### Troubleshooting
- **Application not loading**: Check browser console for JavaScript errors
- **Module import errors**: Verify file paths are correct and case-sensitive
- **Google API errors**: Expected in sandboxed environments with messages like:
  - "Failed to load resource: net::ERR_BLOCKED_BY_CLIENT" for Google APIs
  - "ReferenceError: gapi is not defined"
  - These are NORMAL in test environments - focus on application structure loading
- **Server not accessible**: Ensure firewall allows local connections on chosen port
- **Syntax errors**: Run `node -c <filename>` to validate JavaScript syntax

### File Access Patterns
- **Static files**: Direct HTTP access for HTML, CSS, JS
- **ES6 modules**: Browser handles module loading automatically
- **External resources**: Google APIs and Scryfall API loaded from CDN
- **No compilation**: Files served directly as written

## Validation Scenarios

**Expected Console Messages**: In test environments, you will see Google API errors like "ERR_BLOCKED_BY_CLIENT" and "gapi is not defined" - these are NORMAL and expected.