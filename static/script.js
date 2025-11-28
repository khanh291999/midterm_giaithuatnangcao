// Load all data when page loads
document.addEventListener('DOMContentLoaded', function() {
    loadAllData();
});

// Tab switching
function switchTab(tab) {
    const listTab = document.getElementById('listTab');
    const treeTab = document.getElementById('treeTab');
    const listContent = document.getElementById('listContent');
    const treeContent = document.getElementById('treeContent');
    
    if (tab === 'list') {
        listTab.className = 'tab-button px-6 py-4 text-sm font-semibold text-indigo-600 border-b-2 border-indigo-600';
        treeTab.className = 'tab-button px-6 py-4 text-sm font-semibold text-gray-500 hover:text-gray-700 border-b-2 border-transparent';
        listContent.classList.remove('hidden');
        treeContent.classList.add('hidden');
    } else {
        treeTab.className = 'tab-button px-6 py-4 text-sm font-semibold text-indigo-600 border-b-2 border-indigo-600';
        listTab.className = 'tab-button px-6 py-4 text-sm font-semibold text-gray-500 hover:text-gray-700 border-b-2 border-transparent';
        treeContent.classList.remove('hidden');
        listContent.classList.add('hidden');
    }
}

// Show toast notification
function showNotification(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    
    const colors = {
        'success': 'from-green-500 to-green-600',
        'error': 'from-red-500 to-red-600',
        'info': 'from-blue-500 to-blue-600'
    };
    
    const icons = {
        'success': 'bi-check-circle-fill',
        'error': 'bi-x-circle-fill',
        'info': 'bi-info-circle-fill'
    };
    
    const toast = document.createElement('div');
    toast.className = `bg-gradient-to-r ${colors[type]} text-white px-6 py-4 rounded-lg shadow-2xl transform transition-all duration-300 flex items-center space-x-3 animate-slide-in`;
    toast.innerHTML = `
        <i class="bi ${icons[type]} text-xl"></i>
        <span class="font-semibold">${message}</span>
    `;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(400px)';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Load all data
function loadAllData() {
    loadBooks();
    loadTree();
}

// Load books
async function loadBooks() {
    try {
        const response = await fetch('/api/books');
        const books = await response.json();
        
        const tbody = document.getElementById('bookTableBody');
        const bookCount = document.getElementById('bookCount');
        
        bookCount.textContent = books.length;
        
        if (books.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="px-4 py-16 text-center">
                        <i class="bi bi-inbox text-gray-300 text-6xl block mb-4"></i>
                        <p class="text-gray-500 text-lg">Chưa có sách nào trong thư viện</p>
                    </td>
                </tr>
            `;
            return;
        }
        
        tbody.innerHTML = books.map((book, index) => `
            <tr class="hover:bg-gray-50 transition">
                <td class="px-4 py-3 text-gray-700">${index + 1}</td>
                <td class="px-4 py-3">
                    <span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800">
                        ${book.ma_sach}
                    </span>
                </td>
                <td class="px-4 py-3 text-gray-700">${book.ten_sach}</td>
                <td class="px-4 py-3 text-gray-600">${book.tac_gia}</td>
                <td class="px-4 py-3 text-center">
                    <button onclick="deleteBookById('${book.ma_sach}')" 
                        class="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded-lg text-sm font-semibold transition transform hover:scale-105"
                        title="Xóa sách">
                        <i class="bi bi-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Error loading books:', error);
        showNotification('Lỗi khi tải danh sách sách', 'error');
    }
}

// Load tree structure
async function loadTree() {
    try {
        const response = await fetch('/api/tree');
        const tree = await response.json();
        
        const treeContainer = document.getElementById('treeStructure');
        
        if (!tree || !tree.keys || tree.keys.length === 0) {
            treeContainer.innerHTML = `
                <div class="flex flex-col items-center justify-center py-16">
                    <i class="bi bi-tree text-gray-300 text-6xl mb-4"></i>
                    <p class="text-gray-500 text-lg">Cây B-Tree rỗng</p>
                </div>
            `;
            return;
        }
        
        treeContainer.innerHTML = renderTree(tree);
    } catch (error) {
        console.error('Error loading tree:', error);
        showNotification('Lỗi khi tải cấu trúc cây', 'error');
    }
}

// Render tree structure - Beautiful circular nodes with connections
function renderTree(tree) {
    if (!tree || !tree.keys || tree.keys.length === 0) {
        return '<div class="text-center py-16"><i class="bi bi-tree text-gray-400 text-6xl"></i><p class="text-gray-400 mt-4">Cây rỗng</p></div>';
    }
    
    // Build tree structure with levels
    const levels = buildTreeLevels(tree);
    
    let html = '<div class="btree-container" id="btree-container">';
    html += '<svg class="btree-svg-canvas" id="btree-svg"></svg>';
    html += '<div class="btree-content">';
    
    levels.forEach((level, levelIndex) => {
        html += `<div class="btree-level" style="animation-delay: ${levelIndex * 0.1}s">`;
        
        level.forEach(node => {
            html += `<div class="btree-node" data-node-id="${node.id}">`;
            
            // Render keys in circular nodes
            node.keys.forEach((key, keyIndex) => {
                html += `<div class="btree-key" data-key="${key}">${key}</div>`;
            });
            
            // Add leaf label if it's a leaf node
            if (node.leaf) {
                html += '<span class="btree-leaf-label">(Lá)</span>';
            }
            
            html += '</div>';
        });
        
        html += '</div>';
    });
    
    html += '</div></div>';
    
    // After rendering, draw connections - use longer delay and requestAnimationFrame
    setTimeout(() => {
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                drawConnections(levels);
            });
        });
    }, 300);
    
    return html;
}

