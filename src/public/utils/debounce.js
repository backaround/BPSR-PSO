/**
 * Creates a debounced version of a function that prevents execution until
 * wait milliseconds have passed since the last execution completed.
 *
 * @param {Function} func - The function to debounce
 * @param {number} wait - The number of milliseconds to wait between executions
 * @returns {Function} The debounced function
 *
 * @example
 * const debouncedClear = debounce(clearData, 500);
 * debouncedClear(); // Executes immediately
 * debouncedClear(); // Ignored if called within 500ms of last execution
 */
function debounce(func, wait) {
    let lastExecutionTime = 0;
    let isExecuting = false;

    return async function executedFunction(...args) {
        const now = Date.now();
        const timeSinceLastExecution = now - lastExecutionTime;

        // Prevent execution if already running or too soon since last execution
        if (isExecuting || timeSinceLastExecution < wait) {
            return;
        }

        isExecuting = true;
        lastExecutionTime = now;

        try {
            await func.apply(this, args);
        } finally {
            isExecuting = false;
        }
    };
}
