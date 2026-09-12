import { useEffect, useState } from 'react'
import './App.css'

const fallbackContent = {
  cities: '5+', stores: 5, garments: '5,000',
  services: ['Dry cleaning', 'Laundry', 'Steam press', 'Shoe care', 'Toilet cleaning', "Airbnb's cleaning", 'Office cleanup'],
  sigma: ['Unique barcode tags', 'Specialised segregation', 'Wash care instructions', 'Fabric-friendly detergents', 'Steam press', 'Three-stage quality check'],
}
const showcaseImages = [
  ['Clothes', 'https://raw.githubusercontent.com/maina098/coastalYouthParliament/main/WhatsApp%20Image%202026-09-08%20at%2012.22.09%20PM.jpeg'],
  ['Airbnbs', 'https://raw.githubusercontent.com/maina098/coastalYouthParliament/main/WhatsApp%20Image%202026-09-08%20at%2012.44.03%20PM.jpeg'],
  ['Toilet', 'https://raw.githubusercontent.com/maina098/coastalYouthParliament/main/WhatsApp%20Image%202026-09-08%20at%2012.42.16%20PM.jpeg'],
  ['Offices', 'https://raw.githubusercontent.com/maina098/coastalYouthParliament/main/WhatsApp%20Image%202026-09-08%20at%2012.45.59%20PM.jpeg'],
]
const serviceDescriptions = {
  'Dry cleaning': 'Gentle off-site care for everyday and occasion wear.',
  Laundry: 'Wash, fold and finish, just the way you like it.',
  'Steam press': 'Crisp, crease-free garments ready when you are.',
  'Shoe care': 'Expert care for shoes, bags and accessories.',
  'Toilet cleaning': 'Detailed sanitation for a hygienic, fresh bathroom.',
  "Airbnb's cleaning": 'Fast, thorough turnovers ready for your next guest.',
  'Office cleanup': 'A polished, productive workspace for your team.',
}
const serviceImages = {
  'Dry cleaning': 'https://raw.githubusercontent.com/maina098/coastalYouthParliament/main/WhatsApp%20Image%202026-09-08%20at%2012.22.09%20PM.jpeg',
  'Laundry': 'https://raw.githubusercontent.com/maina098/coastalYouthParliament/main/anton-savinov-S6jnHcI2Y-M-unsplash.jpg',
  'Steam press': 'https://raw.githubusercontent.com/maina098/coastalYouthParliament/main/WhatsApp%20Image%202026-09-08%20at%2012.28.17%20PM.jpeg',
  'Shoe care': 'https://raw.githubusercontent.com/maina098/coastalYouthParliament/main/WhatsApp%20Image%202026-09-08%20at%2012.34.49%20PM.jpeg',
  'Toilet cleaning': 'https://raw.githubusercontent.com/maina098/coastalYouthParliament/main/WhatsApp%20Image%202026-09-08%20at%2012.42.16%20PM.jpeg',
  "Airbnb's cleaning": 'https://raw.githubusercontent.com/maina098/coastalYouthParliament/main/WhatsApp%20Image%202026-09-08%20at%2012.44.03%20PM.jpeg',
  'Office cleanup': 'https://raw.githubusercontent.com/maina098/coastalYouthParliament/main/WhatsApp%20Image%202026-09-08%20at%2012.45.59%20PM.jpeg',
}
const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:4000'
const pricing = [
  { service: '2 Bedroom deep clean', unit: 'per visit', price: 5500, description: 'Current guide price for a two-bedroom deep clean.' },
  { service: 'Laundry', unit: 'per kilogram', price: 200, description: 'Standard wash, dry and fold from KSh 200 per kg.' },
  { service: 'Carpet cleaning', unit: 'per square metre', price: 300, description: 'Deep carpet cleaning at KSh 300 per square metre.' },
  { service: 'Small office cleaning', unit: 'per visit', price: 2500, description: 'Up to five rooms, from KSh 2,500 per visit.' },
]
const pricingSections = [
  { title: 'House Cleaning', rows: [
    ['Bed-sitter / Studio', 'KSh 1,500 standard · KSh 2,500 deep clean'],
    ['1 Bedroom', 'KSh 2,500 standard · KSh 3,500 deep clean'],
    ['2 Bedroom', 'KSh 3,500 standard · KSh 5,500 deep clean'],
    ['3 Bedroom', 'KSh 4,800 standard · KSh 6,500 deep clean'],
    ['4 Bedroom', 'KSh 6,000 standard · KSh 9,000 deep clean'],
    ['5 Bedroom', 'KSh 7,500 standard · KSh 11,000 deep clean'],
    ['Large House / Villa', 'From KSh 8,500 standard · From KSh 13,500 deep clean'],
  ] },
  { title: 'Individual Services', rows: [
    ['Kitchen cleaning', 'KSh 1,000-2,000'], ['Bathroom / Washroom', 'KSh 700-1,500'], ['Floor scrubbing', 'From KSh 1,500'],
    ['Window cleaning', 'KSh 150-250 per window'], ['Compound cleaning', 'From KSh 1,500'], ['Balcony cleaning', 'From KSh 500'],
    ['Kitchen appliances', 'From KSh 500 each'], ['Wall cleaning', 'From KSh 1,000'],
  ] },
  { title: 'Carpet & Furniture Cleaning', rows: [
    ['Carpet cleaning', 'KSh 300 per m2'], ['Dining chair', 'KSh 400 each'], ['Office chair', 'KSh 500 each'],
    ['1-seater sofa', 'KSh 500'], ['2-seater sofa', 'KSh 1,000'], ['3-seater sofa', 'KSh 1,500'],
    ['5-seater sofa', 'KSh 2,500'], ['6-seater sofa', 'KSh 3,000'], ['L-shaped sofa', 'From KSh 3,500'],
  ] },
  { title: 'Package Deals', rows: [
    ['Basic Home', 'KSh 3,000 · Dusting, sweeping, mopping, kitchen & bath'],
    ['Premium Home', 'KSh 4,500 · Full deep clean, floor scrub, windows'],
    ['Move-In / Out', 'From KSh 6,000 · Full property deep clean'],
  ] },
  { title: 'Commercial, Office & Laundry', rows: [
    ['Small office (up to 5 rooms)', 'From KSh 2,500 per visit'], ['Medium office (6-15 rooms)', 'From KSh 4,500 per visit'],
    ['Large office (15+ rooms)', 'Quote after inspection'], ['Monthly contract', 'Quote after inspection'],
    ['Event setup & cleanup', 'Quote after inspection'], ['Post-construction', 'Quote after inspection'],
    ['Standard wash, dry & fold', 'KSh 200-250 per kg'], ['Wash, dry, iron & fold', 'KSh 250-300 per kg'],
    ['Express (24-hour)', '+50% surcharge'], ['Commercial bulk', 'Quote after inspection'],
  ] },
]
const testimonials = [
  { quote: 'Safi Squad restored my 3-seater sofa and removed a stain I thought would never go. It looks brand new and the team was very professional!', name: 'Rajab Abdallah', area: 'Old Town, Mvita', initial: 'R' },
  { quote: 'Safi Squad made our office carpets and floor mats spotless within hours. Great office care, clear pricing and dependable timing!', name: 'Khadija Ali', area: 'Kisauni', initial: 'K' },
  { quote: 'My clothes come back fresh, neatly folded and beautifully pressed every time. Safi Squad makes laundry and garment care so easy!', name: 'Emmanuel Maingi', area: 'Changamwe', initial: 'E' },
  { quote: 'The Safi Squad team gave my home a thorough deep clean, including the kitchen and bathroom. Everything felt fresh and carefully finished.', name: 'Mwanaisha Salim', area: 'Nyali', initial: 'M' },
  { quote: 'From windows and the compound to the final tidy-up, Safi Squad handled every detail with care. Excellent service from start to finish!', name: 'Faith Pade', area: 'Liikoni', initial: 'F' },
  { quote: 'Reliable pickup and delivery, careful shoe and garment care, and friendly service throughout. Safi Squad returned everything fresh and ready to use.', name: 'Issa Mwite', area: 'Jomvu', initial: 'I' },
]
const formatMoney = (amount) => `KSh ${Number(amount).toLocaleString()}`

