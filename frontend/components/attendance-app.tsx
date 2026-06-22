"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  BookOpen,
  Camera,
  ChevronRight,
  FolderDown,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Plus,
  ScanFace,
  Settings,
  UserCog,
  Users,
} from "lucide-react";
import { Sidebar, SidebarBody, SidebarLink } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

function resolveApiBase() {
  const configuredBase = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  if (configuredBase) {
    return configuredBase;
  }

  if (typeof window !== "undefined") {
    const { hostname, protocol } = window.location;
    const isNativeShell = protocol !== "http:" && protocol !== "https:";

    // Capacitor uses a custom scheme, so infer the laptop backend explicitly for device demos.
    if (isNativeShell) {
      return "https://web-production-b4960.up.railway.app";
    }

    const resolvedHost = hostname === "localhost" ? "127.0.0.1" : hostname;
    return "https://web-production-b4960.up.railway.app";
  }

  return "https://web-production-b4960.up.railway.app";
}

type Screen = "auth" | "classes" | "workspace";
type WorkspaceTab = "register" | "attendance" | "reports";

type Faculty = {
  id: number;
  name: string;
  email: string;
};

type SmartClass = {
  id: number;
  class_name: string;
  section: string;
  semester?: string;
};

type Student = {
  id: number;
  name: string;
  roll_number?: string;
};

type AttendanceRow = {
  name: string;
  roll_number?: string;
  time: string;
};

type AttendanceStats = {
  total_strength: number;
  present: number;
  absent: number;
};

type RegisterResponse = {
  message?: string;
  name: string;
};

type RecognizeResponse = {
  name: string;
  confidence: number;
  attendance_marked: boolean;
};

const heroImage =
  "https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&w=1200&q=80";
const profileImage =
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=300&q=80";

function today() {
  return new Date().toISOString().split("T")[0];
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fileToDataURL(file: File) {
  return new Promise<string>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new window.Image();

    image.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");
        if (!context) {
          throw new Error("Unable to process image");
        }

        canvas.width = image.naturalWidth || image.width;
        canvas.height = image.naturalHeight || image.height;
        context.drawImage(image, 0, 0, canvas.width, canvas.height);

        // Normalize uploads to JPEG so iPhone HEIC photos are accepted by the backend decoder.
        resolve(canvas.toDataURL("image/jpeg", 0.92));
      } catch (error) {
        reject(error instanceof Error ? error : new Error("Failed to process image file"));
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Failed to read image file"));
    };

    image.src = objectUrl;
  });
}

async function api<T>(path: string, options: RequestInit = {}) {
  const response = await fetch(`${resolveApiBase()}${path}`, options);
  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json") ? await response.json() : await response.text();

  if (!response.ok) {
    const detail = typeof payload === "object" && payload && "detail" in payload ? payload.detail : String(payload);
    throw new Error(detail || "Request failed");
  }

  return payload as T;
}

async function registerWithRetries(
  payloadFactory: () => Promise<{ class_id: number; name: string; roll_number: string; image_base64: string }>,
  attempts = 3
) {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const payload = await payloadFactory();
      return await api<RegisterResponse>("/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Registration failed");
      const lowerMessage = lastError.message.toLowerCase();
      const shouldRetry =
        attempt < attempts &&
        (lowerMessage.includes("no face detected") || lowerMessage.includes("camera frame not ready"));

      if (!shouldRetry) {
        throw lastError;
      }

      await sleep(350);
    }
  }

  throw lastError ?? new Error("Registration failed");
}

