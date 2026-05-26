// Foundation system — refined, microinteractions, scroll reveals
const { useState, useEffect, useRef, useCallback } = React;

// === Hooks ===
const useScrollProgress = () => {
  const [p, setP] = useState(0);
  useEffect(() => {
    const onScroll = () => {
      const h = document.documentElement;
      const max = h.scrollHeight - h.clientHeight;
      setP(max > 0 ? Math.min(1, h.scrollTop / max) : 0);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return p;
};

const useReveal = () => {
  const ref = useRef(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!ref.current) return;
    const io = new IntersectionObserver((es) => {
      es.forEach(e => { if (e.isIntersecting) { setShown(true); io.disconnect(); }});
    }, { threshold: 0.15, rootMargin: '0px 0px -8% 0px' });
    io.observe(ref.current);
    return () => io.disconnect();
  }, []);
  return [ref, shown];
};

const Reveal = ({ children, delay = 0, as = 'div', className = '', ...rest }) => {
  const [ref, shown] = useReveal();
  const Tag = as;
  return (
    <Tag ref={ref} className={`reveal ${shown ? 'is-in' : ''} ${className}`} style={{ transitionDelay: `${delay}ms` }} {...rest}>
      {children}
    </Tag>
  );
};

// Animated counter
const useCountUp = (target, run) => {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!run) return;
    const num = parseFloat(String(target).replace(/[^\d.]/g, '')) || 0;
    const dur = 1400;
    const t0 = performance.now();
    let raf;
    const step = (t) => {
      const k = Math.min(1, (t - t0) / dur);
      const ease = 1 - Math.pow(1 - k, 3);
      setV(num * ease);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, run]);
  return v;
};

