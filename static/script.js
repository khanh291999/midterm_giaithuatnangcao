// --- CẤU HÌNH & CSS ---
const CONFIG = { NODE_SPACING: 40, LEVEL_HEIGHT: 120 };

let panzoomInstance = null;

// Inject CSS styles dynamically
const style = document.createElement('style');
style.innerHTML = `
    /* --- GENERAL UI --- */
    #animMessage code { background: #e0e7ff; color: #4338ca; padding: 2px 5px; border-radius: 4px; font-family: monospace; font-weight: bold; border: 1px solid #c7d2fe; }
    #treeStructure { background-image: radial-gradient(#cbd5e1 1px, transparent 1px); background-size: 20px 20px; overflow: hidden; cursor: grab; }
    #treeStructure:active { cursor: grabbing; }
    .tippy-box[data-theme~='translucent'] { background-color: rgba(30, 41, 59, 0.9); color: white; backdrop-filter: blur(4px); }
    
    /* --- NODE STATES --- */
    .node-search-active { border-color: #3b82f6 !important; } /* Xanh dương */
    .node-insert-active { border-color: #10b981 !important; } /* Xanh lá */
    .node-delete-mode { border-color: #ef4444 !important; }   /* Đỏ */
    
    /* Tràn (Overflow) -> Đỏ nhấp nháy */
    .node-overflow { 
        border-color: #ef4444 !important; 
        background-color: #fef2f2 !important; 
        box-shadow: 0 0 15px rgba(239, 68, 68, 0.5) !important;
        animation: pulse-red 1s infinite;
    }
    
    /* Batch Scan (Disk I/O) -> Nền vàng nhạt */
    .node-batch-active { 
        border-color: #f59e0b !important; 
        background-color: #fffbeb !important; 
        box-shadow: 0 0 15px rgba(245, 158, 11, 0.4); 
    }

    /* --- KEY STATES --- */
    .key-found { background-color: #22c55e !important; transform: scale(1.1); box-shadow: 0 0 10px rgba(34, 197, 94, 0.6); z-index: 10; }
    .key-delete-target { background-color: #ef4444 !important; animation: shake 0.5s; }
    
    /* Trung vị (Median) -> Vàng cam nổi bật */
    .key-median-target {
        background-color: #f59e0b !important; 
        color: white !important;
        transform: scale(1.25) !important;
        box-shadow: 0 0 15px rgba(245, 158, 11, 0.8);
        z-index: 20;
        border: 2px solid white;
    }

    /* Range Match -> Tím */
    .key-range-match { 
        background-color: #8b5cf6 !important; 
        color: white !important; 
        transform: scale(1.1); 
        z-index: 10;
        box-shadow: 0 0 5px rgba(139, 92, 246, 0.5);
    }
    
    /* Kết quả cuối cùng -> Tím sáng + Viền trắng */
    .key-final-result { 
        background-color: #7c3aed !important; 
        color: white !important; 
        transform: scale(1.15) !important; 
        box-shadow: 0 0 0 2px white, 0 0 10px #7c3aed !important; 
        z-index: 10; 
    }

    /* [GHOST KEY] Hiệu ứng bóng ma */
    .key-ghost {
        background-color: #e5e7eb !important; /* Xám nhạt */
        color: #9ca3af !important;            /* Chữ chìm */
        opacity: 0.5;                         /* Rất mờ */
        border: 2px dashed #9ca3af !important; /* Viền nét đứt */
        transform: scale(0.9);
        box-shadow: none !important;
    }

    /* --- ANIMATIONS --- */
    @keyframes shake { 0% { transform: translateX(0); } 25% { transform: translateX(-5px); } 50% { transform: translateX(5px); } 75% { transform: translateX(-5px); } 100% { transform: translateX(0); } }
    @keyframes pulse-red {
        0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
        70% { box-shadow: 0 0 0 10px rgba(239, 68, 68, 0); }
        100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
    }
`;
document.head.appendChild(style);

