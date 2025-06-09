import { initializeApp, getApps } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getDatabase, connectDatabaseEmulator } from 'firebase/database';

const firebaseConfig = {
  apiKey: "AIzaSyAs-zlHthLvAVNQFJqZ0mdY-NAqjCBf0R0",
  authDomain: "za-legal.firebaseapp.com",
  projectId: "za-legal",
  storageBucket: "za-legal.firebasestorage.app",
  messagingSenderId: "515147521993",
  appId: "1:515147521993:web:4e99d4ef3dca3cfc5a9218",
  measurementId: "G-69N4XT1NS4",
  databaseURL: "https://za-legal-default-rtdb.firebaseio.com/"
};

// Initialize Firebase only if it hasn't been initialized already
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// Initialize Auth and Database
export const auth = getAuth(app);
export const database = getDatabase(app);

// Only connect to emulators in development and if not already connected
// if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
//   try {
//     // Check if already connected to avoid multiple connections
//     if (!auth.config.emulator) {
//       // connectAuthEmulator(auth, 'http://localhost:9099');
//     }
//     if (!(database as any)._delegate._repoInternal.repoInfo_.host.includes('localhost')) {
//       // connectDatabaseEmulator(database, 'localhost', 9000);
//     }
//   } catch (error) {
//     // Emulators already connected or not available
//     console.log('Firebase emulators not connected:', error);
//   }


export default app;