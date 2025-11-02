const colorHues = [
    210, // Blue
    30, // Orange
    270, // Purple
    150, // Teal
    330, // Magenta
    60, // Yellow
    180, // Cyan
    0, // Red
    240, // Indigo
];

let colorIndex = 0;
function getColorShades(currentMode) {
    // const h = colorHues[colorIndex];
    // colorIndex = (colorIndex + 1) % colorHues.length;
    // const s = 90,
    //     l_main = 30,
    //     l_sub = 20;
    // return {
    //     main: `hsl(${h}, ${s}%, ${l_main}%)`,
    //     sub: `hsl(${h}, ${s}%, ${l_sub}%)`,
    // };
    switch (currentMode) {
        case 'healing':
        case 'hps':
            return 'var(--green-gradient)';
        case 'taken':
            return 'var(--blue-gradient)';
        default:
            return 'var(--red-gradient)';
    }
}

const columnsContainer = document.getElementById('columnsContainer');
const helpContainer = document.getElementById('helpContainer');
const passthroughTitle = document.getElementById('passthroughTitle');
const controlTool = document.getElementById('control-tool');
const controlPassthrough = document.getElementById('control-passthrough');
const sortSelect = document.getElementById('sortSelect');
const filterSelect = document.getElementById('filterSelect');
const pauseButton = document.getElementById('pauseButton');
const serverStatus = document.getElementById('serverStatus');
const opacitySlider = document.getElementById('opacitySlider');
const HkclearData = document.getElementById('HkclearData');

let isCurrentModeChanged = false;
let allUsers = {};
let userColors = {};
let isPaused = false;
let socket = null;
let isWebSocketConnected = false;
let lastWebSocketMessage = Date.now();
const WEBSOCKET_RECONNECT_INTERVAL = 5000;
const SERVER_URL = 'localhost:8990';

let currentMode = 'damage';
let selectedClasses = new Set([
    'Frost Mage',
    'Heavy Guardian',
    'Marksman',
    'Shield Knight',
    'Soul Musician',
    'Stormblade',
    'Verdant Oracle',
    'Wind Knight',
]);

let rafRenderId = null;
let scheduledUsersArray = null;
let lastRenderTime = 0;
const TARGET_FPS = 10; // WebSocket is ~10 updates per sec.
const FRAME_INTERVAL = 1000 / TARGET_FPS;

function scheduleRenderDataList(users) {
    scheduledUsersArray = users;
    if (rafRenderId) return;

    rafRenderId = requestAnimationFrame((currentTime) => {
        const elapsed = currentTime - lastRenderTime;

        if (elapsed >= FRAME_INTERVAL) {
            rafRenderId = null;
            renderDataList(scheduledUsersArray || []);
            scheduledUsersArray = null;
            lastRenderTime = currentTime;
        } else {
            rafRenderId = null;
            scheduleRenderDataList(scheduledUsersArray);
        }
    });
}

function formatNumber(num) {
    if (isNaN(num)) return 'NaN';
    if (num >= 1_000_000_000) return (num / 1_000_000_000).toFixed(1) + 'B';
    if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + 'M';
    if (num >= 1_000) return (num / 1_000).toFixed(1) + 'K';
    return Math.round(num).toString();
}

function sortUsers(users, mode) {
    switch (mode) {
        case 'damage':
            return users.sort(
                (a, b) => b.total_damage.total - a.total_damage.total || b.total_healing.total - a.total_healing.total
            );
        case 'healing':
            return users.sort(
                (a, b) => b.total_healing.total - a.total_healing.total || b.total_damage.total - a.total_damage.total
            );
        case 'taken':
            return users.sort((a, b) => b.taken_damage - a.taken_damage || b.total_damage.total - a.total_damage.total);
        case 'dps':
            return users.sort((a, b) => b.total_dps - a.total_dps || b.total_hps - a.total_hps);
        case 'hps':
            return users.sort((a, b) => b.total_hps - a.total_hps || b.total_dps - a.total_dps);
    }
}