function App() {
  const [content, setContent] = useState(fallbackContent)
  const [menuOpen, setMenuOpen] = useState(false)
  const [bookingOpen, setBookingOpen] = useState(false)
  const [portalOpen, setPortalOpen] = useState(false)
  const [portalLoggedIn, setPortalLoggedIn] = useState(() => localStorage.getItem('safisquad-portal-session') === 'active' && Boolean(localStorage.getItem('safisquad-portal-token')))
  const [portalError, setPortalError] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [bookingError, setBookingError] = useState('')
  const [bookingSubmitting, setBookingSubmitting] = useState(false)
  const [selectedService, setSelectedService] = useState('Dry cleaning')
  const [trackingCode, setTrackingCode] = useState('')
  const [trackedOrder, setTrackedOrder] = useState(null)
  const [trackingError, setTrackingError] = useState('')
  const [orders, setOrders] = useState([])
  const [calculator, setCalculator] = useState([{ service: '2 Bedroom deep clean', quantity: 1 }])
  const [currentPage, setCurrentPage] = useState(() => ({ '/privacy-policy': 'privacy', '/terms': 'terms', '/faq': 'faq' }[window.location.pathname] || 'home'))
  const [cookieConsent, setCookieConsent] = useState(() => localStorage.getItem('cookie-consent') === 'accepted')
  const [showCookieBanner, setShowCookieBanner] = useState(() => !localStorage.getItem('cookie-consent'))
  
  useEffect(() => {
    fetch(`${apiBase}/api/site-content`).then((response) => response.ok ? response.json() : Promise.reject()).then((data) => setContent({ ...fallbackContent, ...data })).catch(() => {})
  }, [])

  useEffect(() => {
    const pageMeta = {
      home: ['Safi Squad | Cleaning and Garment Care in Mombasa', 'Professional cleaning, laundry and garment care in Mombasa with dependable pickup and delivery.', '/'],
      privacy: ['Privacy Policy | Safi Squad', 'How Safi Squad collects, uses and protects information when you book a service.', '/privacy-policy'],
      terms: ['Terms and Conditions | Safi Squad', 'Terms that apply when you use Safi Squad services and website.', '/terms'],
      faq: ['FAQ | Safi Squad Cleaning Services', 'Answers about Safi Squad bookings, service areas, turnaround times and payments.', '/faq'],
    }[currentPage] || null
    if (!pageMeta) return
    document.title = pageMeta[0]
    document.querySelector('meta[name="description"]')?.setAttribute('content', pageMeta[1])
    document.querySelector('link[rel="canonical"]')?.setAttribute('href', `https://safisquad.com${pageMeta[2]}`)
  }, [currentPage])

  useEffect(() => {
    const measurementId = import.meta.env.VITE_GA_MEASUREMENT_ID
    if (!cookieConsent || !measurementId || document.querySelector(`script[data-ga-id="${measurementId}"]`)) return
    window.dataLayer = window.dataLayer || []
    window.gtag = window.gtag || function gtag() { window.dataLayer.push(arguments) }
    window.gtag('js', new Date())
    window.gtag('config', measurementId, { anonymize_ip: true })
    const script = document.createElement('script')
    script.async = true
    script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`
    script.dataset.gaId = measurementId
    document.head.appendChild(script)
  }, [cookieConsent])
  
  const acceptCookies = () => {
    localStorage.setItem('cookie-consent', 'accepted')
    setCookieConsent(true)
    setShowCookieBanner(false)
  }

  const declineCookies = () => {
    localStorage.setItem('cookie-consent', 'declined')
    setCookieConsent(false)
    setShowCookieBanner(false)
  }

  const openPage = (page) => {
    setCurrentPage(page)
    window.history.pushState(null, '', `/${page === 'privacy' ? 'privacy-policy' : page === 'terms' ? 'terms' : 'faq'}`)
  }

  const closePage = () => {
    setCurrentPage('home')
    window.history.pushState(null, '', '/')
  }
  
  const openBooking = (service = 'Dry cleaning') => { setSelectedService(service); setSubmitted(false); setBookingError(''); setBookingOpen(true) }
  const submitBooking = async (event) => { event.preventDefault(); setBookingSubmitting(true); setBookingError(''); try { const formData = new FormData(event.currentTarget); const payload = Object.fromEntries(formData); payload.services = formData.getAll('services'); const response = await fetch(`${apiBase}/api/orders`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.error || 'We could not save your booking. Please try again.'); setTrackedOrder(data.order); setTrackingCode(data.order.tracking_code); setSubmitted(true) } catch (error) { setBookingError(error.message) } finally { setBookingSubmitting(false) } }
  const lookupOrder = async (event) => { event.preventDefault(); setTrackingError(''); setTrackedOrder(null); try { const response = await fetch(`${apiBase}/api/orders/${trackingCode.trim()}`); const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.error || 'We could not find that tracking code.'); setTrackedOrder(data.order) } catch (error) { setTrackingError(error.message) } }
  const portalHeaders = () => { const token = localStorage.getItem('safisquad-portal-token'); return token ? { Authorization: `Bearer ${token}` } : {} }
  const loadOrders = async () => { const response = await fetch(`${apiBase}/api/orders`, { headers: portalHeaders() }); if (response.ok) setOrders((await response.json()).orders) }
  const updateStatus = async (id, status) => { const response = await fetch(`${apiBase}/api/orders/${id}/status`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', ...portalHeaders() }, body: JSON.stringify({ status }) }); if (response.ok) loadOrders() }
  const loginToPortal = async (event) => { event.preventDefault(); const formData = new FormData(event.currentTarget); if (!formData.get('email') || !formData.get('password')) return; const response = await fetch(`${apiBase}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.fromEntries(formData)) }); if (!response.ok) { setPortalError((await response.json()).error || 'Login failed.'); return; } const data = await response.json(); localStorage.setItem('safisquad-portal-session', 'active'); localStorage.setItem('safisquad-portal-token', data.token); setPortalError(''); window.history.replaceState(null, '', '#admin'); setPortalLoggedIn(true); setPortalOpen(true); loadOrders() }
  const logoutPortal = () => { localStorage.removeItem('safisquad-portal-session'); localStorage.removeItem('safisquad-portal-token'); setPortalLoggedIn(false); setPortalOpen(false) }
  const estimate = calculator.reduce((total, item) => { const price = pricing.find((entry) => entry.service === item.service) || pricing[0]; return total + price.price * Math.max(1, Number(item.quantity) || 1) }, 0)
  const addCalculatorLine = () => setCalculator([...calculator, { service: pricing[0].service, quantity: 1 }])
  const updateCalculatorLine = (index, field, value) => setCalculator(calculator.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item))

  return <div className="site-shell">
    <header className="site-header"><a className="logo" href="#top" onClick={() => setCurrentPage('home')}><img src="/logo.jpeg" alt="Safi Squad Logo" className="logo-image" /><strong>safi<span>squad</span></strong></a><button className="menu-toggle" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle navigation" aria-expanded={menuOpen}>☰</button><nav className={menuOpen ? 'site-nav open' : 'site-nav'} role="navigation"><a href="#services">Services</a><a href="#pricing">Pricing</a><a href="https://drive.google.com/file/d/1b7dHZHil5TcrJPlo287xPMug0duB3E7o/view?usp=sharing" target="_blank" rel="noopener noreferrer">Detailed Prices</a><a href="#tracking">Track order</a><a href="#how-it-works">How it works</a><button onClick={() => {openPage('faq'); setMenuOpen(false)}} className="nav-link">FAQ</button><button onClick={() => {openPage('privacy'); setMenuOpen(false)}} className="nav-link">Privacy</button><button className="portal-link" onClick={() => { setPortalOpen(true); if (portalLoggedIn) loadOrders() }} aria-label="Open admin portal">{portalLoggedIn ? 'Admin panel' : 'Portal'}</button><button className="nav-cta" onClick={() => openBooking()} aria-label="Book a pickup service">Book a pickup <span>↗</span></button></nav></header>
    <main id="top">
      <section className="hero"><div className="hero-copy"><p className="kicker">MOMBASA'S HYBRID CLEANING & CARE SERVICE</p><h1>Fresh clothes<br />and environment.<br /><em>Fresh feeling.</em></h1><p className="hero-text">We handle clothes, house, office, toilet, compound - treat garment and surroundings with professional care. Garment care off-site, plus dependable cleaning for homes, Airbnbs and offices on-site.</p><button className="button dark" onClick={() => openBooking()} aria-label="Schedule a pickup for professional cleaning">Schedule a pickup <span>↗</span></button><div className="hero-note"><span>✦</span> Free doorstep pickup and delivery</div></div><div className="hero-visual"><img src="https://raw.githubusercontent.com/maina098/coastalYouthParliament/main/Screenshot%202026-09-06%20004231.jpg" alt="Professional garment care and dry cleaning services ready for delivery" fetchPriority="high" decoding="async" /><div className="floating-card"><strong>5+ years</strong><span>Safi Squad care</span></div></div></section>
      <section className="trust-strip"><p>SAFISQUAD'S HYBRID CLEANING AND GARMENT CARE SERVICE</p><div><strong>5+</strong><span>years of care</span></div><div><strong>{content.cities}</strong><span>subcounties served</span></div><div><strong>{content.stores}+</strong><span>stores across Mombasa</span></div><div><strong>{content.garments}</strong><span>garments weekly</span></div></section>
      <section className="intro section"><div className="section-label">01 / WHAT WE DO</div><div className="intro-grid"><h2>Your precious clothes<br />and environments,<br /><em>our devoted care.</em></h2><div><p>We handle couture, heirlooms and your most treasured garments. Whether it is a cherished saree, a wedding lehenga, or your favourite designer outfit, we treat every garment and surrounding with the care it deserves.</p><a className="arrow-link" href="#how-it-works">Our story <span>↗</span></a></div></div></section>
      <section className="services section" id="services"><div className="section-label">02 / OUR SERVICES</div><div className="section-heading"><h2>Care<br /><em>your way.</em></h2><p>Professional garment care off-site and specialized cleaning services on-site for Airbnbs, toilets and offices.</p></div><div className="service-grid">{content.services.map((service, index) => <article className="service-card" key={service}><span className="service-number">{String(index + 1).padStart(2, '0')}</span><div className="service-art"><img src={serviceImages[service]} alt={service} loading="lazy" decoding="async" style={{width: '100%', height: '100%', objectFit: 'cover'}} /></div><h3>{service}</h3><p>{serviceDescriptions[service] || 'Thoughtful cleaning and care delivered with signature attention.'}</p><button onClick={() => openBooking(service)}>Book this service <span>↗</span></button></article>)}</div></section>
      <section className="pricing-section section" id="pricing"><div className="section-label">02A / CLEAR PRICING</div><div className="section-heading"><h2>Know the cost<br /><em>before you book.</em></h2><p>Updated September 2026 pricing in Kenyan shillings. Variable services are marked clearly and larger jobs may require inspection.</p></div><div className="price-list">{pricingSections.map((section) => <div className="price-group" key={section.title}><h3>{section.title}</h3><div>{section.rows.map(([service, price]) => <article className="price-row" key={service}><strong>{service}</strong><span>{price}</span></article>)}</div></div>)}</div><div className="pricing-notes"><strong>Service rules</strong><span>Free transport within 5km · KSh 50/km beyond</span><span>Minimum call-out: KSh 1,500 · Inspection quotes valid for 14 days</span><span>Monthly contracts: 12% discount with advance payment · New customers: 50% deposit</span><span>Cancellation requires 4 hours notice · Report re-clean requests within 24 hours</span></div><div className="calculator"><div><div className="section-label">QUICK ESTIMATE</div><h3>Build your estimate</h3><p>Use current starting rates for a quick guide. Final quotes apply where noted above.</p><button className="calculator-add" type="button" onClick={addCalculatorLine}>+ Add another service</button></div><div className="calculator-lines">{calculator.map((item, index) => <div className="calculator-line" key={`${item.service}-${index}`}><label>Service<select value={item.service} onChange={(event) => updateCalculatorLine(index, 'service', event.target.value)}>{pricing.map((entry) => <option key={entry.service}>{entry.service}</option>)}</select></label><label>Quantity<input type="number" min="1" value={item.quantity} onChange={(event) => updateCalculatorLine(index, 'quantity', event.target.value)} /></label>{calculator.length > 1 && <button type="button" className="calculator-remove" onClick={() => setCalculator(calculator.filter((_, itemIndex) => itemIndex !== index))} aria-label={`Remove ${item.service}`}>×</button>}</div>)}</div><div className="estimate"><span>Estimated total</span><strong>{formatMoney(estimate)}</strong><small>{calculator.length} service line{calculator.length === 1 ? '' : 's'}</small></div></div></section>
      <section className="tracking-section section" id="tracking"><div className="section-label">02B / ORDER TRACKING</div><div className="tracking-grid"><div><h2>See every step<br /><em>of the journey.</em></h2><p>Enter the tracking code from your booking confirmation to see the live care status.</p><form className="tracking-form" onSubmit={lookupOrder}><input aria-label="Tracking code" required value={trackingCode} onChange={(event) => setTrackingCode(event.target.value)} placeholder="SQ-XXXXXXXX" /><button className="button dark">Track order <span>↗</span></button></form>{trackingError && <p className="form-error" role="alert">{trackingError}</p>}{trackedOrder && <div className="order-result"><strong>{trackedOrder.tracking_code}</strong><span>{trackedOrder.service} · {formatMoney(trackedOrder.estimated_cost)}</span><OrderTimeline status={trackedOrder.status} events={trackedOrder.events} /></div>}</div><div className="trust-panel"><span>YOUR DETAILS STAY VISIBLE</span><h3>One record from booking to delivery.</h3><p>Your address, requested service, estimate and status history are stored together for the care team and customer.</p></div></div></section>
      <section className="split-section" id="how-it-works"><div className="split-image"><img src="/assets/work-img-1.jpg" alt="Safi Squad pickup and delivery process illustration showing how our cleaning service works" /></div><div className="split-copy"><div className="section-label">03 / HOW IT WORKS</div><h2>Clean garments,<br /><em>zero effort.</em></h2><div className="steps"><Step number="01" title="Schedule online" text="Choose pickup and drop-off times that work best for you." /><Step number="02" title="We pick up" text="A Safi Squad agent collects your garments from your doorstep." /><Step number="03" title="We deliver" text="Your garments return clean, fresh and wrinkle-free." /></div><button className="button outline" onClick={() => openBooking()}>Start with a pickup <span>↗</span></button></div></section>
      <section className="care-section section"><div className="section-label">04 / CARE THAT FITS YOU</div><h2>Because every garment<br /><em>has its own story.</em></h2><div className="care-grid"><Care title="Regular" text="Thoughtful care, right on time. Everyday garments handled with signature attention." image="care-img-1.svg" /><Care title="Express" text="When you need it fresh, fast and flawless, for life's last-minute plans." image="care-img-2.svg" /><Care title="Premium" text="For garments that cannot afford shortcuts. Reserved for your most prized pieces." image="care-img-3.svg" /></div></section>
      <section className="sigma section" id="sigmacare"><div className="section-label">05 / THE SAFI SQUAD DIFFERENCE</div><div className="sigma-head"><h2>Experience the nuances of<br /><em>9-step care</em></h2><p>A considered process built around your clothes, so they look better and feel better for longer.</p></div><div className="sigma-list">{content.sigma.map((step, index) => <div key={step}><strong>0{index + 1}</strong><span>{step}</span></div>)}</div></section>
      <section className="garments section" id="garments"><div className="section-label">06 / OUR CLEANING SPACES</div><div className="section-heading"><h2>Every space,<br /><em>beautifully cared for.</em></h2><p>Specialized services for clothes, Airbnbs, toilets and offices.</p></div><div className="garment-grid">{showcaseImages.map(([name, image]) => <button className="garment-card" key={name} onClick={() => openBooking(name)}><img src={image} alt={`${name} cleaning service`} loading="lazy" decoding="async" /><span>{name}</span><small>Explore care ↗</small></button>)}</div></section>
      <section className="quote-section"><p>“We do not deal in loads.”</p><h2>We care<br /><em>by the piece.</em></h2><span>Thousands of customers trust us with their most-loved clothes.</span></section>
      <section className="testimonials-section section" id="testimonials"><div className="section-label">07 / TESTIMONIALS</div><div className="testimonials-heading"><h2>What clients <em>say.</em></h2><p>Real feedback from happy customers across Mombasa County.</p></div><div className="testimonial-grid">{testimonials.map((testimonial) => <article className="testimonial-card" key={testimonial.name}><div className="stars" aria-label="5 out of 5 stars">★★★★★</div><blockquote>“{testimonial.quote}”</blockquote><div className="testimonial-author"><span>{testimonial.initial}</span><div><strong>{testimonial.name}</strong><small>{testimonial.area}</small></div></div></article>)}</div></section>

    </main>
    <footer className="site-footer"><div className="footer-section"><a className="logo" href="#top" onClick={() => setCurrentPage('home')}><img src="/logo.jpeg" alt="Safi Squad Logo" className="logo-image" /><strong>safi<span>squad</span></strong></a><p>Because clothes carry more than just a story.</p><div className="social-share" aria-label="Social media links"><a href="https://www.facebook.com/safisquad" target="_blank" rel="noopener noreferrer" aria-label="Visit Safi Squad on Facebook">f</a><a href="https://www.instagram.com/safisquad" target="_blank" rel="noopener noreferrer" aria-label="Follow Safi Squad on Instagram">Instagram</a><a href="https://twitter.com/safisquad" target="_blank" rel="noopener noreferrer" aria-label="Follow Safi Squad on Twitter">𝕏</a></div></div><div className="footer-section"><h4>Quick Links</h4><ul><li><a href="#services" onClick={() => setMenuOpen(false)}>Services</a></li><li><a href="#pricing" onClick={() => setMenuOpen(false)}>Pricing</a></li><li><a href="https://drive.google.com/file/d/1b7dHZHil5TcrJPlo287xPMug0duB3E7o/view?usp=sharing" target="_blank" rel="noopener noreferrer">Detailed Prices</a></li><li><a href="#how-it-works" onClick={() => setMenuOpen(false)}>How It Works</a></li><li><button onClick={() => openPage('faq')} className="footer-button">FAQ</button></li></ul></div><div className="footer-section"><h4>Get In Touch</h4><ul><li><a href="tel:+254708309425" aria-label="Call us at +254 708 309425">+254 708 309425</a></li><li><a href="mailto:safisquaadcleaningservices@gmail.com" aria-label="Email us">safisquaadcleaningservices@gmail.com</a></li><li>Mombasa, Kenya</li></ul></div><div className="footer-section"><h4>Information</h4><ul><li><button onClick={() => openPage('privacy')} className="footer-button">Privacy Policy</button></li><li><button onClick={() => openPage('terms')} className="footer-button">Terms & Conditions</button></li><li><a href="mailto:safisquaadcleaningservices@gmail.com">Contact Us</a></li></ul></div><div className="footer-bottom"><small>© {new Date().getFullYear()} Safi Squad Cleaning Services Limited. All rights reserved.</small><div className="footer-links"><a href="https://safisquad.com/sitemap.xml" target="_blank" rel="noopener noreferrer">Sitemap</a> | <a href="https://safisquad.com/robots.txt" target="_blank" rel="noopener noreferrer">Robots</a></div></div></footer>
    {portalOpen && <div className="portal-backdrop" onClick={() => setPortalOpen(false)}><div className="portal-modal" onClick={(event) => event.stopPropagation()}><button className="modal-close" onClick={() => setPortalOpen(false)} aria-label="Close portal">×</button>{portalLoggedIn ? <div className="portal-dashboard"><aside className="portal-sidebar"><strong className="portal-brand"><span>S</span> Safi Squad</strong><p>OPERATIONS PORTAL</p><button className="portal-nav-active">▦ Dashboard</button><button onClick={loadOrders}>▤ Orders</button><button>◷ Workflow</button><button>♙ Team</button><button>▥ Settlements</button><button className="portal-logout" onClick={logoutPortal}>Log out</button></aside><main className="portal-main"><div className="portal-topbar"><div><p className="kicker">OPERATIONS OVERVIEW</p><h2>Welcome back,<br /><em>care team.</em></h2></div><span className="portal-role">ADMIN CONSOLE</span></div><div className="portal-stats"><div><span>Active orders</span><strong>{orders.filter((order) => order.status !== 'Delivered').length}</strong></div><div><span>Pending pickup</span><strong>{orders.filter((order) => order.status === 'Pending').length}</strong></div><div><span>QC queue</span><strong>{orders.filter((order) => order.status === 'QC Passed').length}</strong></div></div><section className="portal-order-section"><div className="portal-section-heading"><h3>Recent orders</h3><button onClick={loadOrders}>Refresh ↻</button></div><div className="portal-orders">{orders.length ? orders.map((order) => <article className="admin-order" key={order.id}><div><strong>{order.tracking_code}</strong><span>{order.customer_name} · {order.service}</span><small>{order.address} · {order.preferred_date} · Deposit {formatMoney(order.deposit_paid || 0)}</small></div><select value={order.status} onChange={(event) => updateStatus(order.id, event.target.value)}>{['Pending', 'Picked Up', 'In-Progress', 'QC Passed', 'Out for Delivery', 'Delivered'].map((status) => <option key={status}>{status}</option>)}</select></article>) : <p className="empty-state">No bookings recorded yet.</p>}</div></section><div className="portal-review-card"><span>SETTLEMENTS</span><strong>Weekly payout review gate</strong><p>Calculate and approve payouts before any B2C disbursement is triggered.</p><button>Open settlement review →</button></div><p className="portal-contact">Any queries? Email <a href="mailto:safisquaadcleaningservices@gmail.com">safisquaadcleaningservices@gmail.com</a>.</p></main></div> : <><p className="kicker">TEAM ACCESS</p><h2>Welcome to the<br /><em>SafiCleaners portal.</em></h2><p className="portal-intro">Sign in to view bookings and manage the order journey from pickup to delivery.</p><form className="portal-form" onSubmit={loginToPortal}><label>Email<input required name="email" type="email" placeholder="you@saficleaners.com" /></label><label>Password<input required name="password" type="password" placeholder="Enter your password" /></label>{portalError && <p className="portal-error">{portalError}</p>}<button className="button dark" type="submit">Log in to admin panel <span>↗</span></button></form><p className="portal-contact">Any queries? Email <a href="mailto:safisquaadcleaningservices@gmail.com">safisquaadcleaningservices@gmail.com</a>.</p></>}</div></div>}
    {bookingOpen && <div className="modal-backdrop" onClick={() => setBookingOpen(false)}><div className="booking-modal" onClick={(event) => event.stopPropagation()}><button className="modal-close" onClick={() => setBookingOpen(false)} aria-label="Close">×</button>{submitted ? <div className="success"><span>✓</span><h2>Booking sent to Safi Squad.</h2><p>Your confirmation has been sent to the care team. Tracking code: <strong>{trackingCode}</strong>.</p><button className="button dark" onClick={() => setBookingOpen(false)}>Done</button></div> : <><p className="kicker">DOORSTEP BOOKING</p><h2>Place your order<br /><em>with every detail.</em></h2><p className="booking-intro">All fields marked * are required. We will email your confirmation instantly.</p><form onSubmit={submitBooking}><div className="booking-two-col"><label>Full name *<input required name="name" placeholder="e.g. Jane Wanjiru" /></label><label>Phone / WhatsApp *<input required name="phone" type="tel" placeholder="e.g. 0712 345 678" /></label><label>Email address *<input required name="email" type="email" placeholder="your@email.com" /></label><label>Building / estate name *<input required name="building" placeholder="e.g. Sunrise Apartments" /></label><label>Room / house number *<input required name="room" placeholder="e.g. Room B4 / House 12" /></label><label>Floor / level<input name="floor" placeholder="e.g. Ground Floor, 2nd Floor" /></label><label>Picking date *<input required name="preferredDate" type="date" /></label><label>Preferred picking time *<select required name="preferredTime"><option value="">-- Select picking time --</option><option>8:00 AM - 10:00 AM</option><option>10:00 AM - 12:00 PM</option><option>12:00 PM - 2:00 PM</option><option>2:00 PM - 4:00 PM</option><option>4:00 PM - 6:00 PM</option></select></label></div><fieldset className="service-picker"><legend>Services required *</legend>{[...content.services, ...pricing.map((item) => item.service)].filter((service, index, list) => list.indexOf(service) === index).map((service) => <label key={service}><input type="checkbox" name="services" value={service} defaultChecked={service === selectedService} />{service}</label>)}</fieldset><label>Special instructions / notes<textarea name="details" placeholder="Fragile items, allergies, special care instructions, number of items..." /></label><input type="hidden" name="service" value={selectedService} /><input type="hidden" name="quantity" value="1" /><input type="hidden" name="estimatedCost" value={pricing.find((item) => item.service === selectedService)?.price || 0} />{bookingError && <p className="form-error" role="alert">{bookingError}</p>}<button className="button dark" type="submit" disabled={bookingSubmitting}>{bookingSubmitting ? 'Sending booking...' : 'Confirm booking & send email'} <span>↗</span></button></form></>}</div></div>}
    <a className="whatsapp-float" href="https://wa.me/254708309425?text=Hello%20Safi%20Squad%2C%20I%27d%20like%20to%20book%20a%20pickup." target="_blank" rel="noopener noreferrer" aria-label="Chat with Safi Squad on WhatsApp">☏<span>WhatsApp us</span></a>
    {showCookieBanner && <div className="cookie-banner" role="dialog" aria-modal="true" aria-label="Cookie consent notice"><div className="cookie-content"><h3>We respect your privacy</h3><p>Essential cookies keep bookings working. Optional analytics cookies help us improve the service.</p><div className="cookie-buttons"><button onClick={() => openPage('privacy')} className="cookie-link">Learn more</button><button onClick={declineCookies} className="cookie-decline">Decline optional</button><button onClick={acceptCookies} className="cookie-accept">Accept analytics</button></div></div></div>}
    {currentPage === 'privacy' && <PrivacyPage onClose={closePage} />}
    {currentPage === 'terms' && <TermsPage onClose={closePage} />}
    {currentPage === 'faq' && <FAQPage onClose={closePage} />}
  </div>
}

