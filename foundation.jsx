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
    { code: '01', title: 'Cooperative education', body: 'Quarterly cohorts on blockchain, AI, and decentralized economics. Full scholarships for students from public universities across Latin America.', stat: 4548, statSuffix: '+', statLabel: 'active students', img: 'uploads/cooperative education.jpg' },
    { code: '02', title: 'Project incubation', body: 'We help new projects emerge, find resources, and access funding opportunities — connecting founders with the cooperative network, mentors, and partners to build with real backing.', stat: 100, statSuffix: '+', statLabel: 'community projects', img: 'uploads/project incubation.jpg' },
    { code: '03', title: 'Public resources', body: 'Open publications on data sovereignty, cooperative organizational models, and digital economics — freely available for communities across Latin America.', stat: 191, statSuffix: '+', statLabel: 'articles published', img: 'uploads/public research.jpg' },
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
              <span className="eyebrow">The blockchain cooperative · EST 2019</span>
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
        <Stat num={4548} label="active subscribers" />
        <Stat num={12} label="countries reached" />
        <Stat num={209} suffix="+" label="hackathon projects" />
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
          <div className="eyebrow">Institutional ecosystem</div>
          <h2 className="fs-h2">We build in good company.</h2>
        </Reveal>
        <div className="fs-partners-ticker">
          <div className="fs-partners-track">
            {[...partners, ...partners, ...partners].map((p, i) => (
              <div key={i} className="fs-partner-item">
                <img src={p.logo} alt={p.name} className="fs-partner-logo" />
                <span className="fs-partner-name">{p.name}</span>
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
                  <CountStat target={p.stat} suffix={p.statSuffix} label={p.statLabel} />
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
                href={a.link || 'https://telluscoop.beehiiv.com'}
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
            <a className="fs-handle" href="https://x.com/TellusCoop" target="_blank" rel="noopener noreferrer">
              <span className="fs-handle-ico"><svg viewBox="0 0 24 24" fill="currentColor" width="15" height="15"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.737-8.835L1.254 2.25H8.08l4.253 5.622 5.91-5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg></span>
              <span>@TellusCoop</span>
            </a>
            <a className="fs-handle" href="https://www.instagram.com/telluscoop/" target="_blank" rel="noopener noreferrer">
              <span className="fs-handle-ico"><svg viewBox="0 0 24 24" fill="currentColor" width="15" height="15"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg></span>
              <span>@telluscoop</span>
            </a>
            <a className="fs-handle" href="https://www.youtube.com/@telluscoop" target="_blank" rel="noopener noreferrer">
              <span className="fs-handle-ico"><svg viewBox="0 0 24 24" fill="currentColor" width="15" height="15"><path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg></span>
              <span>@telluscoop</span>
            </a>
            <a className="fs-handle" href="https://www.linkedin.com/company/tellus-cooperative/" target="_blank" rel="noopener noreferrer">
              <span className="fs-handle-ico"><svg viewBox="0 0 24 24" fill="currentColor" width="15" height="15"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg></span>
              <span>tellus-cooperative</span>
            </a>
            <a className="fs-handle" href="https://chat.whatsapp.com/FsNIUPsmNCl2YJkQi5r4p4" target="_blank" rel="noopener noreferrer">
              <span className="fs-handle-ico"><img src="uploads/whatsapp.svg" alt="WhatsApp" width="15" height="15" style={{display:'block'}} /></span>
              <span>WhatsApp · 300+ members</span>
            </a>
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
        <Reveal delay={450}>
          <a className="fs-cta-wa" href="https://chat.whatsapp.com/FsNIUPsmNCl2YJkQi5r4p4" target="_blank" rel="noopener noreferrer">
            <img src="uploads/whatsapp.svg" alt="WhatsApp" width="16" height="16" className="fs-wa-ico" />
            <span>Or join our WhatsApp community — 300+ members</span>
            <span className="fs-arrow">→</span>
          </a>
        </Reveal>
      </section>

      {/* FOOTER */}
      <footer className="fs-footer">
        <div className="fs-footer-grid">
          <div className="fs-footer-brand">
            <a className="fs-mark">
              <img src="uploads/tellus.svg" alt="Tellus Cooperative" className="fs-mark-img" />
            </a>
            <p>A Latin American blockchain cooperative for education, incubation, and open knowledge.</p>
          </div>
          <div>
            <div className="eyebrow">Programs</div>
            <ul>
              <li><a href="#programs">Cooperative education</a></li>
              <li><a href="#programs">Project incubation</a></li>
              <li><a href="#programs">Public resources</a></li>
            </ul>
          </div>
          <div>
            <div className="eyebrow">Community</div>
            <ul>
              <li><a href="https://chat.whatsapp.com/FsNIUPsmNCl2YJkQi5r4p4" target="_blank" rel="noopener noreferrer" className="fs-footer-icon-link"><svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>WhatsApp · 300+ members</a></li>
              <li><a href="https://telluscoop.beehiiv.com" target="_blank" rel="noopener noreferrer" className="fs-footer-icon-link"><svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg>Newsletter</a></li>
              <li><a href="https://www.youtube.com/@telluscoop" target="_blank" rel="noopener noreferrer" className="fs-footer-icon-link"><svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>YouTube courses</a></li>
            </ul>
          </div>
          <div>
            <div className="eyebrow">Follow</div>
            <ul>
              <li><a href="https://x.com/TellusCoop" target="_blank" rel="noopener noreferrer" className="fs-footer-icon-link"><svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.737-8.835L1.254 2.25H8.08l4.253 5.622 5.91-5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>X / Twitter</a></li>
              <li><a href="https://www.instagram.com/telluscoop/" target="_blank" rel="noopener noreferrer" className="fs-footer-icon-link"><svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>Instagram</a></li>
              <li><a href="https://www.linkedin.com/company/tellus-cooperative/" target="_blank" rel="noopener noreferrer" className="fs-footer-icon-link"><svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>LinkedIn</a></li>
              <li><a href="https://github.com/Tellus-Cooperative/" target="_blank" rel="noopener noreferrer" className="fs-footer-icon-link"><svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/></svg>GitHub</a></li>
              <li><a href="https://discord.gg/Fy2SgR3XRu" target="_blank" rel="noopener noreferrer" className="fs-footer-icon-link"><svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028 14.09 14.09 0 001.226-1.994.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/></svg>Discord</a></li>
            </ul>
          </div>
        </div>
        <div className="fs-footer-base">
          <span>© 2026 Tellus Cooperative Foundation · New York, NY</span>
        </div>
      </footer>

      {joinOpen && <JoinModal onClose={() => setJoinOpen(false)} />}
    </div>
  );
};

const CountStat = ({ target, suffix = '', label }) => {
  const [ref, shown] = useReveal();
  const v = useCountUp(target, shown);
  const display = target % 1 !== 0 ? v.toFixed(1) : Math.round(v).toLocaleString();
  return (
    <div ref={ref} className="fs-program-stat-inner">
      <span className="fs-program-num-big">{display}{suffix && <span className="fs-stat-suffix">{suffix}</span>}</span>
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
  const [email, setEmail] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleSubscribe = (e) => {
    e.preventDefault();
    if (!email) return;
    window.open(`https://blog.telluscoop.com/subscribe?email=${encodeURIComponent(email)}`, '_blank');
    setDone(true);
  };

  return (
    <div className="fs-modal-bg" onClick={onClose}>
      <div className="fs-modal fs-modal-wide" onClick={e => e.stopPropagation()}>
        <button className="fs-modal-close" onClick={onClose} aria-label="Close">×</button>
        {!done ? (
          <>
            <h3 className="fs-modal-h" style={{ marginBottom: 4 }}>Join Tellus.</h3>
            <p className="fs-modal-lede" style={{ marginBottom: 24 }}>Weekly guides, events, and resources for blockchain entrepreneurship — free.</p>
            <form className="fs-subscribe-form" onSubmit={handleSubscribe}>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                autoFocus
                className="fs-subscribe-input"
              />
              <button type="submit" className="fs-btn-primary fs-subscribe-btn">
                <span>Subscribe</span>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 7h10M7 2l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
            </form>
            <div className="fs-modal-divider"><span>also join the community</span></div>
            <div className="fs-modal-community">
              <a href="https://chat.whatsapp.com/FsNIUPsmNCl2YJkQi5r4p4" target="_blank" rel="noopener noreferrer" className="fs-community-btn fs-community-wa">
                <img src="uploads/whatsapp.svg" alt="WhatsApp" width="20" height="20" style={{filter:'brightness(10)'}} />
                <span>WhatsApp · 300+ members</span>
              </a>
              <a href="https://discord.gg/Fy2SgR3XRu" target="_blank" rel="noopener noreferrer" className="fs-community-btn fs-community-dc">
                <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028 14.09 14.09 0 001.226-1.994.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/></svg>
                <span>Discord community</span>
              </a>
            </div>
          </>
        ) : (
          <div className="fs-modal-success">
            <div className="fs-modal-check" aria-hidden="true">
              <svg viewBox="0 0 48 48" width="48" height="48">
                <circle cx="24" cy="24" r="22" fill="none" stroke="currentColor" strokeWidth="1.5" className="fs-check-c"/>
                <path d="M14 24l7 7 14-14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="fs-check-p"/>
              </svg>
            </div>
            <h3 className="fs-modal-h">Check your inbox.</h3>
            <p className="fs-modal-lede">Confirm your subscription in the tab that just opened. Then join the community:</p>
            <div className="fs-modal-community">
              <a href="https://chat.whatsapp.com/FsNIUPsmNCl2YJkQi5r4p4" target="_blank" rel="noopener noreferrer" className="fs-community-btn fs-community-wa">
                <img src="uploads/whatsapp.svg" alt="WhatsApp" width="20" height="20" style={{filter:'brightness(10)'}} />
                <span>WhatsApp · 300+ members</span>
              </a>
              <a href="https://discord.gg/Fy2SgR3XRu" target="_blank" rel="noopener noreferrer" className="fs-community-btn fs-community-dc">
                <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028 14.09 14.09 0 001.226-1.994.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/></svg>
                <span>Discord community</span>
              </a>
            </div>
            <button className="fs-btn-primary fs-modal-btn" style={{ marginTop: 16 }} onClick={onClose}>Done</button>
          </div>
        )}
      </div>
    </div>
  );
};

window.FoundationSystem = FoundationSystem;
