const FALLBACK_ICON =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="%239aa0ab" stroke-width="1.6">' +
      '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"/></svg>'
  );

const state = { categories: [], links: [] };

const board = document.getElementById('board');
const emptyState = document.getElementById('empty-state');

const linkModal = document.getElementById('link-modal');
const linkForm = document.getElementById('link-form');
const linkModalTitle = document.getElementById('link-modal-title');
const linkIdField = document.getElementById('link-id');
const linkNameField = document.getElementById('link-name');
const linkUrlField = document.getElementById('link-url');
const linkDescriptionField = document.getElementById('link-description');
const linkCategoryField = document.getElementById('link-category');

const categoryModal = document.getElementById('category-modal');
const categoryForm = document.getElementById('category-form');
const categoryNameField = document.getElementById('category-name');

const confirmModal = document.getElementById('confirm-modal');
const confirmModalTitle = document.getElementById('confirm-modal-title');
const confirmModalMessage = document.getElementById('confirm-modal-message');
const confirmOkBtn = document.getElementById('confirm-ok-btn');
const confirmCancelBtn = document.getElementById('confirm-cancel-btn');

document.getElementById('add-link-btn').addEventListener('click', () => openLinkModal());
document.getElementById('add-category-btn').addEventListener('click', () => openCategoryModal());

document.getElementById('theme-toggle').addEventListener('click', () => {
  const root = document.documentElement;
  const next = root.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
  root.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
});

document.querySelectorAll('[data-close]').forEach((btn) => {
  btn.addEventListener('click', () => closeModal(document.getElementById(btn.dataset.close)));
});

linkForm.addEventListener('submit', onSubmitLink);
categoryForm.addEventListener('submit', onSubmitCategory);

async function fetchJSON(url, opts) {
  const res = await fetch(url, opts);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  if (res.status === 204) return null;
  return res.json();
}

async function loadAll() {
  const [categories, links] = await Promise.all([
    fetchJSON('/api/categories'),
    fetchJSON('/api/links'),
  ]);
  state.categories = categories;
  state.links = links;
  render();
}

function faviconFor(url) {
  try {
    return new URL(url).origin + '/favicon.ico';
  } catch {
    return FALLBACK_ICON;
  }
}

function render() {
  board.innerHTML = '';

  const linksByCategory = new Map();
  for (const link of state.links) {
    const key = link.category_id ?? 'null';
    if (!linksByCategory.has(key)) linksByCategory.set(key, []);
    linksByCategory.get(key).push(link);
  }

  const sortedCategories = [...state.categories].sort((a, b) => a.sort_order - b.sort_order);

  for (const category of sortedCategories) {
    const links = (linksByCategory.get(String(category.id)) || linksByCategory.get(category.id) || [])
      .sort((a, b) => a.sort_order - b.sort_order);
    board.appendChild(buildCategorySection(category, links));
  }

  const uncategorized = (linksByCategory.get('null') || []).sort((a, b) => a.sort_order - b.sort_order);
  if (uncategorized.length > 0) {
    board.appendChild(buildCategorySection(null, uncategorized));
  }

  emptyState.hidden = !(sortedCategories.length === 0 && uncategorized.length === 0);
  refreshCategorySelect();
}

function buildCategorySection(category, links) {
  const section = document.createElement('section');
  section.className = 'category-section';

  const header = document.createElement('div');
  header.className = 'category-header';

  const name = document.createElement('span');
  name.className = 'cat-name';
  name.textContent = category ? category.name : 'Uncategorized';
  header.appendChild(name);

  if (category) {
    const actions = document.createElement('div');
    actions.className = 'category-header-actions';

    const renameBtn = document.createElement('button');
    renameBtn.className = 'btn-icon';
    renameBtn.textContent = 'Rename';
    renameBtn.addEventListener('click', () => renameCategory(category));

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn-icon danger';
    deleteBtn.textContent = 'Delete';
    deleteBtn.addEventListener('click', () => deleteCategory(category));

    actions.appendChild(renameBtn);
    actions.appendChild(deleteBtn);
    header.appendChild(actions);
  }

  section.appendChild(header);

  const grid = document.createElement('div');
  grid.className = 'link-grid';
  grid.dataset.categoryId = category ? category.id : '';
  attachGridDnd(grid);

  for (const link of links) {
    grid.appendChild(buildLinkCard(link));
  }

  section.appendChild(grid);
  return section;
}

