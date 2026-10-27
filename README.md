# HealthLink — Connected Care Platform

HealthLink is a React + Vite healthcare product concept for patient care coordination and clinician practice management. It includes a responsive patient portal, clinician workspace, practice-plan experience, and a clear seam for a future backend. It is not a deployed or clinically validated healthcare service.

## Run the frontend

Requirements: Node.js and npm.

```bash
npm install
npm run dev
```

Open the local URL printed by Vite. The app uses sample data and stores demo changes in browser LocalStorage. To reset the demo, clear the site's LocalStorage and reload.

### Demo accounts

| Role | ID | Password |
| --- | --- | --- |
| Patient | `P1001` | `patient123` |
| Doctor | `D1001` | `doctor123` |

Other sample accounts are in `src/data/healthlinkStore.js`.

## Project structure

```text
src/
  App.jsx                 Screens, role dashboards, and demo workflows
  main.jsx                React entry point
  data/healthlinkStore.js Demo fixtures, LocalStorage, BMI helper
  services/api.js         Fetch client for the future backend
  styles/app.css          Responsive light/dark design system
assets/
  icons/                  App icon
```

## Included UI workflows

- Patient registration with required-field validation, profile photo editing, blood groups, QR patient ID and demo access code
- Patient medical history with visit date/day/time, facility, doctor, reason, treatment notes, report uploads, appointments, prescriptions, and medication schedules
- Nearby doctor directory with search by location, specialty, and consultation budget, plus appointment requests
- Clinician dashboard with today's schedule, pending appointment inbox, patient list, appointment workflow, prescriptions, notes, and consent-code lookup
- English, Hindi, and Gujarati interface selection, plus patient-profile-informed wellness/yoga suggestions
- Working in-app notification inbox, dark mode, and simulated live-style analytics (sample data only)
- Practice growth area with sample Solo, Practice, and Clinic subscription concepts and monthly/yearly price display
- Premium healthcare identity, mobile responsive layouts, dark theme, and product marketing page
- Responsive navigation, light/dark themes, demo login shortcuts, and seeded sample data

Google sign-in is shown as a login option, but actual Google OAuth requires credentials and a server-side authentication callback. The current browser demo stores only upload metadata (file name/type/date), not document bytes. Analytics are generated sample values and are not connected to a device or clinical data source.

## Connect a backend

The browser demo is not a security boundary. It includes fake credentials and sample clinical records; all access checks and stored records can be inspected or changed by the browser user. Do not enter real patient data or deploy these demo login flows for real users.

When the API is ready:

1. Set `VITE_API_BASE_URL` in a local `.env` file (start from `.env.example`). Use HTTPS outside local development.
2. Replace LocalStorage reads/writes in `src/data/healthlinkStore.js` with authenticated API calls via `src/services/api.js`.
3. Implement authentication, role/organization permissions, patient consent, and audit checks on the server. The UI's doctor access code and doctor patient list are demonstrations only; they must not authorize access to real records.
4. Keep access tokens out of persistent browser storage. Prefer a secure, HttpOnly, SameSite cookie session with CSRF protection where appropriate.
5. Upload medical files directly to an authenticated backend or short-lived signed URL. Current visit, report, and prescription uploads save file metadata only; they do not store the file.

The API helper demonstrates a small contract: `POST /auth/login`, `GET /auth/me`, `GET/POST /appointments`, and `GET /hospitals`. Treat these as a starting interface, not an implemented server. A real hospital network also needs organization onboarding, verified provider identities, facility/department directories, scheduling rules, and consent-aware record exchange. The AI, telehealth, hospital connections, and subscription screens are product direction only; no AI service, video provider, hospital network, or payment processor is connected.

## Build and deploy the web frontend

```bash
npm run build
npm run preview
```

Vite writes static production assets to `dist/`. Deploy that directory to a static host with HTTPS and SPA fallback routing configured if you later add client-side routes. Configure the API URL in the build environment; Vite environment values are public in the client bundle and must never contain secrets.

## Package for Android and iOS

This is a React web app. To publish it as an installable app while reusing this UI, wrap it with Capacitor and create native platform projects. Capacitor's current React guide uses the compiled web assets, installs the iOS/Android platforms, then syncs the bundle. This project outputs to `dist`, so its Capacitor `webDir` must be `dist`.

1. Install Capacitor core and CLI, initialize the app with your permanent reverse-domain app ID, and set `webDir` to `dist`.
2. Install `@capacitor/android` and `@capacitor/ios`, then run `npx cap add android` and `npx cap add ios`.
3. Build the web app and run `npx cap sync`; open the native projects in Android Studio or Xcode, then configure signing, icons, launch screens, privacy disclosures, and store metadata.
4. Test on real devices, including sign-in/session expiry, accessibility, uploads, offline/network failure, and privacy behavior, before submitting to either store.

Capacitor's official setup currently requires Android Studio/Android SDK for Android and macOS with Xcode for local iOS builds. Review its [React setup](https://capacitorjs.com/solution/react) and [environment requirements](https://capacitorjs.com/docs/getting-started/environment-setup) because platform requirements change over time. Store approval and a production backend are separate steps from building the frontend.

## Before real patient use

You will need a production backend and database, secure authentication and recovery, fine-grained authorization, consent and revocation enforcement, encrypted storage and transport, access audit trails, backups, monitoring, incident response, accessibility and security review, and legal/privacy compliance for the jurisdictions where you operate. Have qualified clinical, security, and legal reviewers assess the product before any real-world care use.
