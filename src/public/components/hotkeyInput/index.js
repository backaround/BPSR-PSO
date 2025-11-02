(() => {
    class HotkeyInput {
        constructor(element) {
            this.element = element;
            this.pressedKeys = new Set();
            this.modifiers = [];
            this.letterKey = null;
            this.isRecording = false;
            this.previousValue = element.value || ''; // Store the previous valid value

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
            this.isRecording = true;
            this.pressedKeys.clear();
            this.modifiers = [];
            this.letterKey = null;
        }

        stopRecording() {
            this.isRecording = false;
            this.pressedKeys.clear();

            // Restore previous value if current value is invalid when unfocusing
            const currentValue = this.element.value.trim();
            const isValid = this.isValidHotkey(currentValue);

            if (!isValid) {
                this.element.value = this.previousValue;
            }
        }

        isValidHotkey(value) {
            if (!value) return false;

            const parts = value.split('+');
            if (parts.length < 2) return false;

            const hasModifier = parts.slice(0, -1).some((part) => ['Ctrl', 'Alt', 'Shift', 'Meta'].includes(part));
            const hasLetter = /^[A-Z]$/.test(parts[parts.length - 1]);

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
            } else if (this.isLetter(key)) {
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
            if (e.key === 'Control') return 'Ctrl';
            if (e.key === 'Meta') return 'Meta';
            if (e.key === 'Alt') return 'Alt';
            if (e.key === 'Shift') return 'Shift';
            return e.key.toUpperCase();
        }

        isModifier(key) {
            return ['Ctrl', 'Alt', 'Shift', 'Meta'].includes(key);
        }

        isLetter(key) {
            return /^[A-Z]$/.test(key);
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
            const hasLetter = this.letterKey !== null;

            if (hasModifier && hasLetter) {
                const hotkey = [...this.modifiers, this.letterKey].join('+');
                this.previousValue = hotkey; // Update previous value on valid input
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
    }

    // Initialize hotkey input
    const input = document.querySelector('[data-type-hotkey]');
    new HotkeyInput(input);
})();