function buildLinkCard(link) {
  const card = document.createElement('div');
  card.className = 'link-card';
  card.draggable = true;
  card.dataset.linkId = link.id;

  card.addEventListener('dragstart', (e) => {
    card.classList.add('dragging');
    e.dataTransfer.setData('text/plain', String(link.id));
    e.dataTransfer.effectAllowed = 'move';
  });
  card.addEventListener('dragend', () => card.classList.remove('dragging'));

  const anchor = document.createElement('a');
  anchor.href = link.url;
  anchor.target = '_blank';
  anchor.rel = 'noopener noreferrer';
  anchor.className = 'link-card-anchor';
  anchor.style.display = 'contents';

  const iconFrame = document.createElement('div');
  iconFrame.className = 'link-icon-frame';

  const icon = document.createElement('img');
  icon.className = 'link-icon';
  icon.src = faviconFor(link.url);
  icon.alt = '';
  icon.onerror = () => {
    icon.onerror = null;
    icon.src = FALLBACK_ICON;
  };
  iconFrame.appendChild(icon);

  const info = document.createElement('div');
  info.className = 'link-info';

  const nameEl = document.createElement('div');
  nameEl.className = 'link-name';
  nameEl.textContent = link.name;
  nameEl.title = link.name;

  info.appendChild(nameEl);

  if (link.description) {
    const descEl = document.createElement('div');
    descEl.className = 'link-description';
    descEl.textContent = link.description;
    descEl.title = link.description;
    info.appendChild(descEl);
  }

  anchor.appendChild(iconFrame);
  anchor.appendChild(info);
  card.appendChild(anchor);

  const actions = document.createElement('div');
  actions.className = 'link-card-actions';

  const editBtn = document.createElement('button');
  editBtn.type = 'button';
  editBtn.className = 'btn-icon';
  editBtn.textContent = '✎';
  editBtn.title = 'Edit';
  editBtn.addEventListener('click', (e) => {
    e.preventDefault();
    openLinkModal(link);
  });

  const deleteBtn = document.createElement('button');
  deleteBtn.type = 'button';
  deleteBtn.className = 'btn-icon danger';
  deleteBtn.textContent = '✕';
  deleteBtn.title = 'Delete';
  deleteBtn.addEventListener('click', (e) => {
    e.preventDefault();
    deleteLink(link);
  });

  actions.appendChild(editBtn);
  actions.appendChild(deleteBtn);
  card.appendChild(actions);

  return card;
}

function attachGridDnd(grid) {
  grid.addEventListener('dragover', (e) => {
    e.preventDefault();
    grid.classList.add('drag-over');
    const dragging = document.querySelector('.link-card.dragging');
    if (!dragging) return;
    const afterElement = getDragAfterElement(grid, e.clientY);
    if (afterElement == null) {
      grid.appendChild(dragging);
    } else {
      grid.insertBefore(dragging, afterElement);
    }
  });

  grid.addEventListener('dragleave', (e) => {
    if (e.target === grid) grid.classList.remove('drag-over');
  });

  grid.addEventListener('drop', async (e) => {
    e.preventDefault();
    grid.classList.remove('drag-over');
    await persistReorder(grid);
  });
}

function getDragAfterElement(container, y) {
  const cards = [...container.querySelectorAll('.link-card:not(.dragging)')];
  return cards.reduce(
    (closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;
      if (offset < 0 && offset > closest.offset) {
        return { offset, element: child };
      }
      return closest;
    },
    { offset: Number.NEGATIVE_INFINITY, element: null }
  ).element;
}

