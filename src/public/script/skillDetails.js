const skillDetailsContainer = document.getElementById('skillDetailsContainer');
const serverStatus = document.getElementById('serverStatus');

let socket = null;
let isWebSocketConnected = false;
let lastWebSocketMessage = Date.now();
const WEBSOCKET_RECONNECT_INTERVAL = 5000;
const SERVER_URL = 'localhost:8990';

let allSkillData = {};

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

function getSkillTypeIcon(type) {
    switch (type) {
        case 'damage':
            return 'assets/swords.svg';
        case 'healing':
            return 'assets/heart-plus.svg';
        default:
            return 'assets/swords.svg';
    }
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
    const typeIcon = getSkillTypeIcon(skillData.type);
    const avgDamage = skillData.totalCount > 0 ? skillData.totalDamage / skillData.totalCount : 0;

    return `
        <div class="skill-row" data-skill-id="${skillId}">
            <div class="skill-main-bar">
                <div class="skill-bar-fill" style="background: ${typeColor};"></div>
                <div class="skill-content">
                    <img src="${typeIcon}" class="skill-type-icon" onerror="this.style.display='none'">
                    <span class="skill-name">${skillData.displayName}</span>
                    <div class="skill-stats">
                        <span class="skill-total">${formatNumber(skillData.totalDamage)}</span>
                        <span class="skill-count">(${skillData.totalCount} hits)</span>
                    </div>
                </div>
            </div>
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
    `;
}

