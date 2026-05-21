const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyToken } = require('../middleware/auth');
const { getAssistantResponse } = require('../services/claude');

// Iniciar una nueva llamada dentro de una orden
router.post('/start', verifyToken, async (req, res) => {
  const { order_id } = req.body;
  if (!order_id) return res.status(400).json({ error: 'order_id requerido' });

  const order = db.prepare('SELECT * FROM service_orders WHERE id = ? AND status = ?').get(order_id, 'active');
  if (!order) return res.status(404).json({ error: 'Orden no encontrada o inactiva' });

  const patient = db.prepare('SELECT * FROM patients WHERE id = ?').get(order.patient_id);
  if (!patient) return res.status(404).json({ error: 'Paciente no encontrado' });

  const callNumber = order.calls_completed + 1;

  const logResult = db.prepare(
    'INSERT INTO call_logs (order_id, call_number) VALUES (?, ?)'
  ).run(order_id, callNumber);

  const callLogId = logResult.lastInsertRowid;

  try {
    const { text, isUrgent } = await getAssistantResponse(patient, order, callNumber, []);

    const initialTranscript = [{ role: 'assistant', content: text }];
    db.prepare('UPDATE call_logs SET transcript = ? WHERE id = ?')
      .run(JSON.stringify(initialTranscript), callLogId);

    if (isUrgent) {
      db.prepare('UPDATE call_logs SET urgent_flag = 1 WHERE id = ?').run(callLogId);
    }

    res.json({ call_log_id: callLogId, call_number: callNumber, message: text, is_urgent: isUrgent });
  } catch (err) {
    db.prepare('DELETE FROM call_logs WHERE id = ?').run(callLogId);
    res.status(500).json({ error: `Error del asistente: ${err.message}` });
  }
});

// El paciente responde — el asistente contesta
router.post('/respond', verifyToken, async (req, res) => {
  const { call_log_id, patient_message } = req.body;
  if (!call_log_id || !patient_message) {
    return res.status(400).json({ error: 'call_log_id y patient_message requeridos' });
  }

  const callLog = db.prepare('SELECT * FROM call_logs WHERE id = ?').get(call_log_id);
  if (!callLog) return res.status(404).json({ error: 'Llamada no encontrada' });

  const order = db.prepare('SELECT * FROM service_orders WHERE id = ?').get(callLog.order_id);
  const patient = db.prepare('SELECT * FROM patients WHERE id = ?').get(order.patient_id);

  const history = JSON.parse(callLog.transcript || '[]');
  history.push({ role: 'user', content: patient_message });

  try {
    const { text, isUrgent } = await getAssistantResponse(patient, order, callLog.call_number, history);
    history.push({ role: 'assistant', content: text });

    db.prepare('UPDATE call_logs SET transcript = ?, urgent_flag = ? WHERE id = ?')
      .run(JSON.stringify(history), isUrgent ? 1 : callLog.urgent_flag, call_log_id);

    res.json({ message: text, is_urgent: isUrgent });
  } catch (err) {
    res.status(500).json({ error: `Error del asistente: ${err.message}` });
  }
});

// Terminar la llamada y guardar resumen
router.post('/end', verifyToken, async (req, res) => {
  const { call_log_id, summary } = req.body;
  if (!call_log_id) return res.status(400).json({ error: 'call_log_id requerido' });

  const callLog = db.prepare('SELECT * FROM call_logs WHERE id = ?').get(call_log_id);
  if (!callLog) return res.status(404).json({ error: 'Llamada no encontrada' });

  db.prepare(`
    UPDATE call_logs
    SET ended_at = datetime('now','localtime'), summary = ?
    WHERE id = ?
  `).run(summary || null, call_log_id);

  db.prepare(`
    UPDATE service_orders
    SET calls_completed = calls_completed + 1
    WHERE id = ?
  `).run(callLog.order_id);

  res.json({ success: true });
});

// Ver transcripción de una llamada
router.get('/log/:call_log_id', verifyToken, (req, res) => {
  const log = db.prepare('SELECT * FROM call_logs WHERE id = ?').get(req.params.call_log_id);
  if (!log) return res.status(404).json({ error: 'Llamada no encontrada' });

  res.json({ ...log, transcript: JSON.parse(log.transcript || '[]') });
});

module.exports = router;