// Build tree levels for visualization
function buildTreeLevels(node, levels = [], level = 0, parentId = null) {
    if (!node) return levels;
    
    // Initialize level array if needed
    if (!levels[level]) {
        levels[level] = [];
    }
    
    // Create node with unique ID
    const nodeId = `node-${level}-${levels[level].length}`;
    const nodeData = {
        id: nodeId,
        keys: node.keys || [],
        leaf: node.leaf || false,
        parentId: parentId
    };
    
    levels[level].push(nodeData);
    
    // Process children
    if (node.children && node.children.length > 0) {
        node.children.forEach(child => {
            buildTreeLevels(child, levels, level + 1, nodeId);
        });
    }
    
    return levels;
}

// Draw SVG connections between nodes
function drawConnections(levels) {
    const svg = document.getElementById('btree-svg');
    const container = document.getElementById('btree-container');
    
    if (!svg || !container) {
        console.log('SVG or container not found');
        return;
    }
    
    console.log('Drawing connections for levels:', levels.length);
    
    // Clear previous connections
    svg.innerHTML = '';
    
    // Force layout recalculation
    container.offsetHeight;
    
    // Set SVG size to match container
    const containerRect = container.getBoundingClientRect();
    console.log('Container rect:', containerRect);
    
    if (containerRect.width === 0 || containerRect.height === 0) {
        console.log('Container has no size, retrying...');
        setTimeout(() => drawConnections(levels), 100);
        return;
    }
    
    svg.setAttribute('width', containerRect.width);
    svg.setAttribute('height', containerRect.height);
    svg.setAttribute('viewBox', `0 0 ${containerRect.width} ${containerRect.height}`);
    
    let lineCount = 0;
    
    // Draw connections from parent to children
    for (let i = 0; i < levels.length - 1; i++) {
        const currentLevel = levels[i];
        const nextLevel = levels[i + 1];
        
        console.log(`Level ${i}: ${currentLevel.length} nodes, Next level: ${nextLevel.length} nodes`);
        
        currentLevel.forEach(parentNode => {
            const parentElement = document.querySelector(`.btree-node[data-node-id="${parentNode.id}"]`);
            if (!parentElement) {
                console.log(`Parent node not found: ${parentNode.id}`);
                return;
            }
            
            // Get center position of parent node
            const parentRect = parentElement.getBoundingClientRect();
            
            if (parentRect.width === 0 || parentRect.height === 0) {
                console.log(`Parent node has no size: ${parentNode.id}`);
                return;
            }
            
            const containerTop = containerRect.top;
            const containerLeft = containerRect.left;
            
            const parentX = parentRect.left + parentRect.width / 2 - containerLeft;
            const parentY = parentRect.bottom - containerTop;
            
            console.log(`Parent ${parentNode.id}: (${parentX.toFixed(1)}, ${parentY.toFixed(1)})`);
            
            // Find children of this parent
            nextLevel.forEach(childNode => {
                if (childNode.parentId === parentNode.id) {
                    const childElement = document.querySelector(`.btree-node[data-node-id="${childNode.id}"]`);
                    if (!childElement) {
                        console.log(`Child node not found: ${childNode.id}`);
                        return;
                    }
                    
                    const childRect = childElement.getBoundingClientRect();
                    const childX = childRect.left + childRect.width / 2 - containerLeft;
                    const childY = childRect.top - containerTop;
                    
                    console.log(`  Child ${childNode.id}: (${childX.toFixed(1)}, ${childY.toFixed(1)})`);
                    
                    // Create line element
                    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                    line.setAttribute('x1', parentX);
                    line.setAttribute('y1', parentY);
                    line.setAttribute('x2', childX);
                    line.setAttribute('y2', childY);
                    line.setAttribute('stroke', '#38bdf8');
                    line.setAttribute('stroke-width', '3');
                    line.setAttribute('stroke-linecap', 'round');
                    
                    svg.appendChild(line);
                    lineCount++;
                    console.log(`  Drew line from (${parentX.toFixed(1)}, ${parentY.toFixed(1)}) to (${childX.toFixed(1)}, ${childY.toFixed(1)})`);
                }
            });
        });
    }
    
    console.log(`Total lines drawn: ${lineCount}`);
}