// Update existing skill row (only what changed)
function updateSkillRow(skillElement, skillId, skillData) {
    const typeColor = getSkillTypeColor(skillData.type);
    const typeIcon = getSkillTypeIcon(skillData.type);
    const avgDamage = skillData.totalCount > 0 ? skillData.totalDamage / skillData.totalCount : 0;

    // Update skill bar fill color
    const barFill = skillElement.querySelector('.skill-bar-fill');
    if (barFill && barFill.style.background !== typeColor) {
        barFill.style.background = typeColor;
    }

    // Update skill icon
    const icon = skillElement.querySelector('.skill-type-icon');
    if (icon && icon.src !== typeIcon) {
        icon.src = typeIcon;
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

// Create initial user section HTML
function createUserSectionHTML(userId, userData) {
    const { icon, displayName, mainProfession } = formatUserData(userData);
    const skills = userData.skills || {};
    const skillEntries = Object.entries(skills);

    if (skillEntries.length === 0) {
        return '';
    }

    // Sort skills by total damage/healing descending
    skillEntries.sort((a, b) => b[1].totalDamage - a[1].totalDamage);

    const skillsHtml = skillEntries.map(([skillId, skillData]) =>
        createSkillRowHTML(skillId, skillData)
    ).join('');

    return `
        <div class="user-section" data-user-id="${userId}" data-collapsible="user-${userId}" data-collapsed="true">
            <div class="user-header" data-collapsible-trigger="user-${userId}">
                <img src="${icon}" class="user-class-icon" alt="${mainProfession}" onerror="this.style.display='none'">
                <span class="user-name">${displayName}</span>
                <span class="skill-count-badge">${skillEntries.length} skills</span>
            </div>
            <div class="user-skills" data-collapsible-content="user-${userId}">
                ${skillsHtml}
            </div>
        </div>
    `;
}

// Update existing user section (only what changed)
function updateUserSection(userElement, userId, userData) {
    const { icon, displayName, mainProfession } = formatUserData(userData);
    const skills = userData.skills || {};

    // Update user header
    const classIcon = userElement.querySelector('.user-class-icon');
    if (classIcon && classIcon.src !== icon) {
        classIcon.src = icon;
    }
    if (classIcon && classIcon.alt !== mainProfession) {
        classIcon.alt = mainProfession;
    }

    const userName = userElement.querySelector('.user-name');
    if (userName && userName.textContent !== displayName) {
        userName.textContent = displayName;
    }

    const skillCountBadge = userElement.querySelector('.skill-count-badge');
    const skillCount = Object.keys(skills).length;
    const newBadgeText = `${skillCount} skills`;
    if (skillCountBadge && skillCountBadge.textContent !== newBadgeText) {
        skillCountBadge.textContent = newBadgeText;
    }

    // Update skills
    const userSkillsContainer = userElement.querySelector('.user-skills');
    if (!userSkillsContainer) return;

    const skillEntries = Object.entries(skills);
    skillEntries.sort((a, b) => b[1].totalDamage - a[1].totalDamage);

    // Create map of existing skill elements
    const existingSkills = new Map(
        Array.from(userSkillsContainer.children).map((el) => [el.dataset.skillId, el])
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
        const currentAtIndex = userSkillsContainer.children[index];
        if (currentAtIndex !== skillElement) {
            userSkillsContainer.insertBefore(skillElement, currentAtIndex || null);
        }
    });

    // Remove skills that no longer exist
    existingSkills.forEach((el) => el.remove());
}

function renderSkillDetails(data) {
    if (!data || Object.keys(data).length === 0) {
        return;
    }

    const userEntries = Object.entries(data);

    // Filter out users without valid names
    const validUserEntries = userEntries.filter(([userId, userData]) => {
        const userName = userData.name;
        // Skip users with invalid or missing names
        if (!userName || userName === '...' || userName === '未知' || /^\.+$/.test(userName)) {
            return false;
        }
        return true;
    });

    // Sort users by total damage (sum of all skills)
    validUserEntries.sort((a, b) => {
        const getTotalDamage = (userData) => {
            const skills = userData.skills || {};
            return Object.values(skills).reduce((sum, skill) => sum + skill.totalDamage, 0);
        };
        return getTotalDamage(b[1]) - getTotalDamage(a[1]);
    });

    // Create map of existing user sections
    const existingUsers = new Map(
        Array.from(skillDetailsContainer.children)
            .filter((el) => el.classList.contains('user-section'))
            .map((el) => [el.dataset.userId, el])
    );

    // Update or create user sections
    validUserEntries.forEach(([userId, userData], index) => {
        let userElement = existingUsers.get(userId);
        const isNewElement = !userElement;

        if (userElement) {
            // Update existing user section
            updateUserSection(userElement, userId, userData);
            existingUsers.delete(userId);
        } else {
            // Create new user section
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = createUserSectionHTML(userId, userData);
            userElement = tempDiv.firstElementChild;
        }

        // Ensure correct position
        const currentAtIndex = skillDetailsContainer.children[index];
        if (currentAtIndex !== userElement) {
            skillDetailsContainer.insertBefore(userElement, currentAtIndex || null);
        }

        // Register new collapsible
        if (isNewElement && window.CollapsibleManager) {
            window.CollapsibleManager.register(`user-${userId}`, true);
        }
    });

    // Remove users that no longer exist
    existingUsers.forEach((el) => {
        const userId = el.dataset.userId;
        if (window.CollapsibleManager) {
            window.CollapsibleManager.unregister(`user-${userId}`);
        }
        el.remove();
    });
}

function processSkillDataUpdate(data) {
    if (!data.user) {
        console.warn('Received skill data without a "user" object:', data);
        return;
    }

    allSkillData = data.user;
    renderSkillDetails(allSkillData);
}

function closeWindow() {
    window.electronAPI.closeSkillDetailsWindow();
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
    });

    socket.on('disconnect', () => {
        isWebSocketConnected = false;
        showServerStatus('disconnected');
    });

    socket.on('skillData', (data) => {
        processSkillDataUpdate(data);
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
    connectWebSocket();
    setInterval(checkConnection, WEBSOCKET_RECONNECT_INTERVAL);
}

document.addEventListener('DOMContentLoaded', () => {
    initialize();
});

window.closeWindow = closeWindow;
