<<<<<<< HEAD
# Smart Attendance System

A hybrid AI-powered attendance platform that automates student attendance using facial recognition.

Built using a React + Next.js frontend, FastAPI backend, SQLite database, and InsightFace embeddings, the system supports real-time attendance marking, student registration, CSV report generation, and mobile deployment on iPhone using Capacitor + Xcode.

---

## Project Overview

Traditional attendance systems are repetitive, manual, and time-consuming.

This project was built to simplify classroom attendance using computer vision and facial embeddings.

The workflow is straightforward:

* Faculty logs into the system
* Classes can be created and managed
* Students are registered using face capture/upload
* The system extracts facial embeddings and stores them securely
* During attendance, live face scans are compared against stored embeddings
* Matching students are automatically marked present
* Attendance reports can be exported as CSV files

The project was designed as a full-stack AI application with mobile support.

---

# Tech Stack

## Frontend

* React
* Next.js 15
* TypeScript
* Tailwind CSS
* Framer Motion

## Backend

* FastAPI
* Python
* Uvicorn

## AI / Computer Vision

* InsightFace
* OpenCV
* ONNX Runtime
* scikit-learn

## Database

* SQLite

## Mobile Deployment

* Capacitor
* Xcode
* WKWebView

---

# System Architecture

```text
Frontend (React + Next.js)
        ↓
HTTP API Requests
        ↓
FastAPI Backend
        ↓
OpenCV Image Processing
        ↓
InsightFace Embedding Extraction
        ↓
Cosine Similarity Matching
        ↓
SQLite Database
```

---

# Key Features

* AI-powered facial recognition attendance
* Student registration with face embeddings
* Real-time attendance marking
* Attendance statistics dashboard
* CSV report generation
* Mobile-friendly UI
* iPhone deployment support
* Local network communication between phone and backend
* Responsive frontend interface

---

# Facial Recognition Pipeline

## Registration Flow

```text
Student Image
    ↓
OpenCV preprocessing
    ↓
InsightFace embedding extraction
    ↓
Embedding stored in SQLite
```

## Attendance Flow

```text
Live Camera Scan
        ↓
Image preprocessing
        ↓
Embedding generation
        ↓
Cosine similarity comparison
        ↓
Attendance marked
```

The system compares facial embedding vectors instead of comparing raw images directly.

---

# Folder Structure

```text
smart_attendance/
│
├── backend/
│   ├── main.py
│   ├── database.py
│   ├── recognition.py
│
├── frontend/
│   ├── app/
│   ├── components/
│   ├── ios/
│   ├── public/
│   ├── out/
│   ├── capacitor.config.ts
│
├── reports/
├── models/
├── src/
├── attendance.db
├── start_dev.sh
```

---

# Important Components

## `backend/main.py`

Main FastAPI backend application.
Handles API routes, authentication, attendance APIs, and report generation.

## `backend/database.py`

Handles SQLite operations including student records, attendance storage, and report generation.

## `backend/recognition.py`

Core facial recognition pipeline.
Handles embedding extraction and similarity matching.

## `frontend/components/attendance-app.tsx`

Main frontend application logic.
Handles UI state, API communication, and attendance workflows.

## `frontend/ios/`

Generated Capacitor iOS project opened through Xcode.

---

# Running the Project Locally

## 1. Clone the Repository

```bash
git clone <your-repo-url>
cd smart_attendance
```

---

## 2. Backend Setup

Create virtual environment:

```bash
python -m venv venv
```

Activate virtual environment:

### macOS/Linux

```bash
source venv/bin/activate
```

### Windows

```bash
venv\Scripts\activate
```

Install dependencies:

```bash
pip install -r requirements.txt
```

Run backend:

```bash
cd backend
uvicorn main:app --reload
```

Backend will run on:

```text
http://localhost:8000
```

---

## 3. Frontend Setup

Open another terminal:

```bash
cd frontend
npm install
```

Run frontend:

```bash
npm run dev
```

Frontend will run on:

```text
http://localhost:3000
```

---

# Running on iPhone

## Build Frontend

```bash
npm run build
```

This generates the static frontend inside:

```text
frontend/out/
```

---

## Sync with Capacitor

```bash
npx cap sync ios
```

---

## Open in Xcode

```bash
npx cap open ios
```

---

## Important Notes

* Backend must still be running on your laptop
* Phone and laptop should be connected to the same WiFi network
* Replace localhost with your laptop's LAN IP for mobile testing

Example:

```text
http://192.168.x.x:8000
```

---

# API Endpoints

| Endpoint                        | Method | Purpose                |
| ------------------------------- | ------ | ---------------------- |
| `/auth/login`                   | POST   | Faculty login          |
| `/register`                     | POST   | Register student face  |
| `/recognize`                    | POST   | Attendance recognition |
| `/classes`                      | GET    | Fetch classes          |
| `/classes/{id}/attendance`      | GET    | Attendance records     |
| `/classes/{id}/report/download` | GET    | Download CSV report    |

---

# What I Learned

This project helped me explore:

* Full-stack application architecture
* Frontend-backend communication using REST APIs
* Facial embedding systems
* AI inference workflows
* Computer vision preprocessing
* Mobile app deployment using Capacitor and Xcode
* Local network debugging
* Database design and persistence
* State management in React
* Hybrid mobile application architecture

---

# Current Limitations

The current implementation is optimized for prototype/demo-scale usage.

Some production-level improvements that can be added:

* JWT authentication
* Password hashing
* Cloud deployment
* PostgreSQL instead of SQLite
* Liveness detection / anti-spoofing
* Vector database indexing for scalability
* Role-based access control
* Automated testing

---

# Future Improvements

* Cloud-hosted backend
* Real-time attendance analytics
* Multi-device synchronization
* Student attendance notifications
* Admin dashboard
* Better recognition optimization for large classrooms

---



# Author

Ananya

Computer Science Engineering Student
Specialization: Business Analytics

Interested in AI/ML, Data Science, Full-Stack Development, and Intelligent Systems.

---

# Final Note

This project was built as an exploration of how AI, computer vision, backend systems, and hybrid mobile applications can work together to solve a real-world academic workflow problem.

The goal was not just to build a UI, but to understand the complete engineering pipeline behind an AI-assisted application.
=======
# smart_attendance
AI-based smart attendance system with facial embedding recognition, REST APIs, mobile deployment, and real-time attendance analytics.
>>>>>>> 159a313cf52c80551fd27c5c913fba0500d887ad
