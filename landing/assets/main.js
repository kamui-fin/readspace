(function () {
  var root = document;

  // Sticky nav: compress + add shadow after scrolling past the top
  var stickyNav = root.querySelector('[data-sticky-nav]');
  if (stickyNav) {
    var syncNavScrolled = function () {
      stickyNav.classList.toggle('is-scrolled', window.scrollY > 24);
    };
    syncNavScrolled();
    window.addEventListener('scroll', syncNavScrolled, { passive: true });
  }

  // Number count-up on scroll into view
  var countEls = Array.prototype.slice.call(root.querySelectorAll('[data-count-to]'));
  if (countEls.length) {
    var animateCount = function (el) {
      var target = parseFloat(el.dataset.countTo);
      var suffix = el.dataset.countSuffix || '';
      var duration = 1100;
      var start = null;
      var ease = function (t) { return 1 - Math.pow(1 - t, 3); };
      var step = function (ts) {
        if (start === null) start = ts;
        var p = Math.min(1, (ts - start) / duration);
        var val = Math.round(target * ease(p));
        el.textContent = val.toLocaleString('en-US') + suffix;
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };
    if ('IntersectionObserver' in window) {
      var countObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            animateCount(entry.target);
            countObserver.unobserve(entry.target);
          }
        });
      }, { threshold: 0.6 });
      countEls.forEach(function (el) { countObserver.observe(el); });
    } else {
      countEls.forEach(animateCount);
    }
  }

  // Cursor spotlight on feature cards
  root.querySelectorAll('.step-card, .gist-card, .spotlight-card').forEach(function (el) {
    el.addEventListener('mousemove', function (e) {
      var r = el.getBoundingClientRect();
      el.style.setProperty('--x', (e.clientX - r.left) + 'px');
      el.style.setProperty('--y', (e.clientY - r.top) + 'px');
    });
  });

  // Magnetic tilt on mockup cards
  root.querySelectorAll('[data-tilt]').forEach(function (el) {
    el.style.transition = 'transform .4s cubic-bezier(.2,.7,.2,1)';
    el.style.willChange = 'transform';
    var reset = function () { el.style.transform = 'perspective(900px) rotateX(0deg) rotateY(0deg)'; };
    el.addEventListener('mousemove', function (e) {
      var r = el.getBoundingClientRect();
      var px = (e.clientX - r.left) / r.width - 0.5;
      var py = (e.clientY - r.top) / r.height - 0.5;
      el.style.transition = 'transform .08s linear';
      el.style.transform = 'perspective(900px) rotateX(' + (-py * 5) + 'deg) rotateY(' + (px * 5) + 'deg)';
    });
    el.addEventListener('mouseleave', function () {
      el.style.transition = 'transform .5s cubic-bezier(.2,.7,.2,1)';
      reset();
    });
  });

  // Logo fallback (img onerror)
  root.querySelectorAll('[data-logo]').forEach(function (img) {
    img.addEventListener('error', function () {
      img.style.display = 'none';
      var fb = img.nextElementSibling;
      if (fb) fb.style.display = 'flex';
    });
  });

  // Arrow nudge on hover
  root.querySelectorAll('[data-arrow-trigger]').forEach(function (el) {
    el.addEventListener('mouseenter', function () {
      var a = el.querySelector('[data-arrow]');
      if (!a) return;
      a.style.transform = 'translateX(4px)';
      setTimeout(function () { a.style.transform = 'translateX(0)'; }, 320);
    });
  });

  // Star pop on hover
  root.querySelectorAll('[data-star-trigger]').forEach(function (el) {
    el.addEventListener('mouseenter', function () {
      var s = el.querySelector('[data-star]');
      if (!s) return;
      s.style.transform = 'rotate(72deg) scale(1.25)';
      setTimeout(function () { s.style.transform = 'none'; }, 420);
    });
  });

  // Draw-in SVG stroke animation on hover
  root.querySelectorAll('[data-draw-trigger]').forEach(function (el) {
    el.addEventListener('mouseenter', function () {
      el.querySelectorAll('svg path, svg circle').forEach(function (p, i) {
        var len = 120;
        try { len = p.getTotalLength ? p.getTotalLength() : 120; } catch (_) {}
        p.style.transition = 'none';
        p.style.strokeDasharray = len;
        p.style.strokeDashoffset = len;
        requestAnimationFrame(function () {
          p.style.transition = 'stroke-dashoffset .55s cubic-bezier(.3,.7,.2,1) ' + (i * 70) + 'ms';
          p.style.strokeDashoffset = '0';
        });
      });
    });
  });

  // "Coming soon" modal for store links not yet live
  var modal = document.createElement('div');
  modal.className = 'modal-backdrop';
  modal.innerHTML =
    '<div class="modal-card" role="dialog" aria-modal="true">' +
      '<div class="modal-icon"><svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="10" r="7.3"></circle><path d="M10 5.5v5l3 2"></path></svg></div>' +
      '<div class="modal-title">Coming soon!</div>' +
      '<div class="modal-body">The native app isn\'t out yet &mdash; the web app works great in the meantime.</div>' +
      '<button type="button" class="modal-close">Got it</button>' +
    '</div>';
  document.body.appendChild(modal);
  var closeModal = function () { modal.classList.remove('is-open'); };
  modal.addEventListener('click', function (e) { if (e.target === modal) closeModal(); });
  modal.querySelector('.modal-close').addEventListener('click', closeModal);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeModal(); });
  root.querySelectorAll('[data-coming-soon]').forEach(function (el) {
    el.addEventListener('click', function (e) {
      e.preventDefault();
      modal.classList.add('is-open');
    });
  });

  // FAQ chevron rotation
  root.querySelectorAll('.faq-item').forEach(function (d) {
    d.addEventListener('toggle', function () {
      var c = d.querySelector('.faq-chev');
      if (!c) return;
      c.style.transform = d.open ? 'rotate(180deg)' : 'rotate(0deg)';
      c.style.color = d.open ? '#38663F' : '#9AA497';
    });
  });

  // Pricing cycle toggle
  var monthlyBtn = root.getElementById('cycle-monthly');
  var annualBtn = root.getElementById('cycle-annual');
  var proPrice = root.getElementById('pro-price');
  var proPer = root.getElementById('pro-per');
  var proSub = root.getElementById('pro-sub');
  if (proPrice) proPrice.classList.add('price-roll');
  var currentAnnual = false;
  function setCycle(annual) {
    if (annual === currentAnnual) return;
    currentAnnual = annual;
    if (monthlyBtn) monthlyBtn.classList.toggle('active', !annual);
    if (annualBtn) annualBtn.classList.toggle('active', annual);
    if (proPer) proPer.textContent = annual ? '/ year' : '/ month';
    if (proSub) proSub.textContent = annual
      ? 'Billed yearly — $5.00 / month.'
      : 'For people who want to spend less time catching up. $59.99 / year.';
    if (proPrice) {
      proPrice.classList.add('is-rolling');
      setTimeout(function () {
        proPrice.textContent = annual ? '$59.99' : '$5.99';
        proPrice.classList.remove('is-rolling');
      }, 160);
    }
  }
  if (monthlyBtn) monthlyBtn.addEventListener('click', function () { setCycle(false); });
  if (annualBtn) annualBtn.addEventListener('click', function () { setCycle(true); });

  // Responsive layout toggles (mirrors the design's breakpoints)
  var wide = function () {
    var w = window.innerWidth;
    root.querySelectorAll('[data-sidebar]').forEach(function (e) { e.style.display = w > 820 ? 'flex' : 'none'; });
    root.querySelectorAll('[data-phone-hero]').forEach(function (e) { e.style.display = w > 900 ? 'block' : 'none'; });
    root.querySelectorAll('[data-foliage]').forEach(function (e) { e.style.display = w > 880 ? 'block' : 'none'; });
    root.querySelectorAll('[data-gistgrid]').forEach(function (e) {
      e.style.gridTemplateColumns = w > 1000 ? '1.4fr 1fr 1fr' : (w > 640 ? 'repeat(2,minmax(0,1fr))' : '1fr');
    });
    root.querySelectorAll('[data-steps]').forEach(function (e) {
      e.style.gridTemplateColumns = w > 1000 ? 'repeat(4,minmax(0,1fr))' : (w > 560 ? 'repeat(2,minmax(0,1fr))' : '1fr');
    });
    root.querySelectorAll('[data-navlinks]').forEach(function (e) { e.style.display = w > 1000 ? 'flex' : 'none'; });
    root.querySelectorAll('[data-navstar]').forEach(function (e) { e.style.display = w > 760 ? 'inline-flex' : 'none'; });
    root.querySelectorAll('[data-navspacer]').forEach(function (e) { e.style.display = w > 1000 ? 'none' : 'block'; });
  };
  wide();
  window.addEventListener('resize', wide);

  // Text color-fill on scroll: paints character-by-character as the element scrolls into view
  var fills = Array.prototype.slice.call(root.querySelectorAll('[data-fill]'));
  if (fills.length) {
    var hex = function (c) { return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]; };
    var mix = function (f, t, p) { return 'rgb(' + f.map(function (v, i) { return Math.round(v + (t[i] - v) * p); }).join(',') + ')'; };
    fills.forEach(function (el) {
      var words = el.textContent.split(/(\s+)/);
      el.textContent = '';
      el._chars = [];
      words.forEach(function (word) {
        if (/^\s+$/.test(word)) {
          el.appendChild(document.createTextNode(word));
          return;
        }
        var wordSpan = document.createElement('span');
        wordSpan.className = 'fill-word';
        Array.prototype.forEach.call(word, function (ch) {
          var s = document.createElement('span');
          s.className = 'fill-char';
          s.textContent = ch;
          wordSpan.appendChild(s);
          el._chars.push(s);
        });
        el.appendChild(wordSpan);
      });
      el._from = hex(el.dataset.fillFrom || '#C6CCC1');
      el._to = hex(el.dataset.fillTo || '#171C18');
    });
    var paintFills = function () {
      fills.forEach(function (el) {
        var r = el.getBoundingClientRect();
        var p = Math.max(0, Math.min(1, (window.innerHeight * 0.82 - r.top) / (window.innerHeight * 0.4)));
        var n = el._chars.length;
        el._chars.forEach(function (s, i) {
          var cp = Math.max(0, Math.min(1, p * (n * 0.6 + 1) - i * 0.6));
          s.style.color = mix(el._from, el._to, cp);
        });
      });
    };
    paintFills();
    setInterval(paintFills, 90);
    window.addEventListener('scroll', paintFills, { passive: true });
    window.addEventListener('resize', paintFills);
    document.addEventListener('scroll', paintFills, { capture: true, passive: true });
  }

  // "Chaos to calm" tile animation
  var stage = root.querySelector('[data-chaos]');
  if (stage) {
    var tiles = Array.prototype.slice.call(stage.querySelectorAll('[data-tile]'));
    var rows = Array.prototype.slice.call(stage.querySelectorAll('[data-row]'));
    var card = stage.querySelector('[data-calm-card]');
    var ease = function (t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; };
    var lastE = -1, lastW = -1;
    var paint = function (e, sw) {
      var k = Math.min(1, sw / 940);
      var W = Math.min(420, sw - 40);
      if (card) {
        card.style.width = W + 'px';
        card.style.marginLeft = (-W / 2) + 'px';
        card.style.opacity = Math.max(0, (e - 0.4) / 0.6);
      }
      tiles.forEach(function (t) {
        var cx = (+t.dataset.cx) * k, cy = (+t.dataset.cy) * (sw < 620 ? 0.8 : 1), rot = +t.dataset.r;
        var tx = cx * 0.18, ty = cy * 0.18, sc = 0.3, op = 0;
        t.style.transform = 'translate(' + (cx + (tx - cx) * e) + 'px,' + (cy + (ty - cy) * e) + 'px) rotate(' + (rot * (1 - e)) + 'deg) scale(' + (1 + (sc - 1) * e) + ')';
        t.style.opacity = String(1 + (op - 1) * e);
      });
      rows.forEach(function (r, i) {
        r.style.transform = 'translate(' + (-W / 2 + 36) + 'px,' + ((i - 2.5) * 46) + 'px)';
        r.style.width = (W - 72) + 'px';
        r.style.opacity = String(Math.max(0, Math.min(1, (e - 0.5 - i * 0.05) / 0.28)));
      });
    };
    var frame = function () {
      var rect = stage.getBoundingClientRect();
      var raw = (window.innerHeight * 0.84 - rect.top) / (rect.height * 0.95);
      var e = ease(Math.max(0, Math.min(1, raw)));
      var sw = stage.clientWidth || 900;
      if (Math.abs(e - lastE) < 0.002 && sw === lastW) return;
      lastE = e; lastW = sw;
      paint(e, sw);
    };
    var ticking = true, sawProgress = false, raf;
    var run = function () { frame(); if (lastE > 0.01) sawProgress = true; };
    var tick = function () {
      if (!ticking) return;
      run();
      raf = requestAnimationFrame(tick);
    };
    run();
    raf = requestAnimationFrame(tick);
    setInterval(run, 120);
    window.addEventListener('scroll', run, { passive: true });
    window.addEventListener('resize', run);
    document.addEventListener('scroll', run, { capture: true, passive: true });
    setTimeout(function () {
      if (!sawProgress) { lastE = -1; paint(1, stage.clientWidth || 900); }
    }, 1600);
  }

  // Scroll reveal
  var show = function (e) { e.style.opacity = '1'; e.style.transform = 'none'; };
  var hidden = [];
  root.querySelectorAll('[data-reveal]').forEach(function (e) {
    if (e.getBoundingClientRect().top > window.innerHeight) {
      hidden.push(e);
    } else {
      e.classList.add('is-visible');
    }
  });
  var check = function () {
    for (var i = hidden.length - 1; i >= 0; i--) {
      if (hidden[i].getBoundingClientRect().top < window.innerHeight * 0.92) {
        hidden[i].classList.add('is-visible');
        hidden.splice(i, 1);
      }
    }
    if (!hidden.length) {
      window.removeEventListener('scroll', check);
      window.removeEventListener('resize', check);
    }
  };
  window.addEventListener('scroll', check, { passive: true });
  window.addEventListener('resize', check);
  setTimeout(check, 300);
  setTimeout(function () { hidden.slice().forEach(function (e) { e.classList.add('is-visible'); }); hidden.length = 0; }, 1200);
})();
