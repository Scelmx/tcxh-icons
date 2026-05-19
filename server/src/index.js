const express = require('express');
const cors = require('cors');
const path = require('path');
const { uploadsDir } = require('./utils/storage');
const iconsRouter = require('./routes/icons');
const publishRouter = require('./routes/publish');

const app = express();
const PORT = process.env.PORT || 3001;

// 中间件
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(uploadsDir));

// 路由
app.use('/api/icons', iconsRouter);
app.use('/api/publish', publishRouter);

// 健康检查
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => console.log(`Server: http://localhost:${PORT}`));
