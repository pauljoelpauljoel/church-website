const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const multer = require('multer');

// Configure Multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, '../public/uploads/gallery');
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        // Unique filename: timestamp + original extension
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

const uploadTeam = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => {
            const dir = path.join(__dirname, '../public/uploads/team');
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            cb(null, dir);
        },
        filename: (req, file, cb) => {
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
            cb(null, uniqueSuffix + path.extname(file.originalname));
        }
    })
});

// Redirect /admin to /admin/dashboard
router.get('/', (req, res) => {
    res.redirect('/admin/dashboard');
});

// Basic Authentication Middleware
const requireLogin = (req, res, next) => {
    if (req.session.user_id) {
        return next();
    }
    res.redirect('/admin/login');
};

// Helper helper
// Helper helper
const readData = (filename) => {
    const filePath = path.join(__dirname, '../data', filename);
    if (!fs.existsSync(filePath)) return [];
    return JSON.parse(fs.readFileSync(filePath));
};

// --- TEAM MANAGEMENT ---

// List Team Members
router.get('/team', requireLogin, (req, res) => {
    const team = readData('team.json');
    res.render('admin/team/index', { title: 'Manage Team', team });
});

// New Team Member Form
router.get('/team/new', requireLogin, (req, res) => {
    res.render('admin/team/new', { title: 'Add Team Member' });
});

// Create Team Member
router.post('/team', requireLogin, uploadTeam.single('image'), (req, res) => {
    const team = readData('team.json');
    let imageUrl = '';
    if (req.file) {
        imageUrl = '/uploads/team/' + req.file.filename;
    } else {
        // Default image logic or require image can be handled here
        imageUrl = 'https://via.placeholder.com/150';
    }

    const newMember = {
        id: Date.now(),
        name: req.body.name,
        role: req.body.role,
        image: imageUrl,
        quote: req.body.quote
    };
    team.push(newMember);
    writeData('team.json', team);
    res.redirect('/admin/team');
});

// Edit Team Member Form
router.get('/team/:id/edit', requireLogin, (req, res) => {
    const team = readData('team.json');
    const member = team.find(m => m.id == req.params.id);
    if (!member) return res.redirect('/admin/team');
    res.render('admin/team/edit', { title: 'Edit Team Member', member });
});

// Update Team Member
router.post('/team/:id', requireLogin, uploadTeam.single('image'), (req, res) => {
    let team = readData('team.json');
    const index = team.findIndex(m => m.id == req.params.id);

    if (index !== -1) {
        let imageUrl = team[index].image;
        if (req.file) {
            imageUrl = '/uploads/team/' + req.file.filename;
        }

        team[index] = {
            ...team[index],
            name: req.body.name,
            role: req.body.role,
            quote: req.body.quote,
            image: imageUrl
        };
        writeData('team.json', team);
    }
    res.redirect('/admin/team');
});

// Delete Team Member
router.delete('/team/:id', requireLogin, (req, res) => {
    let team = readData('team.json');
    team = team.filter(m => m.id != req.params.id);
    writeData('team.json', team);
    res.redirect('/admin/team');
});

const writeData = (filename, data) => {
    const filePath = path.join(__dirname, '../data', filename);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
};

// Login Page
router.get('/login', (req, res) => {
    res.render('admin/login', { title: 'Admin Login', error: null });
});

// Login Logic
router.post('/login', async (req, res) => {
    const { username, password } = req.body;

    // Fetch dynamic credentials
    const { getAdminSettings } = require('../utils/storage');
    const settings = await getAdminSettings();

    if (username === settings.username && password === settings.password) {
        req.session.user_id = 'admin';
        res.redirect('/admin/dashboard');
    } else {
        res.render('admin/login', { title: 'Admin Login', error: 'Invalid Credentials' });
    }
});

// Settings Page
router.get('/settings', requireLogin, (req, res) => {
    res.render('admin/settings', { title: 'Admin Settings', error: null, success: null });
});

