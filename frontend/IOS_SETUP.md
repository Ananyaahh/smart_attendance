# iPhone App Setup

This project is now prepared for the fastest iPhone packaging path using `Next.js static export + Capacitor`.

## What is already done

- Static export is enabled in `next.config.ts`
- Capacitor config is added in `capacitor.config.ts`
- App manifest and installable icons are added under `public/`
- Mobile build script is available as `npm run build:mobile`

## What still needs to happen on this Mac

1. Install the full Xcode app from the Mac App Store
2. Install CocoaPods:

```bash
brew install cocoapods
```

3. Accept Xcode license and switch to full Xcode if needed:

```bash
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
sudo xcodebuild -license accept
```

## iPhone build flow

From the `frontend` folder:

```bash
npm install
npm run build:mobile
npx cap add ios
npx cap sync ios
npx cap open ios
```

## In Xcode

1. Connect the iPhone with cable
2. Open the generated `App` project
3. Set your Apple ID/team in Signing & Capabilities
4. Select your iPhone as the run target
5. Press Run

## Important note for this project

This iPhone app wrapper only packages the frontend. The backend still needs to be reachable from the phone.

If `NEXT_PUBLIC_API_BASE_URL` is left blank, the app automatically uses the same hostname as the page or device connection and port `8000`.

You only need to set `NEXT_PUBLIC_API_BASE_URL` manually if the backend is running somewhere else, such as:

- a deployed backend URL, or
- your laptop's local IP on the same Wi-Fi

Example:

```bash
NEXT_PUBLIC_API_BASE_URL=http://192.168.1.5:8000
```

`127.0.0.1` will not work from the iPhone because it points to the phone itself, not your laptop.
