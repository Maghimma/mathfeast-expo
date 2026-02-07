/**
 * NUMB3RS & NIBBLES — App Logic
 *
 * ┌──────────────────────────────────────────────────┐
 * │  GOOGLE SHEETS SETUP (one-time)                  │
 * ├──────────────────────────────────────────────────┤
 * │                                                  │
 * │  1. Create a Google Sheet with THREE tabs:       │
 * │     Tab "Stall Feedback" — columns:              │
 * │       Timestamp | Stall ID | Stall Name |        │
 * │       Rating | Enjoyed | Suggestions             │
 * │                                                  │
 * │     Tab "Expo Feedback" — columns:               │
 * │       Timestamp | Rating | Favorite Part |       │
 * │       Improvements | Attend Again                │
 * │                                                  │
 * │     Tab "Stall Edits" — columns:                 │
 * │       Timestamp | stallId | name | dish |        │
 * │       shortDescription | fullDescription |       │
 * │       ingredients                                │
 * │                                                  │
 * │  2. Go to Extensions → Apps Script               │
 * │                                                  │
 * │  3. Replace the code with:                       │
 * │                                                  │
 * │  function doPost(e) {                            │
 * │    var data = JSON.parse(e.postData.contents);   │
 * │    var ss = SpreadsheetApp                       │
 * │               .getActiveSpreadsheet();           │
 * │    var sheet = ss                                │
 * │               .getSheetByName(data.sheetName);   │
 * │    sheet.appendRow(data.values);                 │
 * │    return ContentService                         │
 * │      .createTextOutput(                          │
 * │        JSON.stringify({ status: "ok" })          │
 * │      )                                           │
 * │      .setMimeType(                               │
 * │        ContentService.MimeType.JSON              │
 * │      );                                          │
 * │  }                                               │
 * │                                                  │
 * │  function doGet(e) {                             │
 * │    var ss = SpreadsheetApp                       │
 * │               .getActiveSpreadsheet();           │
 * │    var sheet = ss.getSheetByName("Stall Edits"); │
 * │    if (!sheet) return ContentService             │
 * │      .createTextOutput("[]")                     │
 * │      .setMimeType(                               │
 * │        ContentService.MimeType.JSON);            │
 * │    var data = sheet.getDataRange().getValues();   │
 * │    if (data.length <= 1) return ContentService   │
 * │      .createTextOutput("[]")                     │
 * │      .setMimeType(                               │
 * │        ContentService.MimeType.JSON);            │
 * │    var headers = data[0];                        │
 * │    var rows = [];                                │
 * │    for (var i = 1; i < data.length; i++) {       │
 * │      var row = {};                               │
 * │      for (var j = 0; j < headers.length; j++) {  │
 * │        row[headers[j]] = data[i][j];             │
 * │      }                                           │
 * │      rows.push(row);                             │
 * │    }                                             │
 * │    return ContentService                         │
 * │      .createTextOutput(                          │
 * │        JSON.stringify(rows)                      │
 * │      )                                           │
 * │      .setMimeType(                               │
 * │        ContentService.MimeType.JSON              │
 * │      );                                          │
 * │  }                                               │
 * │                                                  │
 * │  4. Deploy → New Deployment → Web App            │
 * │     Execute as: Me                               │
 * │     Who has access: Anyone                       │
 * │                                                  │
 * │  5. Copy the URL and paste it below ↓            │
 * └──────────────────────────────────────────────────┘
 */

const GOOGLE_SCRIPT_URL = 'YOUR_GOOGLE_APPS_SCRIPT_URL_HERE';

// ── Stall data cache ──
let stallsCache = null;

// ════════════════════════
//  INIT
// ════════════════════════

document.addEventListener('DOMContentLoaded', () => {
  const path = window.location.pathname;

  if (path.endsWith('stall.html')) {
    initStallPage();
  } else if (path.endsWith('feedback.html')) {
    initFeedbackPage();
  } else {
    initIndexPage();
  }
});

// ════════════════════════
//  DATA
// ════════════════════════