async function persistReorder(grid) {
  const categoryId = grid.dataset.categoryId === '' ? null : Number(grid.dataset.categoryId);
  const ids = [...grid.querySelectorAll('.link-card')].map((el) => Number(el.dataset.linkId));
  const updates = ids.map((id, index) => ({ id, sort_order: index, category_id: categoryId }));

  try {
    await fetchJSON('/api/links/reorder', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    await loadAll();
  } catch (err) {
    alert(err.message);
    await loadAll();
  }
}

function refreshCategorySelect() {
  const previous = linkCategoryField.value;
  linkCategoryField.innerHTML = '';

  const noneOption = document.createElement('option');
  noneOption.value = '';
  noneOption.textContent = 'No category';
  linkCategoryField.appendChild(noneOption);

  for (const category of [...state.categories].sort((a, b) => a.sort_order - b.sort_order)) {
    const option = document.createElement('option');
    option.value = category.id;
    option.textContent = category.name;
    linkCategoryField.appendChild(option);
  }

  if ([...linkCategoryField.options].some((o) => o.value === previous)) {
    linkCategoryField.value = previous;
  }
}

function openLinkModal(link) {
  linkForm.reset();
  refreshCategorySelect();

  if (link) {
    linkModalTitle.textContent = 'Edit link';
    linkIdField.value = link.id;
    linkNameField.value = link.name;
    linkUrlField.value = link.url;
    linkDescriptionField.value = link.description || '';
    linkCategoryField.value = link.category_id || '';
  } else {
    linkModalTitle.textContent = 'Add link';
    linkIdField.value = '';
  }

  openModal(linkModal);
  linkNameField.focus();
}

async function onSubmitLink(e) {
  e.preventDefault();
  const id = linkIdField.value;
  const payload = {
    name: linkNameField.value.trim(),
    url: linkUrlField.value.trim(),
    description: linkDescriptionField.value.trim(),
    category_id: linkCategoryField.value ? Number(linkCategoryField.value) : null,
  };

  try {
    if (id) {
      await fetchJSON(`/api/links/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } else {
      await fetchJSON('/api/links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    }
    closeModal(linkModal);
    await loadAll();
  } catch (err) {
    alert(err.message);
  }
}

async function deleteLink(link) {
  const ok = await confirmDelete('Delete link', `Delete "${link.name}"? This can't be undone.`);
  if (!ok) return;
  try {
    await fetchJSON(`/api/links/${link.id}`, { method: 'DELETE' });
    await loadAll();
  } catch (err) {
    alert(err.message);
  }
}

function openCategoryModal() {
  categoryForm.reset();
  openModal(categoryModal);
  categoryNameField.focus();
}

async function onSubmitCategory(e) {
  e.preventDefault();
  try {
    await fetchJSON('/api/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: categoryNameField.value.trim() }),
    });
    closeModal(categoryModal);
    await loadAll();
  } catch (err) {
    alert(err.message);
  }
}

async function renameCategory(category) {
  const name = prompt('Rename category', category.name);
  if (!name || !name.trim() || name.trim() === category.name) return;
  try {
    await fetchJSON(`/api/categories/${category.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim() }),
    });
    await loadAll();
  } catch (err) {
    alert(err.message);
  }
}

async function deleteCategory(category) {
  const ok = await confirmDelete(
    'Delete category',
    `Delete "${category.name}"? Links inside will become uncategorized.`
  );
  if (!ok) return;
  try {
    await fetchJSON(`/api/categories/${category.id}`, { method: 'DELETE' });
    await loadAll();
  } catch (err) {
    alert(err.message);
  }
}

function openModal(modal) {
  modal.hidden = false;
}

function closeModal(modal) {
  modal.hidden = true;
}

function confirmDelete(title, message) {
  confirmModalTitle.textContent = title;
  confirmModalMessage.textContent = message;
  openModal(confirmModal);

  return new Promise((resolve) => {
    const cleanup = (result) => {
      closeModal(confirmModal);
      confirmOkBtn.removeEventListener('click', onConfirm);
      confirmCancelBtn.removeEventListener('click', onCancel);
      resolve(result);
    };
    const onConfirm = () => cleanup(true);
    const onCancel = () => cleanup(false);

    confirmOkBtn.addEventListener('click', onConfirm);
    confirmCancelBtn.addEventListener('click', onCancel);
  });
}

loadAll().catch((err) => {
  console.error(err);
  alert('Failed to load dashboard: ' + err.message);
});
