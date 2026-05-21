const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs-extra');
const { uploadsDir } = require('./utils/storage');
const { getRuntimeRoot, isPkg } = require('./utils/paths');
const iconsRouter = require('./routes/icons');
const publishRouter = require('./routes/publish');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(uploadsDir));

app.use('/api/icons', iconsRouter);
app.use('/api/publish', publishRouter);
app.get('/api/health', (req, res) => res.json({ status: 'ok', pkg: isPkg }));

// 可选：托管前端静态资源（设置 CLIENT_DIST 或放置于运行时目录下的 client/）
const clientDist =
  process.env.CLIENT_DIST ||
  (process.env.SERVE_CLIENT === '1' ? path.join(getRuntimeRoot(), 'client') : null);

if (clientDist && fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
      return res.status(404).end();
    }
    res.sendFile(path.join(clientDist, 'index.html'));
  });
  console.log(`Serving frontend from: ${clientDist}`);
}

app.listen(PORT, () => {
  console.log(`Server: http://localhost:${PORT}`);
  console.log(`Runtime root: ${getRuntimeRoot()}`);
  if (isPkg) console.log('Mode: standalone binary (pkg)');
});