// --- ANIMATION MANAGER ---
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
        
        // Vẽ cây với đầy đủ tham số
        drawTreeProfessional(step.tree, step.highlights, this.targetKey, step.message, step.found_keys); 
    }

    next() { if (this.currentIndex < this.steps.length - 1) { this.currentIndex++; this.renderStep(); } else { this.stop(); } }
    prev() { if (this.currentIndex > 0) { this.currentIndex--; this.renderStep(); } }
    
    play() {
        if (this.isPlaying) { this.stop(); } else {
            this.isPlaying = true;
            this.updatePlayButton();
            if (this.currentIndex >= this.steps.length - 1) this.currentIndex = -1;
            const runNextStep = () => {
                if (!this.isPlaying) return;
                if (this.currentIndex < this.steps.length - 1) {
                    this.next();
                    let delay = 1000; 
                    const msg = this.steps[this.currentIndex]?.message || "";
                    // Tăng thời gian chờ cho các bước quan trọng
                    if (["Gộp", "Tách", "Thay thế", "Mượn", "Hạ gốc", "Batch Scan", "Disk I/O", "HOÀN TẤT", "Tràn", "Trung vị", "TÌM THẤY"].some(kw => msg.includes(kw))) delay = 2500; 
                    this.timer = setTimeout(runNextStep, delay);
                } else { this.stop(); }
            };
            runNextStep();
        }
    }
    stop() { this.isPlaying = false; if(this.timer) clearTimeout(this.timer); this.updatePlayButton(); }
    updatePlayButton() {
        if(this.isPlaying) { this.btnPlay.innerHTML = '<i class="bi bi-pause-fill"></i>'; this.btnPlay.classList.remove('bg-indigo-600'); this.btnPlay.classList.add('bg-yellow-500'); } 
        else { this.btnPlay.innerHTML = '<i class="bi bi-play-fill"></i>'; this.btnPlay.classList.remove('bg-yellow-500'); this.btnPlay.classList.add('bg-indigo-600'); }
    }
}
const animManager = new AnimationManager();

// --- KHỞI TẠO & EVENTS ---
document.addEventListener('DOMContentLoaded', () => { loadAllData(); setupEventListeners(); });

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
        if (!ma) return showNotification('Nhập mã', 'warning'); 
        await searchBook(ma); 
    });

    const deleteForm = document.getElementById('deleteBookForm');
    if (deleteForm) deleteForm.addEventListener('submit', async (e) => { 
        e.preventDefault(); 
        const ma = document.getElementById('deleteMaSach').value.trim(); 
        if (!ma) return showNotification('Nhập mã', 'warning'); 
        if(confirm(`Xóa ${ma}?`)) { await deleteBookById(ma); deleteForm.reset(); } 
    });

    const rangeForm = document.getElementById('rangeSearchForm');
    if (rangeForm) rangeForm.addEventListener('submit', async (e) => { 
        e.preventDefault(); 
        const min = document.getElementById('searchRangeStart').value.trim(); 
        const max = document.getElementById('searchRangeEnd').value.trim(); 
        if (!min || !max) return showNotification('Nhập đủ khoảng min - max', 'warning'); 
        await executeRangeSearch(min, max); 
    });
}

// --- API FUNCTIONS ---
async function loadAllData(affectedNodesList = null, newlyAddedBookId = null, searchPath = null, skipTreeDraw = false, highlightKey = null) {
    try {
        const [booksRes, treeRes] = await Promise.all([ fetch(`/api/books?t=${Date.now()}`), fetch(`/api/tree?t=${Date.now()}`) ]);
        const books = await booksRes.json(); const treeRoot = await treeRes.json();
        renderBookTable(books);
        document.getElementById('bookCount').innerText = books.length;
        if (treeRoot.m) document.getElementById('degreeInput').value = treeRoot.m;
        if (!skipTreeDraw) drawTreeProfessional(treeRoot, affectedNodesList, newlyAddedBookId, null);
    } catch (e) { console.error(e); }
}

async function addBook(bookData, newBookId) {
    try {
        const res = await fetch('/api/books', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(bookData) });
        const data = await res.json();
        if (data.success) { showNotification(data.message, 'success'); switchTab('tree');
            if (data.steps && data.steps.length > 0) { animManager.start(data.steps, null, false); await loadAllData(null, null, null, true); } 
            else { await loadAllData(data.affected_nodes, newBookId); }
        } else showNotification(data.message, 'error');
    } catch (e) { showNotification('Lỗi server', 'error'); }
}

