/**
 * RAF Scheduler - Throttles function calls using requestAnimationFrame
 *
 * This utility helps prevent excessive DOM updates by batching rapid calls
 * and syncing them with the browser's repaint cycle.
 *
 * @example
 * // Create a scheduler for 10 FPS updates
 * const renderScheduler = createRAFScheduler(10);
 *
 * // Schedule a function call - if called rapidly, only the latest data is used
 * function updateUI(data) {
 *   console.log('Updating UI with:', data);
 * }
 *
 * // This will batch multiple rapid calls into a single render at 10 FPS
 * renderScheduler.schedule(updateUI, userData);
 *
 * @param {number} targetFPS - Target frames per second (default: 10)
 * @returns {Object} Scheduler object with schedule, cancel, and isPending methods
 */
function createRAFScheduler(targetFPS = 10) {
    let rafId = null;
    let scheduledCallback = null;
    let scheduledData = null;
    let lastRenderTime = 0;
    const frameInterval = 1000 / targetFPS;

    /**
     * Schedules a callback to run at the target FPS rate
     *
     * @param {Function} callback - Function to call with the data
     * @param {*} data - Data to pass to the callback
     */
    function schedule(callback, data) {
        scheduledCallback = callback;
        scheduledData = data;

        if (rafId) return; // Already scheduled

        rafId = requestAnimationFrame((currentTime) => {
            const elapsed = currentTime - lastRenderTime;

            if (elapsed >= frameInterval) {
                rafId = null;
                if (scheduledCallback) {
                    scheduledCallback(scheduledData);
                }
                scheduledCallback = null;
                scheduledData = null;
                lastRenderTime = currentTime;
            } else {
                // Not enough time has passed, reschedule
                rafId = null;
                schedule(scheduledCallback, scheduledData);
            }
        });
    }

    /**
     * Cancels any pending scheduled callback
     */
    function cancel() {
        if (rafId) {
            cancelAnimationFrame(rafId);
            rafId = null;
        }
        scheduledCallback = null;
        scheduledData = null;
    }

    /**
     * Checks if a callback is currently scheduled
     */
    function isPending() {
        return rafId !== null;
    }

    return {
        schedule,
        cancel,
        isPending,
    };
}