function Step({ number, title, text }) { return <div className="step"><strong>{number}</strong><div><h3>{title}</h3><p>{text}</p></div></div> }
function Care({ title, text, image }) { return <article className="care-card"><img src={`/assets/${image}`} alt={`${title} cleaning and care service by Safi Squad`} /><h3>{title}</h3><p>{text}</p><a href="#pricing">Choose {title.toLowerCase()} <span>↗</span></a></article> }
function OrderTimeline({ status, events = [] }) { const statuses = ['Pending', 'Picked Up', 'In-Progress', 'QC Passed', 'Out for Delivery', 'Delivered']; const activeIndex = statuses.indexOf(status); return <div className="order-timeline">{statuses.map((item, index) => <div className={index <= activeIndex ? 'timeline-step active' : 'timeline-step'} key={item}><i>{index <= activeIndex ? '✓' : index + 1}</i><span>{item}</span>{events.find((event) => event.status === item) && <small>{new Date(events.find((event) => event.status === item).created_at).toLocaleDateString()}</small>}</div>)}</div> }

function PrivacyPage({ onClose }) {
  return <div className="page-overlay"><div className="page-content"><button onClick={onClose} aria-label="Close privacy policy" className="page-close">×</button><h1>Privacy Policy</h1><p>Last updated: September 8, 2026</p><h2>1. Introduction</h2><p>Safi Squad Cleaning Services Limited ("Company", "we", "our", or "us") operates the website. This page informs you of our policies regarding the collection, use, and disclosure of personal data when you use our Service and the choices you have associated with that data.</p><h2>2. Information Collection and Use</h2><p>We collect several different types of information for various purposes to provide and improve our Service to you.</p><h3>Types of Data Collected:</h3><ul><li><strong>Personal Data:</strong> Name, email, phone number, address, payment information</li><li><strong>Usage Data:</strong> Browser type, IP address, pages visited, time spent on page</li><li><strong>Cookies and Tracking:</strong> We use cookies to enhance user experience</li></ul><h2>3. Use of Data</h2><p>Safi Squad uses the collected data for:</p><ul><li>Providing and maintaining the Service</li><li>Notifying you about changes to the Service</li><li>Processing bookings and payments</li><li>Sending marketing communications (if opted in)</li><li>Analyzing usage patterns</li></ul><h2>4. Security of Data</h2><p>The security of your data is important to us but remember that no method of transmission over the Internet is 100% secure.</p><h2>5. Contact Us</h2><p>If you have questions about this Privacy Policy, please contact us at safisquaadcleaningservices@gmail.com or +254 708 309425</p></div></div>
}

