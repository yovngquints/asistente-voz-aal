const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyToken } = require('../middleware/auth');

router.get('/', verifyToken, (req, res) => {
  const status = req.query.status || 'active';
  const orders = db.prepare(`
    SELECT o.*, p.name as patient_name, p.phone as patient_phone,
           p.condition as patient_condition, p.age as patient_age
    FROM service_orders o
    JOIN patients p ON p.id = o.patient_id
    WHERE o.status = ?
    ORDER BY o.created_at DESC
  `).all(status);

  const result = orders.map(o => {
    const lastCall = db.prepare(
      'SELECT id, call_number, urgent_flag, started_at, ended_at FROM call_logs WHERE order_id = ? ORDER BY call_number DESC LIMIT 1'
    ).get(o.id);
    return { ...o, last_call: lastCall || null };
  });

  res.json(result);
});

router.get('/:id', verifyToken, (req, res) => {
  const order = db.prepare(`
    SELECT o.*, p.name as patient_name, p.phone as patient_phone,
           p.condition as patient_condition, p.age as patient_age,
           p.medications as patient_medications, p.allergies as patient_allergies,
           p.special_instructions as patient_instructions
    FROM service_orders o
    JOIN patients p ON p.id = o.patient_id
    WHERE o.id = ?
  `).get(req.params.id);

  if (!order) return res.status(404).json({ error: 'Orden no encontrada' });

  const calls = db.prepare(
    'SELECT * FROM call_logs WHERE order_id = ? ORDER BY call_number ASC'
  ).all(req.params.id);

  res.json({ ...order, calls });
});

router.post('/', verifyToken, (req, res) => {
  const { patient_id, crew_name, eta_minutes, call_interval_minutes, notes } = req.body;
  if (!patient_id) return res.status(400).json({ error: 'Paciente requerido' });

  const result = db.prepare(`
    INSERT INTO service_orders (patient_id, crew_name, eta_minutes, call_interval_minutes, notes)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    patient_id,
    crew_name || 'Tripulación asignada',
    eta_minutes || 30,
    call_interval_minutes || 10,
    notes || null
  );

  res.json({ success: true, id: result.lastInsertRowid });
});

router.patch('/:id/complete', verifyToken, (req, res) => {
  db.prepare(
    "UPDATE service_orders SET status = 'completed', completed_at = datetime('now','localtime') WHERE id = ?"
  ).run(req.params.id);
  res.json({ success: true });
});

router.patch('/:id/cancel', verifyToken, (req, res) => {
  db.prepare(
    "UPDATE service_orders SET status = 'cancelled', completed_at = datetime('now','localtime') WHERE id = ?"
  ).run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
