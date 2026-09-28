# Calendar Notes 📅

A React Native (Expo) app for attaching notes, icons, reminders, and pictures/videos to calendar dates.

## Features

- **Calendar view** — tap any date to add a note with an emoji icon
- **Reminders** — optional date/time alarm per note via local notifications
- **Media per date** — attach pictures and short videos (≤ 20s) from camera or gallery; full-screen viewer included
- **Offline-first** — notes in AsyncStorage, media copied to the app's document directory

## Get started

```bash
npm install
npx expo start
```

> After pulling the refactored project, run `npx expo install --fix` once so
> `package-lock.json` picks up the cleaned-up dependency list.

## Project structure

```
App.tsx                  # Calendar screen, note editor modal, alarm scheduling
app/index.tsx            # expo-router entry (renders App)
src/components/
  DateImageModal.tsx     # Picture/video manager + full-screen viewer
src/utils/
  imageStorage.ts        # Media files <-> AsyncStorage index
  notifications.ts       # Local notification scheduling
assets/                  # Icons, splash
PRIVACY.html             # Privacy policy (for store listing)
```

## Notes for developers

- `babel.config.js` is required — the project will not build without it.
- Android alarm delivery: `SCHEDULE_EXACT_ALARM` is declared in `app.json`.
  On Android 12+ the user must grant "Alarms & reminders" in system settings
  for exact-time delivery.
- `expo-av` (video playback) is deprecated upstream in favor of `expo-video`;
  it still works on this SDK but plan a migration before the next major upgrade.
