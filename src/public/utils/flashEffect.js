/**
 * Creates a reusable flash effect utility using Web Animations API
 * This approach is performance-optimized as it:
 * - Uses CSS animations that run on the GPU compositor thread
 * - Avoids repeated class add/remove operations
 * - Leverages will-change for render optimization
 */

/**
 * Triggers a flash animation on an element using a div mask overlay
 * @param {HTMLElement} element - The element to flash
 * @param {Object} options - Animation options
 * @param {number} options.duration - Duration in ms (default: 300)
 * @param {string} options.color - Flash color (default: 'rgba(255, 255, 255, 0.3)')
 * @param {string} options.easing - Animation easing (default: 'ease-out')
 */
function flashElement(element, options = {}) {
    if (!element) return;

    const { duration = 300, color = 'rgba(255, 255, 255, 0.3)', easing = 'ease-out' } = options;

    // Create or reuse flash mask div
    let flashMask = element._flashMask;
    if (!flashMask) {
        flashMask = document.createElement('div');

        // Apply all styles inline for complete portability
        Object.assign(flashMask.style, {
            position: 'absolute',
            inset: '0',
            pointerEvents: 'none',
            zIndex: '100',
            borderRadius: 'inherit',
            display: 'none',
        });

        element.appendChild(flashMask);
        element._flashMask = flashMask;
    }

    // Cancel any existing flash animation
    if (element._flashAnimation) {
        element._flashAnimation.cancel();
    }

    // Show the mask and animate its opacity
    flashMask.style.display = 'block';
    flashMask.style.backgroundColor = color;

    element._flashAnimation = flashMask.animate([{ opacity: '1' }, { opacity: '0' }], {
        duration,
        easing,
    });

    // Clean up when animation finishes
    element._flashAnimation.onfinish = () => {
        flashMask.style.display = 'none';
        element._flashAnimation = null;
    };
}

/**
 * Triggers a flash effect on an element when its content changes
 * @param {HTMLElement} element - The element to flash
 * @param {string} newContent - The new content to check against
 * @param {string} oldContent - The old content to compare
 * @param {Object} options - Flash animation options
 */
function flashOnChange(element, newContent, oldContent, options = {}) {
    if (newContent !== oldContent) {
        flashElement(element, options);
    }
}

/**
 * Triggers a flash effect on a parent element (like a row)
 * Optimized for list items that update frequently
 * @param {HTMLElement} element - The element to flash
 * @param {Object} options - Flash animation options
 */
function flashRow(element, options = {}) {
    if (!element) return;

    const defaultOptions = {
        duration: 1000,
        color: 'rgba(255, 255, 255, 0.1)',
        easing: 'ease-out',
        ...options,
    };

    flashElement(element, defaultOptions);
}
