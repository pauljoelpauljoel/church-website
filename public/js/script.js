// Client-side script

document.addEventListener('DOMContentLoaded', () => {
    console.log('Church Website Loaded');

    // Auto-change Bible Verse Logic
    const verses = [
        "For I know the plans I have for you, declares the Lord. - Jeremiah 29:11",
        "The Lord is my shepherd, I lack nothing. - Psalm 23:1",
        "Trust in the Lord with all your heart. - Proverbs 3:5",
        "I can do all this through him who gives me strength. - Philippians 4:13",
        "Be strong and courageous. - Joshua 1:9"
    ];

    const heroParams = document.querySelector('.hero-section p');
    if (heroParams && heroParams.textContent.includes('Matthew')) {
        // Only if it's the static one, maybe we want to rotate it
        // Or we can leave the static one as default

        // Simple rotation every 10 seconds if on home page
        let index = 0;
        setInterval(() => {
            heroParams.style.opacity = 0;
            setTimeout(() => {
                heroParams.textContent = `"${verses[index]}"`;
                heroParams.style.opacity = 1;
                index = (index + 1) % verses.length;
            }, 500); // Wait for fade out
        }, 8000);

        // Add transition
        heroParams.style.transition = "opacity 0.5s ease";
    }

    // Active link highlighting
    const currentPath = window.location.pathname;
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        if (link.getAttribute('href') === currentPath) {
            link.classList.add('active');
            link.style.color = 'var(--accent-color)';
        }
    });

});