async function fetchStalls() {
  if (stallsCache) return stallsCache;
  try {
    const res = await fetch('stalls.json');
    if (!res.ok) throw new Error(res.statusText);
    let stalls = await res.json();

    // Merge any live edits from Google Sheets
    const edits = await fetchStallEdits();
    if (edits && edits.length) {
      stalls = mergeEdits(stalls, edits);
    }

    stallsCache = stalls;
    return stallsCache;
  } catch (err) {
    console.error('Failed to load stalls:', err);
    return null;
  }
}

async function fetchStallEdits() {
  if (GOOGLE_SCRIPT_URL === 'YOUR_GOOGLE_APPS_SCRIPT_URL_HERE') return null;
  try {
    const res = await fetch(GOOGLE_SCRIPT_URL);
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.warn('Could not fetch stall edits:', err);
    return null;
  }
}

function mergeEdits(stalls, edits) {
  // Build a map of latest edit per stall ID
  const latestEdits = {};
  for (const edit of edits) {
    const id = parseInt(edit.stallId);
    if (!id) continue;
    latestEdits[id] = edit; // later rows overwrite earlier ones
  }

  return stalls.map(stall => {
    const edit = latestEdits[stall.id];
    if (!edit) return stall;
    // Only overwrite non-empty fields
    const merged = { ...stall };
    if (edit.name) merged.name = edit.name;
    if (edit.dish) merged.dish = edit.dish;
    if (edit.shortDescription) merged.shortDescription = edit.shortDescription;
    if (edit.fullDescription) merged.fullDescription = edit.fullDescription;
    if (edit.ingredients) merged.ingredients = edit.ingredients;
    return merged;
  });
}

// ════════════════════════
//  INDEX PAGE
// ════════════════════════

async function initIndexPage() {
  // Hide nav until user scrolls past the hero
  const nav  = document.querySelector('.nav');
  const hero = document.querySelector('.hero');
  if (nav && hero) {
    nav.classList.add('nav-hidden');
    const observer = new IntersectionObserver(([entry]) => {
      nav.classList.toggle('nav-hidden', entry.isIntersecting);
    }, { threshold: 0 });
    observer.observe(hero);
  }

  const grid     = document.getElementById('stallsGrid');
  const input    = document.getElementById('searchInput');
  const counter  = document.getElementById('stallCount');

  const stalls = await fetchStalls();

  if (!stalls) {
    grid.innerHTML = '<div class="no-results">Could not load stalls. Please refresh.</div>';
    return;
  }

  const icons = ['\uD83E\uDD67', '\uD83C\uDF70', '\uD83E\uDDC1', '\uD83C\uDF55', '\uD83E\uDD57', '\uD83C\uDF82', '\uD83C\uDF73', '\uD83E\uDD50'];

  let activeFilter = 'all';

  function getFiltered() {
    const q = input.value.toLowerCase().trim();
    return stalls.filter(s => {
      const matchSearch = !q ||
        s.name.toLowerCase().includes(q) ||
        s.topic.toLowerCase().includes(q) ||
        s.shortDescription.toLowerCase().includes(q) ||
        (s.presenter && s.presenter.toLowerCase().includes(q));
      const matchDiet = activeFilter === 'all' || s.dietary === activeFilter;
      return matchSearch && matchDiet;
    });
  }

  function render() {
    const list = getFiltered();
    if (!list.length) {
      grid.innerHTML = '<div class="no-results">No stalls match your search.</div>';
      counter.textContent = '';
      return;
    }
    grid.innerHTML = list.map((s, i) => {
      const icon   = icons[s.id % icons.length];
      const hasImg = s.image && !s.image.includes('placeholder') && s.image !== '';
      const sample = s.sampleAvailable === true || s.sampleAvailable === 'likely';
      return `
        <a href="stall.html?id=${s.id}" class="stall-card" style="animation-delay:${i * 55}ms">
          <div class="stall-card-image">
            ${hasImg
              ? `<img src="${s.image}" alt="${s.name}" loading="lazy">`
              : `<div class="placeholder-icon">${icon}</div>`}
            <span class="stall-card-topic">${s.topic}</span>
            <span class="stall-card-dietary ${s.dietary}"></span>
          </div>
          <div class="stall-card-body">
            <h3 class="stall-card-name">${s.name}</h3>
            <div class="stall-card-dish">${s.dish || ''}</div>
            <p class="stall-card-desc">${s.shortDescription}</p>
            <div class="stall-card-team">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              ${s.presenter || s.team.map(t => t.name).join(', ')}
              ${sample ? '<span class="sample-badge">Samples!</span>' : ''}
            </div>
          </div>
        </a>`;
    }).join('');
    counter.textContent = `Showing ${list.length} of ${stalls.length} stalls`;
  }

  render();

  // Search
  input.addEventListener('input', render);

  // Dietary filter buttons
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeFilter = btn.dataset.filter;
      render();
    });
  });
}

