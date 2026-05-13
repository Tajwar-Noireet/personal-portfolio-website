// ── GSAP Setup ──────────────────────────────────────────────
gsap.registerPlugin(ScrollTrigger);

// ── Canvas Setup ─────────────────────────────────────────────
const canvas  = document.getElementById('avatar-canvas');
const context = canvas.getContext('2d');

// Total frames extracted from Web_Animation.mp4 (8s @ 24fps = 192 frames, 0-indexed)
const FRAME_COUNT = 192;
const FIRST_INDEX = 0;  // frame-000.jpg

// Frame path helper — zero-padded, 0-indexed
const framePath = (index) =>
    `images/frame-${index.toString().padStart(3, '0')}.jpg`;

// Image cache array and load tracking
const images = new Array(FRAME_COUNT);
let loadedCount = 0;

// Playhead object GSAP animates
const playhead = { frame: FIRST_INDEX };

// ── Preloader ─────────────────────────────────────────────────
const preloader    = document.getElementById('preloader');
const progressBar  = document.getElementById('progress-bar');
const progressText = document.getElementById('progress-text');

function updatePreloader() {
    const pct = Math.floor((loadedCount / FRAME_COUNT) * 100);
    if (progressBar)  progressBar.style.width = `${pct}%`;
    if (progressText) progressText.textContent = `${pct}%`;

    if (loadedCount >= FRAME_COUNT) {
        gsap.to(preloader, {
            opacity: 0,
            duration: 0.9,
            delay: 0.3,
            ease: 'power2.inOut',
            onComplete: () => {
                preloader.style.display = 'none';
                revealHero();
            }
        });
    }
}

// ── Image Preloading ──────────────────────────────────────────
// Load frame 0 first so canvas shows something immediately
const firstImg = new Image();
firstImg.src = framePath(FIRST_INDEX);
images[FIRST_INDEX] = firstImg;

let booted = false;
function boot() {
    if (booted) return;
    booted = true;
    resizeCanvas();
    window.addEventListener('resize', debounce(resizeCanvas, 150));
    // Hide roles 1 & 2 immediately so they don't flash before animation
    gsap.set(['#role-1', '#role-2'], { opacity: 0, y: 18 });
    // Start loading the rest
    preloadRest();
    // Init scroll animation (canvas will render as frames arrive)
    initScrollAnimation();
}

firstImg.onload = () => {
    loadedCount++;
    updatePreloader();
    boot();
};

firstImg.onerror = () => {
    loadedCount++;
    updatePreloader();
    boot();
};

function preloadRest() {
    for (let i = FIRST_INDEX + 1; i < FRAME_COUNT; i++) {
        const img = new Image();
        img.onload  = () => { loadedCount++; updatePreloader(); };
        img.onerror = () => { loadedCount++; updatePreloader(); };
        img.src = framePath(i);
        images[i] = img;
    }
}

// ── Canvas Render ─────────────────────────────────────────────
function resizeCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width  = window.innerWidth  * dpr;
    canvas.height = window.innerHeight * dpr;
    render();
}

function render() {
    const idx = Math.round(playhead.frame);
    const img = images[idx];
    if (!img || !img.complete || img.naturalWidth === 0) return;

    context.clearRect(0, 0, canvas.width, canvas.height);

    // Cover-fit: fill canvas while preserving aspect ratio (no black bars, no stretch)
    const canvasRatio = canvas.width / canvas.height;
    const imgRatio    = img.naturalWidth / img.naturalHeight;

    let drawW, drawH;
    if (canvasRatio > imgRatio) {
        // Canvas is wider than image → fit width
        drawW = canvas.width;
        drawH = canvas.width / imgRatio;
    } else {
        // Canvas is taller → fit height
        drawH = canvas.height;
        drawW = canvas.height * imgRatio;
    }

    const offsetX = (canvas.width  - drawW) / 2;
    const offsetY = (canvas.height - drawH) / 2;

    context.drawImage(img, offsetX, offsetY, drawW, drawH);
}

