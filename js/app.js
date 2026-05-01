(function () {
    'use strict';

    const STORAGE_KEY = 'boardgame_museums_visited';
    let museums = [];
    let visited = { frysk: new Set(), grunn: new Set() };
    let markers = {};
    let map;
    let hideVisited = false;

    // --- Init ---
    async function init() {
        const resp = await fetch('data/museums.json');
        museums = await resp.json();
        loadState();
        initMap();
        renderMarkers();
        renderSidebar();
        updateProgress();
        bindEvents();
    }

    // --- State Management ---
    function loadState() {
        const params = new URLSearchParams(window.location.search);
        const fryskParam = params.get('frysk');
        const grunnParam = params.get('grunn');

        if (fryskParam || grunnParam) {
            // URL takes priority
            visited.frysk = new Set(fryskParam ? fryskParam.split(',').map(Number) : []);
            visited.grunn = new Set(grunnParam ? grunnParam.split(',').map(Number) : []);
            saveToStorage();
        } else {
            // Fall back to localStorage
            loadFromStorage();
        }
    }

    function loadFromStorage() {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                const data = JSON.parse(stored);
                visited.frysk = new Set(data.frysk || []);
                visited.grunn = new Set(data.grunn || []);
            }
        } catch (e) {
            // Ignore storage errors
        }
    }

    function saveToStorage() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({
                frysk: [...visited.frysk],
                grunn: [...visited.grunn]
            }));
        } catch (e) {
            // Ignore storage errors
        }
    }

    function updateUrl() {
        const params = new URLSearchParams();
        if (visited.frysk.size > 0) {
            params.set('frysk', [...visited.frysk].sort((a, b) => a - b).join(','));
        }
        if (visited.grunn.size > 0) {
            params.set('grunn', [...visited.grunn].sort((a, b) => a - b).join(','));
        }
        const query = params.toString();
        const newUrl = window.location.pathname + (query ? '?' + query : '');
        history.replaceState(null, '', newUrl);
    }

    function toggleVisited(game, num) {
        if (visited[game].has(num)) {
            visited[game].delete(num);
        } else {
            visited[game].add(num);
        }
        saveToStorage();
        updateUrl();
        updateMarker(game, num);
        updateSidebarItem(game, num);
        updateProgress();
    }

    function isVisited(museum) {
        return visited[museum.game].has(museum.num);
    }

    // --- Map ---
    function initMap() {
        map = L.map('map').setView([53.15, 6.0], 9);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 18
        }).addTo(map);
    }

    function createIcon(game, isVisitedState) {
        const color = game === 'frysk' ? '#2563eb' : '#ea580c';
        const opacity = isVisitedState ? 0.4 : 1;
        const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="25" height="41" viewBox="0 0 25 41">
        <path d="M12.5 0C5.6 0 0 5.6 0 12.5C0 21.9 12.5 41 12.5 41S25 21.9 25 12.5C25 5.6 19.4 0 12.5 0z"
              fill="${color}" opacity="${opacity}" stroke="#fff" stroke-width="1"/>
        <circle cx="12.5" cy="12.5" r="5" fill="#fff" opacity="${opacity}"/>
      </svg>`;
        return L.divIcon({
            html: svg,
            className: '',
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [0, -34]
        });
    }

    function renderMarkers() {
        museums.forEach(museum => {
            const visitedState = isVisited(museum);
            const marker = L.marker([museum.lat, museum.lng], {
                icon: createIcon(museum.game, visitedState)
            });

            if (!(hideVisited && visitedState)) {
                marker.addTo(map);
            }

            marker.bindPopup(() => createPopupContent(museum));
            markers[museum.id] = marker;
        });
    }

    function createPopupContent(museum) {
        const visitedState = isVisited(museum);
        const div = document.createElement('div');
        div.className = 'museum-popup';
        div.innerHTML = `
      <div class="popup-name">${escapeHtml(museum.name)}</div>
      <div class="popup-address">${escapeHtml(museum.address)}</div>
      ${museum.website ? `<a class="popup-link" href="${escapeHtml(museum.website)}" target="_blank" rel="noopener">Website →</a>` : ''}
      <button class="popup-visit-btn ${visitedState ? 'visited' : ''}" data-game="${museum.game}" data-num="${museum.num}">
        ${visitedState ? '✓ Bezocht' : 'Markeer als bezocht'}
      </button>
    `;
        div.querySelector('.popup-visit-btn').addEventListener('click', function () {
            toggleVisited(museum.game, museum.num);
            const btn = this;
            const nowVisited = isVisited(museum);
            btn.textContent = nowVisited ? '✓ Bezocht' : 'Markeer als bezocht';
            btn.classList.toggle('visited', nowVisited);
        });
        return div;
    }

    function updateMarker(game, num) {
        const museum = museums.find(m => m.game === game && m.num === num);
        if (!museum) return;
        const marker = markers[museum.id];
        if (!marker) return;

        const visitedState = isVisited(museum);
        marker.setIcon(createIcon(game, visitedState));

        if (hideVisited && visitedState) {
            map.removeLayer(marker);
        } else if (!map.hasLayer(marker)) {
            marker.addTo(map);
        }
    }

    // --- Sidebar ---
    function renderSidebar() {
        renderList('frysk');
        renderList('grunn');
    }

    function renderList(game) {
        const list = document.getElementById(`list-${game}`);
        const gameMuseums = museums.filter(m => m.game === game).sort((a, b) => {
            const aVisited = isVisited(a) ? 1 : 0;
            const bVisited = isVisited(b) ? 1 : 0;
            if (aVisited !== bVisited) return aVisited - bVisited;
            return a.num - b.num;
        });

        list.innerHTML = gameMuseums.map(museum => {
            const v = isVisited(museum);
            return `
        <li class="museum-item ${v ? 'visited' : ''}" data-id="${museum.id}">
          <input type="checkbox" ${v ? 'checked' : ''} data-game="${museum.game}" data-num="${museum.num}">
          <span class="museum-name">${escapeHtml(museum.name)}</span>
          ${museum.website ? `<a class="museum-link" href="${escapeHtml(museum.website)}" target="_blank" rel="noopener" title="Website">↗</a>` : ''}
        </li>`;
        }).join('');

        list.querySelectorAll('input[type="checkbox"]').forEach(cb => {
            cb.addEventListener('change', function () {
                const game = this.dataset.game;
                const num = parseInt(this.dataset.num, 10);
                toggleVisited(game, num);
            });
        });

        // Click museum name to pan to marker
        list.querySelectorAll('.museum-name').forEach(el => {
            el.style.cursor = 'pointer';
            el.addEventListener('click', function () {
                const item = this.closest('.museum-item');
                const id = item.dataset.id;
                const museum = museums.find(m => m.id === id);
                if (museum && markers[museum.id]) {
                    map.setView([museum.lat, museum.lng], 14);
                    markers[museum.id].openPopup();
                }
            });
        });
    }

    function updateSidebarItem(game, num) {
        renderList(game);
    }

    function updateProgress() {
        const fryskTotal = museums.filter(m => m.game === 'frysk').length;
        const grunnTotal = museums.filter(m => m.game === 'grunn').length;
        document.getElementById('progress-frysk').textContent = `${visited.frysk.size} / ${fryskTotal}`;
        document.getElementById('progress-grunn').textContent = `${visited.grunn.size} / ${grunnTotal}`;
    }

    // --- Events ---
    function bindEvents() {
        // Sidebar toggle
        document.getElementById('sidebar-toggle').addEventListener('click', () => {
            document.getElementById('sidebar').classList.add('collapsed');
            setTimeout(() => map.invalidateSize(), 300);
        });

        document.getElementById('sidebar-open').addEventListener('click', () => {
            document.getElementById('sidebar').classList.remove('collapsed');
            setTimeout(() => map.invalidateSize(), 300);
        });

        // Share button
        document.getElementById('share-btn').addEventListener('click', () => {
            const url = window.location.href;
            navigator.clipboard.writeText(url).then(() => {
                showToast('Link gekopieerd naar klembord!');
            }).catch(() => {
                // Fallback for older browsers
                const input = document.createElement('input');
                input.value = url;
                document.body.appendChild(input);
                input.select();
                document.execCommand('copy');
                document.body.removeChild(input);
                showToast('Link gekopieerd!');
            });
        });

        // Reset button
        document.getElementById('reset-btn').addEventListener('click', () => {
            if (confirm('Weet je zeker dat je alle voortgang wilt resetten?')) {
                visited.frysk.clear();
                visited.grunn.clear();
                saveToStorage();
                updateUrl();
                museums.forEach(m => {
                    updateMarker(m.game, m.num);
                    updateSidebarItem(m.game, m.num);
                });
                updateProgress();
                showToast('Voortgang gereset');
            }
        });

        // Hide visited toggle
        document.getElementById('hide-visited-toggle').addEventListener('change', function () {
            hideVisited = this.checked;
            museums.forEach(museum => {
                const marker = markers[museum.id];
                if (!marker) return;
                if (hideVisited && isVisited(museum)) {
                    map.removeLayer(marker);
                } else if (!map.hasLayer(marker)) {
                    marker.addTo(map);
                }
            });
        });

        // Section collapse
        document.querySelectorAll('.section-header').forEach(header => {
            header.addEventListener('click', () => {
                const section = header.closest('.sidebar-section');
                const list = section.querySelector('.museum-list');
                list.style.display = list.style.display === 'none' ? '' : 'none';
            });
        });
    }

    // --- Helpers ---
    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function showToast(msg) {
        const toast = document.getElementById('toast');
        toast.textContent = msg;
        toast.classList.remove('hidden');
        setTimeout(() => toast.classList.add('hidden'), 2500);
    }

    // --- Start ---
    document.addEventListener('DOMContentLoaded', init);
})();
