const fs = require('fs');
const path = require('path');
const axios = require('axios');
require('dotenv').config();

const localFilePath = path.join(__dirname, '../data/prayers.json');



const JSONBIN_API_URL = 'https://api.jsonbin.io/v3/b';

async function getPrayers() {
    const BIN_ID = process.env.JSONBIN_BIN_ID;
    const MASTER_KEY = process.env.JSONBIN_SECRET;

    // If credentials are provided, try fetching from cloud
    if (BIN_ID && MASTER_KEY) {
        try {
            const response = await axios.get(`${JSONBIN_API_URL}/${BIN_ID}/latest`, {
                headers: {
                    'X-Master-Key': MASTER_KEY
                }
            });
            // JSONBin v3 returns the actual data inside 'record' (or root if we sent array)
            // When we created with { prayers: [] }, it wraps it. 
            // When we save array direct, it might be root.
            // Let's handle both.
            let data = response.data.record;
            if (data.prayers && Array.isArray(data.prayers)) {
                return data.prayers;
            }
            if (Array.isArray(data)) {
                return data;
            }
            return [];
        } catch (error) {
            console.error('Error fetching from JSONBin:', error.message);
            // On error, fall back to local file so the site doesn't break
            return readLocal();
        }
    } else {
        // No credentials, use local file
        return readLocal();
    }
}

async function savePrayers(prayers) {
    const BIN_ID = process.env.JSONBIN_BIN_ID;
    const MASTER_KEY = process.env.JSONBIN_SECRET;

    // Always save locally first as a backup/cache
    writeLocal(prayers);

    // If credentials exists, save to cloud
    if (BIN_ID && MASTER_KEY) {
        try {
            await axios.put(`${JSONBIN_API_URL}/${BIN_ID}`, prayers, {
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

function readLocal() {
    if (!fs.existsSync(localFilePath)) return [];
    try {
        const data = fs.readFileSync(localFilePath, 'utf8');
        return JSON.parse(data);
    } catch (e) {
        return [];
    }
}

function writeLocal(data) {
    try {
        fs.writeFileSync(localFilePath, JSON.stringify(data, null, 2));
    } catch (e) {
        console.error('Error writing local file:', e.message);
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
    // Fallback default
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

module.exports = { getPrayers, savePrayers, getAdminSettings, saveAdminSettings };
