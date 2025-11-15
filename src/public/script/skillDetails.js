const skillDetailsContainer = document.getElementById('skillDetailsContainer');
const serverStatus = document.getElementById('serverStatus');
const viewTitle = document.getElementById('viewTitle');

let socket = null;
let isWebSocketConnected = false;
let lastWebSocketMessage = Date.now();
const WEBSOCKET_RECONNECT_INTERVAL = 5000;
const SERVER_URL = 'localhost:8990';

let currentUserId = null;
let currentUserData = null;

function formatNumber(num) {
    if (isNaN(num)) return 'NaN';
    if (num >= 1_000_000_000) return (num / 1_000_000_000).toFixed(1) + 'B';
    if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + 'M';
    if (num >= 1_000) return (num / 1_000).toFixed(1) + 'K';
    return Math.round(num).toString();
}

function formatPercentage(value) {
    return (value * 100).toFixed(1) + '%';
}

function getSkillTypeColor(type) {
    switch (type) {
        case 'damage':
            return 'var(--red-gradient)';
        case 'healing':
            return 'var(--green-gradient)';
        default:
            return 'var(--blue-gradient)';
    }
}

function formatUserData(user) {
    const professionString = user.profession ? user.profession.trim() : '';
    const mainProfession = professionString.split('(')[0].trim();

    // Create display name with fightPoint if available
    const displayName = user.fightPoint ? `${user.name} (${user.fightPoint})` : user.name;

    let icon = '';
    if (mainProfession !== '...' && mainProfession.length > 1 && !/^\.+$/.test(mainProfession)) {
        icon = `assets/${mainProfession.toLowerCase().replace(/ /g, '_')}.png`;
    }

    return { icon, displayName, mainProfession };
}

