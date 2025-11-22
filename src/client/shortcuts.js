import { globalShortcut } from 'electron';
import window from './Window.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const RESIZE_INCREMENT = 20;
const MOVE_INCREMENT = 20;

const configPath = path.join(__dirname, '../../shortcutsConfig.json');

// Default shortcuts
const DEFAULT_SHORTCUTS = {
    togglePassthrough: 'Control+`',
    clearData: 'Control+Alt+`',
    resizeUp: 'Control+Up',
    resizeDown: 'Control+Down',
    resizeLeft: 'Control+Left',
    resizeRight: 'Control+Right',
    moveUp: 'Control+Alt+Up',
    moveDown: 'Control+Alt+Down',
    moveLeft: 'Control+Alt+Left',
    moveRight: 'Control+Alt+Right',
    minimizeRestore: 'Control+Alt+Z',
};

let currentShortcuts = { ...DEFAULT_SHORTCUTS };

/**
 * Loads shortcuts from the configuration file.
 * @private
 */
function loadShortcutsConfig() {
    try {
        if (fs.existsSync(configPath)) {
            const rawData = fs.readFileSync(configPath, 'utf8');
            const config = JSON.parse(rawData);
            currentShortcuts = { ...DEFAULT_SHORTCUTS, ...config.shortcuts };
        }
    } catch (error) {
        console.error('Failed to load shortcuts config, using defaults.', error);
        currentShortcuts = { ...DEFAULT_SHORTCUTS };
    }
}

/**
 * Unregisters all global keyboard shortcuts.
 */
export function unregisterShortcuts() {
    globalShortcut.unregisterAll();
}

/**
 * Registers all global keyboard shortcuts for the application.
 */
export function registerShortcuts() {
    loadShortcutsConfig();
    registerPassthrough();
    registerResize();
    registerMove();
    registerMinimize();
    registerClearData();
}

/**
 * Registers the shortcut for toggling mouse event pass-through.
 */
function registerPassthrough() {
    globalShortcut.register(currentShortcuts.togglePassthrough, () => {
        window.togglePassthrough();
    });
}

function registerClearData() {
    globalShortcut.register(currentShortcuts.clearData, () => {
        try {
            const browserWindow = window.getWindow();
            browserWindow?.webContents.send('clear-data');
        } catch (error) {
            console.error('Failed to trigger clear data shortcut.', error);
        }
    });
}

/**
 * Registers shortcuts for resizing the window.
 */
function registerResize() {
    globalShortcut.register(currentShortcuts.resizeUp, () => {
        const [width, height] = window.getSize();
        const newHeight = Math.max(40, height - RESIZE_INCREMENT);
        window.setSize(width, newHeight);
    });

    globalShortcut.register(currentShortcuts.resizeDown, () => {
        const [width, height] = window.getSize();
        window.setSize(width, height + RESIZE_INCREMENT);
    });

    globalShortcut.register(currentShortcuts.resizeLeft, () => {
        const [width, height] = window.getSize();
        const newWidth = Math.max(280, width - RESIZE_INCREMENT);
        window.setSize(newWidth, height);
    });

    globalShortcut.register(currentShortcuts.resizeRight, () => {
        const [width, height] = window.getSize();
        window.setSize(width + RESIZE_INCREMENT, height);
    });
}

/**
 * Registers shortcuts for moving the window.
 */
function registerMove() {
    globalShortcut.register(currentShortcuts.moveUp, () => {
        const [x, y] = window.getPosition();
        window.setPosition(x, y - MOVE_INCREMENT);
    });

    globalShortcut.register(currentShortcuts.moveDown, () => {
        const [x, y] = window.getPosition();
        window.setPosition(x, y + MOVE_INCREMENT);
    });

    globalShortcut.register(currentShortcuts.moveLeft, () => {
        const [x, y] = window.getPosition();
        window.setPosition(x - MOVE_INCREMENT, y);
    });

    globalShortcut.register(currentShortcuts.moveRight, () => {
        const [x, y] = window.getPosition();
        window.setPosition(x + MOVE_INCREMENT, y);
    });
}

/**
 * Registers the shortcut for minimizing/restoring the window height.
 */
function registerMinimize() {
    globalShortcut.register(currentShortcuts.minimizeRestore, () => {
        window.minimizeOrRestore();
    });
}
