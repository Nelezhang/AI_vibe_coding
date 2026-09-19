// Smooth scroll to section
function scrollToSection(sectionId) {
    const element = document.getElementById(sectionId);
    if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
    }
}

// Active navigation link on scroll
window.addEventListener('scroll', () => {
    const sections = document.querySelectorAll('section, header');
    const navLinks = document.querySelectorAll('.nav-link');

    let current = '';
    sections.forEach(section => {
        const sectionTop = section.offsetTop;
        if (scrollY >= sectionTop - 200) {
            current = section.getAttribute('id');
        }
    });

    navLinks.forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href').slice(1) === current) {
            link.classList.add('active');
        }
    });

    // Add scroll shadow to navbar
    const navbar = document.querySelector('.navbar');
    if (scrollY > 10) {
        navbar.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.15)';
    } else {
        navbar.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.1)';
    }
});

// Animate progress bars on scroll
const observerOptions = {
    threshold: 0.5,
    rootMargin: '0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const progressBars = entry.target.querySelectorAll('.progress');
            progressBars.forEach(bar => {
                const width = bar.style.width;
                bar.style.width = '0';
                setTimeout(() => {
                    bar.style.width = width;
                }, 100);
            });
            observer.unobserve(entry.target);
        }
    });
}, observerOptions);

const subjectsSection = document.querySelector('.subjects');
if (subjectsSection) {
    observer.observe(subjectsSection);
}

// Add hover effects to cards
const cards = document.querySelectorAll('.activity-card, .subject-card, .link-card');
cards.forEach(card => {
    card.addEventListener('mouseenter', function() {
        this.style.cursor = 'pointer';
    });
});

// Mobile menu toggle (if you add a hamburger menu later)
function toggleMenu() {
    const navLinks = document.querySelector('.nav-links');
    navLinks.classList.toggle('active');
}

// Fade in elements on scroll
const fadeInElements = document.querySelectorAll('.activity-card, .subject-card, .info-card');

const fadeInObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
            fadeInObserver.unobserve(entry.target);
        }
    });
}, {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
});

fadeInElements.forEach(element => {
    element.style.opacity = '0';
    element.style.transform = 'translateY(20px)';
    element.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
    fadeInObserver.observe(element);
});

// Add a pop-up interaction on section titles
document.addEventListener('DOMContentLoaded', () => {
    const sectionTitles = document.querySelectorAll('.section-title');
    
    sectionTitles.forEach((title, index) => {
        title.style.animation = `fadeInDown 0.8s ease-out ${index * 0.2}s both`;
    });
});

// Add CSS animation dynamically
const style = document.createElement('style');
style.textContent = `
    @keyframes fadeInDown {
        from {
            opacity: 0;
            transform: translateY(-20px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }
    
    @keyframes slideUp {
        from {
            opacity: 0;
            transform: translateY(30px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }
`;
document.head.appendChild(style);

// Keyboard navigation
document.addEventListener('keydown', (e) => {
    if (e.key === 'Home') {
        scrollToSection('home');
    } else if (e.key === 'End') {
        document.querySelector('.footer').scrollIntoView({ behavior: 'smooth' });
    }
});

// Add active state to link cards on click
const linkCards = document.querySelectorAll('.link-card');
linkCards.forEach(card => {
    card.addEventListener('click', function(e) {
        // Prevent default only if it's not an actual link
        if (this.tagName === 'A') {
            // Let the link work normally
            return;
        }
    });
});

// Typing animation for the name
function typeWriter(element, text, speed = 50) {
    let index = 0;
    element.textContent = '';
    
    function type() {
        if (index < text.length) {
            element.textContent += text.charAt(index);
            index++;
            setTimeout(type, speed);
        }
    }
    
    // Only animate if the page is being viewed
    if (window.scrollY === 0) {
        type();
    }
}

// Counter animation for stats (if you want to add them)
function animateCounter(element, target, duration = 2000) {
    let current = 0;
    const increment = target / (duration / 16);
    
    const updateCounter = () => {
        current += increment;
        if (current < target) {
            element.textContent = Math.floor(current);
            requestAnimationFrame(updateCounter);
        } else {
            element.textContent = target;
        }
    };
    
    updateCounter();
}

// Parallax effect on hero section
window.addEventListener('scroll', () => {
    const hero = document.querySelector('.hero');
    if (hero) {
        hero.style.transform = `translateY(${window.scrollY * 0.5}px)`;
    }
});

// Print to console for debugging
console.log('🎓 Welcome to Alex Johnson\'s Resume Website!');
console.log('📱 This site is fully responsive and optimized for all devices.');
console.log('🎨 Enjoy exploring the colorful modern design!');
