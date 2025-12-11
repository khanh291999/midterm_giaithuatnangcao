// --- CẤU HÌNH & CSS ---
const CONFIG = { NODE_WIDTH: 60, NODE_SPACING: 30, LEVEL_HEIGHT: 120 };

// Biến lưu trạng thái Pan/Zoom
let panzoomState = { x: 0, y: 0, scale: 1 };
let panzoomInstance = null;

const style = document.createElement('style');
style.innerHTML = `
    @keyframes search-path-pulse {
        0% { border-color: #3b82f6; box-shadow: 0 0 5px rgba(59, 130, 246, 0.5); }
        50% { border-color: #60a5fa; box-shadow: 0 0 15px rgba(59, 130, 246, 0.8); transform: scale(1.02); }
        100% { border-color: #3b82f6; box-shadow: 0 0 5px rgba(59, 130, 246, 0.5); }
    }
    .search-path-node {
        animation: search-path-pulse 1.5s infinite;
        border: 2px solid #3b82f6 !important;
        background-color: rgba(59, 130, 246, 0.05);
    }

    @keyframes green-key-pulse {
        0% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.7); transform: scale(1); }
        50% { box-shadow: 0 0 0 10px rgba(34, 197, 94, 0); transform: scale(1.3); background: #16a34a !important; border-color: #fff; }
        100% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0); transform: scale(1); }
    }
    .newly-added-key {
        animation: green-key-pulse 2s infinite;
        background: #22c55e !important; color: white !important; border: 2px solid white !important;
        z-index: 200; position: relative;
    }

    /* Found Key Style */
    .found-key {
        background-color: #22c55e !important; /* Green-500 */
        color: white !important;
        box-shadow: 0 0 0 6px rgba(34, 197, 94, 0.4);
        transform: scale(1.25);
        border: 2px solid #fff !important;
        z-index: 100;
        font-weight: bold;
    }

    @keyframes node-affected-pulse {
        0% { border-color: #f59e0b; } 50% { border-color: #fbbf24; } 100% { border-color: #f59e0b; }
    }
    .active-node {
        animation: node-affected-pulse 1.5s infinite;
        border: 2px solid #f59e0b !important;
        background-color: #fffbeb !important;
    }

    /* Container Background */
    #treeStructure {
        background-image: radial-gradient(#e5e7eb 1px, transparent 1px);
        background-size: 20px 20px;
    }
    
    .tippy-box[data-theme~='translucent'] {
        background-color: rgba(30, 41, 59, 0.9);
        color: white;
        backdrop-filter: blur(4px);
    }
    /* Style cho message log */
    #animMessage code {
        background: #e0e7ff;
        color: #4338ca;
        padding: 2px 4px;
        border-radius: 4px;
        font-family: monospace;
        font-weight: bold;
    }
    #animMessage b {
        color: #1e40af; /* Màu xanh đậm hơn cho text in đậm */
    }
`;
document.head.appendChild(style);

// --- CLASS QUẢN LÝ ANIMATION ---
class AnimationManager {
    constructor() {
        this.steps = [];
        this.currentIndex = 0;
        this.isPlaying = false;
        this.timer = null;
        this.targetKey = null;
        
        this.controlsDiv = document.getElementById('animationControls');
        this.msgEl = document.getElementById('animMessage');
        this.progressEl = document.getElementById('animProgress');
        this.counterEl = document.getElementById('animCounter');
        this.btnPlay = document.getElementById('btnPlayPause');
    }

    start(steps, targetKey = null) {
        if (!steps || steps.length === 0) return;
        
        this.steps = steps;
        this.targetKey = targetKey;
        this.currentIndex = 0;
        this.isPlaying = false;
        if(this.timer) clearInterval(this.timer);
        
        this.controlsDiv.classList.remove('hidden');
        this.updatePlayButton();
        this.renderStep();
    }

    renderStep() {
        if (this.currentIndex < 0 || this.currentIndex >= this.steps.length) return;

        const step = this.steps[this.currentIndex];
        
        this.msgEl.innerHTML = `<span class="text-blue-600">Bước ${this.currentIndex + 1}:</span> ${step.message}`;
        this.counterEl.innerText = `${this.currentIndex + 1} / ${this.steps.length}`;
        const pct = ((this.currentIndex + 1) / this.steps.length) * 100;
        this.progressEl.style.width = `${pct}%`;

        let currentHighlightKey = null;
        if (this.targetKey && step.message && step.message.includes('ĐÃ TÌM THẤY')) {
            currentHighlightKey = this.targetKey;
        }

        drawTreeProfessional(step.tree, step.highlights, null, null, currentHighlightKey); 
    }

