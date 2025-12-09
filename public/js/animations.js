/**
 * MAGNY FC 78 - Animations & Effets JavaScript
 */

// =====================================================
// SCROLL ANIMATIONS (Intersection Observer)
// =====================================================
const initScrollAnimations = () => {
  const observerOptions = {
    root: null,
    rootMargin: '0px 0px -100px 0px',
    threshold: 0.1
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('animated');
        // Optionnel: arrêter d'observer après animation
        // observer.unobserve(entry.target);
      }
    });
  }, observerOptions);

  // Observer tous les éléments avec la classe animate-on-scroll
  document.querySelectorAll('.animate-on-scroll').forEach(el => {
    observer.observe(el);
  });

  // Observer les stats
  document.querySelectorAll('.stat-item').forEach(el => {
    observer.observe(el);
  });

  // Observer les cards de match
  document.querySelectorAll('.match-card').forEach(el => {
    observer.observe(el);
  });
};

// =====================================================
// HEADER SCROLL EFFECT
// =====================================================
const initHeaderScroll = () => {
  const header = document.querySelector('header');
  if (!header) return;

  let lastScroll = 0;
  let ticking = false;

  const updateHeader = () => {
    const currentScroll = window.scrollY;

    // Ajouter classe scrolled après 100px
    if (currentScroll > 100) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }

    // Cacher/montrer header au scroll (optionnel)
    /*
    if (currentScroll > lastScroll && currentScroll > 200) {
      header.classList.add('hidden');
    } else {
      header.classList.remove('hidden');
    }
    */

    lastScroll = currentScroll;
    ticking = false;
  };

  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(updateHeader);
      ticking = true;
    }
  });
};

// =====================================================
// SCROLL PROGRESS BAR
// =====================================================
const initScrollProgress = () => {
  const progressBar = document.createElement('div');
  progressBar.className = 'scroll-progress';
  document.body.appendChild(progressBar);

  const updateProgress = () => {
    const scrollTop = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const progress = scrollTop / docHeight;
    progressBar.style.transform = `scaleX(${progress})`;
  };

  window.addEventListener('scroll', () => {
    requestAnimationFrame(updateProgress);
  });
};

// =====================================================
// COUNTER ANIMATION
// =====================================================
const animateCounter = (element, target, duration = 2000) => {
  const start = 0;
  const startTime = performance.now();
  
  // Extraire le nombre et le suffixe (ex: "300+" -> 300, "+")
  const match = target.match(/^(\d+)(.*)$/);
  if (!match) return;
  
  const endValue = parseInt(match[1]);
  const suffix = match[2] || '';

  const updateCounter = (currentTime) => {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    
    // Easing function (ease-out)
    const easeOut = 1 - Math.pow(1 - progress, 3);
    const currentValue = Math.floor(easeOut * endValue);
    
    element.textContent = currentValue + suffix;
    element.classList.add('counting');

    if (progress < 1) {
      requestAnimationFrame(updateCounter);
    } else {
      element.classList.remove('counting');
    }
  };

  requestAnimationFrame(updateCounter);
};

const initCounters = () => {
  const counterObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const target = entry.target.dataset.target || entry.target.textContent;
        animateCounter(entry.target, target);
        counterObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.5 });

  document.querySelectorAll('.stat-value, .counter').forEach(el => {
    el.dataset.target = el.textContent;
    counterObserver.observe(el);
  });
};

// =====================================================
// SMOOTH SCROLL TO ANCHOR
// =====================================================
const initSmoothScroll = () => {
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', (e) => {
      const targetId = anchor.getAttribute('href');
      if (targetId === '#') return;

      const targetEl = document.querySelector(targetId);
      if (targetEl) {
        e.preventDefault();
        const headerHeight = document.querySelector('header')?.offsetHeight || 0;
        const targetPosition = targetEl.offsetTop - headerHeight - 20;
        
        window.scrollTo({
          top: targetPosition,
          behavior: 'smooth'
        });
      }
    });
  });
};

// =====================================================
// PARALLAX EFFECT
// =====================================================
const initParallax = () => {
  const parallaxElements = document.querySelectorAll('.parallax, .hero-parallax');
  
  if (parallaxElements.length === 0) return;

  const updateParallax = () => {
    const scrollY = window.scrollY;

    parallaxElements.forEach(el => {
      const speed = el.dataset.speed || 0.5;
      const offset = scrollY * speed;
      el.style.backgroundPositionY = `calc(50% + ${offset}px)`;
    });
  };

  window.addEventListener('scroll', () => {
    requestAnimationFrame(updateParallax);
  });
};

