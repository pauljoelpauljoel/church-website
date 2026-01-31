const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { getData, saveData, getAdminSettings, saveAdminSettings, getCategories, saveCategories, getPrayers, savePrayers } = require('../utils/storage');

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

// --- HELPER FOR ARRAYS ---
async function syncArrays(key, action, itemData, id = null) {
    let listEn = await getData(key, []);
    let listTa = await getData(key + '_ta', []);

    // Ensure they are arrays
    if (!Array.isArray(listEn)) listEn = [];
    if (!Array.isArray(listTa)) listTa = [];

    if (action === 'create') {
        listEn.push(itemData.en);
        listTa.push(itemData.ta);
    } else if (action === 'update' && id) {
        const idxEn = listEn.findIndex(x => x.id == id);
        const idxTa = listTa.findIndex(x => x.id == id);

        if (idxEn !== -1) listEn[idxEn] = { ...listEn[idxEn], ...itemData.en };
        if (idxTa !== -1) {
            listTa[idxTa] = { ...listTa[idxTa], ...itemData.ta };
        } else if (idxEn !== -1) {
            // If Tamil entry didn't exist but English did (legacy), create it now
            listTa.push({ ...itemData.ta, id: id });
        }
    } else if (action === 'delete' && id) {
        listEn = listEn.filter(x => x.id != id);
        listTa = listTa.filter(x => x.id != id);
    }

    await saveData(key, listEn);
    await saveData(key + '_ta', listTa);
}

// --- ABOUT MANAGEMENT (Moved to top) ---
router.get('/about', requireLogin, async (req, res) => {
    let about = await getData('about', {});
    let aboutTa = await getData('about_ta', {});

    // Normalize
    if (Array.isArray(about)) about = {};
    if (Array.isArray(aboutTa)) aboutTa = {};

    res.render('admin/about/edit', { title: 'Edit About Us', about, aboutTa });
});

router.post('/about', requireLogin, async (req, res) => {
    const aboutEn = {
        title: req.body.title,
        lead: req.body.lead,
        visionTitle: req.body.visionTitle,
        visionText: req.body.visionText,
        missionTitle: req.body.missionTitle,
        missionText: req.body.missionText,
        leadershipTitle: req.body.leadershipTitle
    };

    const aboutTa = {
        title: req.body.titleTa || req.body.title,
        lead: req.body.leadTa,
        visionTitle: req.body.visionTitleTa,
        visionText: req.body.visionTextTa,
        missionTitle: req.body.missionTitleTa,
        missionText: req.body.missionTextTa,
        leadershipTitle: req.body.leadershipTitleTa
    };

    await saveData('about', aboutEn);
    await saveData('about_ta', aboutTa);
    res.redirect('/admin/about');
});


// --- HOME MANAGEMENT ---
router.get('/home', requireLogin, async (req, res) => {
    let home = await getData('home', {});
    let homeTa = await getData('home_ta', {});

    // Default to locale if empty (First run)
    if (Object.keys(home).length === 0) {
        try {
            const enLocale = require('../locales/en.json');
            home = {
                welcome_title: enLocale.welcome_title,
                welcome_quote: enLocale.welcome_quote,
                worship: enLocale.worship,
                worship_text: enLocale.worship_text,
                community: enLocale.community,
                community_text: enLocale.community_text,
                word: enLocale.word,
                word_text: enLocale.word_text
            };
        } catch (e) {
            console.error("Could not load defaults from en.json", e);
        }
    }

    res.render('admin/home/edit', { title: 'Edit Home Content', home, homeTa });
});

router.post('/home', requireLogin, async (req, res) => {
    const homeEn = {
        welcome_title: req.body.welcome_title,
        welcome_quote: req.body.welcome_quote,
        worship: req.body.worship,
        worship_text: req.body.worship_text,
        community: req.body.community,
        community_text: req.body.community_text,
        word: req.body.word,
        word_text: req.body.word_text
    };

    const homeTa = {
        welcome_title: req.body.welcome_titleTa,
        welcome_quote: req.body.welcome_quoteTa,
        worship: req.body.worshipTa,
        worship_text: req.body.worship_textTa,
        community: req.body.communityTa,
        community_text: req.body.community_textTa,
        word: req.body.wordTa,
        word_text: req.body.word_textTa
    };

    await saveData('home', homeEn);
    await saveData('home_ta', homeTa);
    res.redirect('/admin/home');
});


