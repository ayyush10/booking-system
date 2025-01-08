# Appointment Booking System

This repository provides an appointment booking system where professors and students can interact. Professors can set availability, and students can book or cancel appointments. The application includes authentication and role-based authorization.

---

## Features

1. **User Roles:**
   - `Student`: Can view and book available time slots.
   - `Professor`: Can set available time slots and cancel appointments.

2. **Authentication & Authorization:**
   - JWT-based authentication.
   - Middleware to enforce role-based access.

3. **Database:**
   - MongoDB for storing user profiles, appointments, and availability.

4. **Cancel Appointment Endpoint:**
   - Professors can cancel their own appointments.
   - Automatically restores the canceled slot to the professor's availability.

---

## Prerequisites

- **Node.js**: v14 or later
- **MongoDB**: DocumentDB or Local MongoDB instance

---

## Installation

1. Clone the repository:
   ```bash
   git clone <repository_url>
   cd <repository_name>
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   Create a `.env` file with the following variables:
   ```env
   JWT_SECRET=your-jwt-secret-key
   PORT=8080
   DB_URI=your-mongodb-connection-uri
   ```

4. Start the server:
   ```bash
   node index.js
   ```

---

## API Endpoints

### 1. **Cancel Appointment** (For Professors)

- **Endpoint**: `/appointments/cancel`
- **Method**: `DELETE`
- **Headers**:
  - `Authorization`: `Bearer <professor_token>`
  - `Content-Type`: `application/json`
- **Body**:
  ```json
  {
    "appointmentId": "<appointment_id>"
  }
  ```
- **Response**:
  - Success:
    ```json
    {
      "message": "Appointment canceled successfully"
    }
    ```
  - Errors:
    - `404`: Appointment not found
    - `403`: Access denied (trying to cancel someone else's appointment)
    - `500`: Internal server error

---

## Middleware

### 1. **Authentication Middleware**
Ensures only authenticated users can access routes:
```javascript
function authMiddleware(req, res, next) {
  const token = req.header('Authorization');
  if (!token) return res.status(401).json({ error: 'Access denied, no token provided' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(400).json({ error: 'Invalid token' });
  }
}
```

### 2. **Role Middleware**
Restricts access to routes based on user roles:
```javascript
function roleMiddleware(role) {
  return (req, res, next) => {
    if (req.user.role !== role) {
      return res.status(403).json({ error: 'Access denied, insufficient permissions' });
    }
    next();
  };
}
```

---

## Database Models

### 1. **User Schema**
```javascript
const UserSchema = new mongoose.Schema({
  name: String,
  email: String,
  password: String,
  role: { type: String, enum: ['student', 'professor'], required: true }
});
```

### 2. **Appointment Schema**
```javascript
const AppointmentSchema = new mongoose.Schema({
  studentId: mongoose.Schema.Types.ObjectId,
  professorId: mongoose.Schema.Types.ObjectId,
  slot: String,
});
```

### 3. **Professor Availability Schema**
```javascript
const ProfessorAvailabilitySchema = new mongoose.Schema({
  professorId: mongoose.Schema.Types.ObjectId,
  availableSlots: [String],
});
```

---

## License

This project is licensed under the MIT License. See the `LICENSE` file for details.

---

## Contributing

Feel free to fork this repository and contribute by submitting a pull request. For major changes, please open an issue first to discuss what you would like to change.

---

## Author

[Ayush Gupta](https://github.com/yourusername)