async function addRandomBook(btn) {
    const original = btn.innerHTML; btn.innerHTML = '...'; btn.disabled = true;
    try {
        const res = await fetch('/api/books/random', { method: 'POST' }); const data = await res.json();
        if (data.success) { showNotification(data.message, 'success'); switchTab('tree');
            if (data.steps && data.steps.length > 0) { animManager.start(data.steps, null, true); await loadAllData(null, null, null, true); } 
            else { await loadAllData(data.affected_nodes, data.book?.ma_sach); }
        } else showNotification(data.message, 'warning');
    } catch (e) { showNotification('Lỗi', 'error'); } finally { btn.innerHTML = original; btn.disabled = false; }
}

async function generateBulkBooks(btn) {
    const original = btn.innerHTML; btn.innerHTML = '...'; btn.disabled = true;
    try {
        const res = await fetch('/api/books/generate_bulk', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ count: 10 }) });
        const data = await res.json();
        if (data.success) { showNotification(data.message, 'success'); await loadAllData(null, null, null, false); switchTab('tree'); } else showNotification(data.message, 'error');
    } catch (e) { showNotification('Lỗi', 'error'); } finally { btn.innerHTML = original; btn.disabled = false; }
}

async function searchBook(ma) {
    try {
        const res = await fetch(`/api/books/search/${ma}`); const data = await res.json();
        switchTab('tree'); const resultDiv = document.getElementById('searchResult');
        if (data.success) {
            resultDiv.innerHTML = `<div class="p-3 bg-green-50 text-green-800 border-green-200 border rounded">Tìm thấy: ${data.book.ten_sach}</div>`;
        } else {
            resultDiv.innerHTML = `<div class="p-3 bg-red-50 text-red-800 border-red-200 border rounded">Không tìm thấy ${ma}</div>`;
            showNotification('Không tìm thấy', 'error');
        }
        if (data.steps && data.steps.length > 0) { animManager.start(data.steps, ma, false); animManager.play(); } 
        else { await loadAllData(null, null, null, false, ma); }
    } catch (e) { showNotification('Lỗi tìm kiếm', 'error'); }
}

async function deleteBookById(ma) {
    try {
        const res = await fetch(`/api/books/${ma}`, { method: 'DELETE' }); const data = await res.json();
        if (data.success) {
            showNotification(data.message, 'success'); switchTab('tree');
            if (data.steps && data.steps.length > 0) { animManager.start(data.steps, ma, false); animManager.play(); await loadAllData(null, null, null, true); } 
            else { document.getElementById('animationControls').classList.add('hidden'); await loadAllData(data.affected_nodes, null); }
        } else showNotification(data.message, 'error');
    } catch (e) { showNotification('Lỗi xóa', 'error'); }
}

async function executeRangeSearch(min, max) {
    try {
        const res = await fetch('/api/books/range', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({min_key: min, max_key: max})});
        const data = await res.json();
        
        if(data.success) {
            switchTab('tree'); 
            const resultDiv = document.getElementById('searchResult');
            if(resultDiv) {
                resultDiv.innerHTML = `<div class="p-3 bg-green-50 text-green-900 border-green-200 border rounded text-sm shadow-sm">${data.message}</div>`;
            }
            if(data.steps && data.steps.length > 0) { 
                animManager.start(data.steps, null, false); 
                animManager.play(); 
            }
        } else { 
            showNotification(data.message, 'error'); 
        }
    } catch(e) { showNotification('Lỗi', 'error'); }
}