// Update Settings
router.post('/settings', requireLogin, async (req, res) => {
    const { currentUsername, currentPassword, newUsername, newPassword } = req.body;
    const { getAdminSettings, saveAdminSettings } = require('../utils/storage');

    // Verify current credentials first
    const settings = await getAdminSettings();

    if (currentUsername !== settings.username || currentPassword !== settings.password) {
        return res.render('admin/settings', {
            title: 'Admin Settings',
            error: 'Current credentials incorrect',
            success: null
        });
    }

    // Save new credentials
    const newSettings = {
        username: newUsername,
        password: newPassword
    };

    const success = await saveAdminSettings(newSettings);

    if (success) {
        res.render('admin/settings', {
            title: 'Admin Settings',
            error: null,
            success: 'Credentials updated successfully. Please login with new details next time.'
        });
    } else {
        res.render('admin/settings', {
            title: 'Admin Settings',
            error: 'Failed to save settings. Please try again.',
            success: null
        });
    }
});

// Logout
router.get('/logout', (req, res) => {
    req.session.user_id = null;
    res.redirect('/admin/login');
});

// Dashboard
router.get('/dashboard', requireLogin, async (req, res) => {
    const { getPrayers } = require('../utils/storage');
    const prayers = await getPrayers();
    const prayerCount = prayers.length;

    // For other counts, we can still use sync readData as they are local files
    // But we need to make sure readData is accessible here. 
    // It is defined in line 55 of admin.js
    const eventCount = readData('events.json').length;
    const sermonCount = readData('sermons.json').length;
    res.render('admin/dashboard', { title: 'Admin Dashboard', prayerCount, eventCount, sermonCount });
});

// View Prayer Requests
router.get('/prayers', requireLogin, async (req, res) => {
    const { getPrayers } = require('../utils/storage');
    const prayers = await getPrayers();
    res.render('admin/prayers', { title: 'Prayer Requests', prayers });
});

// Edit Prayer Form
router.get('/prayers/:id/edit', requireLogin, async (req, res) => {
    const { getPrayers } = require('../utils/storage');
    const prayers = await getPrayers();
    const prayer = prayers.find(p => p.id == req.params.id);
    if (!prayer) return res.redirect('/admin/prayers');
    res.render('admin/prayers_edit', { title: 'Edit Prayer Request', prayer });
});

// Update Prayer
router.put('/prayers/:id', requireLogin, async (req, res) => {
    const { getPrayers, savePrayers } = require('../utils/storage');
    let prayers = await getPrayers();
    const index = prayers.findIndex(p => p.id == req.params.id);

    if (index !== -1) {
        prayers[index] = {
            ...prayers[index],
            name: req.body.name,
            message: req.body.message,
            confidential: req.body.confidential === 'on',
            // Preserve date and prayedCount
        };
        await savePrayers(prayers);
    }
    res.redirect('/admin/prayers');
});

// Delete Prayer
router.delete('/prayers/:id', requireLogin, async (req, res) => {
    const { getPrayers, savePrayers } = require('../utils/storage');
    let prayers = await getPrayers();
    prayers = prayers.filter(p => p.id != req.params.id);
    await savePrayers(prayers);
    res.redirect('/admin/prayers');
});

const uploadQr = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => {
            const dir = path.join(__dirname, '../public/uploads/qr');
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            cb(null, dir);
        },
        filename: (req, file, cb) => {
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
            cb(null, uniqueSuffix + path.extname(file.originalname));
        }
    })
});

// --- DONATE MANAGEMENT ---

// Edit Donate Info
router.get('/donate', requireLogin, (req, res) => {
    const donate = readData('donate.json');
    res.render('admin/donate/edit', { title: 'Edit Donation Info', donate });
});

// Update Donate Info
router.post('/donate', requireLogin, uploadQr.single('qrImage'), (req, res) => {
    let donate = readData('donate.json');

    let qrUrl = donate.upiQr;
    if (req.file) {
        qrUrl = '/uploads/qr/' + req.file.filename;
    } else if (req.body.upiQr) {
        qrUrl = req.body.upiQr;
    }

    const updatedDonate = {
        bankName: req.body.bankName,
        accNo: req.body.accNo,
        ifsc: req.body.ifsc,
        branch: req.body.branch,
        upiId: req.body.upiId,
        upiQr: qrUrl
    };
    writeData('donate.json', updatedDonate);
    res.redirect('/donate');
});

// --- CONTACT MANAGEMENT ---

// Edit Contact Info
router.get('/contact', requireLogin, (req, res) => {
    const contact = readData('contact.json');
    res.render('admin/contact/edit', { title: 'Edit Contact Info', contact });
});


const uploadEvents = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => {
            const dir = path.join(__dirname, '../public/uploads/events');
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            cb(null, dir);
        },
        filename: (req, file, cb) => {
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
            cb(null, uniqueSuffix + path.extname(file.originalname));
        }
    })
});

