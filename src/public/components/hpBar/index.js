function parseTextHP(current, max) {
    let result = '';
    const currentText = formatNumber(current ?? 0);
    const maxText = formatNumber(max ?? 0);
    if (current === undefined) result = `${maxText} / ${maxText} HP`;
    else result = `${currentText} / ${maxText} HP`;
    return result;
}

function setHP(target, current, max) {
    if (current === undefined) {
        current = max;
    }

    const hpbar = typeof target === 'string' ? document.querySelector(target) : target;
    const fill = hpbar.querySelector('.hp-bar__fill');
    const label = hpbar.querySelector('.hp-bar__label');
    const icon = hpbar.querySelector('.hp-bar__icon');
    const _content = hpbar.querySelector('.hp-bar__content');

    const percent = Math.max(0, Math.min(100, (current / max) * 100));
    fill.style.width = percent + '%';

    // Color based on HP percentage
    let color;
    if (percent > 60) {
        color = 'var(--hp-good)';
    } else if (percent > 30) {
        color = 'var(--hp-warning)';
    } else if (percent > 0) {
        color = 'var(--hp-bad)';
    }

    if (percent === 0) {
        _content.style.opacity = '0.5';
        icon.src = 'assets/heart-broken.svg';
    } else {
        _content.style.opacity = '1';
        icon.src = 'assets/heart.svg';
    }

    fill.style.background = color;

    const content = parseTextHP(current, max);
    if (content !== label.textContent) label.textContent = content;
}