// Add book form handler
document.getElementById('addBookForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const maSach = document.getElementById('addMaSach').value.trim();
    const tenSach = document.getElementById('addTenSach').value.trim();
    const tacGia = document.getElementById('addTacGia').value.trim();
    
    if (!maSach || !tenSach || !tacGia) {
        showNotification('Vui lòng điền đầy đủ thông tin', 'error');
        return;
    }
    
    try {
        const response = await fetch('/api/books', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                ma_sach: maSach,
                ten_sach: tenSach,
                tac_gia: tacGia
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showNotification('✓ ' + result.message, 'success');
            document.getElementById('addBookForm').reset();
            loadAllData();
        } else {
            showNotification('✗ ' + result.message, 'error');
        }
    } catch (error) {
        console.error('Error adding book:', error);
        showNotification('Lỗi khi thêm sách', 'error');
    }
});

// Search book form handler
document.getElementById('searchBookForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const maSach = document.getElementById('searchMaSach').value.trim();
    
    if (!maSach) {
        showNotification('Vui lòng nhập mã sách', 'error');
        return;
    }
    
    try {
        const response = await fetch(`/api/books/search/${maSach}`);
        const result = await response.json();
        
        const searchResult = document.getElementById('searchResult');
        
        if (result.success) {
            const book = result.book;
            searchResult.innerHTML = `
                <div class="bg-gradient-to-r from-green-500 to-green-600 text-white p-4 rounded-lg shadow-lg mt-3 animate-fade-in">
                    <h6 class="font-bold text-sm mb-2 flex items-center">
                        <i class="bi bi-check-circle-fill mr-2"></i> Tìm thấy!
                    </h6>
                    <p class="text-sm mb-1"><strong>Mã:</strong> ${book.ma_sach}</p>
                    <p class="text-sm mb-1"><strong>Tên:</strong> ${book.ten_sach}</p>
                    <p class="text-sm mb-0"><strong>Tác giả:</strong> ${book.tac_gia}</p>
                </div>
            `;
            showNotification('Tìm thấy sách', 'success');
        } else {
            searchResult.innerHTML = `
                <div class="bg-gradient-to-r from-red-500 to-red-600 text-white p-4 rounded-lg shadow-lg mt-3 animate-fade-in">
                    <h6 class="font-bold text-sm mb-2 flex items-center">
                        <i class="bi bi-x-circle-fill mr-2"></i> Không tìm thấy
                    </h6>
                    <p class="text-sm mb-0">${result.message}</p>
                </div>
            `;
            showNotification(result.message, 'error');
        }
    } catch (error) {
        console.error('Error searching book:', error);
        showNotification('Lỗi khi tìm kiếm', 'error');
    }
});

// Delete book form handler
document.getElementById('deleteBookForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const maSach = document.getElementById('deleteMaSach').value.trim();
    
    if (!maSach) {
        showNotification('Vui lòng nhập mã sách', 'error');
        return;
    }
    
    if (!confirm(`Bạn có chắc muốn xóa sách có mã "${maSach}"?`)) {
        return;
    }
    
    await deleteBookById(maSach);
    document.getElementById('deleteBookForm').reset();
});

// Delete book by ID
async function deleteBookById(maSach) {
    try {
        const response = await fetch(`/api/books/${maSach}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        
        if (result.success) {
            showNotification('✓ ' + result.message, 'success');
            loadAllData();
        } else {
            showNotification('✗ ' + result.message, 'error');
        }
    } catch (error) {
        console.error('Error deleting book:', error);
        showNotification('Lỗi khi xóa sách', 'error');
    }
}
