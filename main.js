const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const cards = $$('.destination-card');
const filterButtons = $$('.filter-chip');
const searchInput = $('#destination-search');
const destinationGrid = $('#destination-grid');
const emptyState = $('#empty-state');
const tripCount = $('#trip-count');
const drawer = $('#trip-drawer');
const drawerBackdrop = $('#drawer-backdrop');
const savedPlaces = $('#saved-places');
const placeDialog = $('#place-dialog');
const toast = $('#toast');
const toastMessage = $('#toast-message');
const menuToggle = $('#menu-toggle');
const mobileNav = $('#mobile-nav');

let activeFilter = 'all';
let currentDialogCard = null;
let toastTimer = null;
let toastHiddenTimer = null;
let savedTrip = loadTrip();

function loadTrip() {
  try {
    const parsed = JSON.parse(localStorage.getItem('northstar-trip') || '[]');
    return Array.isArray(parsed) ? parsed.filter(item => item && typeof item.id === 'string') : [];
  } catch {
    return [];
  }
}

function persistTrip() {
  try { localStorage.setItem('northstar-trip', JSON.stringify(savedTrip)); } catch { /* Storage may be disabled; in-memory planning still works. */ }
}

function getCardData(card) {
  return {
    id: card.dataset.name,
    name: card.dataset.place,
    country: card.dataset.country,
    duration: card.dataset.duration,
    type: card.dataset.type,
    image: card.dataset.image,
    description: card.dataset.description,
  };
}

function showToast(message) {
  toastMessage.textContent = message;
  toast.classList.add('visible');
  toast.setAttribute('aria-hidden', 'false');
  window.clearTimeout(toastTimer);
  window.clearTimeout(toastHiddenTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove('visible'), 3200);
}

function syncCardButtons() {
  cards.forEach(card => {
    const data = getCardData(card);
    const button = $('.add-place', card);
    if (!button) return;
    const isAdded = savedTrip.some(place => place.id === data.id);
    button.classList.toggle('is-added', isAdded);
    button.textContent = isAdded ? '✓' : '+';
    button.setAttribute('aria-label', `${isAdded ? 'Remove' : 'Add'} ${data.name} ${isAdded ? 'from' : 'to'} my trip`);
    button.title = isAdded ? 'Remove from my trip' : 'Add to my trip';
  });
}

function renderTrip() {
  tripCount.textContent = String(savedTrip.length);
  $('#drawer-place-count').textContent = `${savedTrip.length} ${savedTrip.length === 1 ? 'place' : 'places'} saved`;
  $('#drawer-duration').textContent = savedTrip.length
    ? `${savedTrip.reduce((sum, place) => sum + (Number.parseInt(place.duration, 10) || 0), 0)} days of possibility.`
    : 'Your next story starts here.';
  $('#share-trip').disabled = savedTrip.length === 0;
  $('#copy-feedback').textContent = '';
  savedPlaces.replaceChildren();

  if (!savedTrip.length) {
    const empty = document.createElement('div');
    empty.className = 'drawer-empty';
    empty.innerHTML = '<span aria-hidden="true">↘</span><h3>A little space<br />for your somewhere.</h3><p>Save the places that catch your eye. We\'ll keep them here while you plan.</p><button type="button" class="button button-dark" id="explore-from-drawer">Explore places <span>↗</span></button>';
    savedPlaces.append(empty);
    $('#explore-from-drawer').addEventListener('click', () => {
      closeDrawer();
      $('#discover').scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    });
  } else {
    savedTrip.forEach(place => {
      const item = document.createElement('article');
      item.className = 'saved-place';
      const image = document.createElement('img');
      image.src = place.image;
      image.alt = '';
      image.loading = 'lazy';
      const textWrap = document.createElement('div');
      const title = document.createElement('h3');
      title.textContent = place.name;
      const meta = document.createElement('p');
      meta.textContent = `${place.country} · ${place.duration}`;
      textWrap.append(title, meta);
      const remove = document.createElement('button');
      remove.className = 'remove-place';
      remove.type = 'button';
      remove.setAttribute('aria-label', `Remove ${place.name} from my trip`);
      remove.textContent = '−';
      remove.addEventListener('click', () => removePlace(place.id));
      item.append(image, textWrap, remove);
      savedPlaces.append(item);
    });
  }
  syncCardButtons();
}

function addPlace(data) {
  if (savedTrip.some(place => place.id === data.id)) {
    showToast(`${data.name} is already in your trip`);
    return;
  }
  savedTrip = [...savedTrip, data];
  persistTrip();
  renderTrip();
  showToast(`${data.name} added to your trip`);
}

function removePlace(id) {
  const existing = savedTrip.find(place => place.id === id);
  savedTrip = savedTrip.filter(place => place.id !== id);
  persistTrip();
  renderTrip();
  if (existing) showToast(`${existing.name} removed from your trip`);
}

function openDrawer() {
  closeMobileMenu();
  renderTrip();
  drawerBackdrop.hidden = false;
  requestAnimationFrame(() => {
    drawer.classList.add('open');
    drawer.setAttribute('aria-hidden', 'false');
    document.body.classList.add('drawer-open');
    $('#close-trip').focus();
  });
}

function closeDrawer() {
  drawer.classList.remove('open');
  drawer.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('drawer-open');
  window.setTimeout(() => { drawerBackdrop.hidden = true; }, 360);
  $('#open-trip').focus({ preventScroll: true });
}