function updateAll() {
    scheduleRenderDataList(Object.values(allUsers));
}

const barContent = {
    damage: ({ user, damagePercent }) => {
        return `${formatNumber(user.total_damage.total)} (${formatNumber(user.total_dps)} DPS, ${damagePercent.toFixed(1)}%)`;
    },
    heal: ({ user, healingPercent }) => {
        return `${formatNumber(user.total_healing.total)} (${formatNumber(user.total_hps)} HPS, ${healingPercent.toFixed(1)}%)`;
    },
    damageTaken: ({ user, damageTakenPercent }) => {
        return `${formatNumber(user.taken_damage)} (${damageTakenPercent.toFixed(1)}%)`;
    },
};

function subBar({ barContent, icon, type }) {
    return `<div class="sub-bar">
                <div class="sub-bar-text" data-type="${type}">
                   ${barContent}
                </div>
                <img src="${icon}" class="icon-stat" onerror="this.style.display='none'">
            </div>`;
}

function mainBar({ barColor, barPercent, barContent, displayName, mainProfession, iconClass, iconMain, index }) {
    return `
            <div class="main-bar">
                 <div class="stats-bar-fill" style="width: ${barPercent}%; background: ${barColor};"></div>
                <div class="content">
                    <span class="rank">${index + 1}</span>
                    <img src="${iconClass}" class="class-icon icon" alt="${mainProfession}" onerror="this.style.display='none'">
                    <span class="name">${displayName}</span>
                    <div class='stats-content'>
                        <span class="stats">${barContent}</span>
                        <img src="${iconMain}" class="icon-stat-main" onerror="this.style.display='none'">
                    </div>
                </div>
            </div>`;
}

function hpBar({ currentHp, maxHp }) {
    return `<div class="hp-bar">
                <div class="hp-bar__fill"></div>
                <div class="hp-bar__content">
                    <img src="assets/heart.svg" class='hp-bar__icon' onerror="this.style.display='none'">
                    <span class="hp-bar__label">
                        ${parseTextHP(currentHp, maxHp)}
                    </span>
                </div>
            </div>`;
}

function initSubBarContent({ user, damagePercent, healingPercent, damageTakenPercent }) {
    function initSubBar(types) {
        let result = '';

        if (types.includes('damage'))
            result += subBar({
                type: 'damage',
                icon: 'assets/swords.svg',
                barContent: `${barContent['damage']({
                    user,
                    damagePercent,
                })}`,
            });

        if (types.includes('heal'))
            result += subBar({
                type: 'heal',
                icon: 'assets/heart-plus.svg',
                barContent: `${barContent['heal']({
                    user,
                    healingPercent,
                })}`,
            });

        if (types.includes('damageTaken'))
            result += subBar({
                type: 'damageTaken',
                icon: 'assets/shield-checkered.svg',
                barContent: `${barContent['damageTaken']({
                    user,
                    damageTakenPercent,
                })}`,
            });

        return result;
    }

    switch (currentMode) {
        case 'healing':
        case 'hps':
            return initSubBar(['damageTaken', 'damage']);
        case 'taken':
            return initSubBar(['heal', 'damage']);
        default:
            return initSubBar(['heal', 'damageTaken']);
    }
}

function formatUserData(user) {
    let icon = '';
    const professionString = user.profession ? user.profession.trim() : '';
    const mainProfession = professionString.split('(')[0].trim();
    const displayName = user.fightPoint ? `${user.name} (${user.fightPoint})` : user.name;

    // init class icon
    if (mainProfession !== '...' && mainProfession.length > 1 && !/^\.+$/.test(mainProfession)) {
        icon = `assets/${mainProfession.toLowerCase().replace(/ /g, '_')}.png`;
    }

    return { icon, displayName, mainProfession };
}