function TermsPage({ onClose }) {
  return <div className="page-overlay"><div className="page-content"><button onClick={onClose} aria-label="Close terms and conditions" className="page-close">×</button><h1>Terms & Conditions</h1><p>Last updated: September 8, 2026</p><h2>1. Agreement to Terms</h2><p>By accessing and using this website, you accept and agree to be bound by the terms and provision of this agreement.</p><h2>2. Use License</h2><p>Permission is granted to temporarily download one copy of the materials (information or software) on Safi Squad's website for personal, non-commercial transitory viewing only. This is the grant of a license, not a transfer of title.</p><h2>3. Disclaimer</h2><p>The materials on Safi Squad's website are provided on an 'as is' basis. Safi Squad makes no warranties, expressed or implied, and hereby disclaims and negates all other warranties including, without limitation, implied warranties or conditions of merchantability, fitness for a particular purpose, or non-infringement of intellectual property or other violation of rights.</p><h2>4. Limitations</h2><p>In no event shall Safi Squad or its suppliers be liable for any damages (including, without limitation, damages for loss of data or profit, or due to business interruption) arising out of the use or inability to use the materials on Safi Squad's website.</p><h2>5. Accuracy of Materials</h2><p>The materials appearing on Safi Squad's website could include technical, typographical, or photographic errors. Safi Squad does not warrant that any of the materials on its website are accurate, complete, or current.</p><h2>6. Modifications</h2><p>Safi Squad may revise these terms of service at any time without notice. By using this website, you are agreeing to be bound by the then current version of these terms of service.</p><h2>7. Contact</h2><p>If you have any questions about these Terms and Conditions, please contact us at safisquaadcleaningservices@gmail.com</p></div></div>
}

