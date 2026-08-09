export const FIREBASE_CONFIG = Object.freeze({
    apiKey: 'AIzaSyAOYKalLUb2hbghrjQUS8AWzxpLExBT7aU',
    authDomain: 'ygoh-9bcf6.firebaseapp.com',
    projectId: 'ygoh-9bcf6',
    storageBucket: 'ygoh-9bcf6.firebasestorage.app',
    messagingSenderId: '515041224138',
    appId: '1:515041224138:web:8de47b38ed9cc1bb8afd37',
    measurementId: 'G-ZGSRE8MHZ2',
});

const FIREBASE_VERSION = '9.23.0';
const FIREBASE_BASE_URL = `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}`;
let clientPromise = null;

async function loadFirebaseSdk() {
    const [appSdk, authSdk, firestoreSdk] = await Promise.all([
        import(`${FIREBASE_BASE_URL}/firebase-app.js`),
        import(`${FIREBASE_BASE_URL}/firebase-auth.js`),
        import(`${FIREBASE_BASE_URL}/firebase-firestore.js`),
    ]);
    return { ...appSdk, ...authSdk, ...firestoreSdk };
}

async function initializeClient({ sdkLoader, config }) {
    const sdk = await sdkLoader();
    const existingApps = typeof sdk.getApps === 'function' ? sdk.getApps() : [];
    const app = existingApps.length && typeof sdk.getApp === 'function'
        ? sdk.getApp()
        : sdk.initializeApp(config);
    const auth = sdk.getAuth(app);
    const db = sdk.getFirestore(app);
    return Object.freeze({ app, auth, db, sdk });
}

export function getFirebaseClient({
    sdkLoader = loadFirebaseSdk,
    config = FIREBASE_CONFIG,
} = {}) {
    if (!clientPromise) {
        clientPromise = initializeClient({ sdkLoader, config }).catch((error) => {
            clientPromise = null;
            throw error;
        });
    }
    return clientPromise;
}

export async function getFirebaseApp(options) {
    return (await getFirebaseClient(options)).app;
}

export async function getFirebaseAuth(options) {
    return (await getFirebaseClient(options)).auth;
}

export async function getFirestoreDb(options) {
    return (await getFirebaseClient(options)).db;
}

export async function setAuthPersistence(persistence, options) {
    const client = await getFirebaseClient(options);
    if (typeof client.sdk.setPersistence !== 'function') {
        throw new Error('Firebase Auth setPersistence is unavailable');
    }
    return client.sdk.setPersistence(client.auth, persistence);
}
