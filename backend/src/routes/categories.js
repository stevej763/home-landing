const express = require('express');
const db = require('../db');

const router = express.Router();

router.get('/', (req, res) => {
  const categories = db
    .prepare('SELECT * FROM categories ORDER BY sort_order ASC, id ASC')
    .all();
  res.json(categories);
});

router.post('/', (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'name is required' });
  }

  const maxOrder = db
    .prepare('SELECT COALESCE(MAX(sort_order), -1) AS m FROM categories')
    .get().m;

  try {
    const result = db
      .prepare('INSERT INTO categories (name, sort_order) VALUES (?, ?)')
      .run(name.trim(), maxOrder + 1);
    const category = db
      .prepare('SELECT * FROM categories WHERE id = ?')
      .get(result.lastInsertRowid);
    res.status(201).json(category);
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ error: 'category already exists' });
    }
    throw err;
  }
});

router.put('/reorder', (req, res) => {
  const updates = req.body;
  if (!Array.isArray(updates)) {
    return res.status(400).json({ error: 'expected an array of {id, sort_order}' });
  }

  const stmt = db.prepare('UPDATE categories SET sort_order = ? WHERE id = ?');
  const applyAll = db.transaction((items) => {
    for (const item of items) {
      stmt.run(item.sort_order, item.id);
    }
  });
  applyAll(updates);

  res.json({ ok: true });
});

router.put('/:id', (req, res) => {
  const { id } = req.params;
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'name is required' });
  }

  const existing = db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
  if (!existing) {
    return res.status(404).json({ error: 'category not found' });
  }

  db.prepare('UPDATE categories SET name = ? WHERE id = ?').run(name.trim(), id);
  res.json(db.prepare('SELECT * FROM categories WHERE id = ?').get(id));
});

router.delete('/:id', (req, res) => {
  const { id } = req.params;
  const existing = db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
  if (!existing) {
    return res.status(404).json({ error: 'category not found' });
  }

  db.prepare('DELETE FROM categories WHERE id = ?').run(id);
  res.status(204).end();
});

module.exports = router;
