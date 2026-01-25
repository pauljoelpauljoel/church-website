const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

// Helper to read data
const readData = (filename, req) => {
    // Check for localized file if lang is ta
    const lang = req && req.session ? req.session.lang : 'en';
    let targetFile = filename;

    if (lang === 'ta') {
        const namePart = filename.split('.')[0];
        const extPart = filename.split('.')[1];
        const localizedName = `${namePart}_ta.${extPart}`;

        if (fs.existsSync(path.join(__dirname, '../data', localizedName))) {
            targetFile = localizedName;
        }
    }

    const filePath = path.join(__dirname, '../data', targetFile);
    // Fallback to default if localized file missing (redundant check but safe)
    if (!fs.existsSync(filePath)) {
        return JSON.parse(fs.readFileSync(path.join(__dirname, '../data', filename)));
    }

    const rawData = fs.readFileSync(filePath);
    return JSON.parse(rawData);
};

// Home Page
router.get('/', (req, res) => {
    const events = readData('events.json', req).slice(0, 3); // Show top 3 events
    res.render('home', { title: 'Home', events });
});

// About Page
router.get('/about', (req, res) => {
    const about = readData('about.json', req);
    const team = readData('team.json', req);
    const title = req.session.lang === 'ta' ? 'எங்களைப் பற்றி' : 'About Us';
    res.render('about', { title, about, team });
});

// Services Page
router.get('/services', (req, res) => {
    const services = readData('services.json', req);
    const title = req.session.lang === 'ta' ? 'ஆராதனை நேரங்கள்' : 'Service Times';
    res.render('services', { title, services });
});

// Events Page
router.get('/events', (req, res) => {
    const events = readData('events.json', req);
    const title = req.session.lang === 'ta' ? 'நிகழ்வுகள்' : 'Events';
    res.render('events', { title, events });
});

// Sermons Page
router.get('/sermons', (req, res) => {
    const sermons = readData('sermons.json', req);
    const title = req.session.lang === 'ta' ? 'திருச்சபை பிரசங்கங்கள்' : 'Sermons';
    res.render('sermons', { title, sermons });
});

// Gallery Page
router.get('/gallery', (req, res) => {
    const gallery = readData('gallery.json', req);
    const title = req.session.lang === 'ta' ? 'புகைப்படங்கள்' : 'Gallery';
    res.render('gallery', { title, gallery });
});

// Contact Page
router.get('/contact', (req, res) => {
    const contact = readData('contact.json', req);
    const title = req.session.lang === 'ta' ? 'தொடர்பு கொள்ள' : 'Contact Us';
    res.render('contact', { title, contact });
});

// Donate Page
router.get('/donate', (req, res) => {
    const donate = readData('donate.json', req);
    const title = req.session.lang === 'ta' ? 'நன்கொடை' : 'Donate';
    res.render('donate', { title, donate });
});

// Prayer Request (POST)
// Prayers Page (Public Prayer Wall)
router.get('/prayers', (req, res) => {
    try {
        const prayers = readData('prayers.json', req).filter(p => !p.confidential);
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
router.post('/prayer', (req, res) => {
    const { name, message, confidential } = req.body;
    const prayers = readData('prayers.json', req);

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

    fs.writeFileSync(path.join(__dirname, '../data', 'prayers.json'), JSON.stringify(prayers, null, 2));

    // Redirect back to the prayers page
    res.redirect('/prayers');
});

// API endpoint to increment/decrement prayer count
router.post('/api/pray/:id', (req, res) => {
    const prayers = readData('prayers.json', req);
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

        fs.writeFileSync(path.join(__dirname, '../data', 'prayers.json'), JSON.stringify(prayers, null, 2));
        return res.json({ success: true, newCount: prayers[prayerIndex].prayedCount });
    }

    return res.status(404).json({ success: false, message: 'Prayer not found' });
});

module.exports = router;
