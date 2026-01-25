const express = require('express');
const path = require('path');
const methodOverride = require('method-override');
const ejs = require('ejs');
const session = require('express-session');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(methodOverride('_method'));
app.use(session({
    secret: 'secretkey_church',
    resave: false,
    saveUninitialized: false
}));

// Make current user available locally
app.use((req, res, next) => {
    res.locals.currentUser = req.session.user_id;

    // Localization Logic
    const lang = req.session.lang || 'en';
    const langFile = require(`./locales/${lang}.json`);
    res.locals.t = langFile;
    res.locals.currentLang = lang;
    res.locals.currentPath = req.path;

    next();
});

// Routes
const mainRoutes = require('./routes/index');
const adminRoutes = require('./routes/admin');

app.use('/admin', adminRoutes);
app.use('/', mainRoutes);

// Language Switcher Route
app.get('/lang/:locale', (req, res) => {
    const locale = req.params.locale;
    if (['en', 'ta'].includes(locale)) {
        req.session.lang = locale;
        req.session.save(() => { // Ensure session is saved before redirecting
            const referer = req.get('Referer');
            if (referer && !referer.includes('/lang/')) {
                res.redirect(referer);
            } else {
                res.redirect('/');
            }
        });
    } else {
        res.redirect('/');
    }
});


// 404 Handler (optional but good practice)
// app.use((req, res) => {
//    res.status(404).render('404', { title: 'Page Not Found' });
// });


app.listen(PORT, () => {
    console.log(`Serving on port ${PORT}`);
});
