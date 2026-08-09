import { getFirebaseClient } from './firebase-client.js';

export const AUTH_STATUS = Object.freeze({
    UNAUTHENTICATED: 'unauthenticated',
    AUTHENTICATED: 'authenticated',
    LOCAL: 'local',
});

const DEFAULT_LOCAL_USER = Object.freeze({ uid: 'local_user', email: 'local' });

function createState(status, user, isLocal) {
    return Object.freeze({ status, user, isLocal });
}

async function connectApi(api, user) {
    if (api?.setAuth) await api.setAuth(user);
}

export async function subscribeAuth(onChange, {
    api = null,
    getClient = getFirebaseClient,
    firebaseClientOptions,
    localMode = false,
    localUser = DEFAULT_LOCAL_USER,
    apiUser = localUser,
    persistence,
    onError = (error) => console.error('auth subscription failed:', error),
} = {}) {
    if (typeof onChange !== 'function') throw new TypeError('subscribeAuth requires onChange callback');
    let active = true;

    if (localMode) {
        await connectApi(api, apiUser);
        if (active) await onChange(createState(AUTH_STATUS.LOCAL, localUser, true));
        return () => { active = false; };
    }

    const client = await getClient(firebaseClientOptions);
    const { auth, sdk } = client;
    const selectedPersistence = persistence === undefined ? sdk.browserLocalPersistence : persistence;
    if (selectedPersistence !== false && selectedPersistence != null && typeof sdk.setPersistence === 'function') {
        await sdk.setPersistence(auth, selectedPersistence);
    }

    let callbackQueue = Promise.resolve();
    const handleUser = (user) => {
        callbackQueue = callbackQueue.then(async () => {
            if (!active) return;
            await connectApi(api, user || null);
            if (!active) return;
            const state = user
                ? createState(AUTH_STATUS.AUTHENTICATED, user, false)
                : createState(AUTH_STATUS.UNAUTHENTICATED, null, false);
            await onChange(state);
        }).catch(onError);
    };
    const unsubscribeFirebase = sdk.onAuthStateChanged(auth, handleUser, onError);
    return () => {
        active = false;
        unsubscribeFirebase?.();
    };
}
