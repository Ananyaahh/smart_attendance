import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.smartattendance.app",
  appName: "Smart Attendance",
  webDir: "out",
  server: {
    androidScheme: "https",
  },
};

export default config;