function initMainBarContent({ index, user, damagePercent, healingPercent, damageTakenPercent }) {
    const color = getColorShades(currentMode);
    const { icon, displayName, mainProfession } = formatUserData(user);

    switch (currentMode) {
        case 'healing':
        case 'hps':
            return mainBar({
                index,
                barColor: color,
                barPercent: healingPercent,
                barContent: barContent['heal']({
                    user,
                    healingPercent,
                }),
                mainProfession,
                displayName,
                iconClass: icon,
                iconMain: 'assets/heart-plus.svg',
            });
        case 'taken':
            return mainBar({
                index,
                barColor: color,
                barPercent: damageTakenPercent,
                barContent: barContent['damageTaken']({
                    user,
                    damageTakenPercent,
                }),
                mainProfession,
                displayName,
                iconClass: icon,
                iconMain: 'assets/shield-checkered.svg',
            });
        default:
            return mainBar({
                index,
                barColor: color,
                barPercent: damagePercent,
                barContent: barContent['damage']({
                    user,
                    damagePercent,
                }),
                mainProfession,
                displayName,
                iconClass: icon,
                iconMain: 'assets/swords.svg',
            });
    }
}

// Update only the necessary parts of an existing row
function updateRowData(item, { index, user, damagePercent, healingPercent, damageTakenPercent }) {
    // figure out mode-specific main content + percent
    let mainContent = '';
    let mainPercent = 0;
    let mainIconMode = '';
    const color = getColorShades(currentMode);
    const { icon, displayName, mainProfession } = formatUserData(user);

    // main stats DOMs
    const rank = item.querySelector('.rank');
    const stats = item.querySelector('.stats');
    const fill = item.querySelector('.stats-bar-fill');
    const name = item.querySelector('.name');
    const iconClass = item.querySelector('.icon');
    const iconMode = item.querySelector('.icon-stat-main');
    const hpBar = item.querySelector('.hp-bar');
    const contentHeal = barContent.heal({ user, healingPercent });
    const contentDamageTaken = barContent.damageTaken({ user, damageTakenPercent });
    const contentDamage = barContent.damage({ user, damagePercent });

    switch (currentMode) {
        case 'healing':
        case 'hps':
            mainContent = contentHeal;
            mainPercent = healingPercent;
            mainIconMode = 'assets/heart-plus.svg';
            break;
        case 'taken':
            mainContent = contentDamageTaken;
            mainPercent = damageTakenPercent;
            mainIconMode = 'assets/shield-checkered.svg';
            break;
        default:
            mainContent = contentDamage;
            mainPercent = damagePercent;
            mainIconMode = 'assets/swords.svg';
            break;
    }

    const oldRank = rank?.textContent;
    const oldStats = stats?.textContent;
    const oldName = name?.textContent;
    const oldFill = fill?.style.width;
    const oldFillBackground = fill.style.background;
    const oldIconSrc = iconClass?.src;
    const oldIconAlt = iconClass?.alt;
    const oldIconModeSrc = iconMode.src;

    const newRank = `${index + 1}`;
    const newStats = mainContent;
    const newName = displayName;
    const newFill = `${mainPercent}%`;
    const newFillBackground = color;
    const newIconSrc = icon;
    const newIconAlt = mainProfession;
    const newIconModeSrc = mainIconMode;

    if (rank && newRank !== oldRank) {
        rank.textContent = newRank;
    }
    if (stats && newStats !== oldStats) {
        stats.textContent = newStats;
    }
    if (name && newName !== oldName) {
        name.textContent = newName;
    }
    if (fill) {
        if (newFill !== oldFill) {
            fill.style.width = newFill;
        }
        if (newFillBackground !== oldFillBackground) {
            fill.style.background = newFillBackground;
        }
    }
    if (iconClass) {
        if (newIconSrc !== oldIconSrc) {
            iconClass.src = newIconSrc;
        }
        if (newIconAlt !== oldIconAlt) {
            iconClass.alt = newIconAlt;
        }
    }
    if (iconMode) {
        if (newIconModeSrc !== oldIconModeSrc) {
            iconMode.src = newIconModeSrc;
        }
    }

    if (hpBar) {
        setHP(hpBar, user.hp, user.max_hp);
    }

    // update sub-bars content
    const subInfo = item.querySelector('.right-data');
    if (subInfo) {
        const html = initSubBarContent({ user, damagePercent, healingPercent, damageTakenPercent });

        if (subInfo.__htmlCache != html) {
            subInfo.innerHTML = html;
            subInfo.__htmlCache = html;
        }
    }
}

