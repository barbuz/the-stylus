# 3CB Visual Guru
Browser-based tool for gurus to edit result sheets for 3 Card Blind MTG matches from 3cardblind.com. This application runs entirely in your browser without requiring a server or build process.

Always reference these instructions first and fallback to search or bash commands only when you encounter unexpected information that does not match the info here.

## Working Effectively
- **Setup and serve the application:**
  - `cd` to repository root
  - `python3 -m http.server 8000` -- starts in 1 second. NEVER CANCEL. Navigate to http://localhost:8000
  - Alternative: `npx serve -l 3000` -- starts in 2 seconds. NEVER CANCEL. Navigate to http://localhost:3000
- **Validate JavaScript syntax:**
  - `node -c js/main.js` -- validates main entry point syntax (instant)
  - `for f in $(find js -name "*.js"); do node -c "$f"; done` -- validates all JS files (takes 2-3 seconds)

## Application Architecture
- **Pure client-side application** - no build process, no server dependencies
- **Technology stack**: HTML5, CSS3, ES6 JavaScript modules
- **External APIs**: Google Sheets API, Google OAuth, Scryfall API (MTG card images)
- **Data persistence**: Google Sheets + browser localStorage
- **Authentication**: Google OAuth 2.0

## Validation
- **ALWAYS manually test any changes** by serving the application and verifying it loads correctly
- **User scenario validation**: After making changes, ALWAYS test:
  1. Open the application in browser (http://localhost:8000 or :3000)
  2. Verify the header "3CB Visual Guru" displays correctly
  3. Check browser console for JavaScript errors (F12 → Console)
  4. If modifying authentication: Test that sign-in interface appears
  5. If modifying UI: Take screenshots to verify visual changes
- **NEVER CANCEL** any server commands - they start quickly (1-2 seconds) and run continuously
- **JavaScript validation**: Always run `node -c` on modified JavaScript files before committing
- **Full application test**: Always serve and load the application after any changes to verify functionality

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
- **Required tools**: Python 3.12.3, Node.js v20.19.4, modern web browser
- **No build tools required**: Application uses native ES6 modules
- **No package installation**: All dependencies loaded from CDN
- **Linting**: Use `node -c` for syntax validation (no ESLint configuration present)

### Working with the Codebase
- **Entry point**: Always start by examining `index.html` and `js/main.js`
- **Module system**: Uses ES6 import/export - follow import chains to understand dependencies
- **Event handling**: Centralized in `js/modules/uiController.js`
- **API integration**: Google Sheets API in `googleSheetsAPI.js`, Scryfall API in `scryfallAPI.js`
- **State management**: Distributed across modules, localStorage for persistence

### Testing Changes
1. **Serve the application**: `python3 -m http.server 8000` or `npx serve -l 3000`
2. **Open in browser**: Navigate to http://localhost:8000 (or :3000)
3. **Check console**: Open browser DevTools (F12) → Console tab for errors
4. **Verify loading**: Application should show "3CB Visual Guru" header immediately
5. **Note**: Google APIs may show errors in test environments - this is expected
6. **Screenshot changes**: Always take screenshots of UI modifications

### Troubleshooting
- **Application not loading**: Check browser console for JavaScript errors
- **Module import errors**: Verify file paths are correct and case-sensitive
- **Google API errors**: Expected in sandboxed environments with messages like:
  - "Failed to load resource: net::ERR_BLOCKED_BY_CLIENT" for Google APIs
  - "ReferenceError: gapi is not defined"
  - These are NORMAL in test environments - focus on application structure loading
- **Server not accessible**: Ensure firewall allows local connections on chosen port
- **Syntax errors**: Run `node -c <filename>` to validate JavaScript syntax

### Performance Notes
- **Server startup**: Python HTTP server: ~1 second, npx serve: ~2 seconds
- **JavaScript validation**: All files: ~0.5 seconds total (12 files)
- **Application loading**: Instant for static content, Google APIs may take 3-5 seconds
- **File serving**: Static files serve instantly once server is running

### Expected Timings (for timeout reference)
- Python HTTP server startup: 1 second (NEVER CANCEL - set timeout 60+ seconds)
- npx serve startup: 2 seconds (NEVER CANCEL - set timeout 60+ seconds)  
- JavaScript syntax validation: 0.5 seconds for all files
- npm scripts (dev/build/test): Instant (< 0.1 seconds)
- Application loading in browser: 1-2 seconds for UI, Google API errors expected

### File Access Patterns
- **Static files**: Direct HTTP access for HTML, CSS, JS
- **ES6 modules**: Browser handles module loading automatically
- **External resources**: Google APIs and Scryfall API loaded from CDN
- **No compilation**: Files served directly as written

## Validation Scenarios
After making any changes, ALWAYS test these scenarios:

1. **Basic Loading**: 
   - Start server: `python3 -m http.server 8000`
   - Open http://localhost:8000
   - Verify header displays: "3CB Visual Guru"
   - Check browser console has no critical JavaScript errors

2. **Module Loading**:
   - Open browser DevTools → Network tab
   - Refresh page
   - Verify all JS modules load successfully (200 status)
   - Check Console for import/export errors

3. **JavaScript Syntax**:
   - Run: `for f in $(find js -name "*.js"); do echo "Checking $f"; node -c "$f" || echo "✗ $f failed"; done`
   - All files should pass syntax check silently
   - Takes ~0.5 seconds total for all 12 JavaScript files

4. **UI Responsiveness**:
   - Test on different browser window sizes
   - Verify mobile viewport scaling works
   - Take screenshots of any visual changes

**Expected Console Messages**: In test environments, you will see Google API errors like "ERR_BLOCKED_BY_CLIENT" and "gapi is not defined" - these are NORMAL and expected. Focus on verifying the application structure loads (header displays correctly).

Always include these validation steps in your development workflow. The application is designed to be simple and fast to validate - NEVER skip validation because it is quick and essential.