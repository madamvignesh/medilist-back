const express = require('express');
const cors = require('cors');
const { open } = require('sqlite');
const sqlite3 = require('sqlite3');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

const dbPath = path.join(__dirname, 'medilistdoctors.db');
let db;

// API test route
app.get('/', (req, res) => {
  res.send('API is working');
});

// Get all doctors
app.get('/api/doctors/search', async (req, res) => {
  try {
    const search = req.query.search || '';
    const doctors = await db.all(
      'SELECT * FROM doctorsheet WHERE name LIKE ? OR specialization LIKE ?',
      [`%${search}%`, `%${search}%`]
    );
    res.json(doctors);
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
});


// Book appointment (example structure)
app.post('/api/book', async (req, res) => {
  const { name, email, datetime, doctor_name } = req.body;
  const id = uuidv4();
  try {
    const data = await db.get('SELECT * FROM doctorsheet WHERE name = ?', [doctor_name]);
    if (!data) {
      return res.status(404).send({ error: 'Doctor not found' });
    }
    if (!name || !email || !datetime) {
      return res.status(400).send({ error: 'Name, email, and datetime are required' });
    }
    // Check doctor availability (this is a simplified example)
    if (data.availability !== 'Available') {
      return res.status(400).send({ error: 'Doctor is not available' });
    }
    await db.run(
      'INSERT INTO appointments (id, name, email, datetime, doctor_name) VALUES (?, ?, ?, ?, ?)',
      [id, name, email, datetime, doctor_name]
    );
    await db.run(
      'UPDATE doctorsheet SET availability = ? WHERE name = ?',
      ['Appointed', doctor_name]
    );
    res.send({ message: 'Appointment booked successfully', id });
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
});

app.get('/api/appointments', async (req, res) => {
  try {
    const appointments = await db.all('SELECT * FROM appointments');
    res.json(appointments);
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
});

app.delete('/api/appointments/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const data = await db.get('SELECT * FROM appointments WHERE id = ?', [id]);
    const doctorName = data ? data.doctor_name : null;
    if (!data) {
      return res.status(404).send({ error: 'Appointment not found' });
    }
    await db.run('DELETE FROM appointments WHERE id = ?', [id]);
    await db.run(
      'UPDATE doctorsheet SET availability = ? WHERE name = ?',
      ['Available', doctorName]
    );
    res.send({ message: 'Appointment canceled successfully' });
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
});

app.get('/api/management', async (req, res) => {
  try {
    const doctors = await db.all('SELECT * FROM doctorsheet');
    res.json(doctors);
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
});

app.put('/api/management/:id', async (req, res) => {
  const { id } = req.params;
  const {availability} = req.body;
  try {
    await db.run('UPDATE doctorsheet SET availability = ? WHERE id = ?', [availability, id]);
    const doctor = await db.get('SELECT * FROM doctorsheet WHERE id = ?', [id]);
    if (availability === 'Available' || availability === 'Not Available' || availability === 'On Leave') {
      await db.run('DELETE FROM appointments WHERE doctor_name = ?', [doctor.name]);
    }
    res.send({ message: 'Doctor availability updated successfully' });
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
});

// Initialize DB and server
async function initializeDatabase() {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });

    app.listen(PORT, () => {
      console.log(`Server Running at http://localhost:${PORT}/`);
    });
  } catch (error) {
    console.error(`DB Error: ${error.message}`);
    process.exit(1);
  }
}

initializeDatabase();