function renderDataList(users) {
    let filteredUsers = [];
    let totalDamageOverall = 0;
    let totalHealingOverall = 0;
    let totalDamageTakenOverall = 0;

    // Single pass: filter + aggregate
    for (const user of users) {
        if (user.total_dps <= 0 && user.total_hps <= 0) continue;

        if (selectedClasses.size > 0) {
            if (!user.profession) continue;
            const { mainProfession } = formatUserData(user);
            if (!selectedClasses.has(mainProfession)) continue;
        }

        filteredUsers.push(user);
        totalDamageOverall += user.total_damage.total;
        totalHealingOverall += user.total_healing.total;
        totalDamageTakenOverall += user.taken_damage || 0;
    }

    sortUsers(filteredUsers, currentMode);
    const existing = new Map(Array.from(columnsContainer.children).map((element) => [element.dataset.key, element]));

    filteredUsers.forEach((user, index) => {
        let item = existing.get(String(user.id));
        const isCurrentUserUuid = user.isCurrentUserUuid;
        const damagePercent = totalDamageOverall > 0 ? (user.total_damage.total / totalDamageOverall) * 100 : 0;
        const healingPercent = totalHealingOverall > 0 ? (user.total_healing.total / totalHealingOverall) * 100 : 0;
        const damageTakenPercent =
            totalDamageTakenOverall > 0 ? ((user.taken_damage || 0) / totalDamageTakenOverall) * 100 : 0;

        let className = 'data-item';
        if (isCurrentUserUuid) {
            user.name = `🟢 ${user.name}`;
            className += ' main-character';
        }

        if (item) {
            updateRowData(item, { index, user, damagePercent, healingPercent, damageTakenPercent });
            existing.delete(user.id);
        } else {
            item = document.createElement('li');
            item.className = className;
            item.dataset.key = user.id;
            item.innerHTML = `${initMainBarContent({ index, user, damagePercent, healingPercent, damageTakenPercent })}
                                <div class='sub-info'>    
                                    <div class="left-data">
                                        ${hpBar({ currentHp: user.hp, maxHp: user.maxHp })}
                                    </div>
                                    <div class="right-data">   
                                        ${initSubBarContent({ user, damagePercent, healingPercent, damageTakenPercent })}
                                    </div>
                                </div>`;
        }

        // If it's not already at position index, move it there
        const currentAtIndex = columnsContainer.children[index];
        if (currentAtIndex !== item) {
            columnsContainer.insertBefore(item, currentAtIndex || null);
        }
    });

    // Remove excess items
    existing.forEach((el) => el.remove());
}

function processDataUpdate(data) {
    if (isPaused) return;
    if (!data.user) {
        console.warn('Received data without a "user" object:', data);
        return;
    }
    for (const userId in data.user) {
        const newUser = data.user[userId];
        const existingUser = allUsers[userId] || {};
        const updatedUser = Object.assign({}, existingUser, newUser, { id: userId });

        const hasNewValidName = newUser.name && typeof newUser.name === 'string' && newUser.name !== '未知';
        if (hasNewValidName) updatedUser.name = newUser.name;
        else if (!existingUser.name || existingUser.name === '...') updatedUser.name = '...';

        const hasNewProfession = newUser.profession && typeof newUser.profession === 'string';
        if (hasNewProfession) updatedUser.profession = newUser.profession;
        else if (!existingUser.profession) updatedUser.profession = '';

        const hasNewFightPoint = newUser.fightPoint !== undefined && typeof newUser.fightPoint === 'number';
        if (hasNewFightPoint) updatedUser.fightPoint = newUser.fightPoint;
        else if (existingUser.fightPoint === undefined) updatedUser.fightPoint = 0;

        allUsers[userId] = updatedUser;
    }

    updateAll();
}