    next() {
        if (this.currentIndex < this.steps.length - 1) {
            this.currentIndex++;
            this.renderStep();
        } else {
            this.stop();
        }
    }

    prev() {
        if (this.currentIndex > 0) {
            this.currentIndex--;
            this.renderStep();
        }
    }

    play() {
        if (this.isPlaying) {
            this.stop();
        } else {
            this.isPlaying = true;
            this.updatePlayButton();
            if (this.currentIndex >= this.steps.length - 1) this.currentIndex = -1;
            
            this.timer = setInterval(() => {
                if (this.currentIndex < this.steps.length - 1) {
                    this.next();
                } else {
                    this.stop();
                }
            }, 1200); 
        }
    }

    stop() {
        this.isPlaying = false;
        if(this.timer) clearInterval(this.timer);
        this.updatePlayButton();
    }

    updatePlayButton() {
        if(this.isPlaying) {
            this.btnPlay.innerHTML = '<i class="bi bi-pause-fill"></i>';
            this.btnPlay.classList.add('bg-yellow-500');
            this.btnPlay.classList.remove('bg-indigo-600');
        } else {
            this.btnPlay.innerHTML = '<i class="bi bi-play-fill"></i>';
            this.btnPlay.classList.add('bg-indigo-600');
            this.btnPlay.classList.remove('bg-yellow-500');
        }
    }
}

const animManager = new AnimationManager();

// --- KHỞI TẠO ---
document.addEventListener('DOMContentLoaded', () => {
    loadAllData();
    setupEventListeners();
});

function setupEventListeners() {
    const addForm = document.getElementById('addBookForm');
    if (addForm) addForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const ma = document.getElementById('addMaSach').value.trim();
        const ten = document.getElementById('addTenSach').value.trim();
        const tg = document.getElementById('addTacGia').value.trim();
        if (!ma || !ten || !tg) return showNotification('Thiếu thông tin', 'warning');
        
        await addBook({ ma_sach: ma, ten_sach: ten, tac_gia: tg }, ma);
        addForm.reset();
    });

    const searchForm = document.getElementById('searchBookForm');
    if (searchForm) searchForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const ma = document.getElementById('searchMaSach').value.trim();
        if (!ma) return showNotification('Nhập mã sách', 'warning');
        await searchBook(ma);
    });

    const deleteForm = document.getElementById('deleteBookForm');
    if (deleteForm) deleteForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const ma = document.getElementById('deleteMaSach').value.trim();
        if (!ma) return showNotification('Nhập mã sách', 'warning');
        if(confirm(`Xóa sách ${ma}?`)) { await deleteBookById(ma); deleteForm.reset(); }
    });
}

// --- CORE FUNCTIONS ---

async function loadAllData(affectedNodesList = null, newlyAddedBookId = null, searchPath = null, skipTreeDraw = false, highlightKey = null) {
    try {
        const [booksRes, treeRes] = await Promise.all([
            fetch(`/api/books?t=${Date.now()}`),
            fetch(`/api/tree?t=${Date.now()}`)
        ]);
        const books = await booksRes.json();
        const treeRoot = await treeRes.json();
        
        renderBookTable(books);
        document.getElementById('bookCount').innerText = books.length;
        
        if (!skipTreeDraw) {
            drawTreeProfessional(treeRoot, affectedNodesList, newlyAddedBookId, searchPath, highlightKey);
        }
    } catch (error) { console.error('Lỗi tải dữ liệu:', error); }
}

async function addBook(bookData, newBookId) {
    try {
        const res = await fetch('/api/books', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(bookData)
        });
        const data = await res.json();
        
        if (data.success) {
            showNotification(data.message, 'success');
            switchTab('tree');
            
            if (data.steps && data.steps.length > 0) {
                animManager.start(data.steps);
                await loadAllData(null, null, null, true);
            } else {
                await loadAllData(data.affected_nodes, newBookId);
            }
        } else { showNotification(data.message, 'error'); }
    } catch (e) { showNotification('Lỗi server', 'error'); }
}

