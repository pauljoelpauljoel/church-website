const fs = require('fs');
const path = require('path');
const axios = require('axios');
require('dotenv').config();

const localFilePath = path.join(__dirname, '../data/prayers.json');
const JSONBIN_API_URL = 'https://api.jsonbin.io/v3/b';

// Helper to fetch from Bin or Local
async function fetchDataFromBin(binId, key, defaultVal) {
    // 1. Try Local First (sychronous read is fast)
    let localData = defaultVal;
    try {
        const localPath = path.join(__dirname, `../data/${key || 'data'}.json`);
        if (fs.existsSync(localPath)) {
            localData = JSON.parse(fs.readFileSync(localPath));
        }
    } catch (e) {
        // ignore local read error
    }

    // 2. Try JSONBin
    if (binId && process.env.JSONBIN_SECRET) {
        try {
            const response = await axios.get(`${JSONBIN_API_URL}/${binId}/latest`, {
                headers: { 'X-Master-Key': process.env.JSONBIN_SECRET }
            });
            // If the bin returns an object wrapper { prayers: [...] }
            if (key && response.data.record && response.data.record[key]) {
                // Background update local cache
                writeLocal(response.data.record[key], `${key}.json`);
                return response.data.record[key];
            } else if (response.data.record) {
                // Legacy or direct array or when key is not matching
                // But if we asked for a specific key and didn't find it, we should maybe return default
                if (key && !response.data.record[key]) {
                    // Check if it's the old format where root is the array
                    if (key === 'prayers' && Array.isArray(response.data.record)) return response.data.record;
                    return localData;
                }
                return response.data.record;
            }
        } catch (error) {
            console.error(`JSONBin fetch error for ${key}:`, error.message);
        }
    }
    return localData;
}

function writeLocal(data, filename = 'prayers.json') {
    try {
        const filePath = path.join(__dirname, `../data/${filename}`);
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    } catch (e) {
        console.error('Error writing local file:', e.message);
    }
}

async function getPrayers() {
    return await fetchDataFromBin(process.env.JSONBIN_BIN_ID, 'prayers', []);
}

async function savePrayers(prayers) {
    const BIN_ID = process.env.JSONBIN_BIN_ID;
    const MASTER_KEY = process.env.JSONBIN_SECRET;

    // Always save locally first as a backup/cache
    writeLocal(prayers, 'prayers.json');

    // If credentials exists, save to cloud
    if (BIN_ID && MASTER_KEY) {
        try {
            const payload = { prayers: prayers };
            await axios.put(`${JSONBIN_API_URL}/${BIN_ID}`, payload, {
                headers: {
                    'Content-Type': 'application/json',
                    'X-Master-Key': MASTER_KEY
                }
            });
        } catch (error) {
            console.error('Error saving to JSONBin:', error.message);
        }
    }
}

// --- CATEGORIES STORAGE ---
async function getCategories() {
    return await fetchDataFromBin(process.env.JSONBIN_BIN_ID, 'categories', [
        { id: 1, name: "General" },
        { id: 2, name: "Children Ministry" },
        { id: 3, name: "Youths Ministry" }
    ]);
}

async function saveCategories(categories) {
    const BIN_ID = process.env.JSONBIN_BIN_ID;
    const MASTER_KEY = process.env.JSONBIN_SECRET;

    // Save locally
    writeLocal(categories, 'categories.json');

    // Save to cloud
    if (BIN_ID && MASTER_KEY) {
        try {
            // We need to be careful not to overwrite prayers if they share the same bin.
            // But currently they share JSONBIN_BIN_ID.
            // If we use PUT, we overwrite the whole bin.
            // Ideally we need to fetch, merge, and save.
            // OR use a separate bin for categories?
            // User didn't ask for separate bin.
            // Let's Fetch existing data first (prayers) then merge categories.

            const existingPrayers = await getPrayers();
            const payload = {
                prayers: existingPrayers,
                categories: categories
            };

            await axios.put(`${JSONBIN_API_URL}/${BIN_ID}`, payload, {
                headers: { 'Content-Type': 'application/json', 'X-Master-Key': MASTER_KEY }
            });
        } catch (error) {
            console.error('Error saving categories to JSONBin:', error.message);
        }
    }
}

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
            console.error('Error fetching admin settings:', error.message);
            return { username: 'admin', password: 'church123' };
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

module.exports = {
    getPrayers,
    savePrayers,
    getAdminSettings,
    saveAdminSettings,
    getCategories,
    saveCategories
};
