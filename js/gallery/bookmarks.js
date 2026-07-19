// ==================== BOOKMARK FUNCTIONS ====================

export const createBookmarksSystem = (deps) => {
    /**
     * Add card to bookmarks
     */
    const addToBookmarks = async (cardData) => {
        if (!deps.getCurrentUser()) return;

        try {
            const bookmarkData = {
                名前: cardData.data['名前'],
                型番: cardData.data['型番'],
                レアリティ: cardData.data['レアリティ'],
                枚数: cardData.data['枚数'] || 1,
                tags: cardData.data.tags || [],
                selectedCiid: cardData.data.selectedCiid,
                addedAt: new Date().toISOString(),
                updatedAt: Date.now()
            };

            const savedBookmark = await deps.api.addBookmark(bookmarkData);

            console.log('Added to bookmarks:', savedBookmark.id);

            // Update local data directly
            deps.getBookmarkCards().push({ id: savedBookmark.id, data: savedBookmark });

            // Update cache and metadata
            deps.saveGalleryToCache();
            await deps.updateGalleryMetadata();

            // Re-render if on bookmarks tab
            if (deps.getCurrentListType() === 'bookmark') {
                deps.setAllCards(deps.getBookmarkCards());
                deps.applyFilters();
                deps.renderCards();
                deps.updateStats();
            }

            alert('ブックマークに追加しました');
        } catch (error) {
            console.error('Error adding to bookmarks:', error);
            alert('ブックマークの追加に失敗しました');
        }
    };

    /**
     * Remove card from bookmarks
     */
    const removeFromBookmarks = async (cardId) => {
        if (!deps.getCurrentUser()) return;

        try {
            await deps.api.deleteBookmark(cardId);
        } catch (error) {
            if (!error.status || error.status !== 404) {
                console.error('Error removing from bookmarks:', error);
                alert('ブックマークの削除に失敗しました');
                return;
            }
            console.warn('Bookmark not found on server, removing from local cache:', cardId);
        }

        console.log('Removed from bookmarks:', cardId);

        // Update local data directly (no Firebase re-read)
        deps.setBookmarkCards(deps.getBookmarkCards().filter(c => c.id !== cardId));

        // Update cache and metadata
        deps.saveGalleryToCache();
        await deps.updateGalleryMetadata();

        // Re-render if on bookmarks tab
        if (deps.getCurrentListType() === 'bookmark') {
            deps.setAllCards(deps.getBookmarkCards());
            deps.applyFilters();
            deps.renderCards();
            deps.updateStats();
        }

        alert('ブックマークから削除しました');
    };

    /**
     * Check if card is bookmarked
     */
    const isBookmarked = (cardId) => {
        return deps.getBookmarkCards().some(c => c.id === cardId);
    };

    /**
     * Setup context menu for cards
     */
    const setupContextMenu = () => {
        const contextMenu = document.getElementById('contextMenu');
        const cardGrid = document.getElementById('card-grid');

        // Show context menu
        const showContextMenu = (x, y, items) => {
            contextMenu.innerHTML = items.map(item =>
                `<div class="context-menu-item" data-action="${item.action}">
                    <i class="bi ${item.icon}"></i>${item.label}
                </div>`
            ).join('');

            contextMenu.style.left = x + 'px';
            contextMenu.style.top = y + 'px';
            contextMenu.style.display = 'block';

            // Attach handlers
            contextMenu.querySelectorAll('.context-menu-item').forEach(el => {
                el.addEventListener('click', () => {
                    const action = el.dataset.action;
                    const handler = items.find(i => i.action === action)?.handler;
                    if (handler) handler();
                    hideContextMenu();
                });
            });

            // Keep within viewport
            const rect = contextMenu.getBoundingClientRect();
            if (rect.right > window.innerWidth) {
                contextMenu.style.left = (window.innerWidth - rect.width - 10) + 'px';
            }
            if (rect.bottom > window.innerHeight) {
                contextMenu.style.top = (window.innerHeight - rect.height - 10) + 'px';
            }
        };

        // Hide context menu
        const hideContextMenu = () => {
            contextMenu.style.display = 'none';
            contextMenu.innerHTML = '';
        };

        // Card grid right-click
        cardGrid.addEventListener('contextmenu', (e) => {
            const cardItem = e.target.closest('.card-item');
            if (!cardItem) return;

            e.preventDefault();
            e.stopPropagation();

            const cardIndex = parseInt(cardItem.dataset.cardIndex);
            const startIndex = (deps.getCurrentPage() - 1) * deps.getItemsPerPage();
            const card = deps.getFilteredCards()[startIndex + cardIndex];

            if (!card) return;

            const menuItems = [];

            // Bookmark option
            if (isBookmarked(card.id)) {
                menuItems.push({
                    label: 'ブックマークから削除',
                    icon: 'bi-bookmark-dash',
                    action: 'remove-bookmark',
                    handler: () => removeFromBookmarks(card.id)
                });
            } else {
                menuItems.push({
                    label: 'ブックマークに追加',
                    icon: 'bi-bookmark-plus',
                    action: 'add-bookmark',
                    handler: () => addToBookmarks(card)
                });
            }

            showContextMenu(e.pageX, e.pageY, menuItems);
        });

        // Hide when clicking anywhere
        document.addEventListener('click', (e) => {
            if (!contextMenu.contains(e.target)) {
                hideContextMenu();
            }
        });
    };

    return { setupContextMenu };
};

// ==================== END BOOKMARK FUNCTIONS ====================
