const express = require('express');
const db = require('../db');

const router = express.Router();

function isValidUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

router.get('/', (req, res) => {
  const links = db
    .prepare(
      `SELECT links.*, categories.name AS category_name
       FROM links
       LEFT JOIN categories ON categories.id = links.category_id
       ORDER BY links.sort_order ASC, links.id ASC`
    )
    .all();
  res.json(links);
});

router.post('/', (req, res) => {
  const { name, url, description, category_id: categoryId } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'name is required' });
  }
  if (!url || !isValidUrl(url)) {
    return res.status(400).json({ error: 'a valid http(s) url is required' });
  }

  const maxOrder = db
    .prepare('SELECT COALESCE(MAX(sort_order), -1) AS m FROM links WHERE category_id IS ?')
    .get(categoryId ?? null).m;

  const result = db
    .prepare(
      `INSERT INTO links (name, url, description, category_id, sort_order)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(name.trim(), url.trim(), description?.trim() || null, categoryId ?? null, maxOrder + 1);

  const link = db.prepare('SELECT * FROM links WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(link);
});

router.put('/reorder', (req, res) => {
  const updates = req.body;
  if (!Array.isArray(updates)) {
    return res.status(400).json({ error: 'expected an array of {id, sort_order, category_id}' });
  }

  const stmt = db.prepare('UPDATE links SET sort_order = ?, category_id = ? WHERE id = ?');
  const applyAll = db.transaction((items) => {
    for (const item of items) {
      stmt.run(item.sort_order, item.category_id ?? null, item.id);
    }
  });
  applyAll(updates);

  res.json({ ok: true });
});

router.put('/:id', (req, res) => {
  const { id } = req.params;
  const { name, url, description, category_id: categoryId } = req.body;

  const existing = db.prepare('SELECT * FROM links WHERE id = ?').get(id);
  if (!existing) {
    return res.status(404).json({ error: 'link not found' });
  }
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'name is required' });
  }
  if (!url || !isValidUrl(url)) {
    return res.status(400).json({ error: 'a valid http(s) url is required' });
  }

  db.prepare(
    `UPDATE links SET name = ?, url = ?, description = ?, category_id = ? WHERE id = ?`
  ).run(name.trim(), url.trim(), description?.trim() || null, categoryId ?? null, id);

  res.json(db.prepare('SELECT * FROM links WHERE id = ?').get(id));
});

router.delete('/:id', (req, res) => {
  const { id } = req.params;
  const existing = db.prepare('SELECT * FROM links WHERE id = ?').get(id);
  if (!existing) {
    return res.status(404).json({ error: 'link not found' });
  }

  db.prepare('DELETE FROM links WHERE id = ?').run(id);
  res.status(204).end();
});

module.exports = router;