async function clearData() {
    try {
        const currentStatus = getServerStatus();
        showServerStatus('cleared');
        const response = await fetch(`http://${SERVER_URL}/api/clear`);
        const result = await response.json();
        if (result.code === 0) {
            allUsers = {};
            userColors = {};
            updateAll();
            showServerStatus('cleared');
            console.log('Data cleared successfully.');
        } else {
            console.error('Failed to clear data on server:', result.msg);
        }
        setTimeout(() => showServerStatus(currentStatus), 1000);
    } catch (error) {
        console.error('Error sending clear request to server:', error);
    }
}

function togglePause() {
    isPaused = !isPaused;
    pauseButton.innerHTML = isPaused
        ? '<img class="icon-button" src="/assets/caret-right.svg" />'
        : '<img class="icon-button" src="/assets/player-pause.svg" />';
    showServerStatus(isPaused ? 'paused' : 'connected');
}

function closeClient() {
    window.electronAPI.closeClient();
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

    socket.on('data', (data) => {
        processDataUpdate(data);
        lastWebSocketMessage = Date.now();
    });

    socket.on('user_deleted', (data) => {
        console.log(`User ${data.uid} was removed due to inactivity.`);
        delete allUsers[data.uid];
        updateAll();
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

function setBackgroundOpacity(value) {
    document.documentElement.style.setProperty('--main-bg-opacity', value);
}

function setSelectValues(select, values) {
    if (!Array.isArray(values)) values = [values];
    if (!select.multiple && values.length > 1) {
        values = [values[0]];
    }
    const wanted = new Set(values.map(String));
    for (const opt of select.options) {
        const shouldSelect = select.multiple ? wanted.has(opt.value) : opt.value === values[0];
        if (opt.selected !== shouldSelect) {
            opt.selected = shouldSelect;
        }
    }
    select.dispatchEvent(new Event('change', { bubbles: true }));
}

document.addEventListener('DOMContentLoaded', () => {
    initialize();
    setBackgroundOpacity(opacitySlider.value);

    opacitySlider.addEventListener('input', (event) => {
        setBackgroundOpacity(event.target.value);
    });

    if (sortSelect) {
        sortSelect.addEventListener('change', (e) => {
            currentMode = e.target.value;
            updateAll();
        });
        setSelectValues(sortSelect, currentMode);
    }

    if (filterSelect) {
        filterSelect.addEventListener('change', (e) => {
            const values = Array.from(e.target.selectedOptions).map((opt) => opt.value);
            selectedClasses = new Set(values);
            updateAll();
        });
        setSelectValues(filterSelect, Array.from(selectedClasses));
    }

    // if (HkclearData) {
    //     HkclearData.addEventListener('change', (e) => {
    //         const values = Array.from(e.target.selectedOptions).map((opt) => opt.value);
    //     });
    // }

    window.electronAPI?.onTogglePassthrough((isIgnoring) => {
        if (isIgnoring) {
            controlTool.classList.add('hidden');
            controlPassthrough.classList.remove('hidden');
        } else {
            controlPassthrough.classList.add('hidden');
            controlTool.classList.remove('hidden');
        }
    });

    window.electronAPI?.onClearData(() => {
        clearData();
    });
});

window.clearData = clearData;
window.togglePause = togglePause;
window.closeClient = closeClient;
