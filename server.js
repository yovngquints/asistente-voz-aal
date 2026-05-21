require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/auth',      require('./routes/auth'));
app.use('/api/patients',  require('./routes/patients'));
app.use('/api/orders',    require('./routes/orders'));
app.use('/api/assistant', require('./routes/assistant'));
app.use('/api/tts',       require('./routes/tts'));

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Error interno del servidor' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`\n🚀 Asistente de voz AAL corriendo en http://localhost:${PORT}`);
  console.log(`   Panel de control:  http://localhost:${PORT}/index.html`);
  console.log(`   Simulador de llamada: http://localhost:${PORT}/call.html\n`);
  if (!process.env.CLAUDE_API_KEY) {
    console.warn('⚠️  ADVERTENCIA: CLAUDE_API_KEY no configurada en .env');
  }
});