function FAQPage({ onClose }) {
  const [expandedIndex, setExpandedIndex] = useState(null)
  const faqs = [
    { q: 'How does Safi Squad work?', a: 'Simply book a pickup online, we collect your items, professionally clean them, and deliver them back to your doorstep.' },
    { q: 'What areas do you serve?', a: 'We serve Mombasa and surrounding subcounties. Check our website for your specific location.' },
    { q: 'How long does cleaning take?', a: 'Dry cleaning typically takes 3-5 working days. Express services available for urgent orders.' },
    { q: 'Do you handle delicate fabrics?', a: 'Yes! We specialize in delicate, premium garments including sarees, lehengas, and designer pieces.' },
    { q: 'What is your pricing?', a: 'Pricing varies by service. Visit our Pricing section or download our detailed price list from the link in the header.' },
    { q: 'How can I track my order?', a: 'Use your tracking code in our order tracking section to see real-time updates of your booking.' },
    { q: 'Is there a minimum order?', a: 'No minimum order required. You can book a single item or multiple items.' },
    { q: 'What payment methods do you accept?', a: 'We accept M-Pesa, bank transfers, and cash on pickup/delivery. Contact us for more details.' }
  ]
  return <div className="page-overlay"><div className="page-content"><button onClick={onClose} aria-label="Close FAQ" className="page-close">×</button><h1>Frequently Asked Questions</h1><div className="faq-list">{faqs.map((faq, idx) => <div key={idx} className="faq-item"><button className="faq-question" onClick={() => setExpandedIndex(expandedIndex === idx ? null : idx)} aria-expanded={expandedIndex === idx}>{faq.q}<span>{expandedIndex === idx ? '−' : '+'}</span></button>{expandedIndex === idx && <div className="faq-answer"><p>{faq.a}</p></div>}</div>)}</div><div className="faq-cta"><p>Can't find your answer?</p><a href="mailto:safisquaadcleaningservices@gmail.com" className="button dark">Contact Us</a></div></div></div>
}
export default App
