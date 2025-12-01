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
    
    /* Style mới cho Node nằm trong đường tìm kiếm */
    @keyframes search-path-pulse {
        0% { border-color: #3b82f6; box-shadow: 0 0 5px rgba(59, 130, 246, 0.5); }
        50% { border-color: #60a5fa; box-shadow: 0 0 15px rgba(59, 130, 246, 0.8); transform: scale(1.02); }
        100% { border-color: #3b82f6; box-shadow: 0 0 5px rgba(59, 130, 246, 0.5); }
    }
    .search-path-node {
        animation: search-path-pulse 1.5s infinite;
        border: 2px solid #3b82f6 !important; /* Xanh dương */
        background-color: rgba(59, 130, 246, 0.05);
    }

    @keyframes node-affected-pulse {
        0% { border-color: #f59e0b; } 50% { border-color: #fbbf24; } 100% { border-color: #f59e0b; }
    }
    .active-node {
        animation: node-affected-pulse 1.5s infinite;
        border: 2px solid #f59e0b !important;
    }
`;
document.head.appendChild(style);

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

// Thêm tham số searchPath
async function loadAllData(affectedNodesList = null, newlyAddedBookId = null, searchPath = null) {
    const timestamp = new Date().getTime();
    try {
        const [booksRes, treeRes] = await Promise.all([
            fetch(`/api/books?t=${timestamp}`),
            fetch(`/api/tree?t=${timestamp}`)
        ]);
        const books = await booksRes.json();
        const treeRoot = await treeRes.json();
        renderBookTable(books);
        document.getElementById('bookCount').innerText = books.length;
        
        // Truyền searchPath xuống
        drawTreeProfessional(treeRoot, affectedNodesList, newlyAddedBookId, searchPath);
    } catch (error) { console.error('Lỗi tải dữ liệu:', error); }
}

// --- API ACTIONS ---

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
            await loadAllData(data.affected_nodes, newBookId);
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
            const newBookId = data.book ? data.book.ma_sach : null;
            await loadAllData(data.affected_nodes, newBookId);
        } else { showNotification(data.message, 'warning'); }
    } catch (e) { showNotification('Lỗi kết nối', 'error'); } 
    finally { btn.innerHTML = originalContent; btn.disabled = false; }
}

async function searchBook(ma) {
    try {
        const res = await fetch(`/api/books/search/${ma}`);
        const data = await res.json();
        const resultDiv = document.getElementById('searchResult');
        
        // Luôn chuyển sang tab Tree để xem đường đi
        switchTab('tree');

        if (data.success) {
            const b = data.book;
            resultDiv.innerHTML = `<div class="p-3 bg-green-100 text-green-800 rounded"><b>${b.ma_sach}</b>: ${b.ten_sach}</div>`;
            showNotification('Đã tìm thấy sách!', 'success');
            
            // Gọi loadAllData với tham số searchPath (tham số thứ 3)
            // newlyAddedBookId (tham số thứ 2) chính là mã sách tìm thấy để nó tô xanh
            await loadAllData(null, ma, data.search_path); 
        } else {
            resultDiv.innerHTML = `<div class="p-3 bg-red-100 text-red-800">Không tìm thấy ${ma}</div>`;
            showNotification('Không tìm thấy', 'error');
            
            // Vẫn vẽ đường đi (màu xanh dương) để user biết đã tìm ở đâu, nhưng không tô xanh lá key nào
            await loadAllData(null, null, data.search_path);
        }
    } catch (e) { showNotification('Lỗi tìm kiếm', 'error'); }
}

async function deleteBookById(ma) {
    try {
        const res = await fetch(`/api/books/${ma}`, { method: 'DELETE' });
        const data = await res.json();
        if(data.success) { showNotification(data.message, 'success'); await loadAllData(); }
        else { showNotification(data.message, 'error'); }
    } catch(e) { showNotification('Lỗi khi xóa', 'error'); }
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
    const container = document.getElementById('treeStructure'); container.innerHTML = '';
    if (!root || !root.keys || root.keys.length === 0) {
        container.innerHTML = '<div class="text-gray-400 text-center py-20">Cây rỗng</div>'; return;
    }

    const treeData = calculateTreeLayout(root);
    const canvas = document.createElement('div'); canvas.className = 'btree-canvas';
    canvas.style.width = `${treeData.width + 100}px`; canvas.style.height = `${treeData.height + 50}px`;
    const svgLayer = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svgLayer.setAttribute('class', 'btree-svg-layer'); svgLayer.setAttribute('width', '100%'); svgLayer.setAttribute('height', '100%');
    canvas.appendChild(svgLayer);

    let targetElement = null;

    treeData.nodes.forEach(node => {
        const nodeEl = document.createElement('div'); nodeEl.className = 'btree-node-group';
        nodeEl.style.left = `${node.x + 50}px`; nodeEl.style.top = `${node.y + 20}px`;
        
        // Chữ ký của node hiện tại
        const currentNodeSignature = node.data.keys.map(k => k.ma_sach || k).join(',');

        // 1. HIGHLIGHT ĐƯỜNG TÌM KIẾM (Màu Xanh Dương)
        if (searchPath && Array.isArray(searchPath)) {
            const isInPath = searchPath.some(sig => sig.join(',') === currentNodeSignature);
            if (isInPath) {
                nodeEl.classList.add('search-path-node');
                // Target vào node cuối cùng của path (nơi dừng lại)
                if (searchPath[searchPath.length-1].join(',') === currentNodeSignature) targetElement = nodeEl;
            }
        }

        // 2. HIGHLIGHT NODE BỊ ẢNH HƯỞNG (Màu Vàng)
        if (affectedNodesList && Array.isArray(affectedNodesList)) {
            const isAffected = affectedNodesList.some(sig => sig.join(',') === currentNodeSignature);
            if (isAffected) {
                nodeEl.classList.add('active-node');
                if (!targetElement) targetElement = nodeEl;
            }
        }

        node.data.keys.forEach(key => {
            const keyEl = document.createElement('div'); keyEl.className = 'btree-key';
            const currentMaSach = key.ma_sach || key;
            keyEl.innerText = currentMaSach; 
            keyEl.title = (key.ten_sach || '') + ' - ' + (key.tac_gia || '');

            // 3. HIGHLIGHT KEY (Màu Xanh Lá - Cho thêm mới HOẶC Tìm thấy)
            if (newlyAddedBookId && currentMaSach === newlyAddedBookId) {
                keyEl.classList.add('newly-added-key');
                targetElement = nodeEl;
            }
            nodeEl.appendChild(keyEl);
        });
        canvas.appendChild(nodeEl);

        if (node.parent) { /* Vẽ đường nối (như cũ) */ 
            const startX = node.parent.x + (node.parent.width/2) + 50; const startY = node.parent.y + node.parent.height + 20;
            const endX = node.x + (node.width/2) + 50; const endY = node.y + 20;
            const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
            const controlY = (startY + endY) / 2;
            const d = `M ${startX} ${startY} C ${startX} ${controlY}, ${endX} ${controlY}, ${endX} ${endY}`;
            path.setAttribute('d', d); path.setAttribute('class', 'connection-line');
            path.setAttribute('fill', 'none'); path.setAttribute('stroke', '#6b7280'); path.setAttribute('stroke-width', '2');
            svgLayer.appendChild(path);
        }
    });

    const wrapper = document.createElement('div'); wrapper.className = 'btree-container';
    wrapper.style.display = 'flex'; wrapper.style.justifyContent = 'center';
    wrapper.appendChild(canvas); container.appendChild(wrapper);

    if (targetElement) {
        setTimeout(() => { targetElement.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' }); }, 300);
    }
}

// Các hàm Utils (renderBookTable, calculateTreeLayout...) giữ nguyên
function renderBookTable(books) {
    const tbody = document.getElementById('bookTableBody');
    if (!books || books.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center py-8 text-gray-400">Chưa có dữ liệu</td></tr>`; return;
    }
    tbody.innerHTML = books.map((book, idx) => `
        <tr class="hover:bg-gray-100 transition border-b">
            <td class="px-4 py-3 text-gray-500">${idx + 1}</td>
            <td class="px-4 py-3 font-bold text-indigo-600">${book.ma_sach}</td>
            <td class="px-4 py-3 font-medium text-gray-800">${book.ten_sach}</td>
            <td class="px-4 py-3 text-gray-600">${book.tac_gia}</td>
            <td class="px-4 py-3 text-center">
               <button onclick="if(confirm('Xóa sách ${book.ma_sach}?')) deleteBookById('${book.ma_sach}')" class="text-red-500 hover:text-red-700 hover:bg-red-50 p-2 rounded-full transition"><i class="bi bi-trash"></i></button>
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
            width: (node.keys.length * 48) + 16, height: 56, x: 0, y: depth * CONFIG.LEVEL_HEIGHT
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
    if (tab === 'list') {
        document.getElementById('listContent').classList.remove('hidden'); document.getElementById('treeContent').classList.add('hidden');
        document.getElementById('listTab').classList.add('border-indigo-600', 'text-indigo-600'); document.getElementById('treeTab').classList.remove('border-indigo-600', 'text-indigo-600');
    } else {
        document.getElementById('treeContent').classList.remove('hidden'); document.getElementById('listContent').classList.add('hidden');
        document.getElementById('treeTab').classList.add('border-indigo-600', 'text-indigo-600'); document.getElementById('listTab').classList.remove('border-indigo-600', 'text-indigo-600');
    }
}