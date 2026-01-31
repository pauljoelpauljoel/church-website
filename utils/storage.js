const fs = require('fs');
const path = require('path');
const axios = require('axios');
require('dotenv').config();

const JSONBIN_API_URL = 'https://api.jsonbin.io/v3/b';
// Cache structure to minimize API calls
let memCache = {};
let lastFetchTime = 0;
const CACHE_TTL = 30 * 1000; // 30 seconds cache

// Helper to fetch entire bin
async function fetchBin() {
    const BIN_ID = process.env.JSONBIN_BIN_ID;
    const MASTER_KEY = process.env.JSONBIN_SECRET;

    if (!BIN_ID || !MASTER_KEY) return null;

    // Return cached if fresh
    if (Date.now() - lastFetchTime < CACHE_TTL && Object.keys(memCache).length > 0) {
        return memCache;
    }

    try {
        const response = await axios.get(`${JSONBIN_API_URL}/${BIN_ID}/latest`, {
            headers: { 'X-Master-Key': MASTER_KEY }
        });

        // Update cache
        if (response.data.record) {
            memCache = response.data.record;
            lastFetchTime = Date.now();
            return memCache;
        }
    } catch (error) {
        console.error('JSONBin fetch error:', error.message);
    }
    return null;
}

// Generic Get Data
async function getData(key, defaultVal = []) {
    // 1. Try to fetch from cloud
    const cloudData = await fetchBin();

    if (cloudData && cloudData[key]) {
        return cloudData[key];
    }

    // 2. If cloud fails or key missing, check local cache/file as fallback
    // This is useful for initial bootstrap or offline dev
    try {
        const localPath = path.join(__dirname, `../data/${key}.json`);
        if (fs.existsSync(localPath)) {
            const localContent = JSON.parse(fs.readFileSync(localPath, 'utf8'));
            return localContent;
        }
    } catch (e) {
        // ignore
    }

    return defaultVal;
}

// Generic Save Data
async function saveData(key, data) {
    const BIN_ID = process.env.JSONBIN_BIN_ID;
    const MASTER_KEY = process.env.JSONBIN_SECRET;

    // 1. Update Local File (Backup/Dev)
    try {
        const dir = path.join(__dirname, '../data');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

        const filePath = path.join(dir, `${key}.json`);
        // Handle array vs object differentiation if needed, but standardizing as JSON is fine
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    } catch (e) {
        console.error(`Error writing local file for ${key}:`, e.message);
    }

    // 2. Update Cloud
    if (BIN_ID && MASTER_KEY) {
        try {
            // We must fetch latest first to not overwrite other keys
            let currentRecord = await fetchBin() || {};

            // Update specific key
            currentRecord[key] = data;

            await axios.put(`${JSONBIN_API_URL}/${BIN_ID}`, currentRecord, {
                headers: {
                    'Content-Type': 'application/json',
                    'X-Master-Key': MASTER_KEY
                }
            });

            // Update memory cache immediately
            memCache = currentRecord;
            lastFetchTime = Date.now();

            return true;
        } catch (error) {
            console.error(`Error saving ${key} to JSONBin:`, error.message);
            return false;
        }
    }
    return true; // Return true if local save worked and no cloud creds (dev mode)
}

// Admin Settings Specific Functions (Separate Bin)
async function getAdminSettings() {
    const BIN_ID = process.env.JSONBIN_ADMIN_ID;
    const MASTER_KEY = process.env.JSONBIN_SECRET;

    if (BIN_ID && MASTER_KEY) {
        try {
            const response = await axios.get(`${JSONBIN_API_URL}/${BIN_ID}/latest`, {
                headers: { 'X-Master-Key': MASTER_KEY }
            });
            return response.data.record || { username: 'admin', password: 'church123' };
        } catch (error) {
            // console.error('Error fetching admin settings:', error.message);
        }
    }
    return { username: 'admin', password: 'church123' };
}

async function saveAdminSettings(settings) {
    const BIN_ID = process.env.JSONBIN_ADMIN_ID;
    const MASTER_KEY = process.env.JSONBIN_SECRET;

    if (BIN_ID && MASTER_KEY) {
        try {
            await axios.put(`${JSONBIN_API_URL}/${BIN_ID}`, settings, {
                headers: {
                    'Content-Type': 'application/json',
                    'X-Master-Key': MASTER_KEY
                }
            });
            return true;
        } catch (error) {
            console.error('Error saving admin settings:', error.message);
            return false;
        }
    }
    return false;
}

// Deprecated/Alias wrappers for backward compatibility if needed, 
// but best to use generic ones in new code.
async function getPrayers() { return await getData('prayers', []); }
async function savePrayers(data) { return await saveData('prayers', data); }
async function getCategories() { return await getData('categories', []); }
async function saveCategories(data) { return await saveData('categories', data); }

module.exports = {
    getData,
    saveData,
    getAdminSettings,
    saveAdminSettings,
    getPrayers,
    savePrayers,
    getCategories,
    saveCategories
};