// ════════════════════════
//  STALL DETAIL PAGE
// ════════════════════════

async function initStallPage() {
  const container = document.getElementById('stallContent');
  const id = parseInt(new URLSearchParams(window.location.search).get('id'));

  if (!id) { renderNotFound(container); return; }

  const stalls = await fetchStalls();
  if (!stalls) {
    container.innerHTML = '<div class="not-found"><h2>Error</h2><p>Could not load stall data.</p><a href="index.html">\u2190 Back to stalls</a></div>';
    return;
  }

  const stall = stalls.find(s => s.id === id);
  if (!stall) { renderNotFound(container); return; }

  document.title = `${stall.name} \u2014 NUMB3RS & Nibbles`;

  const icons = ['\uD83E\uDD67', '\uD83C\uDF70', '\uD83E\uDDC1', '\uD83C\uDF55', '\uD83E\uDD57', '\uD83C\uDF82', '\uD83C\uDF73', '\uD83E\uDD50'];
  const icon  = icons[stall.id % icons.length];
  const hasImg = stall.image && !stall.image.includes('placeholder') && stall.image !== '';

  container.innerHTML = `
    <div class="stall-hero">
      ${hasImg
        ? `<img src="${stall.image}" alt="${stall.name}">`
        : `<div class="placeholder-hero">${icon}</div>`}
    </div>

    <div class="stall-detail">
      <a href="index.html" class="back-link">\u2190 Back to all stalls</a>

      <div class="stall-title-row">
        <h1>${stall.name}</h1>
        <button class="btn-edit-toggle" id="editToggle">Edit Details</button>
      </div>
      <span class="stall-topic-badge">${stall.topic}</span>

      <div class="stall-meta-row">
        <span class="meta-chip"><span class="diet-indicator" style="background:${stall.dietary === 'veg' ? '#2E7D32' : stall.dietary === 'egg' ? '#E8A839' : '#C62828'}"></span> ${stall.dietary === 'veg' ? 'Vegetarian' : stall.dietary === 'egg' ? 'Contains egg' : 'Non-vegetarian'}</span>
        ${stall.dish ? `<span class="meta-chip">\uD83C\uDF7D\uFE0F ${stall.dish}</span>` : ''}
        ${stall.sampleAvailable === true || stall.sampleAvailable === 'likely' ? '<span class="meta-chip">\u2705 Samples available</span>' : stall.sampleAvailable === 'maybe' ? '<span class="meta-chip">\uD83E\uDD1E Samples TBD</span>' : ''}
      </div>

      <p class="stall-description">${stall.fullDescription}</p>

      ${stall.ingredients ? `<div class="ingredients-section"><strong>Ingredients</strong>${stall.ingredients}</div>` : ''}

      <!-- Edit Form (hidden by default) -->
      <div class="edit-section" id="editSection" style="display:none">
        <h2>Edit Stall Details</h2>
        <p class="subtitle">Fix any mistakes — changes go live on next page load.</p>
        <form id="stallEditForm">
          <div class="form-group">
            <label for="editName">Stall Name</label>
            <input type="text" id="editName" value="${stall.name.replace(/"/g, '&quot;')}">
          </div>
          <div class="form-group">
            <label for="editDish">Dish</label>
            <input type="text" id="editDish" value="${(stall.dish || '').replace(/"/g, '&quot;')}">
          </div>
          <div class="form-group">
            <label for="editShort">Short Description</label>
            <textarea id="editShort">${stall.shortDescription}</textarea>
          </div>
          <div class="form-group">
            <label for="editFull">Full Description</label>
            <textarea id="editFull" style="min-height:160px">${stall.fullDescription}</textarea>
          </div>
          <div class="form-group">
            <label for="editIngredients">Ingredients</label>
            <textarea id="editIngredients">${stall.ingredients || ''}</textarea>
          </div>
          <div class="edit-actions">
            <button type="submit" class="btn-submit">Save Changes</button>
            <button type="button" class="btn-cancel" id="editCancel">Cancel</button>
          </div>
        </form>
      </div>

      <h3 class="section-heading"><span class="icon">\uD83D\uDC65</span> Presented by</h3>
      <div class="team-grid">
        ${stall.team.map(m => `
          <div class="team-card">
            <div class="team-avatar">${m.name.charAt(0)}</div>
            <div class="team-name">${m.name}</div>
            <div class="team-role">${m.role}</div>
          </div>`).join('')}
      </div>

      <h3 class="section-heading"><span class="icon">\uD83E\uDDEE</span> What You'll Explore</h3>
      <div class="concepts-list">
        ${stall.concepts.map(c => `<span class="concept-tag">${c}</span>`).join('')}
      </div>

      <div class="divider">\u2726</div>

      <div class="feedback-section">
        <h2>Rate This Stall</h2>
        <p class="subtitle">Your feedback helps the team grow!</p>

        <form id="stallFeedbackForm">
          <div class="form-group">
            <label>Your Rating</label>
            <div class="star-rating" data-rating="0" id="stallRating">
              <span class="star" data-value="1">\u2605</span>
              <span class="star" data-value="2">\u2605</span>
              <span class="star" data-value="3">\u2605</span>
              <span class="star" data-value="4">\u2605</span>
              <span class="star" data-value="5">\u2605</span>
            </div>
          </div>
          <div class="form-group">
            <label for="enjoyed">What did you enjoy most?</label>
            <textarea id="enjoyed" placeholder="Tell us what you liked about this stall..."></textarea>
          </div>
          <div class="form-group">
            <label for="suggestions">Any suggestions?</label>
            <textarea id="suggestions" placeholder="How could this stall be even better?"></textarea>
          </div>
          <button type="submit" class="btn-submit">Submit Feedback</button>
        </form>
      </div>
    </div>`;

  wireStars();
  wireStallForm(stall);
  wireEditForm(stall);
}

