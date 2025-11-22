import express from 'express';
import path from 'path';
import logger from '../services/Logger.js';
import { promises as fsPromises } from 'fs';
import userDataManager from '../services/UserDataManager.js';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Creates and returns an Express Router instance configured with all API endpoints.
 * @param {object} userDataManager The data manager instance for user data.
 * @param {object} logger The Winston logger instance.
 * @param {object} pauseState The state object containing isPaused property.
 * @param {string} SETTINGS_PATH The path to the settings file.
 * @returns {express.Router} An Express Router with all routes defined.
 */
export function createApiRouter(pauseState, SETTINGS_PATH) {
    const router = express.Router();

    // Middleware to parse JSON requests
    router.use(express.json());

    // GET all user data
    router.get('/data', (req, res) => {
        const userData = userDataManager.getAllUsersData();
        const data = {
            code: 0,
            user: userData,
        };
        res.json(data);
    });

    // GET all enemy data
    router.get('/enemies', (req, res) => {
        const enemiesData = userDataManager.getAllEnemiesData();
        const data = {
            code: 0,
            enemy: enemiesData,
        };
        res.json(data);
    });

    // Clear all statistics
    router.get('/clear', (req, res) => {
        userDataManager.clearAll();
        logger.info('Statistics have been cleared!');
        res.json({
            code: 0,
            msg: 'Statistics have been cleared!',
        });
    });

    // Pause/Resume statistics
    router.post('/pause', (req, res) => {
        const { paused } = req.body;
        pauseState.isPaused = paused;
        logger.info(`Statistics ${pauseState.isPaused ? 'paused' : 'resumed'}!`);
        res.json({
            code: 0,
            msg: `Statistics ${pauseState.isPaused ? 'paused' : 'resumed'}!`,
            paused: pauseState.isPaused,
        });
    });

    // Get pause state
    router.get('/pause', (req, res) => {
        res.json({
            code: 0,
            paused: pauseState.isPaused,
        });
    });

    // Get skill data for a specific user ID
    router.get('/skill/:uid', (req, res) => {
        const uid = parseInt(req.params.uid);
        const skillData = userDataManager.getUserSkillData(uid);

        if (!skillData) {
            return res.status(404).json({
                code: 1,
                msg: 'User not found',
            });
        }

        res.json({
            code: 0,
            data: skillData,
        });
    });

    // Get history summary for a specific timestamp
    router.get('/history/:timestamp/summary', async (req, res) => {
        const { timestamp } = req.params;
        const historyFilePath = path.join('./logs', timestamp, 'summary.json');

        try {
            const data = await fsPromises.readFile(historyFilePath, 'utf8');
            const summaryData = JSON.parse(data);
            res.json({
                code: 0,
                data: summaryData,
            });
        } catch (error) {
            if (error.code === 'ENOENT') {
                logger.warn('History summary file not found:', error);
                res.status(404).json({
                    code: 1,
                    msg: 'History summary file not found',
                });
            } else {
                logger.error('Failed to read history summary file:', error);
                res.status(500).json({
                    code: 1,
                    msg: 'Failed to read history summary file',
                });
            }
        }
    });

    // Get history data for a specific timestamp
    router.get('/history/:timestamp/data', async (req, res) => {
        const { timestamp } = req.params;
        const historyFilePath = path.join('./logs', timestamp, 'allUserData.json');

        try {
            const data = await fsPromises.readFile(historyFilePath, 'utf8');
            const userData = JSON.parse(data);
            res.json({
                code: 0,
                user: userData,
            });
        } catch (error) {
            if (error.code === 'ENOENT') {
                logger.warn('History data file not found:', error);
                res.status(404).json({
                    code: 1,
                    msg: 'History data file not found',
                });
            } else {
                logger.error('Failed to read history data file:', error);
                res.status(500).json({
                    code: 1,
                    msg: 'Failed to read history data file',
                });
            }
        }
    });

    // Get history skill data for a specific timestamp and user
    router.get('/history/:timestamp/skill/:uid', async (req, res) => {
        const { timestamp, uid } = req.params;
        const historyFilePath = path.join('./logs', timestamp, 'users', `${uid}.json`);

        try {
            const data = await fsPromises.readFile(historyFilePath, 'utf8');
            const skillData = JSON.parse(data);
            res.json({
                code: 0,
                data: skillData,
            });
        } catch (error) {
            if (error.code === 'ENOENT') {
                logger.warn('History skill file not found:', error);
                res.status(404).json({
                    code: 1,
                    msg: 'History skill file not found',
                });
            } else {
                logger.error('Failed to read history skill file:', error);
                res.status(500).json({
                    code: 1,
                    msg: 'Failed to read history skill file',
                });
            }
        }
    });

    // Download historical fight log
    router.get('/history/:timestamp/download', (req, res) => {
        const { timestamp } = req.params;
        const historyFilePath = path.join('./logs', timestamp, 'fight.log');
        res.download(historyFilePath, `fight_${timestamp}.log`);
    });

    // Get a list of available history timestamps
    router.get('/history/list', async (req, res) => {
        try {
            const data = (await fsPromises.readdir('./logs', { withFileTypes: true }))
                .filter((e) => e.isDirectory() && /^\d+$/.test(e.name))
                .map((e) => e.name);
            res.json({
                code: 0,
                data: data,
            });
        } catch (error) {
            if (error.code === 'ENOENT') {
                logger.warn('History path not found:', error);
                res.status(404).json({
                    code: 1,
                    msg: 'History path not found',
                });
            } else {
                logger.error('Failed to load history path:', error);
                res.status(500).json({
                    code: 1,
                    msg: 'Failed to load history path',
                });
            }
        }
    });

    // Get current settings
    router.get('/settings', (req, res) => {
        res.json({ code: 0, data: globalSettings });
    });

    // Update settings
    router.post('/settings', async (req, res) => {
        const newSettings = req.body;
        globalSettings = { ...globalSettings, ...newSettings };
        await fsPromises.writeFile(SETTINGS_PATH, JSON.stringify(globalSettings, null, 2), 'utf8');
        res.json({ code: 0, data: globalSettings });
    });

    // Get shortcuts configuration
    router.get('/shortcuts', async (req, res) => {
        const SHORTCUTS_PATH = path.join(__dirname, '../../shortcuts.json');
        try {
            const data = await fsPromises.readFile(SHORTCUTS_PATH, 'utf8');
            const shortcuts = JSON.parse(data);
            res.json({ code: 0, data: shortcuts });
        } catch (error) {
            if (error.code === 'ENOENT') {
                // File doesn't exist, return default shortcuts
                res.json({ code: 0, data: null });
            } else {
                logger.error('Failed to load shortcuts:', error);
                res.status(500).json({
                    code: 1,
                    msg: 'Failed to load shortcuts',
                });
            }
        }
    });

    // Update shortcuts configuration
    router.post('/shortcuts', async (req, res) => {
        const SHORTCUTS_PATH = path.join(__dirname, '../../shortcuts.json');
        try {
            const newShortcuts = req.body;
            await fsPromises.writeFile(SHORTCUTS_PATH, JSON.stringify(newShortcuts, null, 2), 'utf8');
            logger.info('Shortcuts configuration updated');
            res.json({ code: 0, data: newShortcuts, msg: 'Shortcuts saved successfully' });
        } catch (error) {
            logger.error('Failed to save shortcuts:', error);
            res.status(500).json({
                code: 1,
                msg: 'Failed to save shortcuts',
            });
        }
    });

    return router;
}
