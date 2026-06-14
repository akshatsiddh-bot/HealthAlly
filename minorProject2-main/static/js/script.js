//mobile menu toggle
const mobileBtn = document.querySelector('.mobile-menu-btn');
const mobileMenu = document.getElementById('mobileMenu');



// FIX: Check if elements exist before adding listeners
if (mobileBtn && mobileMenu) { 
    mobileBtn.addEventListener('click', () => {
        // Toggle the 'active' class on the menu
        mobileMenu.classList.toggle('active');
        
        // Optional: Change the icon from ☰ to ✖
        if (mobileMenu.classList.contains('active')) {
            mobileBtn.textContent = '✕'; // Change to X
        } else {
            mobileBtn.textContent = '☰'; // Change back to 3 lines
        }
    });
}




// Smooth scrolling for navigation links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});


// Header scroll effect
window.addEventListener('scroll', () => {
    const header = document.querySelector('header');
    if (window.scrollY > 50) {
        header.classList.add('scrolled');
    } else {
        header.classList.remove('scrolled');
    }
});



// --- THEME INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    const savedTheme = localStorage.getItem('theme') || '';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);
});

// --- THEME TOGGLE FUNCTION ---
function toggleTheme() {
    const html = document.documentElement;
    const currentTheme = html.getAttribute('data-theme');
    
    // Switch logic
    const newTheme = currentTheme === 'dark' ? '' : 'dark';
    
    // Save and Apply
    html.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    
    // Update the icon
    updateThemeIcon(newTheme);
}

// --- ICON HELPER ---
function updateThemeIcon(theme) {
    const themeIcon = document.getElementById('themeIcon');
    if (!themeIcon) return;

    // If theme is dark, show the MOON. If light, show the SUN.
    if (theme === 'dark') {
        themeIcon.className = 'fas fa-moon';
    } else {
        themeIcon.className = 'fas fa-sun';
    }
}
