import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { api } from '../../api-client.js';
import { loadMasterData } from '../shared/master-data.js';
import { createCacheSystem } from './cache.js';
import { createCommunityCacheSystem, COMMUNITY_TTL } from './community-cache.js';
import { createPlaymatSystem } from './playmat.js';
import { createPackOpeningSystem } from './pack-opening.js';
import { createBookmarksSystem } from './bookmarks.js';
import { createCommunitySystem } from './community.js';
import { createDeckSystem } from './deck.js';
import { createCollectionSystem } from './collection.js';
import { createGalleryImageQueue } from './image-queue.js';

const firebaseConfig = {
    apiKey: "AIzaSyAOYKalLUb2hbghrjQUS8AWzxpLExBT7aU",
    authDomain: "ygoh-9bcf6.firebaseapp.com",
    projectId: "ygoh-9bcf6",
    storageBucket: "ygoh-9bcf6.firebasestorage.app",
    messagingSenderId: "515041224138",
    appId: "1:515041224138:web:8de47b38ed9cc1bb8afd37",
    measurementId: "G-ZGSRE8MHZ2"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const ADMIN_UIDS = ['tMyC2ohYVAgoDzmBs5Zx2VT8t6m1'];

let isAdmin = false;
let currentUser = null;
let cardDetailsMap = new Map();
let cardReadingMap = new Map();

let collectionSystem;
let cacheSystem;
let deckSystem;
let communityCacheSystem;
const imageQueue = createGalleryImageQueue({ maxConcurrent: 6 });

const loadCardData = async () => {
    try {
        const master = await loadMasterData();
        cardDetailsMap = master.cardDetailsMap;
        cardReadingMap = master.cardReadingMap;

        console.log(`Loaded ${cardReadingMap.size} card readings and ${cardDetailsMap.size} card details (${master.fromCache ? 'IndexedDBキャッシュ' : 'ネットワーク'})`);
        window.cardDetailsMap = cardDetailsMap;
    } catch (error) {
        console.error('Error loading card data:', error);
    }
};

const constructSystems = () => {
    const { RARITY_ORDER, buildEffectHtml } = createPackOpeningSystem({
        getCollectionCards: () => collectionSystem.getCollectionCards(),
        escapeHtml: (...args) => collectionSystem.escapeHtml(...args),
        decodeHtmlEntities: (...args) => collectionSystem.decodeHtmlEntities(...args),
        getCardImageUrl: (...args) => new Promise((resolve, reject) => {
            imageQueue.enqueueCurrent('pack-opening', {
                load: () => collectionSystem.getCardImageUrl(...args),
                apply: resolve,
                onError: reject
            });
        })
    });

    collectionSystem = createCollectionSystem({
        api,
        imageCacheManager,
        PROXY_URL,
        cardDetailsMap,
        cardReadingMap,
        RARITY_ORDER,
        buildEffectHtml,
        imageQueue,
        getCurrentUser: () => currentUser,
        saveGalleryToCache: (...args) => cacheSystem.saveGalleryToCache(...args),
        loadGalleryFromCache: (...args) => cacheSystem.loadGalleryFromCache(...args),
        isGalleryRemoteNewer: (...args) => cacheSystem.isGalleryRemoteNewer(...args),
        updateGalleryMetadata: (...args) => cacheSystem.updateGalleryMetadata(...args),
        loadDecks: (...args) => deckSystem.loadDecks(...args),
        getCardUsageInDecks: (...args) => deckSystem.getCardUsageInDecks(...args),
        getCurrentDeck: () => deckSystem.getCurrentDeck()
    });

    cacheSystem = createCacheSystem({
        api,
        getCurrentUser: () => currentUser,
        getCollectionCards: collectionSystem.getCollectionCards,
        getWishlistCards: collectionSystem.getWishlistCards,
        getBookmarkCards: collectionSystem.getBookmarkCards,
        getDecks: collectionSystem.getDecks,
        setCollectionCards: collectionSystem.setCollectionCards,
        setWishlistCards: collectionSystem.setWishlistCards,
        setBookmarkCards: collectionSystem.setBookmarkCards,
        setDecks: collectionSystem.setDecks,
        getCurrentListType: collectionSystem.getCurrentListType,
        showLoading: collectionSystem.showLoading,
        switchListType: collectionSystem.switchListType
    });

    deckSystem = createDeckSystem({
        api,
        getCurrentUser: () => currentUser,
        getDecks: collectionSystem.getDecks,
        setDecks: collectionSystem.setDecks,
        getCollectionCards: collectionSystem.getCollectionCards,
        getWishlistCards: collectionSystem.getWishlistCards,
        getDraggedCard: collectionSystem.getDraggedCard,
        setDraggedCard: collectionSystem.setDraggedCard,
        getBookmarkCards: collectionSystem.getBookmarkCards,
        setBookmarkCards: collectionSystem.setBookmarkCards,
        getCurrentListType: collectionSystem.getCurrentListType,
        setAllCards: collectionSystem.setAllCards,
        getCurrentPage: collectionSystem.getCurrentPage,
        getItemsPerPage: collectionSystem.getItemsPerPage,
        getFilteredCards: collectionSystem.getFilteredCards,
        saveGalleryToCache: cacheSystem.saveGalleryToCache,
        updateGalleryMetadata: cacheSystem.updateGalleryMetadata,
        renderCards: collectionSystem.renderCards,
        applyFilters: collectionSystem.applyFilters,
        updateStats: collectionSystem.updateStats,
        escapeHtml: collectionSystem.escapeHtml,
        decodeHtmlEntities: collectionSystem.decodeHtmlEntities,
        getCardImageUrl: collectionSystem.getCardImageUrl,
        imageQueue,
        createBookmarksSystem,
        bootstrap: window.bootstrap,
        html2canvas: window.html2canvas
    });

    const { switchToPlaymat, applyPlaymatFilter } = createPlaymatSystem({
        api,
        getCurrentUser: () => currentUser,
        escapeHtml: collectionSystem.escapeHtml,
        bootstrap: window.bootstrap
    });

    communityCacheSystem = createCommunityCacheSystem({ getCurrentUser: () => currentUser });

    const { loadPublicProfile, initializeCommunity } = createCommunitySystem({
        api,
        getCurrentUser: () => currentUser,
        getIsAdmin: () => isAdmin,
        getCardDetailsMap: () => cardDetailsMap,
        imageCacheManager,
        PROXY_URL,
        getCardImageUrl: collectionSystem.getCardImageUrl,
        imageQueue,
        escapeHtml: collectionSystem.escapeHtml,
        decodeHtmlEntities: collectionSystem.decodeHtmlEntities,
        getReadingForSort: (...args) => collectionSystem.getReadingForSort(...args),
        switchToPlaymat,
        applyPlaymatFilter,
        communityCache: communityCacheSystem,
        communityTtl: COMMUNITY_TTL
    });

    window.changePage = collectionSystem.changePage;
    window.openCardEditModal = collectionSystem.openCardEditModal;
    window.handleDragStart = collectionSystem.handleDragStart;
    if (new URLSearchParams(location.search).has('localtest')) {
        window.__galleryImageQueue = imageQueue;
    }

    return { loadPublicProfile, initializeCommunity };
};

const init = async () => {
    // card_listと共通のテーマ設定(localStorage['theme'])を起動時に適用
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-bs-theme', savedTheme);

    try {
        await imageCacheManager.init();
        console.log('Image cache manager initialized');
    } catch (error) {
        console.error('Failed to initialize image cache manager:', error);
    }

    await loadCardData();
    const { loadPublicProfile, initializeCommunity } = constructSystems();
    collectionSystem.showLoading(true);

    // ローカルテストモード(?localtest=1): Firebase認証を迂回し、
    // localStorageのgalleryCacheから描画する（card_listのlocal_userパターン踏襲。
    // ヘッドレスでの認証後ホットパス計測・検証専用。APIは呼ばない）
    if (new URLSearchParams(location.search).has('localtest')) {
        currentUser = { uid: 'local_user' };
        isAdmin = false;
        collectionSystem.restorePreferences();
        collectionSystem.loadAllData('local_user');
        return;
    }

    onAuthStateChanged(auth, (user) => {
        if (user) {
            const vipData = localStorage.getItem('vip_membership');
            let isVipMember = false;

            if (vipData) {
                try {
                    const parsed = JSON.parse(vipData);
                    if (parsed.active && parsed.verified) {
                        isVipMember = true;
                    }
                } catch (e) {
                    console.error('Error parsing VIP data:', e);
                }
            }

            if (!isVipMember) {
                alert('このページはVIPメンバー専用です。\n\nカードリストページに戻ります。');
                window.location.href = 'card_list.html';
                return;
            }

            currentUser = user;
            isAdmin = ADMIN_UIDS.includes(user.uid);
            console.log('Admin status:', isAdmin);

            api.setAuth(user).then(() => {
                collectionSystem.loadAllData(user.uid);
                collectionSystem.loadAllAliases();
            });
            loadPublicProfile();
            initializeCommunity();
            collectionSystem.restorePreferences();
        } else {
            alert('ログインが必要です。');
            window.location.href = 'card_list.html';
        }
    });
};

init();

window.addEventListener('scroll', function() {
    const navbar = document.querySelector('.navbar-custom');
    if (window.scrollY > 50) {
        navbar.classList.add('scrolled');
    } else {
        navbar.classList.remove('scrolled');
    }
});
