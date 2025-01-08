const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const { authMiddleware, roleMiddleware } = require('./middlewares/auth');

// Load environment variables
dotenv.config();

// Initialize app
const app = express();
app.use(express.json());

// MongoDB Connection
mongoose.connect(process.env.DB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log('Connected to MongoDB successfully'))
  .catch((err) => console.error('MongoDB connection error:', err));

// Models
const User = mongoose.model('User', new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  password: String,
  role: String,
}));

const ProfessorAvailability = mongoose.model('ProfessorAvailability', new mongoose.Schema({
  professorId: mongoose.Schema.Types.ObjectId,
  availableSlots: [Date],
}));

const Appointment = mongoose.model('Appointment', new mongoose.Schema({
  studentId: mongoose.Schema.Types.ObjectId,
  professorId: mongoose.Schema.Types.ObjectId,
  slot: Date,
}));

// Root Route
app.get('/', (req, res) => {
  res.json({ message: 'Professor Appointment System API' });
});

// Signup
app.post('/auth/signup', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ name, email, password: hashedPassword, role });
    await user.save();
    res.status(201).json({ message: 'User registered successfully' });
  } catch (err) {
    res.status(400).json({ error: 'Error registering user' });
  }
});

// Login
app.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ userId: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1h' });
    res.json({ token });
  } catch (err) {
    res.status(400).json({ error: 'Error logging in' });
  }
});

// Add Availability (Professor)
app.post('/professors/:professorId/availability', authMiddleware, roleMiddleware('professor'), async (req, res) => {
  try {
    const { professorId } = req.params;
    const { availableSlots } = req.body;

    let availability = await ProfessorAvailability.findOne({ professorId });
    if (!availability) {
      availability = new ProfessorAvailability({ professorId, availableSlots });
    } else {
      const newSlots = availableSlots.filter(slot =>
        !availability.availableSlots.some(s => new Date(s).getTime() === new Date(slot).getTime())
      );
      availability.availableSlots.push(...newSlots);
    }

    await availability.save();
    res.status(200).json({ message: 'Availability updated successfully' });
  } catch (err) {
    res.status(400).json({ error: 'Error updating availability' });
  }
});

// View Availability (Students)
app.get('/professors/:professorId/availability', authMiddleware, async (req, res) => {
  try {
    const { professorId } = req.params;
    const availability = await ProfessorAvailability.findOne({ professorId });

    if (!availability) return res.status(404).json({ error: 'No availability found' });

    const bookedSlots = await Appointment.find({ professorId }).select('slot');
    const bookedSlotTimes = bookedSlots.map(a => a.slot.getTime());

    const freeSlots = availability.availableSlots.filter(slot => !bookedSlotTimes.includes(slot.getTime()));
    res.json({ availableSlots: freeSlots });
  } catch (err) {
    res.status(400).json({ error: 'Error fetching availability' });
  }
});

// Book Appointment
app.post('/appointments/book', authMiddleware, roleMiddleware('student'), async (req, res) => {
  try {
    const { studentId, professorId, slot } = req.body;

    const student = await User.findById(studentId);
    const professor = await User.findById(professorId);
    if (!student || !professor || professor.role !== 'professor') {
      return res.status(400).json({ error: 'Invalid student or professor ID' });
    }

    const availability = await ProfessorAvailability.findOne({ professorId });
    if (!availability || !availability.availableSlots.some(s => new Date(s).getTime() === new Date(slot).getTime())) {
      return res.status(400).json({ error: 'Slot not available' });
    }

    const appointment = new Appointment({ studentId, professorId, slot });
    await appointment.save();

    // Remove the booked slot from availability
    availability.availableSlots = availability.availableSlots.filter(s => s.getTime() !== new Date(slot).getTime());
    await availability.save();

    res.status(201).json({ message: 'Appointment booked successfully' });
  } catch (err) {
    res.status(400).json({ error: 'Error booking appointment' });
  }
});
// Cancel Appointment
app.delete('/appointments/cancel', authMiddleware, roleMiddleware('professor'), async (req, res) => {
  try {
    const { appointmentId } = req.body;

    // Validate appointment ID
    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    // Ensure the professor is canceling their own appointment
    if (appointment.professorId.toString() !== req.user.userId) {
      return res.status(403).json({ error: 'Access denied. You can only cancel your own appointments.' });
    }

    // Remove the appointment
    await Appointment.findByIdAndDelete(appointmentId);

    // Restore the slot to the professor's availability
    const availability = await ProfessorAvailability.findOne({ professorId: req.user.userId });
    if (availability) {
      availability.availableSlots.push(appointment.slot);
      availability.availableSlots = availability.availableSlots.sort(); // Sort slots after adding
      await availability.save();
    }

    res.status(200).json({ message: 'Appointment canceled successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error canceling appointment' });
  }
});


// Start Server
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
