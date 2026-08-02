// Initialize GSAP Animations
document.addEventListener('DOMContentLoaded', () => {
    
    // Hero Text Fade In
    gsap.from(".hero-content h1", {
        duration: 1.5,
        y: 100,
        opacity: 0,
        ease: "power4.out"
    });

    gsap.from(".hero-content p", {
        duration: 1.2,
        delay: 0.5,
        opacity: 0,
        ease: "power2.out"
    });

    // Scroll-triggered Card Animations
    gsap.from(".card", {
        scrollTrigger: {
            trigger: ".pricing",
            start: "top 80%",
        },
        duration: 1,
        y: 50,
        opacity: 0,
        stagger: 0.2,
        ease: "back.out(1.7)"
    });

    // Mouse Move 3D Effect for Cards
    const cards = document.querySelectorAll('.card');
    document.addEventListener('mousemove', (e) => {
        let x = (window.innerWidth / 2 - e.pageX) / 25;
        let y = (window.innerHeight / 2 - e.pageY) / 25;
        
        cards.forEach(card => {
            card.style.transform = `rotateY(${x}deg) rotateX(${y}deg)`;
        });
    });
});

// Smooth Scroll
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        document.querySelector(this.getAttribute('href')).scrollIntoView({
            behavior: 'smooth'
        });
    });
});