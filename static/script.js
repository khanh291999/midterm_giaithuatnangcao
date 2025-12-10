// --- CẤU HÌNH & CSS ---
const CONFIG = { NODE_WIDTH: 60, NODE_SPACING: 30, LEVEL_HEIGHT: 120 };

const style = document.createElement('style');
style.innerHTML = `
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

    @keyframes node-affected-pulse {
        0% { border-color: #f59e0b; } 50% { border-color: #fbbf24; } 100% { border-color: #f59e0b; }
    }
    .active-node {
        animation: node-affected-pulse 1.5s infinite;
        border: 2px solid #f59e0b !important;
        background-color: #fffbeb !important;
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
        
        // DOM Elements
        this.controlsDiv = document.getElementById('animationControls');
        this.msgEl = document.getElementById('animMessage');
        this.progressEl = document.getElementById('animProgress');
        this.counterEl = document.getElementById('animCounter');
        this.btnPlay = document.getElementById('btnPlayPause');
    }

    start(steps) {
        if (!steps || steps.length === 0) return;
        
        this.steps = steps;
        this.currentIndex = 0;
        this.isPlaying = false;
        if(this.timer) clearInterval(this.timer);
        
        // Reset UI
        this.controlsDiv.classList.remove('hidden');
        this.updatePlayButton();
        
        // Render bước đầu tiên
        this.renderStep();
    }

    renderStep() {
        if (this.currentIndex < 0 || this.currentIndex >= this.steps.length) return;

        const step = this.steps[this.currentIndex];
        
        // Update Text Info
        this.msgEl.innerHTML = `<span class="text-blue-600">Bước ${this.currentIndex + 1}:</span> ${step.message}`;
        this.counterEl.innerText = `${this.currentIndex + 1} / ${this.steps.length}`;
        const pct = ((this.currentIndex + 1) / this.steps.length) * 100;
        this.progressEl.style.width = `${pct}%`;

        // Vẽ lại cây từ dữ liệu trong step (snapshot)
        drawTreeProfessional(step.tree, step.highlights); 
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
            // Nếu đã ở cuối thì quay lại đầu
            if (this.currentIndex >= this.steps.length - 1) this.currentIndex = -1;
            
            this.timer = setInterval(() => {
                if (this.currentIndex < this.steps.length - 1) {
                    this.next();
                } else {
                    this.stop();
                }
            }, 1200); // 1.2 giây mỗi bước
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
    // Add Book Form
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

    // Search Form
    const searchForm = document.getElementById('searchBookForm');
    if (searchForm) searchForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const ma = document.getElementById('searchMaSach').value.trim();
        if (!ma) return showNotification('Nhập mã sách', 'warning');
        await searchBook(ma);
    });

    // Delete Form
    const deleteForm = document.getElementById('deleteBookForm');
    if (deleteForm) deleteForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const ma = document.getElementById('deleteMaSach').value.trim();
        if (!ma) return showNotification('Nhập mã sách', 'warning');
        if(confirm(`Xóa sách ${ma}?`)) { await deleteBookById(ma); deleteForm.reset(); }
    });
}

// --- CORE FUNCTIONS ---

async function loadAllData(affectedNodesList = null, newlyAddedBookId = null, searchPath = null) {
    try {
        const [booksRes, treeRes] = await Promise.all([
            fetch(`/api/books?t=${Date.now()}`),
            fetch(`/api/tree?t=${Date.now()}`)
        ]);
        const books = await booksRes.json();
        const treeRoot = await treeRes.json();
        
        renderBookTable(books);
        document.getElementById('bookCount').innerText = books.length;
        
        // Vẽ cây trạng thái tĩnh (kết quả cuối cùng)
        drawTreeProfessional(treeRoot, affectedNodesList, newlyAddedBookId, searchPath);
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
            
            // Kích hoạt Animation Insert
            if (data.steps && data.steps.length > 0) {
                animManager.start(data.steps);
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
        
        // Cập nhật UI Sidebar
        if (data.success) {
            const b = data.book;
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

        // Logic Animation Tìm Kiếm
        if (data.steps && data.steps.length > 0) {
            document.getElementById('animationControls').classList.remove('hidden');
            animManager.start(data.steps);
            animManager.play(); 
        } else {
            await loadAllData();
        }

    } catch (e) { 
        console.error(e);
        showNotification('Lỗi tìm kiếm', 'error'); 
    }
}

// --- UPDATED DELETE FUNCTION WITH ANIMATION ---
async function deleteBookById(ma) {
    try {
        const res = await fetch(`/api/books/${ma}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) {
            showNotification(data.message, 'success');
            switchTab('tree');
            
            // XỬ LÝ ANIMATION KHI XÓA
            if (data.steps && data.steps.length > 0) {
                // Hiện controls và chạy animation
                document.getElementById('animationControls').classList.remove('hidden');
                animManager.start(data.steps);
                animManager.play();
            } else {
                // Fallback cũ nếu không có steps
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
    const tVal = document.getElementById('degreeInput').value;
    if(tVal < 2) return showNotification('t >= 2', 'error');
    if(!confirm('Tái cấu trúc cây?')) return;
    try {
        const res = await fetch('/api/config/degree', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ t: tVal })
        });
        const data = await res.json();
        if(data.success) { showNotification(data.message, 'success'); await loadAllData(); }
    } catch(e) { showNotification('Lỗi server', 'error'); }
}

