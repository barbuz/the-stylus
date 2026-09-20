import { defineConfig } from '@playwright/test';

const PORT = 8123;

export default defineConfig({
    testDir: './tests/e2e',
    timeout: 30000,
    fullyParallel: true,
    reporter: [['list']],
    use: {
        baseURL: `http://127.0.0.1:${PORT}`,
        trace: 'retain-on-failure'
    },
    webServer: {
        command: `python3 -m http.server ${PORT} --bind 127.0.0.1`,
        url: `http://127.0.0.1:${PORT}/index.html`,
        reuseExistingServer: !process.env.CI,
        timeout: 15000
    }
});
