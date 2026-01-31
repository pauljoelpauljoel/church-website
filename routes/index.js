const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { getData, getAdminSettings, getCategories, getPrayers, savePrayers } = require('../utils/storage');

// Helper to resolve key based on language
const getKey = (baseKey, req) => {
    const lang = req && req.session ? req.session.lang : 'en';
    if (lang === 'ta') {
        return `${baseKey}_ta`;
    }
    return baseKey;
};

// Home Page
router.get('/', async (req, res) => {
    const settings = await getAdminSettings();
    const headersKey = getKey('home', req);
    const home = await getData(headersKey, {});

    const key = getKey('events', req);
    const eventsAll = await getData(key, []);
    const events = eventsAll.slice(0, 3); // Show top 3 events

    res.render('home', { title: 'Home', events, settings, home });
});

// About Page
router.get('/about', async (req, res) => {
    const aboutKey = getKey('about', req);
    const teamKey = getKey('team', req);

    const about = await getData(aboutKey, {});
    const team = await getData(teamKey, []);

    const title = req.session.lang === 'ta' ? 'எங்களைப் பற்றி' : 'About Us';
    res.render('about', { title, about, team });
});

// Services Page
router.get('/services', async (req, res) => {
    const key = getKey('services', req);
    const services = await getData(key, []);
    const title = req.session.lang === 'ta' ? 'ஆராதனை நேரங்கள்' : 'Service Times';
    res.render('services', { title, services });
});

// Events Page
router.get('/events', async (req, res) => {
    const key = getKey('events', req);
    const events = await getData(key, []);
    const title = req.session.lang === 'ta' ? 'நிகழ்வுகள்' : 'Events';
    res.render('events', { title, events });
});

// Sermons Page
router.get('/sermons', async (req, res) => {
    // Sermons might not have translations or might use same file? 
    // Original code used readData('sermons.json', req) which supported _ta.
    const key = getKey('sermons', req);
    const sermons = await getData(key, []);
    const title = req.session.lang === 'ta' ? 'திருச்சபை பிரசங்கங்கள்' : 'Sermons';
    res.render('sermons', { title, sermons });
});

// Gallery Page
router.get('/gallery', async (req, res) => {
    const key = getKey('gallery', req);
    const gallery = await getData(key, []);
    const categories = await getCategories();
    const title = req.session.lang === 'ta' ? 'புகைப்படங்கள்' : 'Gallery';
    res.render('gallery', { title, gallery, categories });
});

// Contact Page
router.get('/contact', async (req, res) => {
    const key = getKey('contact', req);
    const contact = await getData(key, {});
    const title = req.session.lang === 'ta' ? 'தொடர்பு கொள்ள' : 'Contact Us';
    res.render('contact', { title, contact });
});

// Donate Page
router.get('/donate', async (req, res) => {
    const key = getKey('donate', req);
    const donate = await getData(key, {});
    const title = req.session.lang === 'ta' ? 'நன்கொடை' : 'Donate';
    res.render('donate', { title, donate });
});

// Prayers Page (Public Prayer Wall)
router.get('/prayers', async (req, res) => {
    try {
        const allPrayers = await getPrayers();

        const prayers = allPrayers.filter(p => !p.confidential);
        // Sort by newest first
        prayers.sort((a, b) => new Date(b.date) - new Date(a.date));

        const title = req.session.lang === 'ta' ? 'ஜெப விண்ணப்பங்கள்' : 'Prayer Requests';
        res.render('prayers', { title, prayers });
    } catch (e) {
        console.error("Error in /prayers:", e);
        res.status(500).send("Error: " + e.message);
    }
});

// Prayer Request (POST)
router.post('/prayer', async (req, res) => {
    try {
        const { name, message, confidential } = req.body;
        const prayers = await getPrayers();

        // Simple ID generation
        const newPrayer = {
            id: Date.now(), // Use timestamp for unique ID
            name,
            message,
            confidential: confidential === 'on',
            date: new Date().toISOString(),
            prayedCount: 0 // Initialize count
        };

        prayers.push(newPrayer);
        await savePrayers(prayers);

        // Redirect back to the prayers page with status
        const status = confidential === 'on' ? 'confidential' : 'public';
        res.redirect(`/prayers?status=${status}`);
    } catch (e) {
        console.error("Error creating prayer:", e);
        res.redirect('/prayers?status=error');
    }
});

// API endpoint to increment/decrement prayer count
router.post('/api/pray/:id', async (req, res) => {
    try {
        const prayers = await getPrayers();
        const id = parseInt(req.params.id);
        const prayerIndex = prayers.findIndex(p => p.id === id);
        const action = req.query.action;

        if (prayerIndex !== -1) {
            if (!prayers[prayerIndex].prayedCount) {
                prayers[prayerIndex].prayedCount = 0;
            }

            if (action === 'undo') {
                if (prayers[prayerIndex].prayedCount > 0) {
                    prayers[prayerIndex].prayedCount -= 1;
                }
            } else {
                prayers[prayerIndex].prayedCount += 1;
            }

            await savePrayers(prayers);
            return res.json({ success: true, newCount: prayers[prayerIndex].prayedCount });
        }

        return res.status(404).json({ success: false, message: 'Prayer not found' });
    } catch (e) {
        console.error("Error updating prayer count:", e);
        return res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
});

module.exports = router;
