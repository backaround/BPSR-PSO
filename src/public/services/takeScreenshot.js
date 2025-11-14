function triggerLoading(screenshotButton, isLoading) {
    if (screenshotButton && isLoading) {
        screenshotButton.disabled = true;
        screenshotButton.style.opacity = '0.5';
        const textSpan = screenshotButton.querySelector('#screenshotButtonText');
        if (textSpan) textSpan.textContent = 'Capturing...';
    }

    if (screenshotButton && !isLoading) {
        // Reset button state
        if (screenshotButton) {
            screenshotButton.disabled = false;
            screenshotButton.style.opacity = '1';
            const textSpan = screenshotButton.querySelector('#screenshotButtonText');
            if (textSpan) textSpan.textContent = 'Take Screenshot';
        }
    }
}

async function takeScreenshot() {
    const screenshotButton = document.getElementById('screenshotButton');

    try {
        triggerLoading(screenshotButton, true);
        const container = document.getElementById('columnsContainer');

        if (!container) {
            console.error('Container not found');
            triggerLoading(screenshotButton, false);
            return;
        }

        // Get actual content height
        const contentHeight = container.scrollHeight;
        const contentWidth = container.scrollWidth;

        // Capture the screenshot using dom-to-image-more (supports CSS filters)
        const dataUrl = await domtoimage.toPng(container, {
            bgcolor: '#303335',
            width: contentWidth,
            height: contentHeight,
            style: {
                transform: 'scale(1)',
                transformOrigin: 'top left',
            },
            quality: 0.95,
        });

        // Send to electron main process to save
        window.electronAPI?.saveScreenshot(dataUrl);
        triggerLoading(screenshotButton, false);
    } catch (error) {
        triggerLoading(screenshotButton, false);
        console.error('Screenshot error:', error);
        alert('Failed to take screenshot: ' + error.message);
    }
}