function renderNotFound(el) {
  el.innerHTML = `
    <div class="not-found">
      <h2>Stall not found</h2>
      <p>We couldn't find the stall you're looking for.</p>
      <a href="index.html">\u2190 Back to all stalls</a>
    </div>`;
}

// ════════════════════════
//  EDIT FORM
// ════════════════════════

function wireEditForm(stall) {
  const toggle  = document.getElementById('editToggle');
  const section = document.getElementById('editSection');
  const cancel  = document.getElementById('editCancel');
  const form    = document.getElementById('stallEditForm');
  if (!toggle || !section || !form) return;

  toggle.addEventListener('click', () => {
    const open = section.style.display !== 'none';
    section.style.display = open ? 'none' : 'block';
    toggle.textContent = open ? 'Edit Details' : 'Cancel Editing';
    if (!open) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  cancel.addEventListener('click', () => {
    section.style.display = 'none';
    toggle.textContent = 'Edit Details';
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('.btn-submit');
    btn.disabled = true;
    btn.textContent = 'Saving\u2026';

    const ok = await submitFeedback({
      sheetName: 'Stall Edits',
      values: [
        new Date().toISOString(),
        stall.id,
        document.getElementById('editName').value.trim(),
        document.getElementById('editDish').value.trim(),
        document.getElementById('editShort').value.trim(),
        document.getElementById('editFull').value.trim(),
        document.getElementById('editIngredients').value.trim()
      ]
    });

    btn.disabled = false;
    btn.textContent = 'Save Changes';

    if (ok) {
      showToast('Changes saved! Reload to see updates.', 'success');
      section.style.display = 'none';
      toggle.textContent = 'Edit Details';
      // Clear cache so next load picks up edits
      stallsCache = null;
    } else {
      showToast('Something went wrong. Please try again.', 'error');
    }
  });
}

// ════════════════════════
//  STALL FEEDBACK FORM
// ════════════════════════

function wireStallForm(stall) {
  const form = document.getElementById('stallFeedbackForm');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const rating      = document.getElementById('stallRating').dataset.rating;
    const enjoyed     = document.getElementById('enjoyed').value.trim();
    const suggestions = document.getElementById('suggestions').value.trim();

    if (rating === '0') { showToast('Please select a star rating first!', 'error'); return; }

    const btn = form.querySelector('.btn-submit');
    btn.disabled = true;
    btn.textContent = 'Submitting\u2026';

    const ok = await submitFeedback({
      sheetName: 'Stall Feedback',
      values: [new Date().toISOString(), stall.id, stall.name, rating, enjoyed, suggestions]
    });

    btn.disabled = false;
    btn.textContent = 'Submit Feedback';

    if (ok) {
      showToast('Thanks for rating this stall!', 'success');
      form.reset();
      resetStars(document.getElementById('stallRating'));
    } else {
      showToast('Something went wrong. Please try again.', 'error');
    }
  });
}