// --- VISUALIZATION ENGINE ---

function drawTreeProfessional(root, affectedNodesList = null, newlyAddedBookId = null, searchPath = null) {
    const container = document.getElementById('treeStructure'); 
    container.innerHTML = '';
    
    // --- SỬA LỖI TẠI ĐÂY ---
    if (!root || ((!root.keys || root.keys.length === 0) && (!root.children || root.children.length === 0))) {
        container.innerHTML = '<div class="text-gray-400 text-center py-20 flex flex-col items-center"><i class="bi bi-tree text-4xl mb-2"></i><span>Cây rỗng</span></div>'; 
        return;
    }
    // ------------------------

    const treeData = calculateTreeLayout(root);
    const canvas = document.createElement('div'); canvas.className = 'btree-canvas relative';
    // Tăng chiều cao canvas thêm chút để tránh bị cắt
    canvas.style.width = `${treeData.width + 100}px`; canvas.style.height = `${treeData.height + 100}px`;
    
    const svgLayer = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svgLayer.setAttribute('class', 'btree-svg-layer absolute top-0 left-0 pointer-events-none'); 
    svgLayer.setAttribute('width', '100%'); svgLayer.setAttribute('height', '100%');
    canvas.appendChild(svgLayer);

    let targetElement = null;

    treeData.nodes.forEach(node => {
        const nodeEl = document.createElement('div'); 
        nodeEl.className = 'btree-node-group absolute flex gap-1 bg-slate-700 p-2 rounded-lg shadow-lg border-2 border-slate-600 transition-all duration-300';
        nodeEl.style.left = `${node.x + 50}px`; nodeEl.style.top = `${node.y + 20}px`;
        
        // Fix lỗi nếu keys rỗng (trường hợp root mới tạo)
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

        // Nếu node không có key (root mới), vẽ một placeholder nhỏ để dây nối vẫn hiển thị đẹp
        if (keys.length === 0) {
            nodeEl.style.width = '20px';
            nodeEl.style.height = '20px';
            nodeEl.classList.add('bg-slate-500'); // Màu nhạt hơn chút
        }

        keys.forEach(key => {
            const keyEl = document.createElement('div'); 
            keyEl.className = 'btree-key w-10 h-10 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold text-xs shadow-inner cursor-default';
            const currentMaSach = key.ma_sach || key;
            keyEl.innerText = currentMaSach; 
            keyEl.title = (key.ten_sach || '') + ' - ' + (key.tac_gia || '');

            if (newlyAddedBookId && currentMaSach === newlyAddedBookId) {
                keyEl.classList.add('newly-added-key');
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

    const wrapper = document.createElement('div'); 
    wrapper.style.display = 'flex'; wrapper.style.justifyContent = 'center';
    wrapper.appendChild(canvas); container.appendChild(wrapper);

    if (targetElement) {
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