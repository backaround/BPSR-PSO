(() => {
    // Default shortcuts configuration
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

    // Store current shortcuts
    let currentShortcuts = { ...DEFAULT_SHORTCUTS };

    // Store hotkey input instances
    const hotkeyInputs = new Map();

    /**
     * HotkeyInput class for capturing keyboard shortcuts
     */
    class HotkeyInput {
        constructor(element) {
            this.element = element;
            this.pressedKeys = new Set();
            this.modifiers = [];
            this.letterKey = null;
            this.isRecording = false;
            this.previousValue = element.value || '';
            this.isFocused = false;

            this.init();
        }

        init() {
            this.element.readOnly = true;

            this.element.addEventListener('focus', () => this.startRecording());
            this.element.addEventListener('blur', () => this.stopRecording());
            this.element.addEventListener('keydown', (e) => this.handleKeyDown(e));
            this.element.addEventListener('keyup', (e) => this.handleKeyUp(e));
        }

        startRecording() {
            this.isFocused = true;
            this.isRecording = true;
            this.pressedKeys.clear();
            this.modifiers = [];
            this.letterKey = null;

            // Disable global shortcuts when focusing on input
            if (window.electronAPI && window.electronAPI.disableShortcuts) {
                window.electronAPI.disableShortcuts();
            }
        }

        stopRecording() {
            this.isFocused = false;
            this.isRecording = false;
            this.pressedKeys.clear();

            // Restore previous value if current value is invalid when unfocusing
            const currentValue = this.element.value.trim();
            const isValid = this.isValidHotkey(currentValue);

            if (!isValid) {
                this.element.value = this.previousValue;
            }

            // Re-enable global shortcuts when unfocusing
            if (window.electronAPI && window.electronAPI.enableShortcuts) {
                window.electronAPI.enableShortcuts();
            }
        }

        isValidHotkey(value) {
            if (!value) return false;

            const parts = value.split('+');
            if (parts.length < 2) return false;

            const hasModifier = parts.slice(0, -1).some((part) => ['Ctrl', 'Alt', 'Shift', 'Meta'].includes(part));
            const hasLetter =
                /^[A-Z`]$/.test(parts[parts.length - 1]) ||
                ['Up', 'Down', 'Left', 'Right'].includes(parts[parts.length - 1]);

            return hasModifier && hasLetter;
        }

        handleKeyDown(e) {
            if (!this.isRecording) return;

            e.preventDefault();
            e.stopPropagation();

            const key = this.normalizeKey(e);

            if (this.pressedKeys.has(key)) return;

            this.pressedKeys.add(key);

            if (this.isModifier(key)) {
                if (!this.modifiers.includes(key)) {
                    this.modifiers.push(key);
                }
            } else if (this.isValidKey(key)) {
                this.letterKey = key;
            }

            this.updateDisplay();
        }

        handleKeyUp(e) {
            if (!this.isRecording) return;

            e.preventDefault();
            e.stopPropagation();

            const key = this.normalizeKey(e);
            this.pressedKeys.delete(key);

            if (this.pressedKeys.size === 0 && (this.modifiers.length > 0 || this.letterKey)) {
                this.validateAndFinalize();
            }
        }

        normalizeKey(e) {
            if (e.key === 'Control') return 'Control';
            if (e.key === 'Meta') return 'Meta';
            if (e.key === 'Alt') return 'Alt';
            if (e.key === 'Shift') return 'Shift';
            if (e.key === 'ArrowUp') return 'Up';
            if (e.key === 'ArrowDown') return 'Down';
            if (e.key === 'ArrowLeft') return 'Left';
            if (e.key === 'ArrowRight') return 'Right';
            return e.key.toUpperCase();
        }

        isModifier(key) {
            return ['Control', 'Alt', 'Shift', 'Meta'].includes(key);
        }

        isValidKey(key) {
            return /^[A-Z`]$/.test(key) || ['Up', 'Down', 'Left', 'Right'].includes(key);
        }

        updateDisplay() {
            const parts = [...this.modifiers];
            if (this.letterKey) {
                parts.push(this.letterKey);
            }
            this.element.value = parts.join('+');
        }

        validateAndFinalize() {
            const hasModifier = this.modifiers.length > 0;
            const hasKey = this.letterKey !== null;

            if (hasModifier && hasKey) {
                const hotkey = [...this.modifiers, this.letterKey].join('+');
                this.previousValue = hotkey;
                this.element.value = hotkey;

                this.element.dispatchEvent(
                    new CustomEvent('hotkeychange', {
                        detail: { hotkey },
                    })
                );
            } else {
                // Restore previous value on invalid input
                this.element.value = this.previousValue;
                this.modifiers = [];
                this.letterKey = null;
            }
        }

        setValue(value) {
            this.element.value = value;
            this.previousValue = value;
        }
    }

    /**
     * Initialize hotkey inputs
     */
    function initializeHotkeyInputs() {
        const inputs = document.querySelectorAll('[data-type-hotkey]');
        inputs.forEach((input) => {
            const hotkeyInput = new HotkeyInput(input);
            const shortcutKey = input.dataset.shortcutKey;
            if (shortcutKey) {
                hotkeyInputs.set(shortcutKey, hotkeyInput);
            }
        });
    }

    /**
     * Load shortcuts from the backend
     */
    async function loadShortcuts() {
        try {
            if (window.electronAPI && window.electronAPI.getShortcuts) {
                const shortcuts = await window.electronAPI.getShortcuts();
                currentShortcuts = { ...DEFAULT_SHORTCUTS, ...shortcuts };
                updateInputValues();
            }
        } catch (error) {
            console.error('Failed to load shortcuts:', error);
        }
    }

    /**
     * Update input values with current shortcuts
     */
    function updateInputValues() {
        hotkeyInputs.forEach((hotkeyInput, key) => {
            if (currentShortcuts[key]) {
                hotkeyInput.setValue(currentShortcuts[key]);
            }
        });
    }

    /**
     * Save shortcuts to the backend
     */
    async function saveShortcuts() {
        try {
            // Collect all shortcuts from inputs
            const shortcuts = {};
            hotkeyInputs.forEach((hotkeyInput, key) => {
                shortcuts[key] = hotkeyInput.element.value;
            });

            if (window.electronAPI && window.electronAPI.saveShortcuts) {
                await window.electronAPI.saveShortcuts(shortcuts);
                currentShortcuts = shortcuts;
            }

            showNotification('Shortcuts saved successfully!', 'success');
        } catch (error) {
            console.error('Failed to save shortcuts:', error);
            showNotification('Failed to save shortcuts', 'error');
        }
    }

    /**
     * Reset shortcuts to default
     */
    function resetShortcuts() {
        currentShortcuts = { ...DEFAULT_SHORTCUTS };
        updateInputValues();
        showNotification('Shortcuts reset successfully!', 'success');
    }

    /**
     * Show notification
     */
    function showNotification(message, type = 'info') {
        // Define icons and colors for each notification type
        const config = {
            success: {
                iconPath: '/assets/check.svg',
                background: 'rgba(0, 200, 83, 0.3)',
            },
            error: {
                iconPath: '/assets/x.svg',
                background: 'rgba(255, 60, 60, 0.3)',
            },
            info: {
                iconPath: '/assets/settings.svg',
                background: 'rgba(41, 98, 255, 0.3)',
            },
        };

        const { iconPath, background } = config[type] || config.info;

        // Create notification container
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            padding: 10px 16px;
            background: ${background};
            color: white;
            border-radius: 6px;
            font-size: 12px;
            font-weight: 500;
            z-index: 10000;
            box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
            display: flex;
            align-items: center;
            gap: 8px;
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);
            animation: notificationSlideIn 0.3s ease forwards;
        `;

        // Create icon element
        const iconElement = document.createElement('img');
        iconElement.src = iconPath;
        iconElement.style.cssText = `
            width: 16px;
            height: 16px;
            flex-shrink: 0;
            filter: invert(1) sepia(0) saturate(0) hue-rotate(180deg) brightness(1.2);
        `;

        // Create message element
        const messageElement = document.createElement('div');
        messageElement.textContent = message;
        messageElement.style.cssText = `
            text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
        `;

        notification.appendChild(iconElement);
        notification.appendChild(messageElement);
        document.body.appendChild(notification);

        // Auto-dismiss with slide-out animation
        setTimeout(() => {
            notification.style.animation = 'notificationSlideOut 0.3s ease forwards';
            setTimeout(() => notification.remove(), 300);
        }, 2000);
    }

    /**
     * Close window
     */
    function closeWindow() {
        if (window.electronAPI && window.electronAPI.closeShortcutsWindow) {
            window.electronAPI.closeShortcutsWindow();
        }
    }

    /**
     * Initialize the shortcuts configuration page
     */
    function init() {
        initializeHotkeyInputs();
        loadShortcuts();

        // Add event listeners for buttons
        const saveButton = document.getElementById('saveButton');
        const resetButton = document.getElementById('resetButton');

        if (saveButton) {
            saveButton.addEventListener('click', saveShortcuts);
        }

        if (resetButton) {
            resetButton.addEventListener('click', resetShortcuts);
        }

        // Add notification animation keyframes
        const style = document.createElement('style');
        style.textContent = `
            @keyframes notificationSlideIn {
                from {
                    top: 45px;
                    opacity: 0;
                }
                to {
                    top: 50px;
                    opacity: 1;
                }
            }
            @keyframes notificationSlideOut {
                from {
                    top: 50px;
                    opacity: 1;
                }
                to {
                    top: 45px;
                    opacity: 0;
                }
            }
        `;
        document.head.appendChild(style);
    }

    // Make closeWindow available globally
    window.closeWindow = closeWindow;

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
