const express = require('express');
const cors = require('cors');

const categoriesRouter = require('./routes/categories');
const linksRouter = require('./routes/links');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ ok: true }));
app.use('/api/categories', categoriesRouter);
app.use('/api/links', linksRouter);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'internal server error' });
});

app.listen(port, () => {
  console.log(`homelab-landing backend listening on :${port}`);
});
