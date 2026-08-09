import { initializeCardList } from '../pages/card-list/collection.js';

const cardList = initializeCardList();

// Compatibility API used by the existing inline pagination handlers.
window.changePage = cardList.changePage;
