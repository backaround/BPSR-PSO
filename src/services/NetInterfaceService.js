import { exec } from 'child_process';
import { promisify } from 'util';
import cap from 'cap';

const execAsync = promisify(exec);

const VIRTUAL_KEYWORDS = ['zerotier', 'vmware', 'virtual', 'loopback', 'veth', 'docker', 'virbr', 'br-', 'vnet'];

/**
 * Checks if a network adapter is virtual based on its name.
 * @param {string} name The description or name of the network device.
 * @returns {boolean} True if the device name indicates it's a virtual adapter.
 */
function isVirtual(name) {
    const lower = name.toLowerCase();
    return VIRTUAL_KEYWORDS.some((keyword) => lower.includes(keyword));
}

/**
 * Detects TCP traffic on a network adapter for 3 seconds.
 * @param {number} deviceIndex The index of the device.
 * @param {Object} devices A map of network devices.
 * @returns {Promise<number>} A promise that resolves with the number of packets detected.
 */
export function detectTraffic(deviceIndex, devices) {
    return new Promise((resolve) => {
        const device = devices[deviceIndex];

        if (!device?.name) {
            console.error(`Invalid device index: ${deviceIndex}`);
            resolve(0);
            return;
        }

        let count = 0;
        let c;
        let timeoutId;

        const cleanup = () => {
            if (timeoutId) clearTimeout(timeoutId);
            if (c) {
                try {
                    c.close();
                } catch (e) {
                    console.error('Error closing capture device:', e);
                }
            }
        };

        try {
            c = new cap.Cap();
            const buffer = Buffer.alloc(65535);

            console.log(`Opening device: ${device.name}`);
            const openResult = c.open(device.name, 'ip and tcp', 1024 * 1024, buffer);

            if (!openResult) {
                console.warn(`Failed to open device ${device.name}`);
                cleanup();
                resolve(0);
                return;
            }

            c.on('packet', () => count++);

            timeoutId = setTimeout(() => {
                cleanup();
                resolve(count);
            }, 3000);
        } catch (e) {
            console.error(
                `Failed to open device ${device.name}:`,
                'Ensure you have CAP_NET_RAW capability or run with sudo.',
                e
            );
            cleanup();
            resolve(0);
        }
    });
}

/**
 * Gets active routes from Linux routing table.
 * @returns {Promise<Array>} Array of route objects.
 */
async function getActiveRoutes() {
    const { stdout } = await execAsync('ip route show');
    const lines = stdout.split('\n').filter((line) => line.trim());

    return lines
        .map((line) => {
            const parts = line.trim().split(/\s+/);
            const route = {};

            // Parse "default via 192.168.1.1 dev eth0" format
            if (parts[0] === 'default') {
                route.destination = '0.0.0.0';
                const viaIdx = parts.indexOf('via');
                const devIdx = parts.indexOf('dev');
                if (viaIdx !== -1) route.gateway = parts[viaIdx + 1];
                if (devIdx !== -1) route.interface = parts[devIdx + 1];
            } else {
                // Parse "192.168.1.0/24 dev eth0 proto kernel scope link src 192.168.1.100"
                const [network] = parts[0].split('/');
                route.destination = network;
                const devIdx = parts.indexOf('dev');
                if (devIdx !== -1) route.interface = parts[devIdx + 1];
            }

            return route;
        })
        .filter((route) => route.interface);
}

/**
 * Extracts the default interface name from routes.
 * @param {Array} routes Array of route objects.
 * @returns {string|null} The interface name.
 */
function getDefaultInterface(routes) {
    const defaultRoute = routes.find((r) => r.destination === '0.0.0.0');
    return defaultRoute?.interface || null;
}

/**
 * Finds any tap/tun interface in the routing table.
 * @param {Array} routes Array of route objects.
 * @returns {string|null} The tap/tun interface name, or null if none found.
 */
function getTapTunInterface(routes) {
    // Linux - find any tap/tun interface in the routing table
    const vpnRoute = routes.find(
        (r) => r.interface && (r.interface.startsWith('tap') || r.interface.startsWith('tun'))
    );
    return vpnRoute?.interface || null;
}

/**
 * Finds the default network device using the system's route table.
 * Prefers tap/tun interfaces if present (for VPN game routing).
 * @param {Object} devices A map of network devices.
 * @returns {Promise<number|undefined>} A promise that resolves with the device index or undefined.
 */
export async function findByRoute(devices) {
    try {
        const routes = await getActiveRoutes();

        // Check for tap/tun interfaces
        const vpnInterface = getTapTunInterface(routes);
        if (vpnInterface) {
            const vpnDevice = Object.keys(devices).find((key) => devices[key].name === vpnInterface);
            if (vpnDevice) {
                return parseInt(vpnDevice, 10);
            }
        }

        // Fall back to default route
        const defaultInterface = getDefaultInterface(routes);
        if (!defaultInterface) return undefined;

        const targetInterface = Object.keys(devices).find((key) => devices[key].name === defaultInterface);

        return targetInterface ? parseInt(targetInterface, 10) : undefined;
    } catch (error) {
        console.error('Failed to find device by route:', error);
        return undefined;
    }
}

/**
 * Finds the most suitable default network device by using the system's route table.
 * @param {Object} devices A map of network devices.
 * @returns {Promise<number|undefined>} The index of the default network device.
 */
export async function findDefaultNetworkDevice(devices) {
    try {
        return await findByRoute(devices);
    } catch (error) {
        console.error('Error during device lookup:', error);
        return undefined;
    }
}
