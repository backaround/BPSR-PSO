import { BrowserWindow, screen } from 'electron';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const iconPath = path.join(__dirname, '../resources/app.ico');
const preloadPath = path.join(__dirname, '../preload.js');
const htmlPath = path.join(__dirname, '../public/skillDetails.html');
const configPath = path.join(__dirname, '../../skillDetailsWindowConfig.json');

/**
 * A manager class to handle the skill details window,
 * including its creation, state, and configuration persistence.
 */
class SkillDetailsWindow {
    _window = null;
    config = {};
    defaultConfig = {
        width: 450,
        height: 450,
        x: undefined,
        y: undefined,
    };

    /**
     * Loads window configuration from the JSON file.
     * @private
     */
    _loadConfig() {
        try {
            if (fs.existsSync(configPath)) {
                const rawData = fs.readFileSync(configPath, 'utf8');
                const loadedConfig = JSON.parse(rawData);
                return { ...this.defaultConfig, ...loadedConfig };
            }
        } catch (error) {
            console.error('Failed to read skill details window config, using defaults.', error);
        }
        return this.defaultConfig;
    }

    /**
     * Saves the current window state to the JSON file.
     * @private
     */
    _saveConfig() {
        if (!this._window) return;
        try {
            const bounds = this._window.getBounds();
            const configData = {
                width: bounds.width,
                height: bounds.height,
                x: bounds.x,
                y: bounds.y,
            };
            fs.writeFileSync(configPath, JSON.stringify(configData, null, 4));
        } catch (error) {
            console.error('Failed to save skill details window config.', error);
        }
    }

    /**
     * Creates and displays the skill details window.
     * @returns {BrowserWindow} The created BrowserWindow instance.
     */
    create() {
        // If window already exists, focus it instead of creating a new one
        if (this._window && !this._window.isDestroyed()) {
            this._window.focus();
            return this._window;
        }

        this.config = this._loadConfig();

        // Get the display where the window will be created
        let targetDisplay;
        if (this.config.x !== undefined && this.config.y !== undefined) {
            // If we have saved position, get the display at that position
            targetDisplay = screen.getDisplayNearestPoint({ x: this.config.x, y: this.config.y });
        } else {
            // Otherwise use the primary display
            targetDisplay = screen.getPrimaryDisplay();
        }

        const scaleFactor = targetDisplay.scaleFactor;

        const scaleWidth = Math.floor(this.config.width / scaleFactor);
        const scaleHeight = Math.floor(this.config.height / scaleFactor);

        const originalWidth = Math.floor(scaleWidth * scaleFactor);
        const originalHeight = Math.floor(scaleHeight * scaleFactor);

        this._window = new BrowserWindow({
            width: scaleWidth,
            height: scaleHeight,
            x: this.config.x,
            y: this.config.y,
            minWidth: 450,
            minHeight: 450,
            transparent: true,
            frame: false,
            title: 'BPSR-PSO Skill Details',
            icon: iconPath,
            alwaysOnTop: true,
            webPreferences: {
                preload: preloadPath,
                contextIsolation: true,
                nodeIntegration: false,
                enableRemoteModule: false,
                v8CacheOptions: 'code',
                nodeIntegration: false,
            },
            autoMenuBar: true,
        });

        // this._window.openDevTools({ mode: 'detach' });
        this._window.setSize(originalWidth, originalHeight);
        this._window.setAlwaysOnTop(true, 'normal');
        this._window.setMovable(true);
        this._window.loadFile(htmlPath);

        this._window.on('close', () => this._saveConfig());
        this._window.on('closed', () => (this._window = null));

        return this._window;
    }

    /**
     * Retrieves the active BrowserWindow instance.
     * @returns {BrowserWindow|null} The active window instance or null.
     */
    getWindow() {
        return this._window;
    }

    /**
     * Checks if the window exists and is not destroyed.
     * @returns {boolean}
     */
    isOpen() {
        return this._window && !this._window.isDestroyed();
    }

    /**
     * Closes the window if it exists.
     */
    close() {
        if (this._window && !this._window.isDestroyed()) {
            this._window.close();
        }
    }

    /**
     * Loads a URL into the skill details window.
     */
    loadURL(url) {
        if (this._window && !this._window.isDestroyed()) {
            this._window.loadURL(url);
        }
    }
}

const skillDetailsWindow = new SkillDetailsWindow();
export default skillDetailsWindow;