export function AttendanceApp() {
  const [screen, setScreen] = useState<Screen>("auth");
  const [faculty, setFaculty] = useState<Faculty | null>(null);
  const [classes, setClasses] = useState<SmartClass[]>([]);
  const [selectedClass, setSelectedClass] = useState<SmartClass | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [attendanceRows, setAttendanceRows] = useState<AttendanceRow[]>([]);
  const [attendanceDays, setAttendanceDays] = useState<string[]>([]);
  const [stats, setStats] = useState<AttendanceStats>({ total_strength: 0, present: 0, absent: 0 });
  const [workspaceTab, setWorkspaceTab] = useState<WorkspaceTab>("register");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [signupMessage, setSignupMessage] = useState("");
  const [classError, setClassError] = useState("");
  const [registerMessage, setRegisterMessage] = useState("");
  const [scanStatus, setScanStatus] = useState("Camera idle");
  const [autoScan, setAutoScan] = useState(false);
  const loginEmailRef = useRef<HTMLInputElement>(null);
  const loginPasswordRef = useRef<HTMLInputElement>(null);
  const signupNameRef = useRef<HTMLInputElement>(null);
  const signupEmailRef = useRef<HTMLInputElement>(null);
  const signupPasswordRef = useRef<HTMLInputElement>(null);
  const classNameRef = useRef<HTMLInputElement>(null);
  const sectionRef = useRef<HTMLInputElement>(null);
  const semesterRef = useRef<HTMLInputElement>(null);
  const studentNameRef = useRef<HTMLInputElement>(null);
  const studentRollRef = useRef<HTMLInputElement>(null);
  const registerVideoRef = useRef<HTMLVideoElement>(null);
  const liveVideoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const registerPhotoInputRef = useRef<HTMLInputElement>(null);
  const scanPhotoInputRef = useRef<HTMLInputElement>(null);
  const autoTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);

  const sidebarLinks = useMemo(
    () => [
      {
        label: "Overview",
        href: "#overview",
        icon: <LayoutDashboard className="h-5 w-5 flex-shrink-0 text-stone-100" />,
      },
      {
        label: "Roster",
        href: "#roster",
        icon: <Users className="h-5 w-5 flex-shrink-0 text-stone-100" />,
      },
      {
        label: "Live Attendance",
        href: "#live-attendance",
        icon: <ScanFace className="h-5 w-5 flex-shrink-0 text-stone-100" />,
      },
      {
        label: "Reports",
        href: "#reports",
        icon: <FolderDown className="h-5 w-5 flex-shrink-0 text-stone-100" />,
      },
    ],
    []
  );

  useEffect(() => {
    const savedFaculty = window.localStorage.getItem("smart_faculty");
    const savedClass = window.localStorage.getItem("smart_selected_class");

    if (!savedFaculty) {
      setScreen("auth");
      return;
    }

    const parsedFaculty = JSON.parse(savedFaculty) as Faculty;
    setFaculty(parsedFaculty);

    if (savedClass) {
      const parsedClass = JSON.parse(savedClass) as SmartClass;
      setSelectedClass(parsedClass);
      setScreen("workspace");
      void Promise.all([
        loadClasses(parsedFaculty),
        loadWorkspaceData(parsedClass),
      ]);
      return;
    }

    setScreen("classes");
    void loadClasses(parsedFaculty);
  }, []);

  useEffect(() => {
    if (!autoScan) {
      if (autoTimerRef.current) {
        clearInterval(autoTimerRef.current);
        autoTimerRef.current = null;
      }
      return;
    }

    autoTimerRef.current = setInterval(() => {
      void scanNow();
    }, 3000);

    return () => {
      if (autoTimerRef.current) {
        clearInterval(autoTimerRef.current);
        autoTimerRef.current = null;
      }
    };
  }, [autoScan, selectedClass]);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  async function loadClasses(targetFaculty = faculty) {
    if (!targetFaculty) return;
    const data = await api<SmartClass[]>(`/classes?faculty_id=${targetFaculty.id}`);
    setClasses(data);
  }

  async function loadWorkspaceData(targetClass = selectedClass) {
    if (!targetClass) return;
    const [studentData, attendanceData, statsData, daysData] = await Promise.all([
      api<Student[]>(`/classes/${targetClass.id}/students`),
      api<AttendanceRow[]>(`/classes/${targetClass.id}/attendance?date=${today()}`),
      api<AttendanceStats>(`/classes/${targetClass.id}/attendance/stats?date=${today()}`),
      api<{ days: string[] }>(`/classes/${targetClass.id}/attendance/days`),
    ]);

    setStudents(studentData);
    setAttendanceRows(attendanceData);
    setStats(statsData);
    setAttendanceDays(daysData.days);
  }

  function saveSession(nextFaculty: Faculty | null, nextClass: SmartClass | null) {
    if (nextFaculty) {
      window.localStorage.setItem("smart_faculty", JSON.stringify(nextFaculty));
    } else {
      window.localStorage.removeItem("smart_faculty");
    }

    if (nextClass) {
      window.localStorage.setItem("smart_selected_class", JSON.stringify(nextClass));
    } else {
      window.localStorage.removeItem("smart_selected_class");
    }
  }

  function stopCamera() {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current = null;
    }
    if (liveVideoRef.current) {
      liveVideoRef.current.srcObject = null;
    }
    if (registerVideoRef.current) {
      registerVideoRef.current.srcObject = null;
    }
  }

  async function ensureCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setScanStatus("Camera unavailable. Use Scan From Photo instead.");
      setRegisterMessage("Camera unavailable. Use Register From Photo instead.");
      return false;
    }

    try {
      if (!cameraStreamRef.current) {
        try {
          cameraStreamRef.current = await navigator.mediaDevices.getUserMedia({
            video: {
              width: { ideal: 640 },
              height: { ideal: 480 },
              facingMode: { ideal: "environment" },
            },
            audio: false,
          });
        } catch {
          cameraStreamRef.current = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });
        }
      }

      if (liveVideoRef.current) {
        liveVideoRef.current.srcObject = cameraStreamRef.current;
        await liveVideoRef.current.play().catch(() => undefined);
      }

      if (registerVideoRef.current) {
        registerVideoRef.current.srcObject = cameraStreamRef.current;
        await registerVideoRef.current.play().catch(() => undefined);
      }

      await sleep(250);
      setScanStatus("Camera ready");
      setRegisterMessage("Camera ready");
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Camera unavailable";
      setScanStatus(`Camera error: ${message}`);
      setRegisterMessage(`Camera error: ${message}`);
      return false;
    }
  }

  async function captureBase64(videoElement: HTMLVideoElement | null) {
    const cameraReady = await ensureCamera();
    if (!cameraReady || !videoElement || !canvasRef.current) {
      throw new Error("Camera frame not ready. Start the camera and wait a moment.");
    }

    const deadline = Date.now() + 10000;
    while (Date.now() < deadline) {
      if (videoElement.readyState >= 2 && videoElement.videoWidth > 0 && videoElement.videoHeight > 0) {
        break;
      }
      await sleep(120);
    }

    if (videoElement.readyState < 2 || videoElement.videoWidth <= 0 || videoElement.videoHeight <= 0) {
      throw new Error("Camera frame not ready. Start the camera and wait a moment.");
    }

    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Unable to capture image");
    }

    canvas.width = videoElement.videoWidth;
    canvas.height = videoElement.videoHeight;
    context.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.92);
  }

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setLoginError("");

    try {
      const email = loginEmailRef.current?.value.trim().toLowerCase() ?? "";
      const password = loginPasswordRef.current?.value ?? "";
      const result = await api<{ success: boolean; faculty: Faculty }>("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, auto_create: false }),
      });

      setFaculty(result.faculty);
      setSelectedClass(null);
      saveSession(result.faculty, null);
      setScreen("classes");
      await loadClasses(result.faculty);
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : "Sign in failed");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSignup(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setSignupMessage("");

    try {
      const name = signupNameRef.current?.value.trim() ?? "";
      const email = signupEmailRef.current?.value.trim().toLowerCase() ?? "";
      const password = signupPasswordRef.current?.value ?? "";

      await api("/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      setSignupMessage("Account created. You can sign in now.");
      if (loginEmailRef.current) {
        loginEmailRef.current.value = email;
      }
      if (signupNameRef.current) signupNameRef.current.value = "";
      if (signupEmailRef.current) signupEmailRef.current.value = "";
      if (signupPasswordRef.current) signupPasswordRef.current.value = "";
    } catch (error) {
      setSignupMessage(error instanceof Error ? error.message : "Signup failed");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCreateClass(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!faculty) return;
    setIsLoading(true);
    setClassError("");

    try {
      await api("/classes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          faculty_id: faculty.id,
          class_name: classNameRef.current?.value.trim() ?? "",
          section: sectionRef.current?.value.trim() ?? "",
          semester: semesterRef.current?.value.trim() ?? "",
        }),
      });

      if (classNameRef.current) classNameRef.current.value = "";
      if (sectionRef.current) sectionRef.current.value = "";
      if (semesterRef.current) semesterRef.current.value = "";
      await loadClasses();
    } catch (error) {
      setClassError(error instanceof Error ? error.message : "Class creation failed");
    } finally {
      setIsLoading(false);
    }
  }

  async function openClass(item: SmartClass) {
    setSelectedClass(item);
    saveSession(faculty, item);
    setScreen("workspace");
    await loadWorkspaceData(item);
  }

  async function handleRegister(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedClass) return;
    setIsLoading(true);
    setRegisterMessage("");

    try {
      const result = await registerWithRetries(async () => ({
        class_id: selectedClass.id,
        name: studentNameRef.current?.value.trim() ?? "",
        roll_number: studentRollRef.current?.value.trim() ?? "",
        image_base64: await captureBase64(registerVideoRef.current),
      }));

      setRegisterMessage(result.message || `Registered: ${result.name}`);
      if (studentNameRef.current) studentNameRef.current.value = "";
      if (studentRollRef.current) studentRollRef.current.value = "";
      await loadWorkspaceData();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Registration failed";
      setRegisterMessage(
        message.includes("No face detected")
          ? "No clear face detected. Hold the phone steady, keep one face centered, and try again."
          : message
      );
      await loadWorkspaceData();
    } finally {
      setIsLoading(false);
    }
  }

  async function handleRegisterFromPhoto(file: File) {
    if (!selectedClass) return;
    setIsLoading(true);
    setRegisterMessage("");

    try {
      const imageBase64 = await fileToDataURL(file);
      const result = await api<RegisterResponse>("/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          class_id: selectedClass.id,
          name: studentNameRef.current?.value.trim() ?? "",
          roll_number: studentRollRef.current?.value.trim() ?? "",
          image_base64: imageBase64,
        }),
      });

      setRegisterMessage(result.message || `Registered: ${result.name}`);
      if (studentNameRef.current) studentNameRef.current.value = "";
      if (studentRollRef.current) studentRollRef.current.value = "";
      await loadWorkspaceData();
    } catch (error) {
      setRegisterMessage(error instanceof Error ? error.message : "Photo registration failed");
    } finally {
      setIsLoading(false);
      if (registerPhotoInputRef.current) {
        registerPhotoInputRef.current.value = "";
      }
    }
  }

  async function handleDeleteStudent(studentId: number) {
    setIsLoading(true);

    try {
      await api(`/students/${studentId}`, { method: "DELETE" });
      await loadWorkspaceData();
    } catch (error) {
      setScanStatus(error instanceof Error ? error.message : "Failed to delete student");
    } finally {
      setIsLoading(false);
    }
  }

  async function scanNow() {
    if (!selectedClass) return;

    try {
      const result = await api<RecognizeResponse>("/recognize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          class_id: selectedClass.id,
          image_base64: await captureBase64(liveVideoRef.current),
        }),
      });

      setScanStatus(
        result.name === "Unknown"
          ? "Unknown face detected"
          : result.attendance_marked
            ? `${result.name} marked present (${result.confidence.toFixed(2)})`
            : `${result.name} already marked today`
      );
      await loadWorkspaceData();
    } catch (error) {
      setScanStatus(error instanceof Error ? error.message : "Scan failed");
    }
  }

  async function handleScanFromPhoto(file: File) {
    if (!selectedClass) return;

    try {
      const imageBase64 = await fileToDataURL(file);
      const result = await api<RecognizeResponse>("/recognize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          class_id: selectedClass.id,
          image_base64: imageBase64,
        }),
      });

      setScanStatus(
        result.name === "Unknown"
          ? "Unknown face detected"
          : result.attendance_marked
            ? `${result.name} marked present (${result.confidence.toFixed(2)})`
            : `${result.name} already marked today`
      );
      await loadWorkspaceData();
    } catch (error) {
      setScanStatus(error instanceof Error ? error.message : "Photo scan failed");
    } finally {
      if (scanPhotoInputRef.current) {
        scanPhotoInputRef.current.value = "";
      }
    }
  }

  function logout() {
    setFaculty(null);
    setSelectedClass(null);
    setClasses([]);
    setStudents([]);
    setAttendanceRows([]);
    setAttendanceDays([]);
    setStats({ total_strength: 0, present: 0, absent: 0 });
    setWorkspaceTab("register");
    setAutoScan(false);
    stopCamera();
    saveSession(null, null);
    setScreen("auth");
  }

  const attendanceRate =
    stats.total_strength > 0 ? Math.round((stats.present / stats.total_strength) * 100) : 0;

  if (screen === "auth") {
    return (
      <main className="min-h-screen px-4 py-6 md:px-8 md:py-8">
        <div className="mx-auto grid min-h-[calc(100vh-3rem)] max-w-7xl gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <section className="glass-panel relative overflow-hidden p-6 md:p-8 lg:p-10">
            <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-accent/10 to-transparent" />
            <div className="relative flex h-full flex-col justify-between gap-8">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.24em] text-accent-deep">
                    Smart Attendance
                  </div>
                  <h1 className="mt-3 max-w-xl text-4xl md:text-5xl">
                    Faculty attendance workspace for classes, scans and reports.
                  </h1>
                  <p className="mt-4 max-w-2xl text-base text-stone-600">
                    Sign in to open your classes, register students, run face recognition and export attendance records.
                  </p>
                </div>
                <div className="hidden rounded-full border border-stone-200 bg-white/70 px-4 py-2 text-sm font-semibold text-stone-600 md:block">
                  Ready for faculty use
                </div>
              </div>

              <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
                <div className="subtle-panel overflow-hidden">
                  <div className="relative overflow-hidden bg-gradient-to-br from-[#214643] via-[#6e9088] to-[#d4ddd8] p-6">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.32),transparent_28%)]" />
                    <div className="relative">
                      <p className="text-xs uppercase tracking-[0.22em] text-white/70">Attendance app</p>
                      <h2 className="mt-2 max-w-md text-3xl text-white">
                        One place to operate classroom attendance.
                      </h2>
                    </div>

                    <div className="relative mt-8 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                      <div className="rounded-[26px] border border-white/20 bg-[#13312f]/70 p-5 text-white shadow-2xl backdrop-blur">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-xs uppercase tracking-[0.2em] text-white/60">Today</div>
                            <div className="mt-2 text-4xl font-semibold">42</div>
                          </div>
                          <div className="rounded-2xl bg-white/10 p-3">
                            <Users className="h-5 w-5" />
                          </div>
                        </div>
                        <p className="mt-4 text-sm text-white/75">Students already registered for live attendance tracking.</p>
                      </div>

                      <div className="grid gap-4">
                        {[
                          ["Camera scan", "Run face recognition from the live classroom feed."],
                          ["Photo upload", "Register or verify students without relying on webcam access."],
                          ["CSV export", "Download date-wise attendance reports for records and reporting."],
                        ].map(([title, body]) => (
                          <div key={title} className="rounded-[22px] border border-white/15 bg-white/10 p-4 text-white backdrop-blur">
                            <div className="text-sm font-semibold">{title}</div>
                            <div className="mt-1 text-sm text-white/72">{body}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4">
                  {[
                    {
                      icon: <Camera className="h-5 w-5 text-accent" />,
                      title: "Register students",
                      body: "Capture faces from the webcam or upload student photos when the camera is not available.",
                    },
                    {
                      icon: <Activity className="h-5 w-5 text-rust" />,
                      title: "Track live attendance",
                      body: "Present, absent and daily entries stay synced with the FastAPI backend during class.",
                    },
                    {
                      icon: <FolderDown className="h-5 w-5 text-accent-deep" />,
                      title: "Export reports",
                      body: "Generate date-wise CSV files from the same workspace used for class operations.",
                    },
                  ].map((item) => (
                    <div key={item.title} className="subtle-panel p-5">
                      <div className="flex items-center gap-3">
                        <div className="rounded-2xl bg-white p-3 shadow-sm">{item.icon}</div>
                        <div>
                          <h3 className="text-lg">{item.title}</h3>
                          <p className="mt-1 text-sm">{item.body}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                {[
                  ["Step 1", "Create a faculty account"],
                  ["Step 2", "Open a class or create a new one"],
                  ["Step 3", "Register, scan and export attendance"],
                ].map(([value, label]) => (
                  <div key={label} className="subtle-panel p-5">
                    <div className="text-3xl font-semibold text-ink">{value}</div>
                    <p className="mt-2 text-sm">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="glass-panel flex flex-col justify-center p-6 md:p-8">
            <div className="grid gap-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-rust">Faculty access</p>
                <h2 className="mt-2 text-3xl">Sign in to continue</h2>
                <p className="mt-2 text-sm">Create a faculty account once, then sign in and use the attendance app normally.</p>
              </div>

              <div className="grid gap-5 xl:grid-cols-2">
                <form onSubmit={handleLogin} className="subtle-panel p-5">
                  <h3 className="text-xl">Sign in</h3>
                  <div className="mt-4 grid gap-3">
                    <input ref={loginEmailRef} type="email" required placeholder="faculty@college.edu" className="field" />
                    <input ref={loginPasswordRef} type="password" required placeholder="Password" className="field" />
                    <button type="submit" className="primary-btn w-full" disabled={isLoading}>
                      Open workspace
                    </button>
                    <p className="min-h-5 text-sm text-rose-600">{loginError}</p>
                  </div>
                </form>

                <form onSubmit={handleSignup} className="subtle-panel p-5">
                  <h3 className="text-xl">Create account</h3>
                  <div className="mt-4 grid gap-3">
                    <input ref={signupNameRef} type="text" required placeholder="Faculty name" className="field" />
                    <input ref={signupEmailRef} type="email" required placeholder="faculty@college.edu" className="field" />
                    <input ref={signupPasswordRef} type="password" required placeholder="Create password" className="field" />
                    <button type="submit" className="secondary-btn w-full" disabled={isLoading}>
                      Register faculty account
                    </button>
                    <p className="min-h-5 text-sm text-accent-deep">{signupMessage}</p>
                  </div>
                </form>
              </div>
            </div>
          </section>
        </div>
      </main>
    );
  }

  if (screen === "classes") {
    return (
      <main className="min-h-screen px-4 py-6 md:px-8 md:py-8">
        <div className="mx-auto max-w-7xl">
          <div className="glass-panel p-6 md:p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent-deep">Faculty workspace</p>
                <h1 className="mt-2 text-4xl">Class setup</h1>
                <p className="mt-2 max-w-2xl text-sm">
                  Choose a class to manage, or create a new section and move directly into live attendance operations.
                </p>
              </div>
              <div className="flex items-center gap-3 rounded-full border border-stone-200 bg-white/70 px-4 py-3">
                <Image src={profileImage} alt="Faculty portrait" width={44} height={44} className="h-11 w-11 rounded-full object-cover" />
                <div>
                  <div className="text-sm font-semibold text-ink">{faculty?.name}</div>
                  <div className="text-xs text-stone-500">{faculty?.email}</div>
                </div>
                <button onClick={logout} className="secondary-btn h-10 px-4">
                  <LogOut className="mr-2 h-4 w-4" />
                  Logout
                </button>
              </div>
            </div>

            <div className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
              <section className="subtle-panel p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl">Your classes</h2>
                    <p className="mt-1 text-sm">Open a teaching workspace with live scan, roster management and reporting.</p>
                  </div>
                  <div className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-stone-600">
                    {classes.length} active
                  </div>
                </div>

                <div className="mt-5 grid gap-3">
                  {classes.length === 0 ? (
                    <div className="rounded-3xl border border-dashed border-stone-300 bg-white/80 p-8 text-center text-sm text-stone-500">
                      No classes yet. Create your first class to launch the attendance workspace.
                    </div>
                  ) : (
                    classes.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => void openClass(item)}
                        className="group flex items-center justify-between rounded-3xl border border-stone-200 bg-white px-5 py-4 text-left transition hover:-translate-y-0.5 hover:border-accent/25 hover:shadow-lg"
                      >
                        <div className="flex items-center gap-4">
                          <div className="rounded-2xl bg-accent-soft p-3 text-accent-deep">
                            <GraduationCap className="h-5 w-5" />
                          </div>
                          <div>
                            <div className="text-lg font-semibold text-ink">{item.class_name}</div>
                            <div className="text-sm text-stone-500">
                              Section {item.section}
                              {item.semester ? ` • ${item.semester}` : ""}
                            </div>
                          </div>
                        </div>
                        <ChevronRight className="h-5 w-5 text-stone-400 transition group-hover:translate-x-1 group-hover:text-accent-deep" />
                      </button>
                    ))
                  )}
                </div>
              </section>

              <section className="subtle-panel p-5">
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl bg-white p-3 shadow-sm">
                    <Plus className="h-5 w-5 text-rust" />
                  </div>
                  <div>
                    <h2 className="text-2xl">Create class</h2>
                    <p className="mt-1 text-sm">Set the identity used across registration, scanning and exports.</p>
                  </div>
                </div>

                <form onSubmit={handleCreateClass} className="mt-5 grid gap-3">
                  <input ref={classNameRef} type="text" required placeholder="B.Tech CSE" className="field" />
                  <input ref={sectionRef} type="text" required placeholder="Section A" className="field" />
                  <input ref={semesterRef} type="text" placeholder="Semester 6" className="field" />
                  <button type="submit" className="primary-btn w-full" disabled={isLoading}>
                    Create class workspace
                  </button>
                  <p className="min-h-5 text-sm text-rose-600">{classError}</p>
                </form>
              </section>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-4 py-4 md:px-6 md:py-6">
      <div className="mx-auto flex max-w-[1500px] flex-col gap-4">
        <Sidebar open={sidebarOpen} setOpen={setSidebarOpen}>
          <div className="md:grid md:grid-cols-[auto_1fr] md:gap-4">
            <SidebarBody className="justify-between gap-8">
              <div className="flex flex-1 flex-col overflow-x-hidden overflow-y-auto">
                <div className="flex items-center gap-3 px-2 py-2">
                  <div className="rounded-2xl bg-amber-300 p-2 text-[#163331]">
                    <GraduationCap className="h-5 w-5" />
                  </div>
                  <div className="overflow-hidden">
                    <div className="truncate text-sm font-semibold uppercase tracking-[0.22em] text-stone-300">
                      Smart Attendance
                    </div>
                    <div className="truncate text-lg font-semibold text-white">{selectedClass?.class_name}</div>
                  </div>
                </div>

                <div className="mt-8 flex flex-col gap-2">
                  {sidebarLinks.map((link) => (
                    <SidebarLink key={link.label} link={link} />
                  ))}
                </div>

                <div className="mt-8 rounded-[24px] border border-white/10 bg-white/5 p-4">
                  <div className="text-xs uppercase tracking-[0.22em] text-stone-400">Today</div>
                  <div className="mt-3 text-3xl font-semibold text-white">{attendanceRate}%</div>
                  <p className="mt-2 text-sm text-stone-300">Attendance rate across {stats.total_strength} registered students.</p>
                </div>
              </div>

              <div className="rounded-[24px] border border-white/10 bg-white/5 p-3">
                <div className="flex items-center gap-3">
                  <Image src={profileImage} alt="Faculty portrait" width={44} height={44} className="h-11 w-11 rounded-full object-cover" />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-white">{faculty?.name}</div>
                    <div className="truncate text-xs text-stone-400">{faculty?.email}</div>
                  </div>
                </div>
              </div>
            </SidebarBody>

            <section className="glass-panel mt-4 flex min-h-[calc(100vh-2rem)] flex-1 flex-col overflow-hidden p-4 md:mt-0 md:p-5">
              <header className="rounded-[28px] bg-mesh-light p-5 md:p-6" id="overview">
                <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent-deep">Live operations</p>
                    <h1 className="mt-2 text-3xl md:text-4xl">
                      {selectedClass?.class_name} · Section {selectedClass?.section}
                    </h1>
                    <p className="mt-2 max-w-2xl text-sm">
                      Manage student onboarding, scan faces in real time and export attendance reports from a single workspace.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <button onClick={() => void ensureCamera()} className="primary-btn">
                      <Camera className="mr-2 h-4 w-4" />
                      Start Camera
                    </button>
                    <button
                      onClick={() => {
                        setScreen("classes");
                        saveSession(faculty, null);
                      }}
                      className="secondary-btn"
                    >
                      <BookOpen className="mr-2 h-4 w-4" />
                      Switch Class
                    </button>
                    <button onClick={logout} className="secondary-btn">
                      <LogOut className="mr-2 h-4 w-4" />
                      Logout
                    </button>
                  </div>
                </div>

                <div className="mt-6 grid gap-4 md:grid-cols-4">
                  {[
                    { label: "Total strength", value: stats.total_strength, icon: <Users className="h-5 w-5" /> },
                    { label: "Present", value: stats.present, icon: <Activity className="h-5 w-5" /> },
                    { label: "Absent", value: stats.absent, icon: <UserCog className="h-5 w-5" /> },
                    { label: "Attendance rate", value: `${attendanceRate}%`, icon: <Settings className="h-5 w-5" /> },
                  ].map((item) => (
                    <div key={item.label} className="metric-card">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-stone-500">{item.label}</span>
                        <div className="rounded-2xl bg-white p-2 text-accent-deep shadow-sm">{item.icon}</div>
                      </div>
                      <div className="mt-4 text-3xl font-semibold text-ink">{item.value}</div>
                    </div>
                  ))}
                </div>
              </header>

              <div className="mt-4 flex flex-wrap gap-2">
                {[
                  ["register", "Register Face"],
                  ["attendance", "Live Attendance"],
                  ["reports", "Reports & History"],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    onClick={() => setWorkspaceTab(value as WorkspaceTab)}
                    className={cn(
                      "rounded-full px-4 py-2 text-sm font-semibold transition",
                      workspaceTab === value
                        ? "bg-accent text-white"
                        : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="mt-4 grid flex-1 gap-4 xl:grid-cols-[1.15fr_0.85fr]">
                <motion.section
                  key={workspaceTab}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25 }}
                  className="grid gap-4"
                >
                  {workspaceTab === "register" && (
                    <>
                      <article className="subtle-panel p-5" id="roster">
                        <div className="flex items-center justify-between">
                          <div>
                            <h2 className="text-2xl">Register new student</h2>
                            <p className="mt-1 text-sm">Center the student in frame or upload a clear face photo.</p>
                          </div>
                          <button onClick={() => void ensureCamera()} className="secondary-btn">
                            <Camera className="mr-2 h-4 w-4" />
                            Ready camera
                          </button>
                        </div>
                        <div className="mt-5 overflow-hidden rounded-[24px] border border-stone-200 bg-stone-950">
                          <video ref={registerVideoRef} autoPlay muted playsInline className="aspect-video w-full object-cover" />
                        </div>
                        <form onSubmit={handleRegister} className="mt-5 grid gap-3">
                          <div className="grid gap-3 md:grid-cols-2">
                            <input ref={studentNameRef} type="text" required placeholder="Student name" className="field" />
                            <input ref={studentRollRef} type="text" required placeholder="Roll number" className="field" />
                          </div>
                          <div className="flex flex-wrap gap-3">
                            <button type="submit" className="primary-btn" disabled={isLoading}>
                              Register from camera
                            </button>
                            <button
                              type="button"
                              className="secondary-btn"
                              onClick={() => registerPhotoInputRef.current?.click()}
                            >
                              Register from photo
                            </button>
                          </div>
                          <input
                            ref={registerPhotoInputRef}
                            type="file"
                            accept="image/*"
                            hidden
                            onChange={(event) => {
                              const file = event.target.files?.[0];
                              if (file) {
                                void handleRegisterFromPhoto(file);
                              }
                            }}
                          />
                          <p className="min-h-5 text-sm text-accent-deep">{registerMessage}</p>
                        </form>
                      </article>

                      <article className="subtle-panel p-5">
                        <div className="flex items-center justify-between">
                          <div>
                            <h2 className="text-2xl">Registered students</h2>
                            <p className="mt-1 text-sm">Current roster for this class workspace.</p>
                          </div>
                          <div className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-stone-600">
                            {students.length} students
                          </div>
                        </div>
                        <div className="mt-5 overflow-hidden rounded-[24px] border border-stone-200 bg-white">
                          <table className="w-full text-left text-sm">
                            <thead className="border-b border-stone-200 bg-stone-50 text-stone-500">
                              <tr>
                                <th className="px-5 py-3 font-medium">Name</th>
                                <th className="px-5 py-3 font-medium">Roll</th>
                                <th className="px-5 py-3 font-medium text-right">Action</th>
                              </tr>
                            </thead>
                            <tbody>
                              {students.length === 0 ? (
                                <tr>
                                  <td className="px-5 py-6 text-stone-500" colSpan={3}>
                                    No students registered yet.
                                  </td>
                                </tr>
                              ) : (
                                students.map((student) => (
                                  <tr key={student.id} className="border-b border-stone-100 last:border-b-0">
                                    <td className="px-5 py-4 font-medium text-ink">{student.name}</td>
                                    <td className="px-5 py-4 text-stone-500">{student.roll_number || "-"}</td>
                                    <td className="px-5 py-4 text-right">
                                      <button
                                        onClick={() => void handleDeleteStudent(student.id)}
                                        className="text-sm font-semibold text-rose-600 transition hover:text-rose-700"
                                      >
                                        Delete
                                      </button>
                                    </td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      </article>
                    </>
                  )}

                  {workspaceTab === "attendance" && (
                    <>
                      <article className="subtle-panel p-5" id="live-attendance">
                        <div className="flex items-center justify-between">
                          <div>
                            <h2 className="text-2xl">Live camera</h2>
                            <p className="mt-1 text-sm">Run instant scans or keep auto scan active during the session.</p>
                          </div>
                          <div className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-stone-600">
                            {scanStatus}
                          </div>
                        </div>
                        <div className="mt-5 overflow-hidden rounded-[24px] border border-stone-200 bg-stone-950">
                          <video ref={liveVideoRef} autoPlay muted playsInline className="aspect-video w-full object-cover" />
                        </div>
                        <div className="mt-5 flex flex-wrap gap-3">
                          <button onClick={() => void scanNow()} className="primary-btn">
                            Scan now
                          </button>
                          <button onClick={() => setAutoScan((value) => !value)} className="secondary-btn">
                            Auto Scan: {autoScan ? "On" : "Off"}
                          </button>
                          <button onClick={() => scanPhotoInputRef.current?.click()} className="secondary-btn">
                            Scan from photo
                          </button>
                          <input
                            ref={scanPhotoInputRef}
                            type="file"
                            accept="image/*"
                            hidden
                            onChange={(event) => {
                              const file = event.target.files?.[0];
                              if (file) {
                                void handleScanFromPhoto(file);
                              }
                            }}
                          />
                        </div>
                      </article>

                      <article className="subtle-panel p-5">
                        <div className="flex items-center justify-between">
                          <div>
                            <h2 className="text-2xl">Today attendance</h2>
                            <p className="mt-1 text-sm">Live marks for {today()}.</p>
                          </div>
                          <div className="rounded-full bg-accent-soft px-4 py-2 text-sm font-semibold text-accent-deep">
                            {attendanceRows.length} entries
                          </div>
                        </div>
                        <div className="mt-5 overflow-hidden rounded-[24px] border border-stone-200 bg-white">
                          <table className="w-full text-left text-sm">
                            <thead className="border-b border-stone-200 bg-stone-50 text-stone-500">
                              <tr>
                                <th className="px-5 py-3 font-medium">Name</th>
                                <th className="px-5 py-3 font-medium">Roll</th>
                                <th className="px-5 py-3 font-medium">Time</th>
                              </tr>
                            </thead>
                            <tbody>
                              {attendanceRows.length === 0 ? (
                                <tr>
                                  <td className="px-5 py-6 text-stone-500" colSpan={3}>
                                    No attendance captured for today yet.
                                  </td>
                                </tr>
                              ) : (
                                attendanceRows.map((row, index) => (
                                  <tr key={`${row.name}-${index}`} className="border-b border-stone-100 last:border-b-0">
                                    <td className="px-5 py-4 font-medium text-ink">{row.name}</td>
                                    <td className="px-5 py-4 text-stone-500">{row.roll_number || "-"}</td>
                                    <td className="px-5 py-4 text-stone-500">{row.time}</td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      </article>
                    </>
                  )}

                  {workspaceTab === "reports" && (
                    <>
                      <article className="subtle-panel p-5" id="reports">
                        <div className="flex items-center justify-between">
                          <div>
                            <h2 className="text-2xl">Download report</h2>
                            <p className="mt-1 text-sm">Export today’s attendance as CSV directly from the API.</p>
                          </div>
                          <button
                            onClick={() => {
                              if (selectedClass) {
                                window.open(
                                  `${resolveApiBase()}/classes/${selectedClass.id}/report/download?date=${today()}`,
                                  "_blank"
                                );
                              }
                            }}
                            className="primary-btn"
                          >
                            <FolderDown className="mr-2 h-4 w-4" />
                            Download CSV
                          </button>
                        </div>
                      </article>

                      <article className="subtle-panel p-5">
                        <div className="flex items-center justify-between">
                          <div>
                            <h2 className="text-2xl">Attendance history</h2>
                            <p className="mt-1 text-sm">Reopen prior day exports without digging through generated files.</p>
                          </div>
                          <div className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-stone-600">
                            {attendanceDays.length} days
                          </div>
                        </div>

                        <div className="mt-5 grid gap-3">
                          {attendanceDays.length === 0 ? (
                            <div className="rounded-3xl border border-dashed border-stone-300 bg-white/80 p-8 text-center text-sm text-stone-500">
                              No attendance days recorded yet.
                            </div>
                          ) : (
                            attendanceDays.map((day) => (
                              <div
                                key={day}
                                className="flex items-center justify-between rounded-3xl border border-stone-200 bg-white px-5 py-4"
                              >
                                <div>
                                  <div className="text-lg font-semibold text-ink">{day}</div>
                                  <div className="text-sm text-stone-500">Generated day report</div>
                                </div>
                                <button
                                  onClick={() => {
                                    if (selectedClass) {
                                      window.open(
                                        `${resolveApiBase()}/classes/${selectedClass.id}/report/download?date=${day}`,
                                        "_blank"
                                      );
                                    }
                                  }}
                                  className="secondary-btn"
                                >
                                  Download
                                </button>
                              </div>
                            ))
                          )}
                        </div>
                      </article>
                    </>
                  )}
                </motion.section>

                <aside className="grid gap-4">
                  <section className="subtle-panel overflow-hidden">
                    <div className="relative h-56">
                      <Image src={heroImage} alt="Campus" fill className="object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#102724]/80 via-[#102724]/25 to-transparent" />
                      <div className="absolute bottom-0 left-0 right-0 p-5 text-white">
                        <div className="text-xs uppercase tracking-[0.22em] text-white/70">Session overview</div>
                        <div className="mt-2 text-2xl font-semibold">
                          {selectedClass?.semester || "Current semester"}
                        </div>
                        <p className="mt-1 text-sm text-white/80">
                          {students.length} students registered for face onboarding.
                        </p>
                      </div>
                    </div>
                  </section>

                  <section className="subtle-panel p-5">
                    <h3 className="text-xl">Operational notes</h3>
                    <div className="mt-4 grid gap-3">
                      {[
                        "Use Start Camera once and switch between registration and live scans without reconnecting the stream.",
                        "Photo upload remains available for devices where webcam permissions are blocked or unstable.",
                        "CSV downloads are generated per day from the backend, so reports stay consistent with live scans.",
                      ].map((note) => (
                        <div key={note} className="rounded-2xl bg-white px-4 py-3 text-sm text-stone-600">
                          {note}
                        </div>
                      ))}
                    </div>
                  </section>
                </aside>
              </div>
            </section>
          </div>
        </Sidebar>

        <canvas ref={canvasRef} width={640} height={480} hidden />
      </div>
    </main>
  );
}
