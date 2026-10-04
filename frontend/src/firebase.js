import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const e = import.meta.env;
export const db = getFirestore(initializeApp({
  apiKey: e.VITE_FB_API_KEY, authDomain: e.VITE_FB_AUTH_DOMAIN,
  projectId: e.VITE_FB_PROJECT_ID, appId: e.VITE_FB_APP_ID,
}));
