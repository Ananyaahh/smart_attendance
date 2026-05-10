# Smart Attendance App Overview

## 1. App Summary

**Smart Attendance** is a faculty-facing attendance management system that uses facial recognition to automate student attendance. It combines a Python backend for recognition and data processing with a modern Next.js frontend for class operations, student registration, live attendance tracking, and report generation.

The application is designed to reduce manual attendance work in classrooms by allowing teachers to:

- create and manage classes
- register students with face data
- recognize students from uploaded or captured images
- mark attendance automatically
- review daily attendance records and statistics
- download CSV attendance reports

## 2. Purpose of the App

The main purpose of the app is to digitize and simplify the attendance workflow in educational institutions.

### Core goals

- eliminate repetitive manual roll calls
- improve attendance accuracy using biometric face matching
- provide faculty with a simple dashboard for daily operations
- maintain attendance history for reporting and analysis
- support mobile-friendly usage for real classroom environments

### Problems it solves

- time lost during manual attendance taking
- inaccurate or proxy attendance entries
- difficulty managing attendance across multiple classes
- lack of quick reporting for faculty and administration

## 3. Main Features

### Faculty authentication

- email/password login
- signup flow for new faculty
- Google sign-in integration
- optional welcome email on new Google-based account creation

### Class management

- create classes with class name, section, and semester
- fetch class lists by faculty
- maintain faculty-to-class ownership

### Student registration

- register students with name, roll number, and facial image
- generate and store face embeddings
- detect duplicates within the same class
- detect face matches across classes and map students accordingly

### Attendance operations

- recognize students from a live or uploaded image
- automatically mark attendance for matched students
- show daily present and absent counts
- store attendance by class, date, and time

### Reports and analytics

- attendance history by class
- attendance day summaries
- daily attendance statistics
- CSV report generation and download

### Mobile readiness

- frontend can be exported as a static site
- Capacitor configuration is included for iPhone packaging
- PWA-style manifest and installable metadata are already present

## 4. System Architecture

The app follows a lightweight full-stack architecture:

### Frontend

- built with Next.js and React
- provides the faculty dashboard and interaction flows
- handles authentication UI, class selection, registration, attendance views, and reports
- connects to the backend through REST APIs

### Backend

- built with FastAPI
- exposes APIs for authentication, classes, student management, face recognition, attendance, and report downloads
- processes images, extracts face embeddings, performs similarity matching, and updates attendance records

### Database

- SQLite is used as the primary database
- stores faculty, classes, students, attendance, and generated report metadata
- configured with WAL mode for better local concurrency

### AI/Recognition layer

- InsightFace is used for face detection and embedding generation
- ONNX Runtime runs the model inference
- cosine similarity is used to compare embeddings and identify best matches

## 5. Current Tech Stack

### Backend stack

- **Python**
- **FastAPI** for REST API development
- **Uvicorn** as the ASGI server
- **SQLite** for persistent local storage
- **NumPy** for numerical processing
- **OpenCV** for image decoding and processing
- **InsightFace** for face analysis and embeddings
- **ONNX Runtime** for model execution
- **scikit-learn** for cosine similarity matching
- **python-dotenv** for environment variable loading
- **google-auth** for Google identity verification
- **smtplib / email.message** for SMTP-based welcome emails

### Frontend stack

- **Next.js 15**
- **React 19**
- **TypeScript**
- **Tailwind CSS**
- **Framer Motion** for UI motion
- **Lucide React** for icons
- **class-variance-authority**, **clsx**, and **tailwind-merge** for UI utility patterns

### Mobile / deployment-related stack

- **Next.js static export**
- **Capacitor 7** for iOS app wrapping
- **Web App Manifest** for installable PWA behavior
- Python `http.server` for simple static hosting in local dev flow

## 6. New Technologies Used in the App

This project includes several modern or relatively advanced technologies beyond a basic CRUD system:

### 1. Face recognition with embeddings