// ── GSAP Scroll Animation ─────────────────────────────────────
function initScrollAnimation() {
    // 1. Pin the hero section and scrub through ALL frames while it's pinned
    //    The page scrolls `scrollLength` extra pixels while the canvas animates.
    const scrollLength = window.innerHeight * 2.5; // ~2.5 screen heights of scroll = full animation

    // Create a spacer/sentinel that defines the scroll distance
    // We use the hero section itself as the trigger and pin it
    const roleEls = [
        document.getElementById('role-0'),
        document.getElementById('role-1'),
        document.getElementById('role-2'),
    ];
    let lastRoleActive = 0; // role-0 is shown at startup

    function showRole(i) {
        if (i === lastRoleActive) return;
        if (lastRoleActive >= 0) {
            gsap.to(roleEls[lastRoleActive], { opacity: 0, y: -16, duration: 0.35, ease: 'power3.in', overwrite: true });
        }
        gsap.to(roleEls[i], { opacity: 1, y: 0, duration: 0.45, ease: 'power3.out', overwrite: true });
        lastRoleActive = i;
    }

    gsap.to(playhead, {
        frame: FRAME_COUNT - 1,
        snap: { snapTo: 1, duration: 0 }, // snap to whole frames
        ease: 'none',
        scrollTrigger: {
            trigger: '.hero-section',
            start: 'top top',
            end: `+=${scrollLength}`,
            scrub: 1,
            pin: true,               // pin hero while scrolling through frames
            anticipatePin: 1,
            pinSpacing: true,        // push content below hero down
            onUpdate(self) {
                // Drive role switching from pin progress (0–1)
                const p = self.progress;
                const roleIdx = p < 0.333 ? 0 : p < 0.666 ? 1 : 2;
                showRole(roleIdx);
            }
        },
        onUpdate: render
    });

    // 2. Fade out hero headline as animation plays (first 30% of pin)
    gsap.to('#hero-headline', {
        opacity: 0,
        y: -50,
        ease: 'none',
        scrollTrigger: {
            trigger: '.hero-section',
            start: 'top top',
            end: `+=${scrollLength * 0.3}`,
            scrub: 1.2
        }
    });

    // 3. Fade out scroll cue quickly
    gsap.to('.scroll-cue', {
        opacity: 0,
        ease: 'none',
        scrollTrigger: {
            trigger: '.hero-section',
            start: 'top top',
            end: `+=${scrollLength * 0.12}`,
            scrub: true
        }
    });

    // 4. Bento card fade-up reveals
    gsap.utils.toArray('.fade-up').forEach((elem) => {
        gsap.to(elem, {
            scrollTrigger: {
                trigger: elem,
                start: 'top 88%',
                toggleActions: 'play none none none'
            },
            y: 0,
            opacity: 1,
            duration: 1.2,
            ease: 'power4.out'
        });
    });

    // 5. Scroll-driven role cycling — driven from frame progress in onUpdate below
    setupRoleCycling();

    // Refresh on resize
    window.addEventListener('resize', () => {
        ScrollTrigger.refresh();
        resizeCanvas();
    });
}

// ── Hero Reveal (after preloader) ────────────────────────────
function revealHero() {
    const tl = gsap.timeline({ defaults: { ease: 'power4.out' } });
    tl.from('.hero-tag',   { opacity: 0, y: 20, duration: 0.8 })
      .from('.hero-title', { opacity: 0, y: 40, duration: 1   }, '-=0.5')
      .fromTo('#role-0',   { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.8 }, '-=0.5')
      .from('.scroll-cue', { opacity: 0, duration: 0.8        }, '-=0.4')
      .from('#hero-nav',   { opacity: 0, y: -16, duration: 0.7 }, 0.2)
      .from('.veo-cover',  { opacity: 0, duration: 0.6        }, '-=0.4');
}

// ── Role Cycling Setup ─────────────────────────────────────────
// Called once to ensure roles start in correct hidden state before revealHero.
function setupRoleCycling() {
    // All roles start invisible—revealHero will show role-0
    gsap.set(['#role-1', '#role-2'], { opacity: 0, y: 18 });
}

// ── Nav scroll state ──────────────────────────────────────────
const nav = document.getElementById('hero-nav');
ScrollTrigger.create({
    start: '40px top',
    onEnter:     () => nav.classList.add('scrolled'),
    onLeaveBack: () => nav.classList.remove('scrolled')
});

// ── Custom Cursor ─────────────────────────────────────────────
const cursorDot  = document.getElementById('cursor-dot');
const cursorRing = document.getElementById('cursor-ring');
let mouseX = 0, mouseY = 0;
let ringX  = 0, ringY  = 0;

document.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    gsap.set(cursorDot, { x: mouseX, y: mouseY });
});

gsap.ticker.add(() => {
    const speed = 0.12;
    ringX += (mouseX - ringX) * speed;
    ringY += (mouseY - ringY) * speed;
    gsap.set(cursorRing, { x: ringX, y: ringY });
});

document.querySelectorAll('a, button, .bento-card, .cta-btn-primary, .cta-btn-secondary, .spec-item')
    .forEach(el => {
        el.addEventListener('mouseenter', () => document.body.classList.add('cursor-hover'));
        el.addEventListener('mouseleave', () => document.body.classList.remove('cursor-hover'));
    });

document.addEventListener('mouseleave', () => gsap.to([cursorDot, cursorRing], { opacity: 0, duration: 0.3 }));
document.addEventListener('mouseenter', () => gsap.to([cursorDot, cursorRing], { opacity: 1, duration: 0.3 }));

// ── Utilities ─────────────────────────────────────────────────
function debounce(fn, ms) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), ms);
    };
}
