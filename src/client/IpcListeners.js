import { app, ipcMain, Notification } from 'electron';
import fs from 'fs';
import path from 'path';
import { shell } from 'electron';

ipcMain.on('close-client', (event) => {
    app.quit();
});

ipcMain.on('open-skill-details-window', async (event) => {
    const { default: skillDetailsWindow } = await import('./SkillDetailsWindow.js');
    const { default: server } = await import('../server.js');

    skillDetailsWindow.create();

    // If server is running, load the server URL
    if (server && server.server && server.server.listening) {
        const address = server.server.address();
        const port = address.port;
        skillDetailsWindow.loadURL(`http://localhost:${port}/skillDetails.html`);
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
