import { app, ipcMain, Notification } from 'electron';
import fs from 'fs';
import path from 'path';
import { shell } from 'electron';

ipcMain.on('close-client', (event) => {
    app.quit();
});

ipcMain.on('open-skill-details-window', async (event, userId) => {
    const { default: skillDetailsWindow } = await import('./SkillDetailsWindow.js');
    const { default: server } = await import('../server.js');

    skillDetailsWindow.create();

    // If server is running, load the server URL
    if (server && server.server && server.server.listening) {
        const address = server.server.address();
        const port = address.port;
        const url = `http://localhost:${port}/skillDetails.html?userId=${userId}`;
        skillDetailsWindow.loadURL(url);
    }
});

ipcMain.on('close-skill-details-window', (event) => {
    import('./SkillDetailsWindow.js').then(({ default: skillDetailsWindow }) => {
        skillDetailsWindow.close();
    });
});

ipcMain.on('save-screenshot', async (event, base64Data) => {
    try {
        // Get the Pictures folder path
        const picturesPath = app.getPath('pictures');

        // Create BPSR Screenshots folder if it doesn't exist
        const screenshotsDir = path.join(picturesPath, 'BPSR Screenshots');
        if (!fs.existsSync(screenshotsDir)) {
            fs.mkdirSync(screenshotsDir, { recursive: true });
        }

        // Generate filename with timestamp
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
        const filename = `BPSR_Screenshot_${timestamp}.png`;
        const filePath = path.join(screenshotsDir, filename);

        // Convert base64 to buffer and save
        const base64Image = base64Data.replace(/^data:image\/png;base64,/, '');
        const imageBuffer = Buffer.from(base64Image, 'base64');

        fs.writeFileSync(filePath, imageBuffer);

        // Show native notification
        const notification = new Notification({
            title: 'Screenshot Saved',
            body: `Saved to: ${filename}`,
            silent: false,
            timeoutType: 'default',
        });

        // Open folder when notification is clicked
        notification.on('click', () => {
            shell.openPath(filePath);
        });

        notification.show();
    } catch (error) {
        // Show error notification
        const errorNotification = new Notification({
            title: 'Screenshot Failed',
            body: `Failed to save screenshot: ${error.message}`,
            silent: false,
            urgency: 'critical',
        });

        errorNotification.show();
    }
});

ipcMain.on('open-shortcuts-window', async (event) => {
    const { default: shortcutsWindow } = await import('./ShortcutsWindow.js');
    const { default: server } = await import('../server.js');

    shortcutsWindow.create();

    // If server is running, load the server URL
    if (server && server.server && server.server.listening) {
        const address = server.server.address();
        const port = address.port;
        const url = `http://localhost:${port}/shortcuts.html`;
        shortcutsWindow.loadURL(url);
    }
});

ipcMain.on('close-shortcuts-window', (event) => {
    import('./ShortcutsWindow.js').then(({ default: shortcutsWindow }) => {
        shortcutsWindow.close();
    });
});

ipcMain.handle('get-shortcuts', async (event) => {
    try {
        const configPath = path.join(process.cwd(), 'shortcutsConfig.json');
        if (fs.existsSync(configPath)) {
            const rawData = fs.readFileSync(configPath, 'utf8');
            const config = JSON.parse(rawData);
            return config.shortcuts || {};
        }
        return {};
    } catch (error) {
        console.error('Failed to read shortcuts config:', error);
        return {};
    }
});

ipcMain.handle('save-shortcuts', async (event, shortcuts) => {
    try {
        const configPath = path.join(process.cwd(), 'shortcutsConfig.json');
        const config = { shortcuts };
        fs.writeFileSync(configPath, JSON.stringify(config, null, 4));

        // Unregister all shortcuts and re-register with new values
        const { unregisterShortcuts, registerShortcuts } = await import('./shortcuts.js');
        unregisterShortcuts();
        registerShortcuts();

        return { success: true };
    } catch (error) {
        console.error('Failed to save shortcuts config:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.on('disable-shortcuts', (event) => {
    import('./shortcuts.js').then(({ unregisterShortcuts }) => {
        unregisterShortcuts();
    });
});

ipcMain.on('enable-shortcuts', (event) => {
    import('./shortcuts.js').then(({ registerShortcuts }) => {
        registerShortcuts();
    });
});