// ════════════════════════
//  FEEDBACK PAGE
// ════════════════════════

function initFeedbackPage() {
  wireStars();

  const form = document.getElementById('expoFeedbackForm');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const rating      = document.getElementById('expoRating').dataset.rating;
    const favorite    = document.getElementById('favoritePart').value.trim();
    const improve     = document.getElementById('improvements').value.trim();
    const attendRadio = form.querySelector('input[name="attendAgain"]:checked');
    const attend      = attendRadio ? attendRadio.value : '';

    if (rating === '0') { showToast('Please select a star rating first!', 'error'); return; }

    const btn = form.querySelector('.btn-submit');
    btn.disabled = true;
    btn.textContent = 'Submitting\u2026';

    const ok = await submitFeedback({
      sheetName: 'Expo Feedback',
      values: [new Date().toISOString(), rating, favorite, improve, attend]
    });

    btn.disabled = false;
    btn.textContent = 'Submit Feedback';

    if (ok) {
      showToast('Thank you for your feedback!', 'success');
      form.reset();
      resetStars(document.getElementById('expoRating'));
    } else {
      showToast('Something went wrong. Please try again.', 'error');
    }
  });
}

// ════════════════════════
//  STAR RATINGS
// ════════════════════════

function wireStars() {
  document.querySelectorAll('.star-rating').forEach(container => {
    const stars = container.querySelectorAll('.star');

    stars.forEach(star => {
      star.addEventListener('click', () => {
        const val = parseInt(star.dataset.value);
        container.dataset.rating = val;
        paintStars(container, val);
        star.classList.remove('pop');
        // trigger reflow for re-animation
        void star.offsetWidth;
        star.classList.add('pop');
      });

      star.addEventListener('mouseenter', () => paintStars(container, parseInt(star.dataset.value)));
    });

    container.addEventListener('mouseleave', () => {
      paintStars(container, parseInt(container.dataset.rating) || 0);
    });
  });
}

function paintStars(container, upTo) {
  container.querySelectorAll('.star').forEach(s => {
    s.classList.toggle('active', parseInt(s.dataset.value) <= upTo);
  });
}

function resetStars(container) {
  if (!container) return;
  container.dataset.rating = '0';
  container.querySelectorAll('.star').forEach(s => s.classList.remove('active', 'pop'));
}

// ════════════════════════
//  GOOGLE SHEETS SUBMIT
// ════════════════════════

async function submitFeedback(data) {
  if (GOOGLE_SCRIPT_URL === 'YOUR_GOOGLE_APPS_SCRIPT_URL_HERE') {
    // Demo mode — no backend configured yet
    console.log('%c[Demo] Submitted:', 'color:#D4903C;font-weight:bold', data);
    await new Promise(r => setTimeout(r, 700));
    return true;
  }

  try {
    await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return true;
  } catch (err) {
    console.error('Submit error:', err);
    return false;
  }
}

// ════════════════════════
//  TOAST
// ════════════════════════

function showToast(message, type) {
  const toast = document.getElementById('toast');
  if (!toast) return;

  const icon = type === 'success' ? '\u2713' : '\u2717';
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${icon}</span> ${message}`;

  void toast.offsetHeight; // force reflow
  toast.classList.add('show');

  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove('show'), 3500);
}
