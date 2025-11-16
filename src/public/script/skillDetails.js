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

// Create RAF scheduler for render and update functions (10 FPS to match WebSocket rate)
const renderScheduler = createRAFScheduler(10);
const updateScheduler = createRAFScheduler(10);

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

function getSkillTypeLabel(type) {
    switch (type) {
        case 'damage':
            return 'Damage Skills';
        case 'healing':
            return 'Healing Skills';
        default:
            return 'Support Skills';
    }
}

function getSkillTypeIcon(type) {
    switch (type) {
        case 'damage':
            return '/assets/swords.svg';
        case 'healing':
            return '/assets/heart-plus.svg';
        default:
            return '/assets/shield-checkered.svg';
    }
}

// Group and sort skills by type
function groupAndSortSkills(skills) {
    const skillsByType = {
        damage: [],
        healing: [],
        support: [],
    };

    const compareDesc = (a, b) => b[1].totalDamage - a[1].totalDamage;

    // Single pass: group skills
    for (const [skillId, skillData] of Object.entries(skills)) {
        const type = skillData.type || 'support';
        (skillsByType[type] || skillsByType.support).push([skillId, skillData]);
    }

    // Sort each group
    skillsByType.damage.sort(compareDesc);
    skillsByType.healing.sort(compareDesc);
    skillsByType.support.sort(compareDesc);

    return skillsByType;
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

// Create section container with header
function createSectionContainerHTML(type, skills) {
    const typeColor = getSkillTypeColor(type);
    const typeIcon = getSkillTypeIcon(type);
    const typeLabel = getSkillTypeLabel(type);
    const count = skills.length;

    // Calculate total damage/heal for this section
    const sectionTotal = skills.reduce((sum, [_, skillData]) => sum + skillData.totalDamage, 0);

    const skillsHtml = skills
        .map(([skillId, skillData]) => createSkillRowHTML(skillId, skillData, sectionTotal))
        .join('');

    return `
        <div class="skill-section" data-skill-type="${type}">
            <div class="skill-section-header">
                <div class="skill-bar-fill" style="background: ${typeColor};"></div>
                <div class="section-header-content">
                    <div class="section-header-left">
                        <div class="section-header-title">
                            <img src="${typeIcon}" class="skill-type-icon">
                            <span>${typeLabel}</span>
                            <span class="section-header-total">${formatNumber(sectionTotal)}</span>
                        </div>
                    </div>
                    <span class="section-header-count">${count} skill${count !== 1 ? 's' : ''}</span>
                </div>
            </div>
            <div class="skill-section-content" data-section-total="${sectionTotal}">
                ${skillsHtml}
            </div>
        </div>
    `;
}

// Create initial skill row HTML
function createSkillRowHTML(skillId, skillData, sectionTotal = 0) {
    const typeColor = getSkillTypeColor(skillData.type);
    const skillIcon = skillData.image;
    const avgDamage = skillData.totalCount > 0 ? skillData.totalDamage / skillData.totalCount : 0;
    const percentage = sectionTotal > 0 ? (skillData.totalDamage / sectionTotal) * 100 : 0;

    return `
        <div class="skill-row" data-skill-id="${skillId}">
            <div class="skill-main-bar">
                <div class="skill-bar-fill" style="background: ${typeColor}"></div>
                <div class="skill-content">
                    <span class="skill-name">${skillData.displayName}</span>
                    <div class="skill-stats">
                        <span class="skill-percentage">${percentage.toFixed(1)}%</span>
                        <span class="skill-total">${formatNumber(skillData.totalDamage)}</span>
                        <span class="skill-count">(${skillData.totalCount} hits)</span>
                    </div>
                </div>
            </div>

            <div style="display: flex; gap: 16px; padding: 10px">
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
function updateSkillRow(skillElement, skillId, skillData, sectionTotal = 0) {
    const typeColor = getSkillTypeColor(skillData.type);
    const skillIcon = skillData.image;
    const avgDamage = skillData.totalCount > 0 ? skillData.totalDamage / skillData.totalCount : 0;
    const percentage = sectionTotal > 0 ? (skillData.totalDamage / sectionTotal) * 100 : 0;

    // Update skill bar fill color and width
    const barFill = skillElement.querySelector('.skill-bar-fill');
    if (barFill) {
        if (barFill.style.background !== typeColor) {
            barFill.style.background = typeColor;
        }
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

    // Update percentage
    const percentageEl = skillElement.querySelector('.skill-percentage');
    const newPercentage = `${percentage.toFixed(1)}%`;
    if (percentageEl && percentageEl.textContent !== newPercentage) {
        percentageEl.textContent = newPercentage;
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

function scheduleRenderUserSkills(userData) {
    renderScheduler.schedule(renderUserSkills, userData);
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

    if (Object.keys(skills).length === 0) {
        return;
    }

    // Group and sort skills by type
    const skillsByType = groupAndSortSkills(skills);

    // Build HTML with section containers
    let skillsHtml = '';
    const typeOrder = ['damage', 'healing', 'support'];

    typeOrder.forEach((type) => {
        const typeSkills = skillsByType[type];
        if (typeSkills.length > 0) {
            skillsHtml += createSectionContainerHTML(type, typeSkills);
        }
    });

    skillDetailsContainer.innerHTML = skillsHtml;
}

function scheduleUpdateUserSkills(userData) {
    updateScheduler.schedule(updateUserSkills, userData);
}

function updateUserSkills(userData) {
    if (!userData || !userData.skills) return;

    const userName = userData.name || 'Unknown User';
    const fightPoint = userData.fightPoint || 0;
    const displayName = fightPoint ? `${userName} (${fightPoint})` : userName;
    viewTitle.textContent = displayName;

    const skills = userData.skills || {};

    // Check if we need to do initial render
    if (skillDetailsContainer.children.length === 0 || skillDetailsContainer.querySelector('.no-data-message')) {
        renderUserSkills(userData);
        return;
    }

    // Group and sort skills by type
    const skillsByType = groupAndSortSkills(skills);

    // Create map of existing section containers
    const existingSections = new Map(
        Array.from(skillDetailsContainer.children)
            .filter((el) => el.classList.contains('skill-section'))
            .map((el) => [el.dataset.skillType, el])
    );

    // Build sections in order using optimal insertion pattern
    const typeOrder = ['damage', 'healing', 'support'];
    let currentPosition = 0;

    typeOrder.forEach((type) => {
        const typeSkills = skillsByType[type];
        if (typeSkills.length === 0) return;

        let sectionElement = existingSections.get(type);

        if (!sectionElement) {
            // Create new section container
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = createSectionContainerHTML(type, typeSkills);
            sectionElement = tempDiv.firstElementChild;
        } else {
            // Update existing section
            updateSectionContent(sectionElement, type, typeSkills);
            existingSections.delete(type);
        }

        // Position section element
        const currentAtPosition = skillDetailsContainer.children[currentPosition];
        if (currentAtPosition !== sectionElement) {
            skillDetailsContainer.insertBefore(sectionElement, currentAtPosition || null);
        }
        currentPosition++;
    });

    // Remove sections that no longer exist
    existingSections.forEach((el) => el.remove());
}

// Update section content (header count and skills)
function updateSectionContent(sectionElement, type, typeSkills) {
    // Calculate total damage/heal for this section
    const sectionTotal = typeSkills.reduce((sum, [_, skillData]) => sum + skillData.totalDamage, 0);

    // Update header count
    const countEl = sectionElement.querySelector('.section-header-count');
    if (countEl) {
        const newCount = `${typeSkills.length} skill${typeSkills.length !== 1 ? 's' : ''}`;
        if (countEl.textContent !== newCount) {
            countEl.textContent = newCount;
        }
    }

    // Update header total
    const totalEl = sectionElement.querySelector('.section-header-total');
    if (totalEl) {
        const newTotal = formatNumber(sectionTotal);
        if (totalEl.textContent !== newTotal) {
            totalEl.textContent = newTotal;
        }
    }

    // Get section content container
    const contentContainer = sectionElement.querySelector('.skill-section-content');
    if (!contentContainer) return;

    // Update section total data attribute
    contentContainer.dataset.sectionTotal = sectionTotal;

    // Create map of existing skill elements in this section
    const existingSkills = new Map(
        Array.from(contentContainer.children)
            .filter((el) => el.classList.contains('skill-row'))
            .map((el) => [el.dataset.skillId, el])
    );

    // Update or create skills
    typeSkills.forEach(([skillId, skillData], index) => {
        let skillElement = existingSkills.get(skillId);

        if (skillElement) {
            // Update existing skill
            updateSkillRow(skillElement, skillId, skillData, sectionTotal);
            existingSkills.delete(skillId);
        } else {
            // Create new skill element
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = createSkillRowHTML(skillId, skillData, sectionTotal);
            skillElement = tempDiv.firstElementChild;
        }

        // Position skill element
        const currentAtIndex = contentContainer.children[index];
        if (currentAtIndex !== skillElement) {
            contentContainer.insertBefore(skillElement, currentAtIndex || null);
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
                scheduleRenderUserSkills(data.data);
            } else {
                scheduleUpdateUserSkills(data.data);
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