// --- TEAM MANAGEMENT ---

// List Team Members
router.get('/team', requireLogin, async (req, res) => {
    const team = await getData('team', []);
    res.render('admin/team/index', { title: 'Manage Team', team });
});

// New Team Member Form
router.get('/team/new', requireLogin, (req, res) => {
    res.render('admin/team/new', { title: 'Add Team Member' });
});

// Create Team Member
router.post('/team', requireLogin, uploadTeam.single('image'), async (req, res) => {
    let imageUrl = '';
    if (req.file) {
        imageUrl = '/uploads/team/' + req.file.filename;
    } else {
        imageUrl = 'https://via.placeholder.com/150';
    }

    const id = Date.now();
    const itemEn = {
        id,
        name: req.body.name,
        role: req.body.role,
        image: imageUrl,
        quote: req.body.quote
    };
    const itemTa = {
        id,
        name: req.body.nameTa || req.body.name,
        role: req.body.roleTa || req.body.role,
        image: imageUrl, // Shared image
        quote: req.body.quoteTa || req.body.quote
    };

    await syncArrays('team', 'create', { en: itemEn, ta: itemTa });
    res.redirect('/admin/team');
});

// Edit Team Member Form
router.get('/team/:id/edit', requireLogin, async (req, res) => {
    const team = await getData('team', []);
    const teamTa = await getData('team_ta', []);

    const member = team.find(m => m.id == req.params.id);
    const memberTa = teamTa.find(m => m.id == req.params.id) || {};

    if (!member) return res.redirect('/admin/team');

    const mergedMember = {
        ...member,
        nameTa: memberTa.name,
        roleTa: memberTa.role,
        quoteTa: memberTa.quote
    };

    res.render('admin/team/edit', { title: 'Edit Team Member', member: mergedMember });
});

// Update Team Member
router.post('/team/:id', requireLogin, uploadTeam.single('image'), async (req, res) => {
    // Need to fetch current to get old image if not updating
    const team = await getData('team', []);
    const oldItem = team.find(x => x.id == req.params.id) || {};

    let imageUrl = oldItem.image || '';
    if (req.file) {
        imageUrl = '/uploads/team/' + req.file.filename;
    }

    const itemEn = {
        name: req.body.name,
        role: req.body.role,
        quote: req.body.quote,
        image: imageUrl
    };

    const itemTa = {
        name: req.body.nameTa,
        role: req.body.roleTa,
        quote: req.body.quoteTa,
        image: imageUrl
    };

    await syncArrays('team', 'update', { en: itemEn, ta: itemTa }, req.params.id);
    res.redirect('/admin/team');
});

// Delete Team Member
router.delete('/team/:id', requireLogin, async (req, res) => {
    await syncArrays('team', 'delete', {}, req.params.id);
    res.redirect('/admin/team');
});



// Login Page
router.get('/login', (req, res) => {
    res.render('admin/login', { title: 'Admin Login', error: null });
});

// Login Logic
router.post('/login', async (req, res) => {
    const { username, password } = req.body;

    // Fetch dynamic credentials
    const settings = await getAdminSettings();

    if (username === settings.username && password === settings.password) {
        req.session.user_id = 'admin';
        res.redirect('/admin/dashboard');
    } else {
        res.render('admin/login', { title: 'Admin Login', error: 'Invalid Credentials' });
    }
});

// Settings Page
router.get('/settings', requireLogin, async (req, res) => {
    const settings = await getAdminSettings();
    res.render('admin/settings', { title: 'Admin Settings', error: null, success: null, settings });
});

// Update Site Settings
router.post('/settings/site', requireLogin, async (req, res) => {
    const currentSettings = await getAdminSettings();

    const newSettings = {
        ...currentSettings,
        liveStreamEnabled: req.body.liveStreamEnabled === 'on',
        liveStreamTitle: req.body.liveStreamTitle,
        liveStreamText: req.body.liveStreamText,
        liveStreamLink: req.body.liveStreamLink
    };

    const success = await saveAdminSettings(newSettings);

    if (success) {
        res.render('admin/settings', {
            title: 'Admin Settings',
            error: null,
            success: 'Site settings updated successfully.',
            settings: newSettings
        });
    } else {
        res.render('admin/settings', {
            title: 'Admin Settings',
            error: 'Failed to update site settings.',
            success: null,
            settings: currentSettings
        });
    }
});