Instead of traditional image comparison, the system uses **face embeddings**, which convert a face into a numeric vector representation. This is a more modern and scalable approach for biometric identification.

### 2. InsightFace

**InsightFace** is a modern facial analysis framework used for high-quality face detection and embedding extraction. It is one of the key technologies that makes the recognition workflow possible.

### 3. ONNX Runtime

**ONNX Runtime** allows pretrained AI models to run efficiently in production-like environments. In this app, it supports inference for the face-recognition pipeline using a CPU execution provider.

### 4. Google authentication

The backend supports **Google Sign-In token verification**, which adds a more modern federated login option compared to only using local email/password credentials.

### 5. Static export + Capacitor mobile packaging

The project uses **Next.js static export** together with **Capacitor** to make the web frontend portable to iPhone. This is a modern hybrid-app approach that avoids building separate native UI screens from scratch.

### 6. Progressive Web App readiness

The frontend includes a **manifest.webmanifest**, icons, standalone display settings, and mobile-focused metadata, which makes the app more installable and device-friendly.

### 7. Motion-enhanced modern UI

The use of **Framer Motion** gives the frontend a more interactive and modern user experience compared to a plain static admin dashboard.

## 7. Key API Capabilities

Based on the current backend implementation, the app supports APIs for:

- `POST /auth/login`
- `POST /auth/signup`
- `POST /auth/google`
- `GET /classes`
- `POST /classes`
- `GET /classes/{class_id}/students`
- `DELETE /students/{student_id}`
- `GET /classes/{class_id}/attendance`
- `GET /classes/{class_id}/attendance/stats`
- `GET /classes/{class_id}/attendance/days`
- `POST /recognize`
- `POST /register`
- `POST /classes/{class_id}/report`
- `GET /classes/{class_id}/reports`
- `GET /classes/{class_id}/report/download`

## 8. Data Model Overview

The core database tables currently used are:

- **faculty**
  - stores faculty account details, auth provider, Google account link, and welcome email state
- **classes**
  - stores class name, section, semester, and owning faculty
- **students**
  - stores student identity information and serialized face embeddings
- **attendance**
  - stores attendance entries by student, class, date, and time
- **reports**
  - stores generated report metadata and file locations

## 9. App Workflow

The typical end-to-end usage flow is:

1. Faculty logs in using email/password or Google.
2. Faculty creates or selects a class.
3. Students are registered with facial image data.
4. The app extracts embeddings and stores them in the database.
5. During attendance, the app captures or uploads an image.
6. The backend recognizes the student by comparing embeddings.
7. Attendance is marked automatically if a valid match is found.
8. Faculty views stats and downloads reports when needed.

## 10. Benefits of the Current Solution

- simple local setup with SQLite and Python
- modern web frontend with mobile-ready packaging path
- AI-assisted automation for attendance
- expandable architecture for future institution-scale features
- clear separation between frontend, backend, and recognition logic

## 11. Future Enhancement Opportunities

If the project is extended further, the following technologies or features would fit naturally:

- cloud database such as PostgreSQL
- secure password hashing and JWT/session-based auth
- role-based access for admin, faculty, and student users
- liveness detection or anti-spoofing for stronger security
- real-time webcam streaming recognition
- analytics dashboards with charts
- deployment on cloud platforms with object storage for reports/images
- Android packaging in addition to iOS
- notification system for attendance alerts

## 12. Conclusion

Smart Attendance is a practical AI-enabled classroom management application that combines facial recognition, modern web technologies, and mobile-ready delivery. Its current implementation already covers the full attendance lifecycle from faculty login and class creation to student registration, recognition, attendance marking, and report generation.

The project stands out because it is not only a standard web dashboard, but also includes biometric recognition, Google authentication, CSV reporting, and a path to mobile app deployment using modern tools such as FastAPI, Next.js, InsightFace, ONNX Runtime, and Capacitor.
