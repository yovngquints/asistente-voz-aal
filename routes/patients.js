const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyToken } = require('../middleware/auth');

router.get('/', verifyToken, (req, res) => {
  const patients = db.prepare(
    'SELECT * FROM patients WHERE active = 1 ORDER BY name ASC'
  ).all();
  res.json(patients);
});

router.get('/:id', verifyToken, (req, res) => {
  const p = db.prepare('SELECT * FROM patients WHERE id = ?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Paciente no encontrado' });
  res.json(p);
});

router.post('/', verifyToken, (req, res) => {
  const {
    name, age, id_number, phone, condition, medications,
    allergies, blood_type, emergency_contact_name,
    emergency_contact_phone, special_instructions
  } = req.body;

  if (!name) return res.status(400).json({ error: 'El nombre es requerido' });

  try {
    const result = db.prepare(`
      INSERT INTO patients
        (name, age, id_number, phone, condition, medications, allergies,
         blood_type, emergency_contact_name, emergency_contact_phone, special_instructions)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      name.trim(), age || null, id_number || null, phone || null,
      condition || null, medications || null, allergies || null,
      blood_type || null, emergency_contact_name || null,
      emergency_contact_phone || null, special_instructions || null
    );
    res.json({ success: true, id: result.lastInsertRowid });
  } catch (err) {
    if (err.message.includes('UNIQUE')) return res.status(400).json({ error: 'El número de cédula ya existe' });
    res.status(500).json({ error: 'Error al guardar paciente' });
  }
});

router.put('/:id', verifyToken, (req, res) => {
  const {
    name, age, id_number, phone, condition, medications,
    allergies, blood_type, emergency_contact_name,
    emergency_contact_phone, special_instructions
  } = req.body;

  db.prepare(`
    UPDATE patients SET
      name = ?, age = ?, id_number = ?, phone = ?, condition = ?,
      medications = ?, allergies = ?, blood_type = ?,
      emergency_contact_name = ?, emergency_contact_phone = ?,
      special_instructions = ?
    WHERE id = ?
  `).run(
    name, age || null, id_number || null, phone || null,
    condition || null, medications || null, allergies || null,
    blood_type || null, emergency_contact_name || null,
    emergency_contact_phone || null, special_instructions || null,
    req.params.id
  );
  res.json({ success: true });
});

router.delete('/:id', verifyToken, (req, res) => {
  db.prepare('UPDATE patients SET active = 0 WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
