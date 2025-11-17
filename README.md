# The Stylus

A browser-based tool for gurus to edit result sheets for 3 Card Blind MTG matches from [3cardblind.com](www.3cardblind.com). This application runs entirely in your browser without requiring a server.


## 🎮 How to Use

### 1. **Authentication**
- Click "Sign in with Google" 
- Grant permissions for Google Sheets access
- Your session will be remembered between visits

**Note:** You need a Google account to use this app, both because you need to be logged in to edit sheets
and because the app stores its configuration on your Google appData. This means that you can change devices
and continue guruing!

### 2. **Set Guru Signature**
- Enter your guru username
- This filters the sheet to show only your matches
- Signature is saved locally for future sessions

### 3. **Load Pod Sheet**
- Paste the Google Sheets URL from 3cardblind.com
- The app will load and parse the pod data
- Only matches assigned to your guru signature will be displayed

### 4. **Analyse Matches**
- View card images for both players
- Use Win/Tie/Loss buttons to score matches
- Navigate between matches with Previous/Next buttons
- Changes are saved automatically to the Google Sheet

### 5. **Track Progress**
- See current match number and total matches
- View completion status
- Restart analysis if needed

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

## 🤝 Contributing

This is an open-source project. Contributions are welcome!

### Development Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/barbuz/the-stylus.git
   cd the-stylus
   ```

2. **Set up local server:**
   ```bash
   python -m http.server 8000
   ```

### Version Management

The app version is managed in `sw.js` at the top of the file. When making changes that should trigger a service worker update:

1. Update the `APP_VERSION` constant in `sw.js`
2. This changes the service worker file, causing the browser to detect a new version
3. The version is fetched and parsed by `main.js` and displayed in the app footer
4. Service worker will activate on page reload with updated cache