// Configuration for Google APIs
export const CONFIG = {
    // Google OAuth 2.0 settings
    GOOGLE_CLIENT_ID: '367897767302-uu5fqngr2cpb1f5fuhrdd03u9fm629ir.apps.googleusercontent.com',
    
    // Google API settings
    DISCOVERY_DOCS: [
        'https://sheets.googleapis.com/$discovery/rest?version=v4',
        'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'
    ],
    SCOPES: [
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/drive.appdata'
    ].join(' '),
    
    // Application settings
    APP_NAME: '3cb Visual Guru',
    
    // Local storage keys
    STORAGE_KEYS: {
        GURU_SIGNATURE: 'guru_signature',
        ACCESS_TOKEN: 'access_token',
        TOKEN_EXPIRY: 'token_expiry',
        USER_PROFILE: 'user_profile',
        REMEMBER_USER: 'remember_user',
        LAST_LOGIN: 'last_login',
        RECENT_PODS: 'recent_pods'
    }
};