async function resetTree() { if(!confirm('Xóa hết?')) return; try { await fetch('/api/reset', { method: 'POST' }); await loadAllData(); showNotification('Đã reset'); } catch(e){} }
async function updateDegree() { const m = document.getElementById('degreeInput').value; try { await fetch('/api/config/degree', { method: 'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({m:m})}); await loadAllData(); showNotification('Đã đổi m='+m); } catch(e){} }

// --- VISUALIZATION CORE (UPDATED & FIXED) ---

function drawTreeProfessional(root, affectedNodesList = null, targetKey = null, stepMessage = "", foundKeys = null) {
    const container = document.getElementById('treeStructure');
    let panzoomWrapper = document.getElementById('panzoomWrapper');
    
    // Init Panzoom
    if (!panzoomWrapper) {
        panzoomWrapper = document.createElement('div');
        panzoomWrapper.id = 'panzoomWrapper';
        panzoomWrapper.className = 'origin-top-left min-w-full min-h-full';
        container.innerHTML = ''; 
        container.appendChild(panzoomWrapper);
        if (typeof Panzoom !== 'undefined') {
            panzoomInstance = Panzoom(panzoomWrapper, { maxScale: 3, minScale: 0.1, startScale: 1, canvas: true });
            container.addEventListener('wheel', panzoomInstance.zoomWithWheel);
        }
    }
    panzoomWrapper.innerHTML = ''; 

    if (!root || ((!root.keys || root.keys.length === 0) && (!root.children || root.children.length === 0))) {
        panzoomWrapper.innerHTML = '<div class="text-gray-400 text-center py-20 flex flex-col items-center"><i class="bi bi-diagram-3 text-4xl mb-2"></i><span>Kho sách rỗng</span></div>'; 
        return;
    }

    // --- CONTEXT ---
    const deleteKeywords = ["Xóa", "Gộp", "Mượn", "Thay thế", "Delete", "Merge", "Borrow", "Replace", "Hạ gốc"];
    const isDeleteMode = stepMessage && deleteKeywords.some(kw => stepMessage.includes(kw));
    const isRangeMode = stepMessage && (stepMessage.includes("Range") || stepMessage.includes("khoảng") || stepMessage.includes("Scan") || stepMessage.includes("Disk I/O") || stepMessage.includes("HOÀN TẤT"));
    const isBatchMode = stepMessage && (stepMessage.includes("Batch Scan") || stepMessage.includes("Disk I/O"));
    const isOverflow = stepMessage && (stepMessage.includes("Tràn") || stepMessage.includes("Overflow"));
    const isMedianStep = stepMessage && (stepMessage.includes("Trung vị") || stepMessage.includes("Median"));
    const isFoundStep = stepMessage && (stepMessage.includes("TÌM THẤY") || stepMessage.includes("Found") || stepMessage.includes("Match"));
    
    // [GHOST] Xác định chế độ bóng ma
    const isGhostStep = stepMessage && (stepMessage.includes("Sao chép") || stepMessage.includes("Copy") || stepMessage.includes("Bóng ma"));

    // [FIX QUAN TRỌNG] Tìm chính xác "nhân vật chính" của bước Bóng ma
    let effectiveTargetKey = targetKey;
    if (isGhostStep) {
        // Regex: Tìm chuỗi dạng BK-xxxx nằm trong thẻ <b>
        const match = stepMessage.match(/<b>(BK-\d+)<\/b>/); 
        if (match) effectiveTargetKey = match[1];
    }

    const treeData = calculateTreeLayout(root);
    
    // [FIX LOGIC DEPTH] Tìm độ sâu của node CAO NHẤT trong danh sách highlight (đó chính là Cha)
    let minHighlightDepth = Infinity;
    if (isGhostStep && affectedNodesList) {
        treeData.nodes.forEach(n => {
            const sig = n.data.keys.map(k => k.ma_sach).join(',');
            // Nếu node này nằm trong danh sách affected
            if (affectedNodesList.some(s => s.join(',') === sig)) {
                if (n.depth < minHighlightDepth) minHighlightDepth = n.depth;
            }
        });
    }
    
    const canvas = document.createElement('div'); 
    canvas.className = 'btree-canvas relative';
    canvas.style.width = `${Math.max(treeData.width + 400, container.clientWidth)}px`; 
    canvas.style.height = `${Math.max(treeData.height + 400, container.clientHeight)}px`;

    const svgLayer = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svgLayer.setAttribute('class', 'btree-svg-layer absolute top-0 left-0 pointer-events-none'); 
    svgLayer.setAttribute('width', '100%'); svgLayer.setAttribute('height', '100%');
    canvas.appendChild(svgLayer);

    let targetNodeData = null;
    const offsetX = (parseInt(canvas.style.width) - treeData.width) / 2;

    treeData.nodes.forEach(node => {
        const nodeEl = document.createElement('div'); 
        nodeEl.className = 'btree-node-group absolute flex gap-1 bg-slate-700 p-1.5 rounded-xl shadow-lg border-2 border-slate-600 transition-all duration-300';
        
        node.realX = node.x + offsetX;
        node.realY = node.y + 50;
        nodeEl.style.left = `${node.realX}px`; 
        nodeEl.style.top = `${node.realY}px`; 

        const keys = node.data.keys || [];
        const currentNodeSignature = keys.map(k => k.ma_sach || k).join(',');

        // 1. HIGHLIGHT NODE
        if (affectedNodesList && Array.isArray(affectedNodesList)) {
            if (affectedNodesList.some(sig => sig.join(',') === currentNodeSignature)) {
                if (isOverflow) nodeEl.classList.add('node-overflow');
                else if (isBatchMode) nodeEl.classList.add('node-batch-active');
                else if (isDeleteMode) nodeEl.classList.add('node-delete-mode');
                else if (stepMessage.includes("Chèn") || stepMessage.includes("Insert")) nodeEl.classList.add('node-insert-active');
                else nodeEl.classList.add('node-search-active');
                
                if (!targetNodeData) targetNodeData = node;
            }
        }
        if (keys.length === 0) { nodeEl.style.width = '20px'; nodeEl.style.height = '20px'; nodeEl.classList.add('bg-slate-500'); }

        // 2. HIGHLIGHT KEYS
        keys.forEach(key => {
            const keyEl = document.createElement('div'); 
            keyEl.className = 'btree-key h-9 px-3 min-w-[40px] rounded-lg bg-blue-500 text-white flex items-center justify-center font-bold text-xs shadow-inner cursor-default hover:bg-blue-400 transition-colors whitespace-nowrap';
            const currentMa = key.ma_sach || key;
            keyEl.innerText = currentMa;
            keyEl.setAttribute('data-tippy-content', `<b>${key.ten_sach}</b><br>${key.tac_gia}`);

            // Priority 1: GHOST KEY (Sửa đổi: Dùng effectiveTargetKey)
            if (isGhostStep && effectiveTargetKey && currentMa === effectiveTargetKey) {
                // Nếu node này có độ sâu > minHighlightDepth => Nó là Node Con (Bản gốc)
                if (node.depth > minHighlightDepth) {
                    keyEl.classList.add('key-ghost'); 
                } else {
                    // Nếu nó là Node Cha (Bản sao)
                    keyEl.classList.add('key-delete-target'); 
                }
            }
            // Priority 2: TARGET CHÍNH (Search/Delete đơn)
            else if (targetKey && currentMa === targetKey) {
                if (isDeleteMode) { keyEl.classList.add('key-delete-target'); targetNodeData = node; }
                else if (isFoundStep) { keyEl.classList.add('key-found'); targetNodeData = node; }
            } 
            // Priority 3: KẾT QUẢ CUỐI CÙNG
            else if (foundKeys && foundKeys.includes(currentMa)) {
                keyEl.classList.add('key-final-result'); 
            }
            // Priority 4: TRUNG VỊ
            else if (isMedianStep && stepMessage.includes(currentMa)) {
                keyEl.classList.add('key-median-target');
            }
            // Priority 5: RANGE MATCH
            else if (isRangeMode && stepMessage.includes(currentMa)) {
                keyEl.classList.add('key-range-match');
            }
            
            nodeEl.appendChild(keyEl);
        });
        canvas.appendChild(nodeEl);

        if (node.parent) { 
            const parentRealX = node.parent.x + offsetX;
            const parentRealY = node.parent.y + 50;
            const startX = parentRealX + (node.parent.width/2); 
            const startY = parentRealY + node.parent.height; 
            const endX = node.realX + (node.width/2); 
            const endY = node.realY;
            const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
            const d = `M ${startX} ${startY} C ${startX} ${(startY+endY)/2}, ${endX} ${(startY+endY)/2}, ${endX} ${endY}`;
            path.setAttribute('d', d); path.setAttribute('fill', 'none'); path.setAttribute('stroke', '#94a3b8'); path.setAttribute('stroke-width', '2');
            svgLayer.appendChild(path);
        }
    });

    panzoomWrapper.appendChild(canvas);
    if (typeof tippy !== 'undefined') tippy('[data-tippy-content]', { allowHTML: true, theme: 'translucent' });

    if (targetNodeData && panzoomInstance) {
        setTimeout(() => {
            focusOnNode(targetNodeData.realX, targetNodeData.realY, targetNodeData.width, targetNodeData.height);
        }, 10);
    }
}

function focusOnNode(x, y, w, h) {
    if (!panzoomInstance) return;
    const container = document.getElementById('treeStructure');
    const containerW = container.clientWidth;
    const containerH = container.clientHeight;
    const scale = panzoomInstance.getScale();
    const targetX = (containerW / 2) - (x * scale) - ((w * scale) / 2);
    const targetY = (containerH / 2) - (y * scale) - ((h * scale) / 2);
    panzoomInstance.pan(targetX, targetY, { animate: true, duration: 600 });
}

function renderBookTable(books) {
    const tbody = document.getElementById('bookTableBody');
    if (!books || books.length === 0) { tbody.innerHTML = `<tr><td colspan="5" class="text-center py-8 text-gray-400">Trống</td></tr>`; return; }
    tbody.innerHTML = books.map(b => `<tr class="hover:bg-gray-100 border-b"><td class="px-4 py-3 font-bold text-indigo-600">${b.ma_sach}</td><td class="px-4 py-3">${b.ten_sach}</td><td class="px-4 py-3">${b.tac_gia}</td><td class="px-4 py-3 text-center"><button onclick="if(confirm('Xóa?')) deleteBookById('${b.ma_sach}')" class="text-red-500 hover:text-red-700"><i class="bi bi-trash"></i></button></td></tr>`).join('');
}

function calculateTreeLayout(root) {
    let nodes = []; let maxDepth = 0; const KEY_WIDTH = 66; 
    function traverse(node, depth, parent) {
        if (!node) return null; maxDepth = Math.max(maxDepth, depth);
        const computedWidth = (node.keys.length * KEY_WIDTH) + 16;
        const processedNode = { data: node, depth: depth, parent: parent, children: [], width: computedWidth, height: 50, x: 0, y: depth * CONFIG.LEVEL_HEIGHT };
        if (node.children) { node.children.forEach(child => { const c = traverse(child, depth + 1, processedNode); if (c) processedNode.children.push(c); }); }
        nodes.push(processedNode); return processedNode;
    }
    const rootNode = traverse(root, 0, null); let currentLeafX = 0; 
    function assignX(node) {
        if (node.children.length === 0) { node.x = currentLeafX; currentLeafX += node.width + CONFIG.NODE_SPACING; } 
        else { node.children.forEach(assignX); const f = node.children[0]; const l = node.children[node.children.length - 1]; node.x = ((f.x + l.x + l.width) / 2) - (node.width / 2); }
    }
    assignX(rootNode);
    return { nodes: nodes, width: currentLeafX, height: (maxDepth + 1) * CONFIG.LEVEL_HEIGHT };
}
function showNotification(msg, type='success') {
    const box = document.getElementById('toastContainer'); const div = document.createElement('div');
    const color = type==='success'?'bg-green-600':type==='warning'?'bg-yellow-500':'bg-red-500';
    div.className = `${color} text-white px-6 py-3 rounded-lg shadow-xl mb-3 flex items-center transform transition translate-x-full`;
    div.innerHTML = `<i class="bi bi-info-circle mr-2"></i> ${msg}`; box.appendChild(div);
    requestAnimationFrame(() => div.classList.remove('translate-x-full')); setTimeout(() => div.remove(), 3000);
}
function switchTab(tab) {
    const l = document.getElementById('listTab'); const t = document.getElementById('treeTab');
    const lc = document.getElementById('listContent'); const tc = document.getElementById('treeContent');
    if(tab==='list'){ lc.classList.remove('hidden'); tc.classList.add('hidden'); l.classList.add('text-indigo-600','border-indigo-600'); l.classList.remove('text-gray-500'); t.classList.remove('text-indigo-600','border-indigo-600'); t.classList.add('text-gray-500'); }
    else{ tc.classList.remove('hidden'); lc.classList.add('hidden'); t.classList.add('text-indigo-600','border-indigo-600'); t.classList.remove('text-gray-500'); l.classList.remove('text-indigo-600','border-indigo-600'); l.classList.add('text-gray-500'); }
}