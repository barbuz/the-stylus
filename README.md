# 3cb Visual Guru

A browser-based tool for gurus to edit result sheets for 3 Card Blind MTG matches from 3cardblind.com. This application runs entirely in your browser without requiring a server, making it perfect for static hosting and easy deployment.

## 🎯 Features

✅ **No Server Required** - Runs entirely in your browser  
✅ **Direct Google API Integration** - Communicates directly with Google Sheets API  
✅ **Persistent Authentication** - Remembers your login between sessions  
✅ **Guru Signature System** - Identify yourself and filter your matches  
✅ **Multi-Sheet Support** - Handle Red, Blue, and Green Guru sheets  
✅ **Card Image Integration** - Visual card display via Scryfall API  
✅ **Real-time Editing** - Save changes directly to Google Sheets  
✅ **Local Preference Storage** - Browser localStorage for settings  
✅ **Static Hosting Ready** - Deploy to GitHub Pages, Netlify, Vercel, or any web server  

## 🚀 Quick Start

### Option 1: Static File Hosting

1. **Upload to any static hosting service:**
   - GitHub Pages
   - Netlify
   - Vercel
   - Firebase Hosting
   - Any web server

2. **Configure Google OAuth:**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create/select your project
   - Enable Google Sheets API
   - Create OAuth 2.0 Client ID (Web application)
   - Add your domain to authorized origins
   - Update `CONFIG.GOOGLE_CLIENT_ID` in `public/js/config.js`

3. **Access your app:**
   - Open `index.html` in your browser
   - Or access via your hosting URL

### Option 2: Local Development

1. **Serve files locally:**
   ```bash
   # Python 3
   python -m http.server 8000
   
   # Node.js (with npx)
   npx serve .
   
   # Live Server (VS Code extension)
   # Right-click index.html → "Open with Live Server"
   ```

2. **Configure OAuth for localhost:**
   - Add `http://localhost:8000` to authorized origins in Google Cloud Console
   - Update client ID in `public/js/config.js`

3. **Open in browser:**
   - Navigate to `http://localhost:8000`

## ⚙️ Configuration

Edit `public/js/config.js` to configure your Google API settings:

```javascript
export const CONFIG = {
    // Your Google OAuth Client ID (REQUIRED)
    GOOGLE_CLIENT_ID: 'your-client-id.apps.googleusercontent.com',
    
    // API settings (usually no need to change)
    DISCOVERY_DOCS: ['https://sheets.googleapis.com/$discovery/rest?version=v4'],
    SCOPES: [
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/drive.file'
    ].join(' '),
    
    // Application settings
    APP_NAME: '3cb Visual Guru',
    
    // Local storage keys (no need to change)
    STORAGE_KEYS: {
        GURU_SIGNATURE: 'guru_signature',
        LAST_SHEET_ID: 'last_sheet_id',
        USER_PREFERENCES: 'user_preferences',
        ACCESS_TOKEN: 'access_token',
        USER_PROFILE: 'user_profile'
    }
};
```

## 🔐 Google OAuth Setup

### Step 1: Google Cloud Console Setup

1. **Create/Select Project:**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select existing one

2. **Enable APIs:**
   - Navigate to "APIs & Services" → "Library"
   - Enable "Google Sheets API"
   - Enable "Google Drive API" (optional, for enhanced functionality)

3. **Create OAuth Credentials:**
   - Go to "APIs & Services" → "Credentials"
   - Click "Create Credentials" → "OAuth 2.0 Client ID"
   - Select "Web application"
   - Add authorized JavaScript origins:
     - `http://localhost:8000` (for local development)
     - `https://yourdomain.com` (for production)
   - No redirect URIs needed for this application

### Step 2: OAuth Consent Screen

1. **Configure Consent Screen:**
   - Go to "APIs & Services" → "OAuth consent screen"
   - Choose "External" (unless you have a Google Workspace)
   - Fill in required fields:
     - App name: "3cb Visual Guru"
     - User support email: your email
     - Developer contact: your email

