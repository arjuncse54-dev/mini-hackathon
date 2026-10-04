import { initializeApp } from "firebase/app";
import { initializeFirestore } from "firebase/firestore";

const e = import.meta.env;
console.log("projectId used by frontend:", e.VITE_FB_PROJECT_ID, "| apiKey set:", !!e.VITE_FB_API_KEY);

export const db = initializeFirestore(
  initializeApp({
    apiKey: e.VITE_FB_API_KEY, authDomain: e.VITE_FB_AUTH_DOMAIN,
    projectId: e.VITE_FB_PROJECT_ID, appId: e.VITE_FB_APP_ID,
  }),
  { experimentalForceLongPolling: true }   // works on networks that block Firestore's default channel
);