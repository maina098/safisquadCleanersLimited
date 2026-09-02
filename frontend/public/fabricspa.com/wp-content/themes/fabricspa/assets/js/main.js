const getBtn = document.querySelectorAll('.ham-btn')
getBtn?.forEach(btn => {
  btn.addEventListener('click', e => {
    document.querySelector('body').classList.toggle('show-menu');
})
})

// accordion 
const handleAccordion = ()=>{
    const headers = document.querySelectorAll('.accordion-header');

    headers.forEach(header => {
      header.addEventListener('click', () => {
        const content = header.nextElementSibling;
        const icon = header.querySelector('svg');

        headers.forEach(h => {
          if (h !== header) {
            h.nextElementSibling.style.maxHeight = null;
            h.querySelector('svg').style.transform = '';
          }
        });

        if (content.style.maxHeight) {
          content.style.maxHeight = null;
          icon.style.transform = '';
        } else {
          content.style.maxHeight = content.scrollHeight + 'px';
          icon.style.transform = 'rotate(180deg)';
        }
      });
    });
}
handleAccordion();




 function animateCounter(el, endValue, duration = 2000, suffix = "") {
  let start = 0;
  let frame;

  const step = () => {
    const increment = Math.ceil(endValue / (duration / 16)); // ~60fps
    start += increment;
    if (start >= endValue) {
      el.textContent = endValue + suffix;
      cancelAnimationFrame(frame);
    } else {
      el.textContent = start + suffix;
      frame = requestAnimationFrame(step);
    }
  };

  frame = requestAnimationFrame(step);
}

document.addEventListener('DOMContentLoaded', () => {
  const counters = document.querySelectorAll('.counter');
  const observer = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const el = entry.target;
        const endValue = parseInt(el.getAttribute('data-count'));
        const suffix = el.getAttribute('data-suffix') || "";
        animateCounter(el, endValue, 2000, suffix);
        observer.unobserve(el);
      }
    });
  }, { threshold: 0.5 });

  counters.forEach(counter => observer.observe(counter));
});

