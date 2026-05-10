# Frontend

This frontend is now a `Next.js + TypeScript + Tailwind CSS` app with a shadcn-compatible structure.

## Run

```bash
npm install
npm run dev
```

Create `frontend/.env.local` from `frontend/.env.local.example` and set:

```bash
NEXT_PUBLIC_API_BASE_URL=
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-google-web-client-id.apps.googleusercontent.com
```

Create a root `.env` from `.env.example` and set:

```bash
GOOGLE_CLIENT_ID=your-google-web-client-id.apps.googleusercontent.com
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your-app-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM_EMAIL=your-app-email@gmail.com
```

## Notes

- Component path: `components/ui`
- Global styles path: `app/globals.css`
- Backend base URL: if `NEXT_PUBLIC_API_BASE_URL` is blank, the app automatically uses the same hostname as the page with port `8000`
- Example: opening `http://192.168.1.8:5500` makes the frontend call `http://192.168.1.8:8000`
- The requested sidebar component lives in `components/ui/sidebar.tsx`
- Google sign-in uses the frontend Google Identity button and `POST /auth/google` on the FastAPI backend
- Welcome email is optional and only sends on first Google account creation if SMTP env vars are configured
- Fastest iPhone packaging path is `Next.js static export + Capacitor`; see `IOS_SETUP.md`