// =====================================================
// LIGHTBOX GALERIE
// =====================================================
const initLightbox = () => {
  // Créer le lightbox
  const lightbox = document.createElement('div');
  lightbox.className = 'lightbox';
  lightbox.innerHTML = `
    <div class="lightbox-overlay"></div>
    <div class="lightbox-content">
      <button class="lightbox-close">&times;</button>
      <button class="lightbox-prev">&#10094;</button>
      <img class="lightbox-image" src="" alt="">
      <button class="lightbox-next">&#10095;</button>
      <div class="lightbox-caption"></div>
    </div>
  `;
  lightbox.style.cssText = `
    display: none; position: fixed; inset: 0; z-index: 10000;
    align-items: center; justify-content: center;
  `;
  document.body.appendChild(lightbox);

  const overlay = lightbox.querySelector('.lightbox-overlay');
  overlay.style.cssText = `position: absolute; inset: 0; background: rgba(0,0,0,0.95);`;

  const content = lightbox.querySelector('.lightbox-content');
  content.style.cssText = `position: relative; max-width: 90vw; max-height: 90vh;`;

  const img = lightbox.querySelector('.lightbox-image');
  img.style.cssText = `max-width: 100%; max-height: 85vh; display: block;`;

  const closeBtn = lightbox.querySelector('.lightbox-close');
  closeBtn.style.cssText = `
    position: absolute; top: -40px; right: 0; background: none; border: none;
    color: white; font-size: 2rem; cursor: pointer;
  `;

  const prevBtn = lightbox.querySelector('.lightbox-prev');
  const nextBtn = lightbox.querySelector('.lightbox-next');
  [prevBtn, nextBtn].forEach(btn => {
    btn.style.cssText = `
      position: absolute; top: 50%; transform: translateY(-50%);
      background: rgba(255,255,255,0.1); border: none; color: white;
      font-size: 2rem; padding: 20px 15px; cursor: pointer;
    `;
  });
  prevBtn.style.left = '-60px';
  nextBtn.style.right = '-60px';

  let images = [];
  let currentIndex = 0;

  const openLightbox = (index) => {
    currentIndex = index;
    img.src = images[currentIndex].src;
    lightbox.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  };

  const closeLightbox = () => {
    lightbox.style.display = 'none';
    document.body.style.overflow = '';
  };

  const navigate = (direction) => {
    currentIndex = (currentIndex + direction + images.length) % images.length;
    img.src = images[currentIndex].src;
  };

  closeBtn.addEventListener('click', closeLightbox);
  overlay.addEventListener('click', closeLightbox);
  prevBtn.addEventListener('click', () => navigate(-1));
  nextBtn.addEventListener('click', () => navigate(1));

  document.addEventListener('keydown', (e) => {
    if (lightbox.style.display !== 'flex') return;
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft') navigate(-1);
    if (e.key === 'ArrowRight') navigate(1);
  });

  // Attacher aux images de galerie
  const attachToGallery = () => {
    const galleryItems = document.querySelectorAll('.galerie-item');
    images = Array.from(galleryItems).map(item => ({
      src: item.querySelector('img')?.src || item.dataset.src
    }));

    galleryItems.forEach((item, index) => {
      item.style.cursor = 'pointer';
      item.addEventListener('click', () => openLightbox(index));
    });
  };

  // Observer pour les galeries chargées dynamiquement
  const galleryObserver = new MutationObserver(attachToGallery);
  galleryObserver.observe(document.body, { childList: true, subtree: true });
  attachToGallery();
};

// =====================================================
// TYPING EFFECT
// =====================================================
const initTypingEffect = (element, texts, speed = 100, pause = 2000) => {
  if (!element) return;

  let textIndex = 0;
  let charIndex = 0;
  let isDeleting = false;

  const type = () => {
    const currentText = texts[textIndex];

    if (isDeleting) {
      element.textContent = currentText.substring(0, charIndex - 1);
      charIndex--;
    } else {
      element.textContent = currentText.substring(0, charIndex + 1);
      charIndex++;
    }

    let delay = isDeleting ? speed / 2 : speed;

    if (!isDeleting && charIndex === currentText.length) {
      delay = pause;
      isDeleting = true;
    } else if (isDeleting && charIndex === 0) {
      isDeleting = false;
      textIndex = (textIndex + 1) % texts.length;
    }

    setTimeout(type, delay);
  };

  type();
};

// =====================================================
// MAGNETIC BUTTONS
// =====================================================
const initMagneticButtons = () => {
  document.querySelectorAll('.btn-magnetic').forEach(btn => {
    btn.addEventListener('mousemove', (e) => {
      const rect = btn.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;
      
      btn.style.transform = `translate(${x * 0.2}px, ${y * 0.2}px)`;
    });

    btn.addEventListener('mouseleave', () => {
      btn.style.transform = '';
    });
  });
};

// =====================================================
// TILT EFFECT ON CARDS
// =====================================================
const initTiltEffect = () => {
  document.querySelectorAll('.card-tilt').forEach(card => {
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;
      
      const tiltX = (y - 0.5) * 10;
      const tiltY = (x - 0.5) * -10;
      
      card.style.transform = `perspective(1000px) rotateX(${tiltX}deg) rotateY(${tiltY}deg)`;
    });

    card.addEventListener('mouseleave', () => {
      card.style.transform = '';
    });
  });
};

// =====================================================
// INITIALIZATION
// =====================================================
const initAnimations = () => {
  // Attendre que le DOM soit prêt
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  function init() {
    initScrollAnimations();
    initHeaderScroll();
    initScrollProgress();
    initCounters();
    initSmoothScroll();
    initParallax();
    initLightbox();
    initMagneticButtons();
    initTiltEffect();

    // Ajouter classe au hero pour animation
    document.querySelector('.hero')?.classList.add('hero-animated');

    console.log('🎬 Animations initialisées');
  }
};

// Auto-init
initAnimations();

// Export pour utilisation modulaire
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    initAnimations,
    initScrollAnimations,
    initCounters,
    initLightbox,
    animateCounter,
    initTypingEffect
  };
}
