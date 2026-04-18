require('dotenv').config();
const express   = require('express');
const mongoose  = require('mongoose');
const cors      = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/auth',    require('./routes/auth'));
app.use('/api/users',   require('./routes/users'));
app.use('/api/events',  require('./routes/events'));
app.use('/api/alerts',  require('./routes/alerts'));
app.use('/api/stats',   require('./routes/stats'));
app.use('/api/reports', require('./routes/reports'));

const PORT      = process.env.PORT || 4000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/siem';

mongoose.connect(MONGO_URI)
  .then(() => {
    console.log('[DB] Connected');
    app.listen(PORT, () => console.log(`[Server] http://localhost:${PORT}`));
  })
  .catch(err => { console.error('[DB]', err.message); process.exit(1); });