function openPlaceDialog(card) {
  currentDialogCard = card;
  const data = getCardData(card);
  $('#dialog-image').src = data.image;
  $('#dialog-image').alt = `${data.name}, ${data.country}`;
  $('#dialog-country').textContent = data.country.toUpperCase();
  $('#dialog-title').innerHTML = `${escapeHtml(data.name)} <em>is calling.</em>`;
  $('#dialog-description').textContent = data.description;
  $('#dialog-duration').textContent = data.duration.toUpperCase();
  const isAdded = savedTrip.some(place => place.id === data.id);
  $('#dialog-add').innerHTML = `${isAdded ? 'Already in my trip' : 'Add to my trip'} <span>${isAdded ? '✓' : '+'}</span>`;
  $('#dialog-add').disabled = isAdded;
  $('#dialog-add').style.opacity = isAdded ? '.65' : '1';
  if (typeof placeDialog.showModal === 'function') {
    placeDialog.showModal();
    document.body.classList.add('dialog-open');
  } else {
    openDrawer();
  }
}

function closePlaceDialog() {
  if (placeDialog.open) placeDialog.close();
  document.body.classList.remove('dialog-open');
  currentDialogCard = null;
}

function filterCards() {
  const query = searchInput.value.trim().toLowerCase();
  let visible = 0;
  cards.forEach(card => {
    const matchesCategory = activeFilter === 'all' || card.dataset.category === activeFilter;
    const matchesSearch = !query || `${card.dataset.name} ${card.dataset.country} ${card.dataset.description}`.toLowerCase().includes(query);
    const show = matchesCategory && matchesSearch;
    card.hidden = !show;
    if (show) visible += 1;
  });
  emptyState.hidden = visible > 0;
  destinationGrid.hidden = visible === 0;
  filterButtons.forEach(button => {
    const active = button.dataset.filter === activeFilter;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
}

function openMobileMenu() {
  mobileNav.classList.add('open');
  mobileNav.setAttribute('aria-hidden', 'false');
  menuToggle.setAttribute('aria-expanded', 'true');
  menuToggle.setAttribute('aria-label', 'Close navigation');
}

function closeMobileMenu() {
  mobileNav.classList.remove('open');
  mobileNav.setAttribute('aria-hidden', 'true');
  menuToggle.setAttribute('aria-expanded', 'false');
  menuToggle.setAttribute('aria-label', 'Open navigation');
}

function toggleMobileMenu() {
  if (menuToggle.getAttribute('aria-expanded') === 'true') closeMobileMenu();
  else openMobileMenu();
}

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

filterButtons.forEach(button => button.addEventListener('click', () => {
  activeFilter = button.dataset.filter;
  filterCards();
}));
searchInput.addEventListener('input', filterCards);
$('#reset-filters').addEventListener('click', () => {
  activeFilter = 'all';
  searchInput.value = '';
  filterCards();
});

cards.forEach(card => {
  $('.destination-image-button', card).addEventListener('click', () => openPlaceDialog(card));
  $('.add-place', card).addEventListener('click', () => {
    const data = getCardData(card);
    if (savedTrip.some(place => place.id === data.id)) removePlace(data.id);
    else addPlace(data);
  });
});

$('#open-trip').addEventListener('click', openDrawer);
$('#open-trip-mobile').addEventListener('click', openDrawer);
$('#close-trip').addEventListener('click', closeDrawer);
drawerBackdrop.addEventListener('click', closeDrawer);
menuToggle.addEventListener('click', toggleMobileMenu);
$$('.mobile-nav a').forEach(link => link.addEventListener('click', closeMobileMenu));
$('#closing-start').addEventListener('click', () => {
  $('#discover').scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  window.setTimeout(() => searchInput.focus({ preventScroll: true }), prefersReducedMotion() ? 0 : 500);
});
$('#close-place-dialog').addEventListener('click', closePlaceDialog);
placeDialog.addEventListener('click', event => {
  if (event.target === placeDialog) closePlaceDialog();
});
placeDialog.addEventListener('close', () => document.body.classList.remove('dialog-open'));
$('#dialog-add').addEventListener('click', () => {
  if (!currentDialogCard) return;
  const data = getCardData(currentDialogCard);
  if (!savedTrip.some(place => place.id === data.id)) addPlace(data);
  closePlaceDialog();
});
$('#toast-close').addEventListener('click', () => toast.classList.remove('visible'));
$('#share-trip').addEventListener('click', async () => {
  const summary = `My NORTHSTAR trip\n${savedTrip.map((place, index) => `${index + 1}. ${place.name}, ${place.country} (${place.duration})`).join('\n')}`;
  const feedback = $('#copy-feedback');
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(summary);
    } else {
      const textarea = document.createElement('textarea');
      textarea.value = summary;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.append(textarea);
      textarea.select();
      const succeeded = document.execCommand('copy');
      textarea.remove();
      if (!succeeded) throw new Error('Copy unavailable');
    }
    feedback.textContent = 'Trip summary copied. Send it to your travel companion.';
  } catch {
    feedback.textContent = 'Copy is unavailable here. Your saved places will stay in this browser.';
  }
});

document.addEventListener('keydown', event => {
  if (event.key === 'Escape') {
    if (drawer.classList.contains('open')) closeDrawer();
    closeMobileMenu();
  }
});
window.addEventListener('resize', () => {
  if (window.innerWidth > 800) closeMobileMenu();
});

renderTrip();
filterCards();
