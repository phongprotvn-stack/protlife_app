# PROT LIFE — Personal Life OS

App quản lý quan hệ cá nhân, ký ức & cuộc sống.

- **Frontend**: React 19 + Vite 8 + Tailwind CSS v4
- **Backend**: Express + Firebase Admin SDK (Vercel Serverless)
- **Database**: Firebase Firestore
- **Auth**: Firebase Auth (Google + Email/Password)
- **Hosting**: Vercel (https://protlife.vercel.app)
- **GitHub**: phongprotvn-stack/protlife_app

## Stack

- React 19, Vite 8, Tailwind v4, Framer Motion
- Firebase Firestore + Auth
- Express 5 + Firebase Admin SDK
- Lucide Icons, Recharts, Leaflet Maps
- vite-plugin-pwa (PWA)
- Data Hub: Import/Export (JSON, Excel, PDF, Word, Google Sheets)

## Scripts

```bash
npm run dev      # Local dev
npm run build    # Build production
npm run preview  # Preview production build
```

## Deploy

```bash
npm run build
npx vercel --prod --yes
```