2. **Add Scopes:**
   - Add the following scopes:
     - `https://www.googleapis.com/auth/spreadsheets`
     - `https://www.googleapis.com/auth/drive.file`

3. **Test Users (for development):**
   - Add your Google account as a test user
   - Add other guru accounts that will use the tool

### Step 3: Production Verification (optional)

For production use with external users, you may need to verify your app with Google. This is only required if you plan to have many users outside your organization.

## 🚢 Deployment Examples

### GitHub Pages

1. **Upload to GitHub:**
   ```bash
   git clone https://github.com/yourusername/3cb-visual-guru.git
   cd 3cb-visual-guru
   git add .
   git commit -m "Initial commit"
   git push origin main
   ```

2. **Enable GitHub Pages:**
   - Go to repository settings
   - Scroll to "Pages" section
   - Source: "Deploy from a branch"
   - Branch: `main`
   - Folder: `/ (root)` or `/public` depending on your setup

3. **Update Configuration:**
   - Update OAuth client ID for your GitHub Pages URL
   - URL format: `https://yourusername.github.io/repo-name/`

### Netlify

1. **Drag and Drop:**
   - Go to [Netlify](https://netlify.com)
   - Drag the `public` folder to the deployment area

2. **Configure Domain:**
   - Update OAuth client ID for your Netlify URL
   - Set up custom domain if desired

3. **Environment Variables (optional):**
   - Can be configured in Netlify dashboard for different environments

### Vercel

1. **Import Project:**
   - Connect your GitHub repository to Vercel
   - Set output directory to `public`

2. **Configure:**
   - Update OAuth settings for Vercel domain
   - Set up custom domain if needed

### Firebase Hosting

1. **Install Firebase CLI:**
   ```bash
   npm install -g firebase-tools
   ```

2. **Initialize and Deploy:**
   ```bash
   firebase login
   firebase init hosting
   # Select 'public' as public directory
   firebase deploy
   ```

## 📁 Project Structure

```
3cb-visual-guru/
├── public/                    # All application files
│   ├── index.html            # Main application entry point
│   ├── styles/
│   │   └── main.css         # Application styles
│   └── js/
│       ├── config.js        # Configuration (update with your OAuth client ID)
│       ├── main.js          # Application entry point and orchestration
│       └── modules/
│           ├── authManager.js           # Google authentication & session management
│           ├── googleSheetsAPI.js       # Google Sheets integration
│           ├── guruSignature.js         # Guru identification system
│           ├── guruAnalysisInterface.js # Match analysis interface
│           ├── scryfallAPI.js           # MTG card image integration
│           ├── sheetRenderer.js         # Sheet data rendering
│           ├── recentPods.js            # Recent pods management
│           └── uiController.js          # UI state management
├── package.json             # Project metadata (for npm scripts only)
├── README.md               # This file
└── .gitignore             # Git ignore rules
```

## 🎮 How to Use

### 1. **Authentication**
- Click "Sign in with Google" 
- Grant permissions for Google Sheets access
- Your session will be remembered between visits

### 2. **Set Guru Signature**
- Enter your guru username (e.g., "RedGuru", "BlueGuru", "GreenGuru")
- This filters the sheet to show only your matches
- Signature is saved locally for future sessions

### 3. **Load Pod Sheet**
- Paste the Google Sheets URL from 3cardblind.com
- The app will load and parse the pod data
- Only matches assigned to your guru signature will be displayed

### 4. **Analyze Matches**
- View card images for both players
- Use Win/Tie/Loss buttons to score matches
- Navigate between matches with Previous/Next buttons
- Changes are saved automatically to the Google Sheet

### 5. **Track Progress**
- See current match number and total matches
- View completion status
- Restart analysis if needed

## 🎯 What is 3 Card Blind?

3 Card Blind is a unique Magic: The Gathering format where:
- Players build decks using exactly **3 cards**
- Games are played "blind" - opponents don't see each other's cards initially
- Tournaments are run through 3cardblind.com
- Gurus are experienced players who analyze matches and determine winners
- Results are tracked in Google Sheets for each pod

This tool helps gurus efficiently process match results by providing:
- Visual card displays for better analysis
- Streamlined scoring interface
- Automatic filtering and navigation
- Direct integration with pod sheets

## 🌐 Browser Requirements

- **Modern Browser Support:**
  - ✅ Chrome 80+
  - ✅ Firefox 75+
  - ✅ Safari 13+
  - ✅ Edge 80+

- **Required Features:**
  - JavaScript enabled
  - ES6 module support
  - localStorage support
  - Internet connection for Google APIs and card images

## 🔧 Troubleshooting

### Common Issues

#### Authentication Problems

1. **"OAuth Client ID not found"**
   - ✅ Check that client ID is correctly set in `public/js/config.js`
   - ✅ Verify the client ID exists in Google Cloud Console
   - ✅ Ensure no extra spaces or characters in the client ID

2. **"Origin not allowed" / CORS errors**
   - ✅ Add your domain/localhost to authorized origins in Google Cloud Console
   - ✅ Ensure the URL matches exactly (including protocol and port)
   - ✅ For localhost, use `http://localhost:8000` not `http://127.0.0.1:8000`

3. **"App not verified" warning**
   - ✅ Click "Advanced" → "Go to app name (unsafe)" for development
   - ✅ For production, complete Google's verification process

#### API and Loading Issues

4. **"Failed to load Google API"**
   - ✅ Check internet connection
   - ✅ Verify Google APIs are accessible (not blocked by firewall)
   - ✅ Try refreshing the page
   - ✅ Check browser console for specific error messages

5. **Sheets not loading**
   - ✅ Verify the Google Sheets URL is correct
   - ✅ Ensure the sheet is shared with your Google account
   - ✅ Check that the sheet follows the expected 3cardblind.com format

6. **Card images not displaying**
   - ✅ Check internet connection to Scryfall.com
   - ✅ Verify card names are spelled correctly in the sheet
   - ✅ Some card names may not be found in Scryfall database

#### Storage and Preferences

7. **Preferences not saving**
   - ✅ Check that localStorage is enabled in your browser
   - ✅ Verify you're not in private/incognito mode
   - ✅ Check for browser extensions that block local storage

8. **Session not persisting**
   - ✅ Ensure localStorage is enabled
   - ✅ Check for browser settings that clear data on exit
   - ✅ Verify you're using the same domain/protocol

### Debug Mode

To enable detailed logging, open browser console (F12) and run:
```javascript
localStorage.setItem('debug', 'true');
// Refresh the page to see detailed logs
```

To disable:
```javascript
localStorage.removeItem('debug');
```

## 🤝 Contributing

This is an open-source project. Contributions are welcome!

### Development Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/yourusername/3cb-visual-guru.git
   cd 3cb-visual-guru
   ```

2. **Set up local server:**
   ```bash
   cd public
   python -m http.server 8000
   ```

3. **Configure OAuth for localhost:**
   - Add `http://localhost:8000` to Google Cloud Console
   - Update client ID in `js/config.js`

### Code Structure

- **ES6 Modules:** Clean, modular JavaScript architecture
- **Event-Driven:** Uses custom events for component communication
- **Responsive Design:** Works on desktop and tablet devices
- **Error Handling:** Comprehensive error handling and user feedback

### Areas for Contribution

- 🎨 UI/UX improvements
- 🔧 Additional tournament formats
- 📊 Enhanced analytics and reporting
- 🌍 Internationalization
- 📱 Mobile responsiveness improvements
- 🧪 Test coverage

## 📄 License

MIT License - see LICENSE file for details.

## 🔗 Related Links

- [3cardblind.com](https://3cardblind.com) - Official 3 Card Blind website
- [Google Cloud Console](https://console.cloud.google.com/) - For OAuth setup
- [Scryfall API](https://scryfall.com/docs/api) - MTG card database
- [Google Sheets API](https://developers.google.com/sheets/api) - API documentation

## 📞 Support

For issues, questions, or feature requests:
1. Check the troubleshooting section above
2. Search existing GitHub issues
3. Create a new issue with detailed information
4. Include browser console errors if applicable

---

**Happy Guru-ing!** 🎴✨
