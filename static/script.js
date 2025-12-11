// --- CẤU HÌNH & CSS ---
const CONFIG = { NODE_SPACING: 30, LEVEL_HEIGHT: 120 };

let panzoomState = { x: 0, y: 0, scale: 1 };
let panzoomInstance = null;

const style = document.createElement('style');
style.innerHTML = `
    /* --- ANIMATIONS CƠ BẢN --- */
    @keyframes pulse-generic { 0% { transform: scale(1); } 50% { transform: scale(1.05); } 100% { transform: scale(1); } }

    /* 1. SEARCH/INSERT STYLE (BLUE/GREEN/YELLOW) */
    .node-search-active {
        border-color: #3b82f6 !important; /* Blue-500 */
        background-color: #eff6ff !important; /* Blue-50 */
        box-shadow: 0 0 10px rgba(59, 130, 246, 0.3);
    }
    .node-insert-active {
        border-color: #f59e0b !important; /* Amber-500 */
        background-color: #fffbeb !important; /* Amber-50 */
    }
    .key-found {
        background-color: #22c55e !important; /* Green-500 */
        color: white !important;
        transform: scale(1.2);
        box-shadow: 0 0 0 4px rgba(34, 197, 94, 0.3);
        z-index: 50;
    }
    
    /* 2. DELETE STYLE (RED - DANGER) - HIGHLIGHT KHI XÓA */
    @keyframes red-flash {
        0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
        70% { box-shadow: 0 0 0 10px rgba(239, 68, 68, 0); }
        100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
    }

    .node-delete-mode {
        border-color: #ef4444 !important; /* Red-500 */
        background-color: #fef2f2 !important; /* Red-50 */
        border-width: 3px !important;
        animation: pulse-generic 1s infinite;
    }

    .key-delete-target {
        background-color: #dc2626 !important; /* Red-600 */
        color: white !important;
        transform: scale(1.1);
        animation: red-flash 1.5s infinite;
        border: 2px solid #fee2e2 !important;
        z-index: 50;
    }

    /* 3. RANGE SEARCH STYLE (PURPLE) */
    .key-range-match {
        background-color: #9333ea !important; /* Purple-600 */
        color: white !important;
        box-shadow: 0 0 0 3px rgba(147, 51, 234, 0.3);
    }

    /* --- COMMON UI --- */
    #animMessage code {
        background: #e0e7ff; color: #4338ca; padding: 2px 5px;
        border-radius: 4px; font-family: monospace; font-weight: bold;
        font-size: 0.9em; border: 1px solid #c7d2fe;
    }
    #animMessage b { color: #1e40af; }

    #treeStructure {
        background-image: radial-gradient(#e5e7eb 1px, transparent 1px);
        background-size: 20px 20px;
    }
    .tippy-box[data-theme~='translucent'] {
        background-color: rgba(30, 41, 59, 0.9);
        color: white;
        backdrop-filter: blur(4px);
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

    start(steps, targetKey = null, startAtEnd = false) {
        if (!steps || steps.length === 0) return;
        this.steps = steps;
        this.targetKey = targetKey;
        this.currentIndex = startAtEnd ? this.steps.length - 1 : 0;
        
        this.isPlaying = false;
        if(this.timer) clearTimeout(this.timer);
        
        this.controlsDiv.classList.remove('hidden');
        this.updatePlayButton();
        this.renderStep();
    }

    renderStep() {
        if (this.currentIndex < 0 || this.currentIndex >= this.steps.length) return;
        const step = this.steps[this.currentIndex];
        
        this.msgEl.innerHTML = step.message; 
        this.counterEl.innerText = `${this.currentIndex + 1} / ${this.steps.length}`;
        const pct = ((this.currentIndex + 1) / this.steps.length) * 100;
        this.progressEl.style.width = `${pct}%`;

        drawTreeProfessional(step.tree, step.highlights, this.targetKey, step.message); 
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

            const runNextStep = () => {
                if (!this.isPlaying) return;

                if (this.currentIndex < this.steps.length - 1) {
                    this.next();
                    let delay = 1200; 
                    const msg = this.steps[this.currentIndex]?.message || "";
                    
                    const slowKeywords = ["Gộp", "Tách", "Thay thế", "Mượn", "Giảm chiều cao"];
                    if (slowKeywords.some(kw => msg.includes(kw))) {
                        delay = 2500; 
                    }
                    this.timer = setTimeout(runNextStep, delay);
                } else {
                    this.stop();
                }
            };
            runNextStep();
        }
    }

    stop() {
        this.isPlaying = false;
        if(this.timer) clearTimeout(this.timer);
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

// --- KHỞI TẠO & EVENTS ---
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
    
    const rangeForm = document.getElementById('rangeSearchForm');
    if (rangeForm) rangeForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const min = document.getElementById('rangeStart').value.trim();
        const max = document.getElementById('rangeEnd').value.trim();
        if (!min || !max) return showNotification('Nhập đủ khoảng', 'warning');
        await executeRangeSearch(min, max);
    });
}

// --- CORE FUNCTIONS (API CALLS) ---

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
        if (treeRoot.m) document.getElementById('degreeInput').value = treeRoot.m;

        if (!skipTreeDraw) {
            drawTreeProfessional(treeRoot, affectedNodesList, newlyAddedBookId, searchPath, highlightKey);
        }
    } catch (error) { console.error('Error loading data:', error); }
}

async function addBook(bookData, newBookId) {
    try {
        const res = await fetch('/api/books', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(bookData)
        });
        const data = await res.json();
        if (data.success) {
            showNotification(data.message, 'success');
            switchTab('tree');
            if (data.steps && data.steps.length > 0) {
                animManager.start(data.steps, null, false);
                await loadAllData(null, null, null, true);
            } else {
                await loadAllData(data.affected_nodes, newBookId);
            }
        } else { showNotification(data.message, 'error'); }
    } catch (e) { showNotification('Lỗi server', 'error'); }
}

// --- ĐÂY LÀ 2 HÀM BẠN ĐANG BỊ THIẾU ---
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
                animManager.start(data.steps, null, true);
                await loadAllData(null, null, null, true);
            } else {
                const newBookId = data.book ? data.book.ma_sach : null;
                await loadAllData(data.affected_nodes, newBookId);
            }
        } else { showNotification(data.message, 'warning'); }
    } catch (e) { showNotification('Lỗi kết nối', 'error'); } 
    finally { btn.innerHTML = originalContent; btn.disabled = false; }
}

async function generateBulkBooks(btn) {
    const originalContent = btn.innerHTML;
    try {
        btn.innerHTML = `<span class="animate-spin inline-block">⟳</span> Đang nhập...`; btn.disabled = true;
        const res = await fetch('/api/books/generate_bulk', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ count: 10 }) 
        });
        const data = await res.json();
        if (data.success) {
            showNotification(data.message, 'success');
            await loadAllData(null, null, null, false); 
            switchTab('tree');
        } else { showNotification(data.message, 'error'); }
    } catch (e) { showNotification('Lỗi server', 'error'); } 
    finally { btn.innerHTML = originalContent; btn.disabled = false; }
}
// ----------------------------------------

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
            resultDiv.innerHTML = `
                <div class="relative bg-white p-4 rounded-lg shadow-md border-l-4 border-green-500 overflow-hidden group">
                    <div class="absolute top-0 right-0 p-2 opacity-10">
                        <i class="bi bi-book text-6xl text-green-600"></i>
                    </div>
                    <div class="relative z-10">
                        <div class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Kết quả tìm kiếm</div>
                        <h3 class="text-xl font-bold text-gray-800">${b.ten_sach}</h3>
                        <div class="flex items-center gap-2 mt-2 text-sm text-gray-600">
                            <span class="bg-gray-100 px-2 py-1 rounded font-mono text-indigo-600 font-bold"><i class="bi bi-barcode"></i> ${b.ma_sach}</span>
                            <span><i class="bi bi-person-circle"></i> ${b.tac_gia}</span>
                        </div>
                    </div>
                </div>`;
            showNotification('Đã tìm thấy sách!', 'success');
        } else {
            resultDiv.innerHTML = `<div class="p-3 bg-red-100 text-red-800 rounded border border-red-200 shadow-sm"><div class="font-bold"><i class="bi bi-x-circle-fill"></i> Không tìm thấy</div><div>ID: ${ma}</div></div>`;
            showNotification('Không tìm thấy', 'error');
        }
        if (data.steps && data.steps.length > 0) {
            animManager.start(data.steps, foundKeyId, false);
            animManager.play(); 
        } else { await loadAllData(null, null, null, false, foundKeyId); }
    } catch (e) { showNotification('Lỗi tìm kiếm', 'error'); }
}

async function executeRangeSearch(min, max) {
    try {
        showNotification('Đang quét Range...', 'info');
        const res = await fetch('/api/books/range', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ min_key: min, max_key: max })
        });
        const data = await res.json();
        
        if (data.success) {
            switchTab('tree');
            showNotification(data.message, 'success');
            if (data.steps && data.steps.length > 0) {
                animManager.start(data.steps, null, false);
                animManager.play();
            }
            const resultDiv = document.getElementById('searchResult');
            if(resultDiv) {
                resultDiv.innerHTML = `
                    <div class="bg-purple-50 p-4 rounded border border-purple-200">
                        <div class="font-bold text-purple-800 mb-2">Kết quả Range [${min} - ${max}]</div>
                        <div class="max-h-40 overflow-y-auto text-sm space-y-1">
                            ${data.books.map(b => `<div class="flex justify-between border-b border-purple-100 pb-1"><span>${b.ma_sach}</span> <span class="text-gray-500 truncate w-32">${b.ten_sach}</span></div>`).join('')}
                        </div>
                    </div>
                `;
            }
        } else {
            showNotification(data.message, 'error');
        }
    } catch (e) {
        console.error(e);
        showNotification('Lỗi Range Search', 'error');
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
                animManager.start(data.steps, ma, false);
                animManager.play();
                await loadAllData(null, null, null, true);
            } else {
                document.getElementById('animationControls').classList.add('hidden');
                await loadAllData(data.affected_nodes, null);
            }
        } else { showNotification(data.message, 'error'); }
    } catch (e) { showNotification('Lỗi xóa', 'error'); }
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
    const mVal = document.getElementById('degreeInput').value;
    if(mVal < 3) return showNotification('Bậc m phải >= 3', 'error');
    if(!confirm('Tái cấu trúc với m=' + mVal + '?')) return;
    try {
        const res = await fetch('/api/config/degree', {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ m: mVal })
        });
        const data = await res.json();
        if(data.success) { showNotification(data.message, 'success'); await loadAllData(); }
    } catch(e) { showNotification('Lỗi server', 'error'); }
}

// --- VISUALIZATION ENGINE ---

function drawTreeProfessional(root, affectedNodesList = null, targetKey = null, stepMessage = "") {
    const container = document.getElementById('treeStructure'); 
    container.innerHTML = ''; 
    
    if (!root || ((!root.keys || root.keys.length === 0) && (!root.children || root.children.length === 0))) {
        container.innerHTML = '<div class="text-gray-400 text-center py-20 flex flex-col items-center"><i class="bi bi-diagram-3 text-4xl mb-2"></i><span>Kho sách rỗng</span></div>'; 
        return;
    }

    const deleteKeywords = ["Xóa", "Gộp", "Mượn", "Thay thế", "Delete", "Merge", "Borrow", "Replace", "Hạ gốc"];
    const isDeleteMode = stepMessage && deleteKeywords.some(kw => stepMessage.includes(kw));

    const isRangeMode = stepMessage && (stepMessage.includes("Range") || stepMessage.includes("khoảng"));

    const treeData = calculateTreeLayout(root);
    
    const panzoomWrapper = document.createElement('div');
    panzoomWrapper.id = 'panzoomWrapper';
    panzoomWrapper.className = 'origin-top-left min-w-full min-h-full';
    
    const canvas = document.createElement('div'); 
    canvas.className = 'btree-canvas relative';
    
    const minWidth = container.clientWidth * 2;
    const minHeight = container.clientHeight * 2;
    canvas.style.width = `${Math.max(treeData.width + 400, minWidth)}px`; 
    canvas.style.height = `${Math.max(treeData.height + 400, minHeight)}px`;
    
    const svgLayer = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svgLayer.setAttribute('class', 'btree-svg-layer absolute top-0 left-0 pointer-events-none'); 
    svgLayer.setAttribute('width', '100%'); svgLayer.setAttribute('height', '100%');
    canvas.appendChild(svgLayer);

    let targetElement = null;

    treeData.nodes.forEach(node => {
        const nodeEl = document.createElement('div'); 
        nodeEl.className = 'btree-node-group absolute flex gap-1 bg-slate-700 p-1.5 rounded-xl shadow-lg border-2 border-slate-600 transition-all duration-300';
        nodeEl.style.left = `${node.x + 50}px`; nodeEl.style.top = `${node.y + 20}px`;
        
        const keys = node.data.keys || [];
        const currentNodeSignature = keys.map(k => k.ma_sach || k).join(',');

        if (affectedNodesList && Array.isArray(affectedNodesList)) {
            const isAffected = affectedNodesList.some(sig => sig.join(',') === currentNodeSignature);
            if (isAffected) {
                if (isDeleteMode) {
                    nodeEl.classList.add('node-delete-mode'); 
                } else if (stepMessage.includes("Chèn") || stepMessage.includes("Insert")) {
                    nodeEl.classList.add('node-insert-active');
                } else {
                    nodeEl.classList.add('node-search-active'); 
                }
                if (!targetElement) targetElement = nodeEl;
            }
        }

        if (keys.length === 0) {
            nodeEl.style.width = '20px'; nodeEl.style.height = '20px'; nodeEl.classList.add('bg-slate-500'); 
        }

        keys.forEach(key => {
            const keyEl = document.createElement('div'); 
            keyEl.className = 'btree-key h-9 px-3 min-w-[40px] rounded-lg bg-blue-500 text-white flex items-center justify-center font-bold text-xs shadow-inner cursor-default hover:bg-blue-400 transition-colors whitespace-nowrap';
            
            const currentMaSach = key.ma_sach || key;
            keyEl.innerText = currentMaSach; 
            keyEl.setAttribute('data-tippy-content', `<div class='text-xs'>${key.ten_sach || 'N/A'}</div>`);

            if (targetKey && currentMaSach === targetKey) {
                if (isDeleteMode) {
                    keyEl.classList.add('key-delete-target'); 
                } else {
                    keyEl.classList.add('key-found');
                }
                targetElement = nodeEl;
            } else if (isRangeMode && stepMessage.includes("candidates") && stepMessage.includes(currentMaSach)) {
                keyEl.classList.add('key-range-match');
            }

            nodeEl.appendChild(keyEl);
        });
        canvas.appendChild(nodeEl);

        if (node.parent) { 
            const startX = node.parent.x + (node.parent.width/2) + 50; 
            const startY = node.parent.y + node.parent.height + 15; 
            const endX = node.x + (node.width/2) + 50; 
            const endY = node.y + 20;
            
            const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
            const controlY = (startY + endY) / 2;
            const d = `M ${startX} ${startY} C ${startX} ${controlY}, ${endX} ${controlY}, ${endX} ${endY}`;
            path.setAttribute('d', d); path.setAttribute('fill', 'none'); path.setAttribute('stroke', '#94a3b8'); path.setAttribute('stroke-width', '2');
            svgLayer.appendChild(path);
        }
    });

    panzoomWrapper.appendChild(canvas);
    container.appendChild(panzoomWrapper);

    if (typeof tippy !== 'undefined') tippy('[data-tippy-content]', { allowHTML: true, animation: 'scale', theme: 'translucent' });

    if (typeof Panzoom !== 'undefined') {
        const elem = document.getElementById('panzoomWrapper');
        panzoomInstance = Panzoom(elem, { maxScale: 3, minScale: 0.1, startScale: 1, canvas: true });
        
        if (panzoomState.scale !== 1 || panzoomState.x !== 0 || panzoomState.y !== 0) {
            panzoomInstance.zoom(panzoomState.scale, { animate: false });
            panzoomInstance.pan(panzoomState.x, panzoomState.y, { animate: false });
        }
        elem.addEventListener('panzoomchange', (e) => { panzoomState = { x: e.detail.x, y: e.detail.y, scale: e.detail.scale }; });
        elem.parentElement.addEventListener('wheel', panzoomInstance.zoomWithWheel);
    }
}

function renderBookTable(books) {
    const tbody = document.getElementById('bookTableBody');
    if (!books || books.length === 0) { tbody.innerHTML = `<tr><td colspan="5" class="text-center py-8 text-gray-400">Chưa có dữ liệu</td></tr>`; return; }
    tbody.innerHTML = books.map((book, idx) => `
        <tr class="hover:bg-gray-100 transition border-b">
            <td class="px-4 py-3 font-bold text-indigo-600">${book.ma_sach}</td>
            <td class="px-4 py-3 text-gray-800">${book.ten_sach}</td>
            <td class="px-4 py-3 text-gray-600">${book.tac_gia}</td>
            <td class="px-4 py-3 text-center"><button onclick="if(confirm('Xóa sách ${book.ma_sach}?')) deleteBookById('${book.ma_sach}')" class="text-red-500 hover:text-red-700 p-2"><i class="bi bi-trash"></i></button></td>
        </tr>`).join('');
}

function calculateTreeLayout(root) {
    let nodes = []; let maxDepth = 0;
    
    // BASE WIDTH
    const KEY_WIDTH = 66; 

    function traverse(node, depth, parent) {
        if (!node) return null;
        maxDepth = Math.max(maxDepth, depth);
        
        const computedWidth = (node.keys.length * KEY_WIDTH) + 16;
        
        const processedNode = {
            data: node, depth: depth, parent: parent, children: [],
            width: computedWidth, 
            height: 50, 
            x: 0, 
            y: depth * CONFIG.LEVEL_HEIGHT
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
    const colorClass = type === 'success' ? 'bg-green-600' : (type === 'warning' ? 'bg-yellow-500' : (type === 'info' ? 'bg-indigo-500' : 'bg-red-500'));
    toast.className = `${colorClass} text-white px-6 py-3 rounded-lg shadow-xl mb-3 flex items-center transform transition-all duration-300 translate-x-full`;
    toast.innerHTML = `<i class="bi ${type==='success'?'bi-check-circle':(type==='info'?'bi-info-circle':'bi-exclamation-circle')} mr-2 text-xl"></i> ${msg}`;
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