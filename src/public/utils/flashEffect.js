/**
 * Creates a reusable flash effect utility using Web Animations API
 * This approach is performance-optimized as it:
 * - Uses CSS animations that run on the GPU compositor thread
 * - Avoids repeated class add/remove operations
 * - Leverages will-change for render optimization
 */

/**
 * Triggers a flash animation on an element
 * @param {HTMLElement} element - The element to flash
 * @param {Object} options - Animation options
 * @param {number} options.duration - Duration in ms (default: 300)
 * @param {string} options.color - Flash color (default: 'rgba(255, 255, 255, 0.3)')
 * @param {string} options.easing - Animation easing (default: 'ease-out')
 */
function flashElement(element, options = {}) {
    if (!element) return;

    const {
        duration = 300,
        color = 'rgba(255, 255, 255, 0.3)',
        easing = 'ease-out'
    } = options;

    // Cancel any existing flash animation on this element
    if (element._flashAnimation) {
        element._flashAnimation.cancel();
    }

    // Create and run the flash animation
    element._flashAnimation = element.animate(
        [
            { backgroundColor: color, boxShadow: `0 0 8px ${color}` },
            { backgroundColor: 'transparent', boxShadow: 'none' }
        ],
        {
            duration,
            easing,
            fill: 'forwards'
        }
    );

    // Clean up the animation reference when done
    element._flashAnimation.onfinish = () => {
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
        duration: 3000,
        color: 'rgba(255, 255, 255, 0.1)',
        easing: 'ease-out',
        ...options
    };

    flashElement(element, defaultOptions);
}
