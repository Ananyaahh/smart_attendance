import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.smartattendance.app",
  appName: "Smart Attendance",
  webDir: "out",
  server: {
    url: "https://smart-attendance-nine-kappa.vercel.app",
    cleartext: false,
  },
};

export default config;