async function addRandomBook(btn) {
    const originalContent = btn.innerHTML;
    try {
        btn.innerHTML = `<span class="animate-spin inline-block mr-2">⟳</span> ...`; btn.disabled = true;
        const res = await fetch('/api/books/random', { method: 'POST' });
        const data = await res.json();
        if (data.success) {
            showNotification(data.message, 'success');
            switchTab('tree');
            
            if (data.steps && data.steps.length > 0) {
                animManager.start(data.steps);
                await loadAllData(null, null, null, true);
            } else {
                const newBookId = data.book ? data.book.ma_sach : null;
                await loadAllData(data.affected_nodes, newBookId);
            }
        } else { showNotification(data.message, 'warning'); }
    } catch (e) { showNotification('Lỗi kết nối', 'error'); } 
    finally { btn.innerHTML = originalContent; btn.disabled = false; }
}

async function searchBook(ma) {
    try {
        const res = await fetch(`/api/books/search/${ma}`);
        const data = await res.json();
        const resultDiv = document.getElementById('searchResult');
        
        switchTab('tree');
        
        let foundKeyId = null;

        if (data.success) {
            const b = data.book;
            foundKeyId = b.ma_sach;
            resultDiv.innerHTML = `<div class="p-3 bg-green-100 text-green-800 rounded border border-green-200 shadow-sm">
                <div class="font-bold text-lg"><i class="bi bi-check-circle-fill"></i> Tìm thấy!</div>
                <div><b>${b.ma_sach}</b> - ${b.ten_sach}</div>
                <div class="text-sm italic">${b.tac_gia}</div>
            </div>`;
            showNotification('Đã tìm thấy sách!', 'success');
        } else {
            resultDiv.innerHTML = `<div class="p-3 bg-red-100 text-red-800 rounded border border-red-200 shadow-sm">
                <div class="font-bold"><i class="bi bi-x-circle-fill"></i> Không tìm thấy</div>
                <div>Mã sách: ${ma}</div>
            </div>`;
            showNotification('Không tìm thấy', 'error');
        }

        if (data.steps && data.steps.length > 0) {
            document.getElementById('animationControls').classList.remove('hidden');
            animManager.start(data.steps, foundKeyId);
            animManager.play(); 
        } else {
            await loadAllData(null, null, null, false, foundKeyId);
        }

    } catch (e) { 
        console.error(e);
        showNotification('Lỗi tìm kiếm', 'error'); 
    }
}