// Create initial skill row HTML
function createSkillRowHTML(skillId, skillData) {
    const typeColor = getSkillTypeColor(skillData.type);
    const skillIcon = skillData.image;
    const avgDamage = skillData.totalCount > 0 ? skillData.totalDamage / skillData.totalCount : 0;

    return `
        <div class="skill-row" data-skill-id="${skillId}">
            <div class="skill-main-bar">
                <div class="skill-bar-fill" style="background: ${typeColor};"></div>
                <div class="skill-content">
                    <span class="skill-name">${skillData.displayName}</span>
                    <div class="skill-stats">
                        <span class="skill-total">${formatNumber(skillData.totalDamage)}</span>
                        <span class="skill-count">(${skillData.totalCount} hits)</span>
                    </div>
                </div>
            </div>
            
            <div style="display: flex; gap: 10px; padding: 10px; background-color: rgba(0, 0, 0, 0.2);">
                ${
                    skillIcon
                        ? ` <div class="skill-icon-container">
                                <img src="${skillIcon}" class="skill-icon" alt="${skillData.displayName}" onerror="this.style.display='none';" onload="this.classList.add('loaded')">
                            </div>`
                        : ''
                }

                <div class="skill-details-row">
                    <div class="skill-detail-item">
                        <span class="detail-label">Avg per Hit:</span>
                        <span class="detail-value avg-hit">${formatNumber(avgDamage)}</span>
                    </div>
                    <div class="skill-detail-item">
                        <span class="detail-label">Crit Rate:</span>
                        <span class="detail-value crit-rate">${formatPercentage(skillData.critRate)}</span>
                    </div>
                    <div class="skill-detail-item">
                        <span class="detail-label">Lucky Rate:</span>
                        <span class="detail-value lucky-rate">${formatPercentage(skillData.luckyRate)}</span>
                    </div>
                    <div class="skill-detail-item">
                        <span class="detail-label">Crit Hits:</span>
                        <span class="detail-value crit-count">${skillData.critCount}</span>
                    </div>
                    <div class="skill-detail-item">
                        <span class="detail-label">Lucky Hits:</span>
                        <span class="detail-value lucky-count">${skillData.luckyCount}</span>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Update existing skill row (only what changed)
function updateSkillRow(skillElement, skillId, skillData) {
    const typeColor = getSkillTypeColor(skillData.type);
    const skillIcon = skillData.image;
    const avgDamage = skillData.totalCount > 0 ? skillData.totalDamage / skillData.totalCount : 0;

    // Update skill bar fill color
    const barFill = skillElement.querySelector('.skill-bar-fill');
    if (barFill && barFill.style.background !== typeColor) {
        barFill.style.background = typeColor;
    }

    // Update skill icon
    const iconImg = skillElement.querySelector('.skill-icon');
    if (iconImg && skillIcon) {
        const currentSrc = iconImg.src.split('/').pop().split('?')[0];
        const newSrc = skillIcon.split('/').pop().split('?')[0];
        if (currentSrc !== newSrc) {
            iconImg.classList.remove('loaded');
            iconImg.src = skillIcon;
            iconImg.alt = skillData.displayName;
        }
    }

    // Update skill name
    const nameEl = skillElement.querySelector('.skill-name');
    const newName = skillData.displayName;
    if (nameEl && nameEl.textContent !== newName) {
        nameEl.textContent = newName;
    }

    // Update total damage
    const totalEl = skillElement.querySelector('.skill-total');
    const newTotal = formatNumber(skillData.totalDamage);
    if (totalEl && totalEl.textContent !== newTotal) {
        totalEl.textContent = newTotal;
    }

    // Update count
    const countEl = skillElement.querySelector('.skill-count');
    const newCount = `(${skillData.totalCount} hits)`;
    if (countEl && countEl.textContent !== newCount) {
        countEl.textContent = newCount;
    }

    // Update avg per hit
    const avgEl = skillElement.querySelector('.avg-hit');
    const newAvg = formatNumber(avgDamage);
    if (avgEl && avgEl.textContent !== newAvg) {
        avgEl.textContent = newAvg;
    }

    // Update crit rate
    const critRateEl = skillElement.querySelector('.crit-rate');
    const newCritRate = formatPercentage(skillData.critRate);
    if (critRateEl && critRateEl.textContent !== newCritRate) {
        critRateEl.textContent = newCritRate;
    }

    // Update lucky rate
    const luckyRateEl = skillElement.querySelector('.lucky-rate');
    const newLuckyRate = formatPercentage(skillData.luckyRate);
    if (luckyRateEl && luckyRateEl.textContent !== newLuckyRate) {
        luckyRateEl.textContent = newLuckyRate;
    }

    // Update crit count
    const critCountEl = skillElement.querySelector('.crit-count');
    const newCritCount = String(skillData.critCount);
    if (critCountEl && critCountEl.textContent !== newCritCount) {
        critCountEl.textContent = newCritCount;
    }

    // Update lucky count
    const luckyCountEl = skillElement.querySelector('.lucky-count');
    const newLuckyCount = String(skillData.luckyCount);
    if (luckyCountEl && luckyCountEl.textContent !== newLuckyCount) {
        luckyCountEl.textContent = newLuckyCount;
    }
}

function closeWindow() {
    window.electronAPI.closeSkillDetailsWindow();
}

function renderUserSkills(userData) {
    if (!userData || !userData.skills) {
        return;
    }

    const userName = userData.name || 'Unknown User';
    const fightPoint = userData.fightPoint || 0;
    const displayName = fightPoint ? `${userName} (${fightPoint})` : userName;

    viewTitle.textContent = displayName;

    const skills = userData.skills || {};
    const skillEntries = Object.entries(skills);

    if (skillEntries.length === 0) {
        return;
    }

    // Sort skills by total damage/healing descending
    skillEntries.sort((a, b) => b[1].totalDamage - a[1].totalDamage);

    const skillsHtml = skillEntries.map(([skillId, skillData]) => createSkillRowHTML(skillId, skillData)).join('');

    skillDetailsContainer.innerHTML = skillsHtml;
}

function updateUserSkills(userData) {
    if (!userData || !userData.skills) return;

    const userName = userData.name || 'Unknown User';
    const fightPoint = userData.fightPoint || 0;
    const displayName = fightPoint ? `${userName} (${fightPoint})` : userName;
    viewTitle.textContent = displayName;

    const skills = userData.skills || {};
    const skillEntries = Object.entries(skills);
    skillEntries.sort((a, b) => b[1].totalDamage - a[1].totalDamage);

    // Check if we need to do initial render
    if (skillDetailsContainer.children.length === 0 || skillDetailsContainer.querySelector('.no-data-message')) {
        renderUserSkills(userData);
        return;
    }

    // Create map of existing skill elements
    const existingSkills = new Map(
        Array.from(skillDetailsContainer.children)
            .filter((el) => el.classList.contains('skill-row'))
            .map((el) => [el.dataset.skillId, el])
    );

    // Update or create skills
    skillEntries.forEach(([skillId, skillData], index) => {
        let skillElement = existingSkills.get(skillId);

        if (skillElement) {
            // Update existing skill
            updateSkillRow(skillElement, skillId, skillData);
            existingSkills.delete(skillId);
        } else {
            // Create new skill element
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = createSkillRowHTML(skillId, skillData);
            skillElement = tempDiv.firstElementChild;
        }

        // Ensure correct position
        const currentAtIndex = skillDetailsContainer.children[index];
        if (currentAtIndex !== skillElement) {
            skillDetailsContainer.insertBefore(skillElement, currentAtIndex || null);
        }
    });

    // Remove skills that no longer exist
    existingSkills.forEach((el) => el.remove());
}

function showServerStatus(status) {
    const statusElement = document.getElementById('serverStatus');
    statusElement.className = `status-indicator ${status}`;
}

function getServerStatus() {
    const statusElement = document.getElementById('serverStatus');
    return statusElement.className.replace('status-indicator ', '');
}

function connectWebSocket() {
    socket = io(`ws://${SERVER_URL}`, {
        transports: ['websocket'],
        upgrade: false,
    });

    socket.on('connect', () => {
        isWebSocketConnected = true;
        showServerStatus('connected');
        lastWebSocketMessage = Date.now();

        // Request user skills if we have a userId
        if (currentUserId) {
            socket.emit('requestUserSkills', { userId: currentUserId });
        }
    });

    socket.on('disconnect', () => {
        isWebSocketConnected = false;
        showServerStatus('disconnected');
    });

    socket.on('userSkillData', (data) => {
        if (data.userId === currentUserId) {
            currentUserData = data.data;

            if (
                skillDetailsContainer.children.length === 0 ||
                skillDetailsContainer.querySelector('.no-data-message')
            ) {
                renderUserSkills(data.data);
            } else {
                updateUserSkills(data.data);
            }
        }
        lastWebSocketMessage = Date.now();
    });

    socket.on('connect_error', (error) => {
        showServerStatus('disconnected');
        console.error('WebSocket connection error:', error);
    });
}

function checkConnection() {
    if (!isWebSocketConnected && socket && socket.disconnected) {
        showServerStatus('reconnecting');
        socket.connect();
    }
    if (isWebSocketConnected && Date.now() - lastWebSocketMessage > WEBSOCKET_RECONNECT_INTERVAL) {
        isWebSocketConnected = false;
        if (socket) socket.disconnect();
        connectWebSocket();
        showServerStatus('reconnecting');
    }
}

function initialize() {
    // Get user ID from URL parameter
    const urlParams = new URLSearchParams(window.location.search);
    const userId = urlParams.get('userId');

    if (userId) {
        currentUserId = userId;
        connectWebSocket();
        setInterval(checkConnection, WEBSOCKET_RECONNECT_INTERVAL);
    } else {
        // No user ID provided, show message
        skillDetailsContainer.innerHTML = '<div class="no-data-message">No user selected</div>';
        viewTitle.textContent = 'Unknown';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    initialize();
});

window.closeWindow = closeWindow;
