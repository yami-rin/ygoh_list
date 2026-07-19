// ==================== PLAYMAT SYSTEM ====================

export const createPlaymatSystem = ({ api, getCurrentUser, escapeHtml, bootstrap }) => {
    let allPlaymats = [];

    const switchToPlaymat = async () => {
        document.getElementById('community-container').style.display = 'none';
        document.getElementById('gallery-content').style.display = 'none';
        document.getElementById('playmat-container').style.display = 'block';
        document.querySelectorAll('.nav-tabs > .nav-item > .nav-link').forEach(t => t.classList.remove('active'));
        document.getElementById('playmat-tab').classList.add('active');
        await renderPlaymats();
    };

    async function renderPlaymats() {
        allPlaymats = getCurrentUser() ? await api.getSupplies() : [];
        document.getElementById('playmat-count-badge').textContent = allPlaymats.length;
        renderPlaymatTagFilters();
        applyPlaymatFilter();
    }

    function renderPlaymatTagFilters() {
        const tags = JSON.parse(localStorage.getItem('supplyTags') || '[]');
        const section = document.getElementById('pm-tag-filter-section');
        const container = document.getElementById('pm-tag-filter-buttons');
        if (!tags.length) { section.style.display = 'none'; return; }
        section.style.display = '';
        container.innerHTML = tags.sort((a, b) => (a.order || 0) - (b.order || 0))
            .map(t => `<button class="tag-filter-btn" data-pm-tag="${escapeHtml(t.name)}" onclick="togglePmTag(this)">${escapeHtml(t.name)}</button>`).join('');
    }

    window.togglePmTag = (btn) => { btn.classList.toggle('active'); applyPlaymatFilter(); };

    function applyPlaymatFilter() {
        const grid = document.getElementById('playmat-grid');
        const empty = document.getElementById('playmat-empty');
        const query = (document.getElementById('pm-search')?.value || '').trim().toLowerCase();
        const sort = document.getElementById('pm-sort')?.value || 'date-desc';
        const sealed = document.getElementById('pm-sealed-filter')?.value || 'all';
        let list = [...allPlaymats];
        if (query) list = list.filter(pm => pm.name.toLowerCase().includes(query));
        if (sealed === 'sealed') list = list.filter(pm => pm.sealed);
        if (sealed === 'opened') list = list.filter(pm => !pm.sealed);
        const activeTags = [...document.querySelectorAll('#pm-tag-filter-buttons .tag-filter-btn.active')].map(b => b.dataset.pmTag);
        if (activeTags.length) list = list.filter(pm => activeTags.some(t => pm.tags && pm.tags.includes(t)));
        if (sort === 'date-desc') list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        if (sort === 'date-asc') list.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        if (sort === 'name-asc') list.sort((a, b) => a.name.localeCompare(b.name, 'ja'));
        if (sort === 'name-desc') list.sort((a, b) => b.name.localeCompare(a.name, 'ja'));
        if (list.length === 0) { grid.innerHTML = ''; empty.style.display = ''; return; }
        empty.style.display = 'none';
        grid.innerHTML = list.map(pm => `
            <div class="col-6 col-md-4 col-lg-3 col-xl-2"><div class="playmat-gallery-card" onclick="showPlaymatDetail(${allPlaymats.indexOf(pm)})" role="button">
            <div class="playmat-gallery-thumb">${pm.imageData ? `<img src="${pm.imageData}" alt="${escapeHtml(pm.name)}">` : `<i class="bi bi-image" style="font-size:2.5rem;color:#adb5bd;"></i>`}</div>
            <div class="playmat-gallery-body"><div class="mb-1"><span class="badge ${pm.sealed ? 'bg-success' : 'bg-warning text-dark'}" style="font-size:.62rem;">${pm.sealed ? '未開封' : '開封済み'}</span></div>
            <div class="playmat-gallery-name">${escapeHtml(pm.name)}</div>${pm.description ? `<div class="playmat-gallery-desc">${escapeHtml(pm.description)}</div>` : ''}
            ${pm.tags && pm.tags.length ? `<div class="playmat-gallery-tags">${pm.tags.map(t => `<span class="badge bg-secondary" style="font-size:.6rem;">${escapeHtml(t)}</span>`).join('')}</div>` : ''}</div></div></div>`).join('');
    }

    function showPlaymatDetail(index) {
        const pm = allPlaymats[index]; if (!pm) return;
        document.getElementById('pm-detail-name').textContent = pm.name;
        const img = document.getElementById('pm-detail-img'); const noImg = document.getElementById('pm-detail-no-img');
        if (pm.imageData) { img.src = pm.imageData; img.style.display = ''; noImg.style.display = 'none'; }
        else { img.style.display = 'none'; noImg.style.display = ''; }
        const badge = document.getElementById('pm-detail-badge');
        badge.textContent = pm.sealed ? '未開封' : '開封済み'; badge.className = `badge ${pm.sealed ? 'bg-success' : 'bg-warning text-dark'}`;
        document.getElementById('pm-detail-desc').textContent = pm.description || '';
        const tagsEl = document.getElementById('pm-detail-tags');
        tagsEl.innerHTML = pm.tags && pm.tags.length ? pm.tags.map(t => `<span class="badge bg-secondary">${escapeHtml(t)}</span>`).join('') : '';
        new bootstrap.Modal(document.getElementById('playmatDetailModal')).show();
    }

    window.showPlaymatDetail = showPlaymatDetail;
    return { switchToPlaymat, applyPlaymatFilter };
};

// ==================== END PLAYMAT SYSTEM ====================