// Update Credentials
router.post('/settings', requireLogin, async (req, res) => {
    const { currentUsername, currentPassword, newUsername, newPassword } = req.body;

    // Verify current credentials first
    const settings = await getAdminSettings();

    if (currentUsername !== settings.username || currentPassword !== settings.password) {
        return res.render('admin/settings', {
            title: 'Admin Settings',
            error: 'Current credentials incorrect',
            success: null,
            settings
        });
    }

    // Save new credentials (preserve other settings)
    const newSettings = {
        ...settings, // Keep liveStream info
        username: newUsername,
        password: newPassword
    };

    const success = await saveAdminSettings(newSettings);

    if (success) {
        res.render('admin/settings', {
            title: 'Admin Settings',
            error: null,
            success: 'Credentials updated successfully. Please login with new details next time.',
            settings: newSettings
        });
    } else {
        res.render('admin/settings', {
            title: 'Admin Settings',
            error: 'Failed to save settings. Please try again.',
            success: null,
            settings
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
    const prayers = await getPrayers();
    const prayerCount = prayers.length;

    const events = await getData('events', []);
    const sermons = await getData('sermons', []);

    const eventCount = events.length;
    const sermonCount = sermons.length;

    res.render('admin/dashboard', { title: 'Admin Dashboard', prayerCount, eventCount, sermonCount });
});

// View Prayer Requests
router.get('/prayers', requireLogin, async (req, res) => {
    const prayers = await getPrayers();
    res.render('admin/prayers', { title: 'Prayer Requests', prayers });
});

// Edit Prayer Form
router.get('/prayers/:id/edit', requireLogin, async (req, res) => {
    const prayers = await getPrayers();
    const prayer = prayers.find(p => p.id == req.params.id);
    if (!prayer) return res.redirect('/admin/prayers');
    res.render('admin/prayers_edit', { title: 'Edit Prayer Request', prayer });
});

// Update Prayer
router.put('/prayers/:id', requireLogin, async (req, res) => {
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
router.get('/donate', requireLogin, async (req, res) => {
    const donate = await getData('donate', {});
    const donateTa = await getData('donate_ta', {});
    res.render('admin/donate/edit', { title: 'Edit Donation Info', donate, donateTa });
});

// Update Donate Info
router.post('/donate', requireLogin, uploadQr.single('qrImage'), async (req, res) => {
    // We need old data to keep QR if not updated
    const oldDonate = await getData('donate', {});

    let qrUrl = oldDonate.upiQr;
    if (req.file) {
        qrUrl = '/uploads/qr/' + req.file.filename;
    } else if (req.body.upiQr) {
        qrUrl = req.body.upiQr;
    }

    const updatedDonateEn = {
        bankName: req.body.bankName,
        accNo: req.body.accNo,
        ifsc: req.body.ifsc,
        branch: req.body.branch,
        upiId: req.body.upiId,
        upiQr: qrUrl
    };

    const updatedDonateTa = {
        bankName: req.body.bankNameTa || req.body.bankName,
        accNo: req.body.accNoTa || req.body.accNo,
        ifsc: req.body.ifscTa || req.body.ifsc,
        branch: req.body.branchTa || req.body.branch,
        upiId: req.body.upiIdTa || req.body.upiId,
        upiQr: qrUrl // Shared
    };

    await saveData('donate', updatedDonateEn);
    await saveData('donate_ta', updatedDonateTa);
    res.redirect('/donate');
});

// --- CONTACT MANAGEMENT ---

// Edit Contact Info
router.get('/contact', requireLogin, async (req, res) => {
    const contact = await getData('contact', {});
    const contactTa = await getData('contact_ta', {});
    res.render('admin/contact/edit', { title: 'Edit Contact Info', contact, contactTa });
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

// Update Contact Info
router.post('/contact', requireLogin, async (req, res) => {
    let mapUrl = req.body.mapUrl;
    const iframeMatch = mapUrl.match(/src="([^"]+)"/);
    if (iframeMatch && iframeMatch[1]) mapUrl = iframeMatch[1];

    let whatsappPhone = req.body.whatsappPhone.trim();
    if (/^\d{10}$/.test(whatsappPhone)) whatsappPhone = '91' + whatsappPhone;

    let phone = req.body.phone.trim();
    if (/^\d{10}$/.test(phone)) phone = '+91 ' + phone;

    const updatedContactEn = {
        address: req.body.address,
        phone: phone,
        email: req.body.email,
        officeHours: req.body.officeHours,
        whatsappPhone: whatsappPhone,
        mapUrl: mapUrl,
        mapLink: req.body.mapLink
    };

    const updatedContactTa = {
        address: req.body.addressTa,
        phone: phone, // Number is same
        email: req.body.email,
        officeHours: req.body.officeHoursTa,
        whatsappPhone: whatsappPhone,
        mapUrl: mapUrl,
        mapLink: req.body.mapLink
    };

    await saveData('contact', updatedContactEn);
    await saveData('contact_ta', updatedContactTa);
    res.redirect('/contact');
});

// --- EVENTS MANAGEMENT ---

// List Events
router.get('/events', requireLogin, async (req, res) => {
    const events = await getData('events', []);
    res.render('admin/events/index', { title: 'Manage Events', events });
});

// New Event Form
router.get('/events/new', requireLogin, (req, res) => {
    res.render('admin/events/new', { title: 'Add New Event' });
});

// Create Event
router.post('/events', requireLogin, uploadEvents.single('image'), async (req, res) => {
    let imageUrl = '';
    if (req.file) {
        imageUrl = '/uploads/events/' + req.file.filename;
    } else {
        imageUrl = 'https://source.unsplash.com/800x600/?church,event';
    }

    const id = Date.now();
    const itemEn = {
        id,
        title: req.body.title,
        date: req.body.date,
        description: req.body.description,
        image: imageUrl
    };
    const itemTa = {
        id,
        title: req.body.titleTa,
        date: req.body.date,
        description: req.body.descriptionTa,
        image: imageUrl
    };

    await syncArrays('events', 'create', { en: itemEn, ta: itemTa });
    res.redirect('/admin/events');
});

// Edit Event Form
router.get('/events/:id/edit', requireLogin, async (req, res) => {
    const events = await getData('events', []);
    const eventsTa = await getData('events_ta', []);

    const event = events.find(e => e.id == req.params.id);
    const eventTa = eventsTa.find(e => e.id == req.params.id) || {};

    if (!event) return res.redirect('/admin/events');

    const mergedEvent = {
        ...event,
        titleTa: eventTa.title,
        descriptionTa: eventTa.description
    };

    res.render('admin/events/edit', { title: 'Edit Event', event: mergedEvent });
});

// Update Event
router.put('/events/:id', requireLogin, uploadEvents.single('image'), async (req, res) => {
    const events = await getData('events', []);
    const oldItem = events.find(x => x.id == req.params.id) || {};

    let imageUrl = oldItem.image || '';
    if (req.file) imageUrl = '/uploads/events/' + req.file.filename;

    const itemEn = {
        title: req.body.title,
        date: req.body.date,
        description: req.body.description,
        image: imageUrl
    };

    const itemTa = {
        title: req.body.titleTa,
        date: req.body.date,
        description: req.body.descriptionTa,
        image: imageUrl
    };

    await syncArrays('events', 'update', { en: itemEn, ta: itemTa }, req.params.id);
    res.redirect('/admin/events');
});

// Delete Event
router.delete('/events/:id', requireLogin, async (req, res) => {
    await syncArrays('events', 'delete', {}, req.params.id);
    res.redirect('/admin/events');
});


// --- SERMONS MANAGEMENT ---

// List Sermons
router.get('/sermons', requireLogin, async (req, res) => {
    const sermons = await getData('sermons', []);
    res.render('admin/sermons/index', { title: 'Manage Sermons', sermons });
});

// New Sermon Form
router.get('/sermons/new', requireLogin, (req, res) => {
    res.render('admin/sermons/new', { title: 'Add New Sermon' });
});

// Create Sermon
router.post('/sermons', requireLogin, async (req, res) => {
    const id = Date.now();
    const itemEn = {
        id,
        title: req.body.title,
        preacher: req.body.preacher,
        date: req.body.date,
        videoUrl: req.body.videoUrl,
        audioUrl: req.body.audioUrl,
        description: req.body.description
    };
    const itemTa = {
        id,
        title: req.body.titleTa,
        preacher: req.body.preacherTa,
        date: req.body.date,
        videoUrl: req.body.videoUrl,
        audioUrl: req.body.audioUrl,
        description: req.body.descriptionTa
    };

    await syncArrays('sermons', 'create', { en: itemEn, ta: itemTa });
    res.redirect('/admin/sermons');
});

// Edit Sermon Form
router.get('/sermons/:id/edit', requireLogin, async (req, res) => {
    const sermons = await getData('sermons', []);
    const sermonsTa = await getData('sermons_ta', []);

    const sermon = sermons.find(s => s.id == req.params.id);
    const sermonTa = sermonsTa.find(s => s.id == req.params.id) || {};
    if (!sermon) return res.redirect('/admin/sermons');

    const mergedSermon = {
        ...sermon,
        titleTa: sermonTa.title,
        preacherTa: sermonTa.preacher,
        descriptionTa: sermonTa.description
    };
    res.render('admin/sermons/edit', { title: 'Edit Sermon', sermon: mergedSermon });
});

// Update Sermon
router.put('/sermons/:id', requireLogin, async (req, res) => {
    const itemEn = {
        title: req.body.title,
        preacher: req.body.preacher,
        date: req.body.date,
        videoUrl: req.body.videoUrl,
        audioUrl: req.body.audioUrl,
        description: req.body.description
    };
    const itemTa = {
        title: req.body.titleTa,
        preacher: req.body.preacherTa,
        date: req.body.date,
        videoUrl: req.body.videoUrl,
        audioUrl: req.body.audioUrl,
        description: req.body.descriptionTa
    };
    await syncArrays('sermons', 'update', { en: itemEn, ta: itemTa }, req.params.id);
    res.redirect('/admin/sermons');
});

// Delete Sermon
router.delete('/sermons/:id', requireLogin, async (req, res) => {
    await syncArrays('sermons', 'delete', {}, req.params.id);
    res.redirect('/admin/sermons');
});

// --- SERVICES MANAGEMENT ---

// List Services
router.get('/services', requireLogin, async (req, res) => {
    const services = await getData('services', []);
    res.render('admin/services/index', { title: 'Manage Services', services });
});

// New Service Form
router.get('/services/new', requireLogin, (req, res) => {
    res.render('admin/services/new', { title: 'Add New Service' });
});

// Create Service
router.post('/services', requireLogin, async (req, res) => {
    const id = Date.now();
    const itemEn = {
        id,
        name: req.body.name,
        day: req.body.day,
        time: req.body.time,
        location: req.body.location
    };
    const itemTa = {
        id,
        name: req.body.nameTa,
        day: req.body.dayTa,
        time: req.body.timeTa,
        location: req.body.locationTa
    };
    await syncArrays('services', 'create', { en: itemEn, ta: itemTa });
    res.redirect('/admin/services');
});

// Edit Service Form
router.get('/services/:id/edit', requireLogin, async (req, res) => {
    const services = await getData('services', []);
    const servicesTa = await getData('services_ta', []);

    const service = services.find(s => s.id == req.params.id);
    const serviceTa = servicesTa.find(s => s.id == req.params.id) || {};

    if (!service) return res.redirect('/admin/services');

    const mergedService = {
        ...service,
        nameTa: serviceTa.name,
        dayTa: serviceTa.day,
        timeTa: serviceTa.time,
        locationTa: serviceTa.location
    };
    res.render('admin/services/edit', { title: 'Edit Service', service: mergedService });
});

// Update Service
router.put('/services/:id', requireLogin, async (req, res) => {
    const itemEn = {
        name: req.body.name,
        day: req.body.day,
        time: req.body.time,
        location: req.body.location
    };
    const itemTa = {
        name: req.body.nameTa,
        day: req.body.dayTa,
        time: req.body.timeTa,
        location: req.body.locationTa
    };
    await syncArrays('services', 'update', { en: itemEn, ta: itemTa }, req.params.id);
    res.redirect('/admin/services');
});

// Delete Service
router.delete('/services/:id', requireLogin, async (req, res) => {
    await syncArrays('services', 'delete', {}, req.params.id);
    res.redirect('/admin/services');
});



// --- CATEGORY MANAGEMENT ---
router.get('/categories', requireLogin, async (req, res) => {
    const categories = await getCategories();
    res.render('admin/categories/index', { title: 'Manage Categories', categories });
});

router.post('/categories', requireLogin, async (req, res) => {
    const categories = await getCategories();
    const newCategory = {
        id: Date.now(),
        name: req.body.name,
        nameTa: req.body.nameTa
    };
    categories.push(newCategory);
    await saveCategories(categories);
    res.redirect('/admin/categories');
});

router.delete('/categories/:id', requireLogin, async (req, res) => {
    let categories = await getCategories();
    // Prevent deleting General category (assuming ID 1 is General)
    if (req.params.id != 1) {
        categories = categories.filter(c => c.id != req.params.id);
        await saveCategories(categories);
    }
    res.redirect('/admin/categories');
});

// --- GALLERY MANAGEMENT ---

// List Gallery
router.get('/gallery', requireLogin, async (req, res) => {
    const gallery = await getData('gallery', []);
    res.render('admin/gallery/index', { title: 'Manage Gallery', gallery });
});

// New Photo Form
router.get('/gallery/new', requireLogin, async (req, res) => {
    const categories = await getCategories();
    res.render('admin/gallery/new', { title: 'Add New Photo', categories });
});

// Create Photo
// Create Photo
router.post('/gallery', requireLogin, upload.single('image'), async (req, res) => {
    let imageUrl = '';
    if (req.file) {
        // Store relative path for frontend access
        imageUrl = '/uploads/gallery/' + req.file.filename;
    } else if (req.body.url) {
        imageUrl = req.body.url;
    }

    const id = Date.now();
    const itemEn = {
        id,
        url: imageUrl,
        caption: req.body.caption,
        category: req.body.category || 'General'
    };

    const itemTa = {
        id,
        url: imageUrl,
        caption: req.body.captionTa,
        category: req.body.category || 'General'
    };

    await syncArrays('gallery', 'create', { en: itemEn, ta: itemTa });
    res.redirect('/admin/gallery');
});

// Edit Photo Form
router.get('/gallery/:id/edit', requireLogin, async (req, res) => {
    const gallery = await getData('gallery', []);
    const galleryTa = await getData('gallery_ta', []);
    const categories = await getCategories();

    const photo = gallery.find(p => p.id == req.params.id);
    const photoTa = galleryTa.find(p => p.id == req.params.id) || {};

    if (!photo) return res.redirect('/admin/gallery');

    const mergedPhoto = {
        ...photo,
        captionTa: photoTa.caption,
        categoryTa: photoTa.category
    };

    res.render('admin/gallery/edit', { title: 'Edit Photo', photo: mergedPhoto, categories });
});

// Update Photo
router.put('/gallery/:id', requireLogin, upload.single('image'), async (req, res) => {
    const gallery = await getData('gallery', []);
    const oldItem = gallery.find(x => x.id == req.params.id) || {};

    let imageUrl = oldItem.url || '';
    if (req.file) {
        imageUrl = '/uploads/gallery/' + req.file.filename;
    }

    const itemEn = {
        url: imageUrl,
        caption: req.body.caption,
        category: req.body.category || 'General'
    };

    const itemTa = {
        url: imageUrl,
        caption: req.body.captionTa,
        category: req.body.category || 'General'
    };

    await syncArrays('gallery', 'update', { en: itemEn, ta: itemTa }, req.params.id);
    res.redirect('/admin/gallery');
});

// Delete Photo
// Delete Photo
router.delete('/gallery/:id', requireLogin, async (req, res) => {
    await syncArrays('gallery', 'delete', {}, req.params.id);
    res.redirect('/admin/gallery');
});

module.exports = router;