// ... (keep existing codes)

// Update Contact Info
router.post('/contact', requireLogin, (req, res) => {
    let mapUrl = req.body.mapUrl;

    // Smart Parsing for Map URL (Embed)
    // If user pastes full iframe code <iframe src="...">
    const iframeMatch = mapUrl.match(/src="([^"]+)"/);
    if (iframeMatch && iframeMatch[1]) {
        mapUrl = iframeMatch[1];
    }

    // Optional: If user pastes "Share Link" into mapLink, we keep it as is.
    // The user wants "Share Link" to populate "Both".
    // If mapUrl LOOKS like a share link (maps.app.goo.gl), we can't easily turn it into embed without API.
    // So we just handle the iframe paste case which is the most common user error.

    // Auto-fix WhatsApp number (default to India +91 if only 10 digits provided)
    let whatsappPhone = req.body.whatsappPhone.trim();
    if (/^\d{10}$/.test(whatsappPhone)) {
        whatsappPhone = '91' + whatsappPhone;
    }

    // Auto-fix General Phone number (default to India +91)
    let phone = req.body.phone.trim();
    if (/^\d{10}$/.test(phone)) {
        phone = '+91 ' + phone;
    }

    const updatedContact = {
        address: req.body.address,
        phone: phone,
        email: req.body.email,
        officeHours: req.body.officeHours,
        whatsappPhone: whatsappPhone,
        mapUrl: mapUrl,
        mapLink: req.body.mapLink
    };
    writeData('contact.json', updatedContact);
    res.redirect('/contact');
});

// ... (Services...)

// --- EVENTS MANAGEMENT ---

// List Events
router.get('/events', requireLogin, (req, res) => {
    const events = readData('events.json');
    res.render('admin/events/index', { title: 'Manage Events', events });
});

// New Event Form
router.get('/events/new', requireLogin, (req, res) => {
    res.render('admin/events/new', { title: 'Add New Event' });
});

// Create Event
router.post('/events', requireLogin, uploadEvents.single('image'), (req, res) => {
    const events = readData('events.json');

    let imageUrl = '';
    if (req.file) {
        imageUrl = '/uploads/events/' + req.file.filename;
    } else {
        imageUrl = 'https://source.unsplash.com/800x600/?church,event';
    }

    const newEvent = {
        id: Date.now(), // Simple unique ID
        title: req.body.title,
        date: req.body.date,
        description: req.body.description,
        image: imageUrl
    };
    events.push(newEvent);
    writeData('events.json', events);
    res.redirect('/admin/events');
});

// Edit Event Form
router.get('/events/:id/edit', requireLogin, (req, res) => {
    const events = readData('events.json');
    const event = events.find(e => e.id == req.params.id);
    if (!event) return res.redirect('/admin/events');
    res.render('admin/events/edit', { title: 'Edit Event', event });
});

// Update Event
router.put('/events/:id', requireLogin, uploadEvents.single('image'), (req, res) => {
    let events = readData('events.json');
    const index = events.findIndex(e => e.id == req.params.id);
    if (index !== -1) {
        let imageUrl = events[index].image;
        if (req.file) {
            imageUrl = '/uploads/events/' + req.file.filename;
        }

        events[index] = {
            ...events[index],
            title: req.body.title,
            date: req.body.date,
            description: req.body.description,
            image: imageUrl
        };
        writeData('events.json', events);
    }
    res.redirect('/admin/events');
});

// Delete Event
router.delete('/events/:id', requireLogin, (req, res) => {
    let events = readData('events.json');
    events = events.filter(e => e.id != req.params.id);
    writeData('events.json', events);
    res.redirect('/admin/events');
});


// --- SERMONS MANAGEMENT ---

// List Sermons
router.get('/sermons', requireLogin, (req, res) => {
    const sermons = readData('sermons.json');
    res.render('admin/sermons/index', { title: 'Manage Sermons', sermons });
});

// New Sermon Form
router.get('/sermons/new', requireLogin, (req, res) => {
    res.render('admin/sermons/new', { title: 'Add New Sermon' });
});

// Create Sermon
router.post('/sermons', requireLogin, (req, res) => {
    const sermons = readData('sermons.json');
    const newSermon = {
        id: Date.now(),
        title: req.body.title,
        preacher: req.body.preacher,
        date: req.body.date,
        videoUrl: req.body.videoUrl,
        audioUrl: req.body.audioUrl,
        description: req.body.description
    };
    sermons.push(newSermon);
    writeData('sermons.json', sermons);
    res.redirect('/admin/sermons');
});