const FoundationSystem = () => {
  const [joinOpen, setJoinOpen] = useState(false);
  const [activeProgram, setActiveProgram] = useState(0);
  const [tab, setTab] = useState('all');
  const [page, setPage] = useState(1);
  const [navScrolled, setNavScrolled] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [mapSvg, setMapSvg] = useState('');
  const sp = useScrollProgress();
  const heroRef = useRef(null);
  const [mouse, setMouse] = useState({ x: 0.5, y: 0.5 });

  useEffect(() => {
    const onScroll = () => setNavScrolled(window.scrollY > 24);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    fetch('uploads/mapa latam.svg')
      .then(r => r.text())
      .then(svg => setMapSvg(svg))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const RSS = 'https://rss.beehiiv.com/feeds/NRVrKCDABF.xml';
    const proxies = [
      '',
      'https://api.allorigins.win/raw?url=',
      'https://corsproxy.io/?url=',
      'https://thingproxy.freeboard.io/fetch/',
    ];

    const tagFor = (cat = '') => {
      if (/\bia\b|inteligencia|gpt|gemini|claude|llm/i.test(cat)) return 'ai';
      if (/blockchain|stellar|crypto|defi|bitcoin|web3/i.test(cat)) return 'blk';
      if (/govern|gobern/i.test(cat)) return 'gov';
      return 'fld';
    };
    const fmtDate = (str) => {
      const d = new Date(str);
      return isNaN(d) ? str : d.toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' });
    };
    const getText = (el, tag) => el.getElementsByTagName(tag)[0]?.textContent?.trim() || '';

    const fetchXml = async () => {
      for (const proxy of proxies) {
        try {
          const url = proxy ? proxy + encodeURIComponent(RSS) : RSS;
          const r = await fetch(url);
          if (!r.ok) continue;
          const t = await r.text();
          if (t.includes('<item>')) return t;
        } catch {}
      }
      return null;
    };

    fetchXml().then(xml => {
      if (!xml) return;
      const doc = new DOMParser().parseFromString(xml, 'text/xml');
      const mapped = Array.from(doc.querySelectorAll('item')).map((item, i) => {
        const title = getText(item, 'title');
        const description = getText(item, 'description');
        const link = getText(item, 'link');
        const date = fmtDate(getText(item, 'pubDate'));
        const cats = Array.from(item.getElementsByTagName('category')).map(c => c.textContent.trim());
        const kind = cats[0] || 'Field notes';
        const enc = item.getElementsByTagName('enclosure')[0];
        const thumbnail = enc?.getAttribute('url') || undefined;
        return { id: i + 1, title, excerpt: description, link, date, kind, tag: tagFor(kind), thumbnail, feat: i === 0 };
      });
      setArticlesAll(mapped);
    });
  }, []);

  useEffect(() => {
    if (window.twttr?.widgets) {
      window.twttr.widgets.load();
    } else {
      const s = document.createElement('script');
      s.src = 'https://platform.twitter.com/widgets.js';
      s.charset = 'utf-8';
      s.async = true;
      document.head.appendChild(s);
    }
    if (window.instgrm?.Embeds) {
      window.instgrm.Embeds.process();
    } else {
      const s = document.createElement('script');
      s.src = '//www.instagram.com/embed.js';
      s.async = true;
      s.onload = () => window.instgrm?.Embeds.process();
      document.body.appendChild(s);
    }
  }, []);

  const onHeroMove = useCallback((e) => {
    const r = heroRef.current?.getBoundingClientRect();
    if (!r) return;
    setMouse({ x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height });
  }, []);

  const programs = [
    { code: '01', title: 'Cooperative education', body: 'Quarterly cohorts on blockchain, AI, and decentralized economics. Full scholarships for students from public universities across Latin America.', stat: 847, statLabel: 'active students', img: 'uploads/cooperative education.jpg' },
    { code: '02', title: 'Project incubation', body: 'We accompany founding teams in building digitally-native cooperatives, with legal, technical, and governance mentorship over 6-month residencies.', stat: 23, statLabel: 'projects incubated', img: 'uploads/project incubation.jpg' },
    { code: '03', title: 'Public research', body: 'We publish open research on data sovereignty, cooperative organizational models, and policy for digital economies in the Global South.', stat: 14, statLabel: 'papers published', img: 'uploads/public research.jpg' },
  ];

  const [articlesAll, setArticlesAll] = useState([
    { id: 1, kind: 'Research', tag: 'res', read: '10 min read', date: '04 May 2026', title: 'On data sovereignty: a cooperative reading of the Global South\'s digital infrastructure.', excerpt: 'A long-form essay on why the next decade of digital policy in Latin America will be defined less by what platforms we use and more by who owns the rails underneath them.', author: 'Sofía Aravena · with C. Restrepo', role: 'Council · Treasury & Research', feat: true },
    { id: 2, kind: 'Field notes', tag: 'fld', read: '6 min read', date: '02 May', title: 'Cohort 04, week one: what 23 students taught us about cooperative pedagogy.' },
    { id: 3, kind: 'Governance', tag: 'gov', read: '8 min read', date: '28 Apr', title: 'Drafting our first cooperative charter: how 412 members shaped the founding document.' },
    { id: 4, kind: 'Research', tag: 'res', read: '12 min read', date: '22 Apr', title: 'Mapping cooperative AI: a directory of 47 LATAM projects building outside Big Tech.' },
  ]);
  const TAB_FILTERS = { 'all': null, 'blockchain': 'blk', 'ia': 'ai', 'newsletter': 'fld' };
  const articles = TAB_FILTERS[tab] ? articlesAll.filter(a => a.tag === TAB_FILTERS[tab]) : articlesAll;
  const PER_PAGE = 6;
  const totalPages = Math.max(1, Math.ceil(articles.length / PER_PAGE));
  const pageArticles = articles.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const partners = [
    { name: 'Stellar Foundation', logo: 'uploads/Stellar.svg' },
    { name: 'Filecoin', logo: 'uploads/Filecoin.svg' },
    { name: 'Ethereum', logo: 'uploads/Ethereum_logo.svg' },
    { name: 'Avalanche', logo: 'uploads/Avalanche_Blockchain_Logo.svg' },
    { name: 'PizzaDAO', logo: 'uploads/pizzaDao-Logo.svg' },
    { name: 'IdeaUFRO', logo: 'uploads/IdeaUfro.svg' },
  ];

  const playlists = [
    { title: 'Hola Stellar — Aprende Stellar desde cero', list: 'PLLgyZ3kOWK4O-Lp1oRBUWGGbuW9ksLQc-', vid: 'RfRx7C5twi0' },
    { title: 'Guía Completa de Stellar Quest', list: 'PLLgyZ3kOWK4OfidwhewcUJOsr2WG3j0nv', vid: '-rSLo0rioaM' },
    { title: 'Talleres', list: 'PLLgyZ3kOWK4MJeY7lqpYJ91K5kYSTqj5z', vid: 'X2md53SSNOA' },
    { title: 'Charlas Educativas', list: 'PLLgyZ3kOWK4MZk7iDpfQfwDLNtD5VPeX8', vid: 'hLtreVEM1yo' },
    { title: 'Charlas Stellares', list: 'PLLgyZ3kOWK4MkXrQni_xlO9B9Wi9sRoSx', vid: 'poGbTGRE0Nw' },
    { title: 'Introducción a Tellus Cooperative', list: 'PLLgyZ3kOWK4PZ33fsUOJa6PtLI8Rv0Itw', vid: '3erjjWHErAo' },
    { title: 'InstaWards', list: 'PLLgyZ3kOWK4Og0k1cTBJHCNc975drI5ru', vid: 'H9N3xA8eRII' },
  ];

  return (
    <div className="fs-root">
      {/* Scroll progress bar */}
      <div className="fs-scroll-bar" style={{ transform: `scaleX(${sp})` }}></div>

      {/* NAV */}
      <nav className={`fs-nav ${navScrolled ? 'is-scrolled' : ''}`}>
        <div className="fs-nav-inner">
          <a className="fs-mark" href="#" aria-label="Tellus Cooperative home">
            <img src="uploads/tellus.svg" alt="Tellus Cooperative" className="fs-mark-img" />
          </a>
          <div className="fs-nav-links">
            {['Programs', 'Chapters', 'Articles', 'Courses', 'Governance', 'About'].map(l => (
              <a key={l} href={`#${l.toLowerCase()}`}>
                <span>{l}</span>
                <span className="fs-nav-underline" aria-hidden="true"></span>
              </a>
            ))}
            <button className="fs-btn-pill-sm" onClick={() => setJoinOpen(true)}>
              <span>Join</span>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6h8M6 2l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
          </div>
          <button
            className={`fs-nav-burger ${mobileNavOpen ? 'is-open' : ''}`}
            onClick={() => setMobileNavOpen(!mobileNavOpen)}
            aria-label="Menu"
          >
            <span></span><span></span><span></span>
          </button>
        </div>
        <div className={`fs-nav-mobile ${mobileNavOpen ? 'is-open' : ''}`}>
          {['Programs', 'Chapters', 'Articles', 'Governance', 'About'].map(l => (
            <a key={l} href={`#${l.toLowerCase()}`} onClick={() => setMobileNavOpen(false)}>{l}</a>
          ))}
          <button className="fs-btn-primary" onClick={() => { setMobileNavOpen(false); setJoinOpen(true); }}>
            <span>Join the cooperative</span>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 7h10M7 2l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
        </div>
      </nav>

      {/* HERO */}
      <section className="fs-hero" ref={heroRef} onMouseMove={onHeroMove}>
        <div className="fs-hero-grid">
          <div className="fs-hero-text">
            <Reveal className="fs-hero-eye">
              <span className="fs-eye-dot" aria-hidden="true"></span>
              <span className="eyebrow">Latin American Cooperative · est. 2024</span>
            </Reveal>
            <h1 className="fs-h1">
              <Reveal delay={50} as="span" className="fs-h1-line">Let's build a better future.</Reveal>
              <Reveal delay={250} as="span" className="fs-h1-line"><em>Together.</em></Reveal>
            </h1>
            <Reveal delay={450}>
              <p className="fs-lede">
                Learn about blockchain, artificial intelligence, and other tools
                for entrepreneurship — from a cooperative, open, and collectively-owned
                organization.
              </p>
            </Reveal>
            <Reveal delay={600}>
              <div className="fs-hero-cta">
                <button className="fs-btn-primary" onClick={() => setJoinOpen(true)}>
                  <span>Join the cooperative</span>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 7h10M7 2l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </button>
                <a className="fs-btn-secondary" href="#programs">
                  <span>See programs</span>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 9l6-6M4 3h5v5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </a>
              </div>
            </Reveal>
          </div>
          <Reveal delay={300} className="fs-hero-figure-wrap">
            <div className="fs-hero-figure">
              {mapSvg && (
                <div
                  className="fs-hero-map"
                  dangerouslySetInnerHTML={{ __html: mapSvg }}
                />
              )}
            </div>
          </Reveal>
        </div>
        <div className="fs-hero-marquee" aria-hidden="true">
          <div className="fs-marquee-track">
            {Array(2).fill(0).map((_, i) => (
              <div key={i} className="fs-marquee-row">
                <span>Santiago</span><span>·</span><span>Mexico City</span><span>·</span><span>São Paulo</span><span>·</span>
                <span>Buenos Aires</span><span>·</span><span>Bogotá</span><span>·</span><span>Lima</span><span>·</span>
                <span>Montevideo</span><span>·</span><span>Quito</span><span>·</span><span>Medellín</span><span>·</span>
                <span>Porto Alegre</span><span>·</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* STATS */}
      <Reveal as="section" className="fs-stats-strip">
        <Stat num={847} label="active members" />
        <Stat num={12} label="chapters across LATAM" />
        <Stat num={23} label="projects in residency" />
        <Stat num={100} suffix="%" unit="open & cooperative" />
      </Reveal>

      {/* MISSION SLAB */}
      <section className="fs-slab" id="about">
        <div className="fs-slab-bg" aria-hidden="true"></div>
        <div className="fs-slab-inner">
          <div className="fs-slab-grid">
            <Reveal>
              <div className="eyebrow on-teal">Our mission</div>
              <p className="fs-slab-text">
                We build cooperative infrastructure so that Latin American
                communities can <em>access</em>, <em>learn</em>, and <em>co-own</em> the technologies
                redrawing the digital economy.
              </p>
              <div className="fs-slab-meta">
                <span>Manifesto v2 · 2026</span>
                <a href="#" className="fs-slab-link">
                  <span>Read the full document</span>
                  <span className="fs-arrow">→</span>
                </a>
              </div>
            </Reveal>
            <Reveal delay={150} className="fs-slab-figure">
              <img src="uploads/3 PLANETAS.svg" alt="Three planets illustration" style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
              <div className="fs-slab-figure-overlay" aria-hidden="true"></div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* PARTNERS */}
      <section id="partners" className="fs-partners">
        <Reveal className="fs-section-head">
          <div className="eyebrow">Institutional partners</div>
          <h2 className="fs-h2">We build in good company.</h2>
        </Reveal>
        <div className="fs-partners-ticker" aria-hidden="true">
          <div className="fs-partners-track">
            {[...partners, ...partners, ...partners].map((p, i) => (
              <div key={i} className="fs-partner-item">
                <img src={p.logo} alt={p.name} className="fs-partner-logo" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PROGRAMS */}
      <section id="programs" className="fs-programs">
        <Reveal className="fs-section-head">
          <div className="eyebrow">Three programs</div>
          <h2 className="fs-h2">What we do, today.</h2>
          <p className="fs-section-sub">
            Three concurrent tracks. Members can join any combination, and contribute
            governance time across all of them.
          </p>
        </Reveal>
        <div className="fs-programs-grid">
          {programs.map((p, i) => (
            <Reveal
              key={i}
              delay={i * 120}
              as="article"
              className={`fs-program-card ${activeProgram === i ? 'is-active' : ''}`}
              onMouseEnter={() => setActiveProgram(i)}
            >
              <div className="fs-program-img">
                <img src={p.img} alt={p.title} className="fs-program-photo" />
                <span className="fs-program-num-overlay">{p.code}</span>
              </div>
              <div className="fs-program-inner">
                <h3 className="fs-program-title">{p.title}</h3>
                <p className="fs-program-body">{p.body}</p>
                <div className="fs-program-stat">
                  <CountStat target={p.stat} label={p.statLabel} />
                </div>
                <a className="fs-program-link" href="#">
                  <span>Learn more</span>
                  <span className="fs-arrow">→</span>
                </a>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* HIGHLIGHTED ARTICLES */}
      <section id="articles" className="fs-articles">
        <Reveal className="fs-section-head fs-articles-head">
          <div>
            <div className="eyebrow">Highlighted articles</div>
            <h2 className="fs-h2">Reading from the cooperative.</h2>
          </div>
          <div className="fs-articles-tabs" role="tablist">
            {['all', 'blockchain', 'ia', 'newsletter'].map(t => (
              <button key={t} className={`fs-art-tab ${tab === t ? 'is-on' : ''}`} onClick={() => { setTab(t); setPage(1); }}>
                <span>{t}</span>
              </button>
            ))}
          </div>
        </Reveal>

        <div className="fs-articles-grid" key={`${tab}-${page}`}>
          {pageArticles.map((a, i) => (
            <Reveal key={a.id} delay={i * 50}>
              <a
                href={a.link || '#'}
                target={a.link ? '_blank' : undefined}
                rel="noopener noreferrer"
                className="fs-article fs-article-card"
              >
                <div className={`fs-article-img${a.thumbnail ? '' : ' fs-article-img--no-thumb'}`}>
                  {a.thumbnail
                    ? <img src={a.thumbnail} alt={a.title} className="fs-article-thumb" />
                    : <div className="fs-article-img-placeholder"><span className="fs-article-img-initial">{a.title?.charAt(0)}</span></div>
                  }
                  <span className={`fs-article-tag fs-tag-${a.tag}`}>{a.kind}</span>
                </div>
                <div className="fs-article-body">
                  <div className="mono fs-article-meta">{a.date}</div>
                  <h3 className="fs-article-title">{a.title}</h3>
                  {a.excerpt && <p className="fs-article-excerpt">{a.excerpt}</p>}
                </div>
              </a>
            </Reveal>
          ))}
        </div>

        {totalPages > 1 && (() => {
          const windowSize = 5;
          let start = Math.max(1, page - Math.floor(windowSize / 2));
          let end = Math.min(totalPages, start + windowSize - 1);
          if (end - start + 1 < windowSize) start = Math.max(1, end - windowSize + 1);
          const pageNums = Array.from({ length: end - start + 1 }, (_, i) => start + i);
          return (
          <div className="fs-articles-foot">
            <div className="fs-pagination">
              <button
                className={`fs-page-btn fs-page-arrow${page === 1 ? ' is-disabled' : ''}`}
                onClick={() => { if (page > 1) { setPage(page - 1); document.querySelector('#articles')?.scrollIntoView({ behavior: 'smooth' }); } }}
                disabled={page === 1}
                aria-label="Previous page"
              >←</button>
              {pageNums.map(p => (
                <button
                  key={p}
                  className={`fs-page-btn ${page === p ? 'is-on' : ''}`}
                  onClick={() => { setPage(p); document.querySelector('#articles')?.scrollIntoView({ behavior: 'smooth' }); }}
                >
                  {p}
                </button>
              ))}
              <button
                className={`fs-page-btn fs-page-arrow${page === totalPages ? ' is-disabled' : ''}`}
                onClick={() => { if (page < totalPages) { setPage(page + 1); document.querySelector('#articles')?.scrollIntoView({ behavior: 'smooth' }); } }}
                disabled={page === totalPages}
                aria-label="Next page"
              >→</button>
            </div>
          </div>
        );})()}
      </section>

      {/* YOUTUBE COURSES */}
      <section id="courses" className="fs-courses">
        <Reveal className="fs-section-head fs-courses-head">
          <div>
            <div className="eyebrow">Learn with us</div>
            <h2 className="fs-h2">Courses on YouTube.</h2>
          </div>
          <a className="fs-btn-secondary" href="https://www.youtube.com/@telluscoop/playlists" target="_blank" rel="noopener noreferrer">
            View all ↗
          </a>
        </Reveal>
        <div className="fs-courses-grid">
          <Reveal delay={0} className="fs-course-feat-wrap">
            <a
              className="fs-course-feat"
              href={`https://www.youtube.com/playlist?list=${playlists[0].list}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <div className="fs-course-feat-img">
                <img src={`https://i.ytimg.com/vi/${playlists[0].vid}/hqdefault.jpg`} alt={playlists[0].title} />
                <div className="fs-course-play-btn">
                  <svg viewBox="0 0 24 24" fill="currentColor" width="36" height="36"><path d="M8 5v14l11-7z"/></svg>
                </div>
                <span className="fs-course-feat-badge">YouTube · Playlist</span>
              </div>
              <div className="fs-course-feat-body">
                <h3 className="fs-course-feat-title">{playlists[0].title}</h3>
                <span className="fs-course-feat-cta">View playlist <span className="fs-arrow">→</span></span>
              </div>
            </a>
          </Reveal>
          <div className="fs-course-side-stack">
            {playlists.slice(1).map((p, i) => (
              <Reveal key={i} delay={i * 60}>
                <a
                  className="fs-course-side"
                  href={`https://www.youtube.com/playlist?list=${p.list}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <div className="fs-course-side-img">
                    <img src={`https://i.ytimg.com/vi/${p.vid}/hqdefault.jpg`} alt={p.title} loading="lazy" />
                  </div>
                  <div className="fs-course-side-body">
                    <span className="fs-course-tag">YouTube · Playlist</span>
                    <h4 className="fs-course-side-title">{p.title}</h4>
                  </div>
                </a>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* SOCIAL WALL */}
      <section className="fs-wall">
        <Reveal className="fs-section-head fs-wall-head">
          <div>
            <div className="eyebrow">Live from the cooperative</div>
            <h2 className="fs-h2">From the field.</h2>
          </div>
          <div className="fs-wall-handles">
            <a className="fs-handle" href="https://x.com/TellusCoop" target="_blank" rel="noopener noreferrer"><span className="fs-handle-ico fs-handle-x">𝕏</span><span>@TellusCoop</span></a>
            <a className="fs-handle" href="https://www.instagram.com/telluscoop/" target="_blank" rel="noopener noreferrer"><span className="fs-handle-ico fs-handle-ig"><img src="uploads/Instagram_icon-icons.com_66804.svg" alt="Instagram" style={{width:'16px',height:'16px',display:'block'}} /></span><span>@telluscoop</span></a>
            <a className="fs-handle" href="https://www.youtube.com/@telluscoop" target="_blank" rel="noopener noreferrer"><span className="fs-handle-ico fs-handle-yt"><img src="uploads/3721679-youtube_108064.svg" alt="YouTube" style={{width:'16px',height:'16px',display:'block'}} /></span><span>@telluscoop</span></a>
            <a className="fs-handle" href="https://www.linkedin.com/company/tellus-cooperative/" target="_blank" rel="noopener noreferrer"><span className="fs-handle-ico fs-handle-li"><img src="uploads/linkedin_icon-icons.com_65929.svg" alt="LinkedIn" style={{width:'16px',height:'16px',display:'block'}} /></span><span>tellus-cooperative</span></a>
          </div>
        </Reveal>

        <div className="fs-tweets-grid">
          {[
            { url: 'https://twitter.com/Stellar_Chile/status/2039151468893093980', label: 'Programa de Embajadores Stellar Chile' },
            { url: 'https://twitter.com/TellusCoop/status/2030682502063439923', label: 'Embajadores en Colombia' },
            { url: 'https://twitter.com/TellusCoop/status/2028927037713297638', label: 'Stellar Barrio — cowork Santiago' },
            { url: 'https://twitter.com/TellusCoop/status/2016526731960553968', label: 'Hola Stellar — cursos en YouTube' },
          ].map((t, i) => (
            <Reveal key={i} delay={i * 80} className="fs-tweet-wrap">
              <blockquote className="twitter-tweet" data-dnt="true" data-lang="es">
                <a href={t.url}>{t.label}</a>
              </blockquote>
            </Reveal>
          ))}
          {[
            'https://www.instagram.com/p/DL0hWBYxX8Q/?img_index=1',
            'https://www.instagram.com/p/DJlCF_4R-qC/?img_index=2',
          ].map((url, i) => (
            <Reveal key={`ig-${i}`} delay={i * 80} className="fs-tweet-wrap">
              <blockquote
                className="instagram-media"
                data-instgrm-captioned
                data-instgrm-permalink={url}
                data-instgrm-version="14"
                style={{ background: '#FFF', border: 0, borderRadius: 3, margin: '0 auto', maxWidth: 540, width: 'calc(100% - 2px)' }}
              >
                <a href={url}>View post on Instagram</a>
              </blockquote>
            </Reveal>
          ))}
        </div>

        <div className="fs-wall-foot">
          <a className="fs-wall-cta">
            <span>Follow the cooperative</span>
            <span className="fs-arrow">→</span>
          </a>
        </div>
      </section>

      {/* CTA */}
      <section className="fs-cta">
        <div className="fs-cta-bg" aria-hidden="true">
          <span></span><span></span><span></span>
        </div>
        <Reveal>
          <h2 className="fs-h2 fs-cta-h">Ready to build<br/><em>with us?</em></h2>
        </Reveal>
        <Reveal delay={150}>
          <p className="fs-cta-sub">Membership is free, open, and takes 90 seconds.</p>
        </Reveal>
        <Reveal delay={300}>
          <button className="fs-btn-primary fs-btn-lg" onClick={() => setJoinOpen(true)}>
            <span>Join the cooperative</span>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 7h10M7 2l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
        </Reveal>
      </section>

      {/* FOOTER */}
      <footer className="fs-footer">
        <div className="fs-footer-grid">
          <div className="fs-footer-brand">
            <a className="fs-mark">
              <img src="uploads/tellus.svg" alt="Tellus Cooperative" className="fs-mark-img" />
            </a>
            <p>A Latin American cooperative for shared learning and digital civic infrastructure.</p>
            <div className="fs-footer-status">
              <span className="fs-status-dot" aria-hidden="true"></span>
              <span className="mono">Cohort 04 · open · 04 May 2026</span>
            </div>
          </div>
          <div>
            <div className="eyebrow">Programs</div>
            <ul><li><a href="#">Education</a></li><li><a href="#">Incubation</a></li><li><a href="#">Research</a></li></ul>
          </div>
          <div>
            <div className="eyebrow">Cooperative</div>
            <ul><li><a href="#">Chapters</a></li><li><a href="#">Governance</a></li><li><a href="#">Members</a></li></ul>
          </div>
          <div>
            <div className="eyebrow">About</div>
            <ul><li><a href="#">Manifesto</a></li><li><a href="#">Team</a></li><li><a href="#">Contact</a></li></ul>
          </div>
        </div>
        <div className="fs-footer-base">
          <span>© 2026 Tellus Cooperative · Santiago · Mexico City · São Paulo</span>
          <span>CC BY-SA 4.0</span>
        </div>
      </footer>

      {joinOpen && <JoinModal onClose={() => setJoinOpen(false)} />}
    </div>
  );
};

const CountStat = ({ target, label }) => {
  const [ref, shown] = useReveal();
  const v = useCountUp(target, shown);
  const display = target % 1 !== 0 ? v.toFixed(1) : Math.round(v).toLocaleString();
  return (
    <div ref={ref} className="fs-program-stat-inner">
      <span className="fs-program-num-big">{display}</span>
      <span className="eyebrow">{label}</span>
    </div>
  );
};

const Stat = ({ num, suffix = '', label, unit, decimals = 0 }) => {
  const [ref, shown] = useReveal();
  const v = useCountUp(num, shown);
  const display = decimals > 0 ? v.toFixed(decimals) : Math.round(v).toLocaleString();
  return (
    <div ref={ref} className="fs-stat">
      <div className="fs-stat-num">
        <span>{display}</span>
        {suffix && <span className="fs-stat-suffix">{suffix}</span>}
      </div>
      <div className="eyebrow">{unit || label}</div>
    </div>
  );
};

const JoinModal = ({ onClose }) => {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({ name: '', email: '', country: 'CL', interest: 'education' });

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fs-modal-bg" onClick={onClose}>
      <div className="fs-modal" onClick={e => e.stopPropagation()}>
        <button className="fs-modal-close" onClick={onClose} aria-label="Close">×</button>
        <div className="fs-modal-progress">
          <div className="fs-modal-progress-fill" style={{ width: `${((step + 1) / 3) * 100}%` }}></div>
        </div>
        {step === 0 && (
          <div className="fs-modal-step">
            <div className="eyebrow">Step 1 of 2</div>
            <h3 className="fs-modal-h">Join Tellus.</h3>
            <p className="fs-modal-lede">Membership is free and open. We just need a few details to assign you to your local chapter.</p>
            <label className="fs-field">
              <span>Full name</span>
              <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="María González" autoFocus />
            </label>
            <label className="fs-field">
              <span>Email</span>
              <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} placeholder="maria@example.com" />
            </label>
            <label className="fs-field">
              <span>Country</span>
              <select value={form.country} onChange={e => setForm({...form, country: e.target.value})}>
                <option value="CL">Chile</option><option value="MX">Mexico</option><option value="BR">Brazil</option>
                <option value="AR">Argentina</option><option value="CO">Colombia</option><option value="PE">Peru</option>
                <option value="UY">Uruguay</option><option value="EC">Ecuador</option>
              </select>
            </label>
            <button className="fs-btn-primary fs-modal-btn" disabled={!form.name || !form.email} onClick={() => setStep(1)}>
              <span>Next</span>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 7h10M7 2l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
          </div>
        )}
        {step === 1 && (
          <div className="fs-modal-step">
            <div className="eyebrow">Step 2 of 2</div>
            <h3 className="fs-modal-h">What interests you?</h3>
            <p className="fs-modal-lede">Pick one entry path. You can join others afterwards.</p>
            {[
              { id: 'education', title: 'Cooperative education', sub: 'Quarterly cohorts · next May 14' },
              { id: 'incubation', title: 'Project incubation', sub: 'Applications open · 8 spots' },
              { id: 'research', title: 'Public research', sub: 'Monthly reading groups' },
              { id: 'chapter', title: 'Open a chapter', sub: 'Your city is not on the map yet' },
            ].map(opt => (
              <label key={opt.id} className={`fs-radio ${form.interest === opt.id ? 'is-on' : ''}`}>
                <input type="radio" name="interest" checked={form.interest === opt.id} onChange={() => setForm({...form, interest: opt.id})} />
                <div>
                  <div className="fs-radio-title">{opt.title}</div>
                  <div className="fs-radio-sub">{opt.sub}</div>
                </div>
                <span className="fs-radio-check" aria-hidden="true">
                  <svg viewBox="0 0 14 14" width="14" height="14"><path d="M2 7l3 3 7-7" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </span>
              </label>
            ))}
            <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
              <button className="fs-btn-secondary" onClick={() => setStep(0)}>← Back</button>
              <button className="fs-btn-primary fs-modal-btn" onClick={() => setStep(2)} style={{ flex: 1 }}>
                <span>Submit</span>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 7h10M7 2l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
            </div>
          </div>
        )}
        {step === 2 && (
          <div className="fs-modal-step fs-modal-success">
            <div className="fs-modal-check" aria-hidden="true">
              <svg viewBox="0 0 48 48" width="48" height="48">
                <circle cx="24" cy="24" r="22" fill="none" stroke="currentColor" strokeWidth="1.5" className="fs-check-c"/>
                <path d="M14 24l7 7 14-14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="fs-check-p"/>
              </svg>
            </div>
            <h3 className="fs-modal-h">You're part of Tellus.</h3>
            <p className="fs-modal-lede">
              We sent an email to <strong>{form.email}</strong> with your cooperative
              credential and next steps for your chapter.
            </p>
            <div className="fs-receipt">
              <div><span className="eyebrow">Member</span><span>{form.name}</span></div>
              <div><span className="eyebrow">Chapter</span><span>{form.country} · auto-assigned</span></div>
              <div><span className="eyebrow">Track</span><span>{form.interest}</span></div>
              <div><span className="eyebrow">ID</span><span style={{ fontFamily: 'var(--mono)' }}>TC-2026-0848</span></div>
            </div>
            <button className="fs-btn-primary fs-modal-btn" onClick={onClose}>Close</button>
          </div>
        )}
      </div>
    </div>
  );
};

window.FoundationSystem = FoundationSystem;