async function deleteBookById(ma) {
    try {
        const res = await fetch(`/api/books/${ma}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) {
            showNotification(data.message, 'success');
            switchTab('tree');
            
            if (data.steps && data.steps.length > 0) {
                document.getElementById('animationControls').classList.remove('hidden');
                animManager.start(data.steps);
                animManager.play();
                await loadAllData(null, null, null, true);
            } else {
                document.getElementById('animationControls').classList.add('hidden');
                await loadAllData(data.affected_nodes, null);
            }

        } else {
            showNotification(data.message, 'error');
        }
    } catch (e) { showNotification('Lỗi khi xóa', 'error'); }
}

async function resetTree() {
    if (!confirm('Xóa toàn bộ dữ liệu?')) return;
    try {
        const res = await fetch('/api/reset', { method: 'POST' });
        const data = await res.json();
        if (data.success) { showNotification(data.message, 'success'); await loadAllData(); }
    } catch (e) { showNotification('Lỗi server', 'error'); }
}

async function updateDegree() {
    const mVal = document.getElementById('degreeInput').value; // Lấy giá trị từ ô input
    if(mVal < 3) return showNotification('Bậc m phải >= 3', 'error');
    if(!confirm('Tái cấu trúc cây với Bậc m=' + mVal + '?')) return;
    try {
        const res = await fetch('/api/config/degree', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ m: mVal }) // Gửi tham số m
        });
        const data = await res.json();
        if(data.success) { showNotification(data.message, 'success'); await loadAllData(); }
    } catch(e) { showNotification('Lỗi server', 'error'); }
}

// --- VISUALIZATION ENGINE (Panzoom + Tooltip) ---

function drawTreeProfessional(root, affectedNodesList = null, newlyAddedBookId = null, searchPath = null, highlightKey = null) {
    const container = document.getElementById('treeStructure'); 
    container.innerHTML = ''; 
    
    if (!root || ((!root.keys || root.keys.length === 0) && (!root.children || root.children.length === 0))) {
        container.innerHTML = '<div class="text-gray-400 text-center py-20 flex flex-col items-center"><i class="bi bi-tree text-4xl mb-2"></i><span>Cây rỗng</span></div>'; 
        return;
    }

    const treeData = calculateTreeLayout(root);
    
    // Wrapper cho Panzoom
    const panzoomWrapper = document.createElement('div');
    panzoomWrapper.id = 'panzoomWrapper';
    panzoomWrapper.className = 'origin-top-left min-w-full min-h-full';
    
    const canvas = document.createElement('div'); 
    canvas.className = 'btree-canvas relative';
    canvas.style.width = `${Math.max(treeData.width + 200, container.clientWidth)}px`; 
    canvas.style.height = `${treeData.height + 200}px`;
    
    const svgLayer = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svgLayer.setAttribute('class', 'btree-svg-layer absolute top-0 left-0 pointer-events-none'); 
    svgLayer.setAttribute('width', '100%'); svgLayer.setAttribute('height', '100%');
    canvas.appendChild(svgLayer);

    let targetElement = null;

    treeData.nodes.forEach(node => {
        const nodeEl = document.createElement('div'); 
        nodeEl.className = 'btree-node-group absolute flex gap-1 bg-slate-700 p-2 rounded-lg shadow-lg border-2 border-slate-600 transition-all duration-300';
        nodeEl.style.left = `${node.x + 50}px`; nodeEl.style.top = `${node.y + 20}px`;
        
        const keys = node.data.keys || [];
        const currentNodeSignature = keys.map(k => k.ma_sach || k).join(',');

        if (searchPath && Array.isArray(searchPath)) {
            const isInPath = searchPath.some(sig => sig.join(',') === currentNodeSignature);
            if (isInPath) {
                nodeEl.classList.add('search-path-node');
                if (searchPath[searchPath.length-1].join(',') === currentNodeSignature) targetElement = nodeEl;
            }
        }

        if (affectedNodesList && Array.isArray(affectedNodesList)) {
            const isAffected = affectedNodesList.some(sig => sig.join(',') === currentNodeSignature);
            if (isAffected) {
                nodeEl.classList.add('active-node');
                if (!targetElement) targetElement = nodeEl;
            }
        }

        if (keys.length === 0) {
            nodeEl.style.width = '20px';
            nodeEl.style.height = '20px';
            nodeEl.classList.add('bg-slate-500'); 
        }

        keys.forEach(key => {
            const keyEl = document.createElement('div'); 
            keyEl.className = 'btree-key w-10 h-10 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold text-xs shadow-inner cursor-default hover:bg-blue-400 transition-colors';
            const currentMaSach = key.ma_sach || key;
            keyEl.innerText = currentMaSach; 
            
            // Tooltip Content
            const tooltipContent = `
                <div class='text-left text-xs'>
                    <div class='font-bold text-yellow-300'>${key.ten_sach || 'N/A'}</div>
                    <div class='italic text-gray-300'>${key.tac_gia || 'N/A'}</div>
                </div>
            `;
            keyEl.setAttribute('data-tippy-content', tooltipContent);

            if (newlyAddedBookId && currentMaSach === newlyAddedBookId) {
                keyEl.classList.add('newly-added-key');
                targetElement = nodeEl;
            }

            if (highlightKey && currentMaSach === highlightKey) {
                keyEl.classList.add('found-key');
                targetElement = nodeEl;
            }

            nodeEl.appendChild(keyEl);
        });
        canvas.appendChild(nodeEl);

        if (node.parent) { 
            const startX = node.parent.x + (node.parent.width/2) + 50; const startY = node.parent.y + node.parent.height + 20;
            const endX = node.x + (node.width/2) + 50; const endY = node.y + 20;
            const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
            const controlY = (startY + endY) / 2;
            const d = `M ${startX} ${startY} C ${startX} ${controlY}, ${endX} ${controlY}, ${endX} ${endY}`;
            path.setAttribute('d', d); path.setAttribute('fill', 'none'); 
            path.setAttribute('stroke', '#94a3b8'); path.setAttribute('stroke-width', '2');
            svgLayer.appendChild(path);
        }
    });

    panzoomWrapper.appendChild(canvas);
    container.appendChild(panzoomWrapper);

    // Init Tooltips
    if (typeof tippy !== 'undefined') {
        tippy('[data-tippy-content]', { allowHTML: true, animation: 'scale', theme: 'translucent' });
    }

    // Init Panzoom
    if (typeof Panzoom !== 'undefined') {
        const elem = document.getElementById('panzoomWrapper');
        panzoomInstance = Panzoom(elem, {
            maxScale: 3, minScale: 0.1, startScale: 1,
            canvas: true 
        });
        
        // Restore State
        if (panzoomState.scale !== 1 || panzoomState.x !== 0 || panzoomState.y !== 0) {
            panzoomInstance.zoom(panzoomState.scale, { animate: false });
            panzoomInstance.pan(panzoomState.x, panzoomState.y, { animate: false });
        }

        elem.addEventListener('panzoomchange', (e) => {
            const detail = e.detail;
            panzoomState = { x: detail.x, y: detail.y, scale: detail.scale };
        });

        elem.parentElement.addEventListener('wheel', panzoomInstance.zoomWithWheel);
    }
    
    if (targetElement && panzoomState.scale === 1 && panzoomState.x === 0) {
        setTimeout(() => { targetElement.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' }); }, 300);
    }
}

function renderBookTable(books) {
    const tbody = document.getElementById('bookTableBody');
    if (!books || books.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center py-8 text-gray-400">Chưa có dữ liệu</td></tr>`; return;
    }
    tbody.innerHTML = books.map((book, idx) => `
        <tr class="hover:bg-gray-100 transition border-b">
            <td class="px-4 py-3 font-bold text-indigo-600">${book.ma_sach}</td>
            <td class="px-4 py-3 text-gray-800">${book.ten_sach}</td>
            <td class="px-4 py-3 text-gray-600">${book.tac_gia}</td>
            <td class="px-4 py-3 text-center">
               <button onclick="if(confirm('Xóa sách ${book.ma_sach}?')) deleteBookById('${book.ma_sach}')" class="text-red-500 hover:text-red-700 p-2"><i class="bi bi-trash"></i></button>
            </td>
        </tr>`).join('');
}

function calculateTreeLayout(root) {
    let nodes = []; let maxDepth = 0;
    function traverse(node, depth, parent) {
        if (!node) return null;
        maxDepth = Math.max(maxDepth, depth);
        const processedNode = {
            data: node, depth: depth, parent: parent, children: [],
            width: (node.keys.length * 44) + 16, height: 56, x: 0, y: depth * CONFIG.LEVEL_HEIGHT
        };
        if (node.children) {
            node.children.forEach(child => {
                const childNode = traverse(child, depth + 1, processedNode);
                if (childNode) processedNode.children.push(childNode);
            });
        }
        nodes.push(processedNode); return processedNode;
    }
    const rootNode = traverse(root, 0, null);
    let currentLeafX = 0; 
    function assignX(node) {
        if (node.children.length === 0) {
            node.x = currentLeafX; currentLeafX += node.width + CONFIG.NODE_SPACING;
        } else {
            node.children.forEach(assignX);
            const firstChild = node.children[0]; const lastChild = node.children[node.children.length - 1];
            const centerPoint = (firstChild.x + lastChild.x + lastChild.width) / 2;
            node.x = centerPoint - (node.width / 2);
        }
    }
    assignX(rootNode);
    return { nodes: nodes, width: currentLeafX, height: (maxDepth + 1) * CONFIG.LEVEL_HEIGHT };
}

function showNotification(msg, type='success') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    const colorClass = type === 'success' ? 'bg-green-600' : (type === 'warning' ? 'bg-yellow-500' : 'bg-red-500');
    toast.className = `${colorClass} text-white px-6 py-3 rounded-lg shadow-xl mb-3 flex items-center transform transition-all duration-300 translate-x-full`;
    toast.innerHTML = `<i class="bi ${type==='success'?'bi-check-circle':'bi-exclamation-circle'} mr-2 text-xl"></i> ${msg}`;
    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.remove('translate-x-full'));
    setTimeout(() => { toast.classList.add('translate-x-full', 'opacity-0'); setTimeout(() => toast.remove(), 300); }, 3000);
}

function switchTab(tab) {
    const listTab = document.getElementById('listTab');
    const treeTab = document.getElementById('treeTab');
    if (tab === 'list') {
        document.getElementById('listContent').classList.remove('hidden'); document.getElementById('treeContent').classList.add('hidden');
        listTab.classList.add('border-indigo-600', 'text-indigo-600'); listTab.classList.remove('text-gray-500');
        treeTab.classList.remove('border-indigo-600', 'text-indigo-600'); treeTab.classList.add('text-gray-500');
    } else {
        document.getElementById('treeContent').classList.remove('hidden'); document.getElementById('listContent').classList.add('hidden');
        treeTab.classList.add('border-indigo-600', 'text-indigo-600'); treeTab.classList.remove('text-gray-500');
        listTab.classList.remove('border-indigo-600', 'text-indigo-600'); listTab.classList.add('text-gray-500');
    }
}