// Edit Sermon Form
router.get('/sermons/:id/edit', requireLogin, (req, res) => {
    const sermons = readData('sermons.json');
    const sermon = sermons.find(s => s.id == req.params.id);
    if (!sermon) return res.redirect('/admin/sermons');
    res.render('admin/sermons/edit', { title: 'Edit Sermon', sermon });
});

// Update Sermon
router.put('/sermons/:id', requireLogin, (req, res) => {
    let sermons = readData('sermons.json');
    const index = sermons.findIndex(s => s.id == req.params.id);
    if (index !== -1) {
        sermons[index] = {
            ...sermons[index],
            title: req.body.title,
            preacher: req.body.preacher,
            date: req.body.date,
            videoUrl: req.body.videoUrl,
            audioUrl: req.body.audioUrl,
            description: req.body.description
        };
        writeData('sermons.json', sermons);
    }
    res.redirect('/admin/sermons');
});

// Delete Sermon
router.delete('/sermons/:id', requireLogin, (req, res) => {
    let sermons = readData('sermons.json');
    sermons = sermons.filter(s => s.id != req.params.id);
    writeData('sermons.json', sermons);
    res.redirect('/admin/sermons');
});

// --- SERVICES MANAGEMENT ---

// List Services
router.get('/services', requireLogin, (req, res) => {
    const services = readData('services.json');
    res.render('admin/services/index', { title: 'Manage Services', services });
});

// New Service Form
router.get('/services/new', requireLogin, (req, res) => {
    res.render('admin/services/new', { title: 'Add New Service' });
});

// Create Service
router.post('/services', requireLogin, (req, res) => {
    const services = readData('services.json');
    const newService = {
        id: Date.now(),
        name: req.body.name,
        day: req.body.day,
        time: req.body.time,
        location: req.body.location
    };
    services.push(newService);
    writeData('services.json', services);
    res.redirect('/admin/services');
});

// Edit Service Form
router.get('/services/:id/edit', requireLogin, (req, res) => {
    const services = readData('services.json');
    const service = services.find(s => s.id == req.params.id);
    if (!service) return res.redirect('/admin/services');
    res.render('admin/services/edit', { title: 'Edit Service', service });
});

// Update Service
router.put('/services/:id', requireLogin, (req, res) => {
    let services = readData('services.json');
    const index = services.findIndex(s => s.id == req.params.id);
    if (index !== -1) {
        services[index] = {
            ...services[index],
            name: req.body.name,
            day: req.body.day,
            time: req.body.time,
            location: req.body.location
        };
        writeData('services.json', services);
    }
    res.redirect('/admin/services');
});

// Delete Service
router.delete('/services/:id', requireLogin, (req, res) => {
    let services = readData('services.json');
    services = services.filter(s => s.id != req.params.id);
    writeData('services.json', services);
    res.redirect('/admin/services');
});

// --- GALLERY MANAGEMENT ---

// List Gallery
router.get('/gallery', requireLogin, (req, res) => {
    const gallery = readData('gallery.json');
    res.render('admin/gallery/index', { title: 'Manage Gallery', gallery });
});

// New Photo Form
router.get('/gallery/new', requireLogin, (req, res) => {
    res.render('admin/gallery/new', { title: 'Add New Photo' });
});

// Create Photo
// Create Photo
router.post('/gallery', requireLogin, upload.single('image'), (req, res) => {
    const gallery = readData('gallery.json');

    let imageUrl = '';
    if (req.file) {
        // Store relative path for frontend access
        imageUrl = '/uploads/gallery/' + req.file.filename;
    } else if (req.body.url) {
        // Fallback or if we somehow decide to keep URL (though form only has file now)
        imageUrl = req.body.url;
    }

    const newPhoto = {
        id: Date.now(),
        url: imageUrl,
        caption: req.body.caption
    };
    gallery.push(newPhoto);
    writeData('gallery.json', gallery);
    res.redirect('/admin/gallery');
});

// Delete Photo
router.delete('/gallery/:id', requireLogin, (req, res) => {
    let gallery = readData('gallery.json');
    gallery = gallery.filter(p => p.id != req.params.id);
    writeData('gallery.json', gallery);
    res.redirect('/admin/gallery');
});

module.exports = router;
