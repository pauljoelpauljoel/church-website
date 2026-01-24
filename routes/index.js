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
    const aboutData = readData('about.json', req);
    const teamData = readData('team.json', req);
    res.render('about', { title: 'About Us', about: aboutData, team: teamData });
});

// Services Page
router.get('/services', (req, res) => {
    const services = readData('services.json', req);
    res.render('services', { title: 'Service Schedule', services });
});

// Events Page
router.get('/events', (req, res) => {
    const events = readData('events.json', req);
    res.render('events', { title: 'Upcoming Events', events });
});

// Sermons Page
router.get('/sermons', (req, res) => {
    const sermons = readData('sermons.json', req);
    res.render('sermons', { title: 'Sermons & Messages', sermons });
});

// Gallery Page
router.get('/gallery', (req, res) => {
    const gallery = readData('gallery.json', req);
    res.render('gallery', { title: 'Photo Gallery', gallery });
});

// Contact Page
router.get('/contact', (req, res) => {
    res.render('contact', { title: 'Contact Us' });
});

// Donate Page
router.get('/donate', (req, res) => {
    res.render('donate', { title: 'Donate' });
});

// Prayer Request (POST)
router.post('/prayer', (req, res) => {
    const { name, message, confidential } = req.body;
    const prayers = readData('prayers.json', req);

    // Simple ID generation
    const newPrayer = {
        id: prayers.length + 1,
        name,
        message,
        confidential: confidential === 'on',
        date: new Date().toISOString()
    };

    prayers.push(newPrayer);

    fs.writeFileSync(path.join(__dirname, '../data', 'prayers.json'), JSON.stringify(prayers, null, 2));

    // Redirect back or to a thank you page
    // For now, redirect to home with success (in query for simplicity or just redirect)
    res.redirect('/?prayer=success');
});

module.exports = router;
