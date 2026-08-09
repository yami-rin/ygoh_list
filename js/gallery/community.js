// ==================== COMMUNITY SYSTEM ====================

export const createCommunitySystem = (deps) => {
    let publicUsers = [];
    let viewingUserId = null;
    let viewingUserData = {
        collection: [],
        wishlist: [],
        decks: [],
        profile: null,
        wishlistLoaded: false,
        decksLoaded: false
    };
    let viewingCurrentType = 'collection';
    let viewingFilteredCards = [];
    let viewingCurrentPage = 1;
    const viewingItemsPerPage = 30;

    // Load user's public profile settings
    const loadPublicProfile = async () => {
        if (!deps.getCurrentUser()) return;

        const cachedProfile = deps.communityCache.getCachedProfile(deps.getCurrentUser().uid, deps.communityTtl.PROFILE);
        if (cachedProfile) {
            document.getElementById('public-profile-toggle').checked = cachedProfile.isPublic || false;
            document.getElementById('display-name-input').value = cachedProfile.displayName || '';

            if (cachedProfile.isPublic && cachedProfile.shareToken) {
                const shareUrl = `${window.location.origin}${window.location.pathname}?view=${deps.getCurrentUser().uid}`;
                document.getElementById('share-link-input').value = shareUrl;
            }
            return;
        }

        try {
            const profile = await deps.api.getProfile(deps.getCurrentUser().uid).catch(() => null);

            if (profile) {
                document.getElementById('public-profile-toggle').checked = profile.isPublic || false;
                document.getElementById('display-name-input').value = profile.displayName || '';

                if (profile.isPublic && profile.shareToken) {
                    const shareUrl = `${window.location.origin}${window.location.pathname}?view=${deps.getCurrentUser().uid}`;
                    document.getElementById('share-link-input').value = shareUrl;
                }
                deps.communityCache.setCachedProfile(deps.getCurrentUser().uid, profile);
            } else {
                // Initialize profile for new users
                const defaultDisplayName = deps.getCurrentUser().email?.split('@')[0] || 'Anonymous';
                const shareToken = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36);
                await deps.api.updateProfile({
                    isPublic: false,
                    displayName: defaultDisplayName,
                    shareToken,
                });
                document.getElementById('display-name-input').value = defaultDisplayName;
                deps.communityCache.setCachedProfile(deps.getCurrentUser().uid, {
                    isPublic: false,
                    displayName: defaultDisplayName,
                    shareToken
                });
                console.log('Initialized public profile for new user (private by default)');
            }
        } catch (error) {
            console.error('Error loading public profile:', error);
        }
    };

    // Save public profile settings
    const savePublicProfile = async () => {
        if (!deps.getCurrentUser()) return;

        const isPublic = document.getElementById('public-profile-toggle').checked;
        const displayName = document.getElementById('display-name-input').value.trim();

        try {
            const shareToken = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36);

            await deps.api.updateProfile({
                isPublic,
                displayName: displayName || deps.getCurrentUser().email?.split('@')[0] || 'Anonymous',
                shareToken,
            });

            if (isPublic) {
                const shareUrl = `${window.location.origin}${window.location.pathname}?view=${deps.getCurrentUser().uid}`;
                document.getElementById('share-link-input').value = shareUrl;
            } else {
                document.getElementById('share-link-input').value = '';
            }

            const uid = deps.getCurrentUser().uid;
            const profilePatch = { isPublic, displayName: displayName || deps.getCurrentUser().email?.split('@')[0] || 'Anonymous', shareToken };
            deps.communityCache.setCachedProfile(uid, profilePatch);
            deps.communityCache.patchCachedPublicProfile(uid, profilePatch);

            alert('公開設定を保存しました');
        } catch (error) {
            console.error('Error saving public profile:', error);
            alert('保存に失敗しました');
        }
    };

    // Load public users list (limited to 50 users to save reads)
    const loadPublicUsers = async (forceRefresh = false) => {
        const userList = document.getElementById('user-list');

        if (!forceRefresh) {
            const cachedProfiles = deps.communityCache.getCachedPublicProfiles(deps.communityTtl.PUBLIC_PROFILES);
            if (cachedProfiles) {
                publicUsers = [];
                for (const data of cachedProfiles) {
                    if (deps.getIsAdmin() || data.isPublic) {
                        publicUsers.push({
                            id: data.userId,
                            ...data
                        });
                    }
                }
                renderUserList();
                return;
            }
        }

        userList.innerHTML = '<div class="text-center py-3"><div class="spinner-border spinner-border-sm" role="status"></div> 読み込み中...</div>';

        try {
            const profiles = await deps.api.getPublicProfiles();
            deps.communityCache.setCachedPublicProfiles(profiles);

            publicUsers = [];
            for (const data of profiles) {
                if (deps.getIsAdmin() || data.isPublic) {
                    publicUsers.push({
                        id: data.userId,
                        ...data
                    });
                }
            }

            renderUserList();
        } catch (error) {
            console.error('Error loading public users:', error);
            userList.innerHTML = '<div class="text-danger text-center py-3"><i class="bi bi-exclamation-circle"></i> 読み込みに失敗しました</div>';
        }
    };

    // Render user list
    const renderUserList = () => {
        const userList = document.getElementById('user-list');
        const searchQuery = document.getElementById('user-search-input').value.toLowerCase();

        const filtered = publicUsers.filter(user => {
            if (!searchQuery) return true;
            const name = (user.displayName || '').toLowerCase();
            return name.includes(searchQuery);
        });

        if (filtered.length === 0) {
            if (publicUsers.length === 0) {
                // No public profiles exist yet
                userList.innerHTML = `
                    <div class="text-muted text-center py-3">
                        <i class="bi bi-people" style="font-size: 2rem;"></i>
                        <p class="mt-2 mb-1">公開プロファイルがありません</p>
                        <small>自分のプロファイルを公開するには、上の設定で「プロファイルを公開」をオンにしてください。</small>
                    </div>`;
            } else {
                // Search returned no results
                userList.innerHTML = '<div class="text-muted text-center py-3">検索条件に一致するユーザーがいません</div>';
            }
            return;
        }

        userList.innerHTML = filtered.map(user => `
            <div class="user-item d-flex align-items-center p-2 border-bottom" style="cursor: pointer;" data-user-id="${user.id}">
                <div class="me-2">
                    <i class="bi bi-person-circle" style="font-size: 1.5rem;"></i>
                </div>
                <div class="flex-grow-1">
                    <div class="fw-bold">${deps.escapeHtml(user.displayName || 'Anonymous')}</div>
                    <small class="text-muted">
                        ${user.isPublic ? '<span class="badge bg-success">公開</span>' : '<span class="badge bg-secondary">非公開</span>'}
                        ${user.id === deps.getCurrentUser()?.uid ? '<span class="badge bg-primary">自分</span>' : ''}
                    </small>
                </div>
                <i class="bi bi-chevron-right"></i>
            </div>
        `).join('');

        // Add click handlers
        userList.querySelectorAll('.user-item').forEach(item => {
            item.addEventListener('click', () => {
                const userId = item.dataset.userId;
                loadUserCollection(userId);
            });
        });
    };

    // Load a specific user's collection (lazy loading - only loads collection initially)
    const loadUserCollection = async (userId) => {
        if (!userId) return;

        viewingUserId = userId;
        // Reset data for new user
        viewingUserData = {
            collection: [],
            wishlist: [],
            decks: [],
            profile: null,
            wishlistLoaded: false,
            decksLoaded: false
        };

        const viewingGrid = document.getElementById('viewing-card-grid');
        viewingGrid.innerHTML = '<div class="col-12 text-center py-5"><div class="spinner-border" role="status"></div><p class="mt-2">読み込み中...</p></div>';

        try {
            // Load user's profile (認可判定に使うため常にサーバーで再検証。キャッシュしない:
            // 相手が非公開に切り替えた場合にTTL内で閲覧が継続する事故を防ぐ)
            viewingUserData.profile = await deps.api.getProfile(userId).catch(() => null);

            // Check access permission
            if (!deps.getIsAdmin() && (!viewingUserData.profile || !viewingUserData.profile.isPublic)) {
                viewingGrid.innerHTML = '<div class="col-12 text-center py-5 text-danger"><i class="bi bi-lock" style="font-size: 3rem;"></i><p class="mt-2">このユーザーのコレクションは非公開です</p></div>';
                return;
            }

            // Load only collection initially (cache-first)
            let communityCards = deps.communityCache.getCachedCommunityCards(userId, deps.communityTtl.VIEW_USER_DATA);
            if (!communityCards) {
                communityCards = await deps.api.getCommunityCards(userId);
                deps.communityCache.setCachedCommunityCards(userId, communityCards);
            }
            viewingUserData.collection = communityCards.map(c => ({ id: c.id, data: c }));

            // Update header and show UI
            const userName = viewingUserData.profile?.displayName || 'Anonymous';
            document.getElementById('viewing-user-header').innerHTML = `<i class="bi bi-collection"></i> ${deps.escapeHtml(userName)} のコレクション`;
            document.getElementById('back-to-my-collection-btn').style.display = 'inline-block';
            document.getElementById('viewing-user-tabs').style.display = 'flex';
            document.getElementById('viewing-filters').style.display = 'flex';

            // Update counts (wishlist/decks show "?" until loaded)
            document.getElementById('view-collection-count').textContent = viewingUserData.collection.length;
            document.getElementById('view-wishlist-count').textContent = '?';
            document.getElementById('view-decks-count').textContent = '?';

            // Reset tab state
            document.querySelectorAll('#viewing-user-tabs .nav-link').forEach(t => t.classList.remove('active'));
            document.querySelector('#viewing-user-tabs .nav-link[data-view-type="collection"]').classList.add('active');

            // Populate rarity filter
            populateViewingRarityFilter();

            // Render cards
            viewingCurrentType = 'collection';
            viewingCurrentPage = 1;
            applyViewingFilters();
            renderViewingCards();

        } catch (error) {
            console.error('Error loading user collection:', error);
            viewingGrid.innerHTML = '<div class="col-12 text-center py-5 text-danger"><i class="bi bi-exclamation-circle" style="font-size: 3rem;"></i><p class="mt-2">読み込みに失敗しました</p></div>';
        }
    };

    // Lazy load wishlist for viewing user
    const loadViewingWishlist = async () => {
        if (!viewingUserId || viewingUserData.wishlistLoaded) return;

        try {
            let wishlistData = deps.communityCache.getCachedCommunityCards(viewingUserId, deps.communityTtl.VIEW_USER_DATA);
            if (!wishlistData) {
                wishlistData = await deps.api.getCommunityCards(viewingUserId);
                deps.communityCache.setCachedCommunityCards(viewingUserId, wishlistData);
            }
            viewingUserData.wishlist = wishlistData.map(c => ({ id: c.id, data: c }));
            viewingUserData.wishlistLoaded = true;
            document.getElementById('view-wishlist-count').textContent = viewingUserData.wishlist.length;
            populateViewingRarityFilter(); // Update filter with wishlist rarities
        } catch (error) {
            console.error('Error loading wishlist:', error);
        }
    };

    // Lazy load decks for viewing user
    const loadViewingDecks = async () => {
        if (!viewingUserId || viewingUserData.decksLoaded) return;

        try {
            let communityDecks = deps.communityCache.getCachedCommunityDecks(viewingUserId, deps.communityTtl.VIEW_USER_DATA);
            if (!communityDecks) {
                communityDecks = await deps.api.getCommunityDecks(viewingUserId);
                deps.communityCache.setCachedCommunityDecks(viewingUserId, communityDecks);
            }
            viewingUserData.decks = communityDecks.map(d => ({ id: d.id, data: d }));
            viewingUserData.decksLoaded = true;
            document.getElementById('view-decks-count').textContent = viewingUserData.decks.length;
        } catch (error) {
            console.error('Error loading decks:', error);
        }
    };

    // Populate rarity filter for viewing
    const populateViewingRarityFilter = () => {
        const filter = document.getElementById('viewing-rarity-filter');
        const rarities = new Set();

        viewingUserData.collection.forEach(card => {
            if (card.data['レアリティ']) rarities.add(card.data['レアリティ']);
        });
        viewingUserData.wishlist.forEach(card => {
            if (card.data['レアリティ']) rarities.add(card.data['レアリティ']);
        });

        filter.innerHTML = '<option value="">全レアリティ</option>' +
            Array.from(rarities).sort().map(r => `<option value="${deps.escapeHtml(r)}">${deps.escapeHtml(r)}</option>`).join('');
    };

    // Apply filters for viewing
    const applyViewingFilters = () => {
        const searchQuery = document.getElementById('viewing-search-input')?.value.toLowerCase() || '';
        const rarityFilter = document.getElementById('viewing-rarity-filter')?.value || '';
        const sortBy = document.getElementById('viewing-sort')?.value || 'name';

        let cards = viewingCurrentType === 'collection' ? viewingUserData.collection :
                    viewingCurrentType === 'wishlist' ? viewingUserData.wishlist : [];

        // Filter
        viewingFilteredCards = cards.filter(card => {
            const name = (card.data['名前'] || '').toLowerCase();
            const rarity = card.data['レアリティ'] || '';

            if (searchQuery && !name.includes(searchQuery)) return false;
            if (rarityFilter && rarity !== rarityFilter) return false;
            return true;
        });

        // Sort
        viewingFilteredCards.sort((a, b) => {
            if (sortBy === 'name') {
                return deps.getReadingForSort(a.data['名前']).localeCompare(deps.getReadingForSort(b.data['名前']), 'ja');
            } else if (sortBy === 'quantity-desc') {
                return (b.data['枚数'] || 0) - (a.data['枚数'] || 0);
            } else if (sortBy === 'rarity') {
                return (a.data['レアリティ'] || '').localeCompare(b.data['レアリティ'] || '');
            }
            return 0;
        });
    };

    // Render viewing cards
    const renderViewingCards = () => {
        const grid = document.getElementById('viewing-card-grid');

        if (viewingCurrentType === 'decks') {
            deps.imageQueue.cancel('community-view');
            // Render decks list
            if (viewingUserData.decks.length === 0) {
                grid.innerHTML = '<div class="col-12 text-center text-muted py-5">デッキがありません</div>';
                return;
            }

            grid.innerHTML = viewingUserData.decks.map(deck => `
                <div class="col-md-6 col-lg-4">
                    <div class="card">
                        <div class="card-body">
                            <h5 class="card-title"><i class="bi bi-box"></i> ${deps.escapeHtml(deck.data.name || '無題のデッキ')}</h5>
                            <p class="card-text small text-muted">
                                メイン: ${(deck.data.mainDeck || []).length}枚 /
                                EX: ${(deck.data.extraDeck || []).length}枚 /
                                サイド: ${(deck.data.sideDeck || []).length}枚
                            </p>
                            ${deck.data.memo ? `<p class="card-text small">${deps.escapeHtml(deck.data.memo)}</p>` : ''}
                        </div>
                    </div>
                </div>
            `).join('');
            return;
        }

        // Render cards
        const start = (viewingCurrentPage - 1) * viewingItemsPerPage;
        const pageCards = viewingFilteredCards.slice(start, start + viewingItemsPerPage);

        if (pageCards.length === 0) {
            deps.imageQueue.cancel('community-view');
            grid.innerHTML = '<div class="col-12 text-center text-muted py-5">カードがありません</div>';
            document.getElementById('viewing-pagination').style.display = 'none';
            return;
        }

        grid.innerHTML = pageCards.map(card => {
            const cardId = deps.getCardDetailsMap().get(card.data['名前'])?.cardId || '';
            return `
                <div class="col-6 col-md-4 col-lg-3">
                    <div class="card h-100">
                        <div class="card-img-wrapper" style="position: relative; padding-top: 145%; background: #f0f0f0;">
                            <img data-card-id="${cardId}" data-ciid="${card.data.ciid || '1'}"
                                 data-card-name="${deps.escapeHtml(deps.decodeHtmlEntities(card.data['名前'] || ''))}"
                                 class="view-card-img" alt="${deps.escapeHtml(deps.decodeHtmlEntities(card.data['名前'] || ''))}"
                                 style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover;"
                                 loading="lazy">
                        </div>
                        <div class="card-body p-2">
                            <p class="card-title small mb-1 text-truncate" title="${deps.escapeHtml(deps.decodeHtmlEntities(card.data['名前'] || ''))}">
                                ${deps.escapeHtml(deps.decodeHtmlEntities(card.data['名前'] || '不明'))}
                            </p>
                            <small class="text-muted">
                                ${deps.escapeHtml(card.data['型番'] || '')} |
                                ${deps.escapeHtml(card.data['レアリティ'] || '')} |
                                ×${card.data['枚数'] || 1}
                            </small>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        // Load only cards that are visible after the result DOM has been rendered.
        deps.imageQueue.observe('community-view', grid.querySelectorAll('.view-card-img'), (img) => {
            const cardId = img.dataset.cardId;
            const ciid = img.dataset.ciid || '1';
            const cardName = img.dataset.cardName || '';
            if (!cardId) return null;
            return {
                key: `${cardId}_${ciid}`,
                load: () => deps.getCardImageUrl(cardName, ciid, cardId),
                apply: (imageUrl) => { if (imageUrl) img.src = imageUrl; },
                onError: (error) => console.error(`Failed to load image for ${cardName}:`, error)
            };
        });

        // Render pagination
        renderViewingPagination();
    };

    // Render viewing pagination
    const renderViewingPagination = () => {
        const totalPages = Math.ceil(viewingFilteredCards.length / viewingItemsPerPage);
        const paginationEl = document.getElementById('viewing-pagination');

        if (totalPages <= 1) {
            paginationEl.style.display = 'none';
            return;
        }

        paginationEl.style.display = 'flex';
        paginationEl.innerHTML = `
            <nav>
                <ul class="pagination pagination-sm mb-0">
                    <li class="page-item ${viewingCurrentPage === 1 ? 'disabled' : ''}">
                        <a class="page-link" href="#" data-page="${viewingCurrentPage - 1}">前へ</a>
                    </li>
                    <li class="page-item disabled">
                        <span class="page-link">${viewingCurrentPage} / ${totalPages}</span>
                    </li>
                    <li class="page-item ${viewingCurrentPage === totalPages ? 'disabled' : ''}">
                        <a class="page-link" href="#" data-page="${viewingCurrentPage + 1}">次へ</a>
                    </li>
                </ul>
            </nav>
        `;

        paginationEl.querySelectorAll('.page-link[data-page]').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const page = parseInt(link.dataset.page);
                if (page >= 1 && page <= totalPages) {
                    viewingCurrentPage = page;
                    renderViewingCards();
                }
            });
        });
    };

    // Initialize community event handlers
    const initializeCommunity = () => {
        // Refresh users button
        document.getElementById('refresh-users-btn').addEventListener('click', () => loadPublicUsers(true));

        // User search
        document.getElementById('user-search-input').addEventListener('input', renderUserList);

        // Save profile settings
        document.getElementById('save-profile-settings-btn').addEventListener('click', savePublicProfile);

        // Copy share link
        document.getElementById('copy-share-link-btn').addEventListener('click', () => {
            const input = document.getElementById('share-link-input');
            if (input.value) {
                navigator.clipboard.writeText(input.value).then(() => {
                    alert('リンクをコピーしました');
                });
            }
        });

        // Back to my collection
        document.getElementById('back-to-my-collection-btn').addEventListener('click', () => {
            viewingUserId = null;
            document.getElementById('viewing-user-header').innerHTML = '<i class="bi bi-collection"></i> ユーザーを選択してください';
            document.getElementById('back-to-my-collection-btn').style.display = 'none';
            document.getElementById('viewing-user-tabs').style.display = 'none';
            document.getElementById('viewing-filters').style.display = 'none';
            document.getElementById('viewing-card-grid').innerHTML = `
                <div class="col-12 text-center text-muted py-5">
                    <i class="bi bi-person-circle" style="font-size: 3rem;"></i>
                    <p class="mt-2">左のユーザー一覧からユーザーを選択すると<br>そのユーザーのコレクションが表示されます</p>
                </div>
            `;
            document.getElementById('viewing-pagination').style.display = 'none';
        });

        // Viewing user tabs (with lazy loading)
        document.querySelectorAll('#viewing-user-tabs .nav-link').forEach(tab => {
            tab.addEventListener('click', async () => {
                document.querySelectorAll('#viewing-user-tabs .nav-link').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                viewingCurrentType = tab.dataset.viewType;
                viewingCurrentPage = 1;

                // Lazy load data if needed
                if (viewingCurrentType === 'wishlist' && !viewingUserData.wishlistLoaded) {
                    const grid = document.getElementById('viewing-card-grid');
                    grid.innerHTML = '<div class="col-12 text-center py-3"><div class="spinner-border spinner-border-sm"></div> 読み込み中...</div>';
                    await loadViewingWishlist();
                } else if (viewingCurrentType === 'decks' && !viewingUserData.decksLoaded) {
                    const grid = document.getElementById('viewing-card-grid');
                    grid.innerHTML = '<div class="col-12 text-center py-3"><div class="spinner-border spinner-border-sm"></div> 読み込み中...</div>';
                    await loadViewingDecks();
                }

                applyViewingFilters();
                renderViewingCards();
            });
        });

        // Viewing filters
        document.getElementById('viewing-search-input')?.addEventListener('input', () => {
            viewingCurrentPage = 1;
            applyViewingFilters();
            renderViewingCards();
        });
        document.getElementById('viewing-rarity-filter')?.addEventListener('change', () => {
            viewingCurrentPage = 1;
            applyViewingFilters();
            renderViewingCards();
        });
        document.getElementById('viewing-sort')?.addEventListener('change', () => {
            viewingCurrentPage = 1;
            applyViewingFilters();
            renderViewingCards();
        });

        // Community tab click
        document.getElementById('community-tab').addEventListener('click', () => {
            switchToCommunity();
        });

        // Playmat tab click
        document.getElementById('playmat-tab').addEventListener('click', () => {
            deps.switchToPlaymat();
        });
        document.getElementById('pm-search').addEventListener('input', deps.applyPlaymatFilter);
        document.getElementById('pm-sort').addEventListener('change', deps.applyPlaymatFilter);
        document.getElementById('pm-sealed-filter').addEventListener('change', deps.applyPlaymatFilter);
        document.getElementById('pm-clear-filters').addEventListener('click', () => {
            document.getElementById('pm-search').value = '';
            document.getElementById('pm-sort').value = 'date-desc';
            document.getElementById('pm-sealed-filter').value = 'all';
            document.querySelectorAll('#pm-tag-filter-buttons .tag-filter-btn.active').forEach(b => b.classList.remove('active'));
            deps.applyPlaymatFilter();
        });

        // Check URL for direct view parameter
        const urlParams = new URLSearchParams(window.location.search);
        const viewUserId = urlParams.get('view');
        if (viewUserId) {
            // Auto-switch to community and load the user
            setTimeout(() => {
                switchToCommunity();
                loadUserCollection(viewUserId);
            }, 500);
        }

        // Admin: Add direct user ID input feature
        if (deps.getIsAdmin()) {
            const userSearchInput = document.getElementById('user-search-input');
            const adminInputDiv = document.createElement('div');
            adminInputDiv.className = 'mb-3 p-2 border border-warning rounded bg-warning bg-opacity-10';
            adminInputDiv.innerHTML = `
                <label class="form-label small text-warning fw-bold"><i class="bi bi-shield-check"></i> Admin: ユーザーID直接入力</label>
                <div class="input-group input-group-sm">
                    <input type="text" class="form-control" id="admin-uid-input" placeholder="ユーザーID (uid)">
                    <button class="btn btn-warning" type="button" id="admin-uid-load-btn">
                        <i class="bi bi-arrow-right-circle"></i> 表示
                    </button>
                </div>
                <small class="text-muted">publicProfilesに登録されていないユーザーも表示可能</small>
            `;
            userSearchInput.parentNode.insertBefore(adminInputDiv, userSearchInput);

            document.getElementById('admin-uid-load-btn').addEventListener('click', () => {
                const uid = document.getElementById('admin-uid-input').value.trim();
                if (uid) {
                    loadUserCollection(uid);
                }
            });

            document.getElementById('admin-uid-input').addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    const uid = e.target.value.trim();
                    if (uid) {
                        loadUserCollection(uid);
                    }
                }
            });
        }
    };

    // Switch to community view
    const switchToCommunity = () => {
        // Hide other containers
        document.getElementById('gallery-content').style.display = 'none';
        document.getElementById('playmat-container').style.display = 'none';

        // Show community container
        document.getElementById('community-container').style.display = 'block';

        // Update tab active state (only main tabs, not other nav elements)
        document.querySelectorAll('.nav-tabs > .nav-item > .nav-link').forEach(tab => tab.classList.remove('active'));
        document.getElementById('community-tab').classList.add('active');

        // Load users if not loaded
        if (publicUsers.length === 0) {
            loadPublicUsers();
        }
    };

    return { loadPublicProfile, initializeCommunity };
};

// ==================== END COMMUNITY SYSTEM ====================
