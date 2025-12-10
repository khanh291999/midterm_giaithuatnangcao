from flask import Flask, render_template, request, jsonify
import json
import os
import random

app = Flask(__name__)

# Config files
DATA_FILE = 'books_data.json'
SAMPLE_FILE = 'sample_books.json'

# --- 1. CLASS DEFINITIONS ---

class Book:
    """Represents a book entity."""
    def __init__(self, ma_sach, ten_sach, tac_gia):
        self.ma_sach = ma_sach
        self.ten_sach = ten_sach
        self.tac_gia = tac_gia
    
    def to_dict(self):
        return {
            'ma_sach': self.ma_sach,
            'ten_sach': self.ten_sach,
            'tac_gia': self.tac_gia
        }
    
    # Comparison overrides for cleaner B-Tree logic
    def __lt__(self, other): return self.ma_sach < (other.ma_sach if isinstance(other, Book) else other)
    def __gt__(self, other): return self.ma_sach > (other.ma_sach if isinstance(other, Book) else other)
    def __eq__(self, other): return self.ma_sach == (other.ma_sach if isinstance(other, Book) else other)
    def __le__(self, other): return self.ma_sach <= (other.ma_sach if isinstance(other, Book) else other)
    def __ge__(self, other): return self.ma_sach >= (other.ma_sach if isinstance(other, Book) else other)


class BTreeNode:
    """Represents a Node in the B-Tree."""
    def __init__(self, leaf=True):
        self.keys = []
        self.children = []
        self.leaf = leaf
    
    def to_dict(self):
        # Recursive serialization to create a data snapshot
        return {
            'keys': [k.to_dict() for k in self.keys],
            'leaf': self.leaf,
            'children': [child.to_dict() for child in self.children]
        }


class BTree:
    """B-Tree Manager with Animation Log capabilities."""
    def __init__(self, t=3):
        self.root = BTreeNode()
        self.t = t
        self.affected_nodes = set()
        self.steps_log = [] # Stores steps for frontend animation

    def capture_state(self, message, highlight_nodes=None):
        """Captures the current state of the tree for animation."""
        snapshot = {
            'tree': self.root.to_dict(),
            'message': message,
            'highlights': []
        }
        # Convert highlight_nodes objects into key signatures (string/array)
        if highlight_nodes:
            if isinstance(highlight_nodes, list):
                snapshot['highlights'] = [[k.ma_sach for k in n.keys] for n in highlight_nodes]
            elif isinstance(highlight_nodes, BTreeNode):
                snapshot['highlights'] = [[k.ma_sach for k in highlight_nodes.keys]]
        
        self.steps_log.append(snapshot)

    def search(self, ma_sach, node=None):
        """Standard search (Internal use for logic checks)."""
        if node is None: node = self.root
        i = 0
        while i < len(node.keys) and ma_sach > node.keys[i].ma_sach:
            i += 1
        if i < len(node.keys) and ma_sach == node.keys[i].ma_sach:
            return node.keys[i]
        if node.leaf: return None
        return self.search(ma_sach, node.children[i])

    # --- SEARCH ANIMATION LOGIC ---
    def search_with_animation(self, ma_sach):
        """Performs search and records steps for animation."""
        self.steps_log = [] # Reset log
        node = self.root
        
        while True:
            self.capture_state(f"Đang xét node: {[k.ma_sach for k in node.keys]}", highlight_nodes=node)
            
            i = 0
            while i < len(node.keys) and ma_sach > node.keys[i].ma_sach:
                i += 1
            
            if i < len(node.keys) and ma_sach == node.keys[i].ma_sach:
                self.capture_state(f"ĐÃ TÌM THẤY: '{node.keys[i].ten_sach}'", highlight_nodes=node)
                return node.keys[i]
            
            if node.leaf:
                self.capture_state(f"Đã duyệt đến lá. Không tìm thấy '{ma_sach}'.", highlight_nodes=node)
                return None
                
            self.capture_state(f"'{ma_sach}' không có ở đây. Đi xuống nhánh con index {i}.", highlight_nodes=[node, node.children[i]])
            node = node.children[i]

    # --- INSERT LOGIC (WITH ANIMATION) ---
    def insert(self, book):
        self.steps_log = [] # Reset log
        self.affected_nodes = set()
        
        self.capture_state(f"Bắt đầu thêm: {book.ten_sach} ({book.ma_sach})")
        
        root = self.root
        if len(root.keys) >= (2 * self.t - 1):
            new_root = BTreeNode(leaf=False)
            new_root.children.append(self.root)
            self.root = new_root
            
            self.capture_state("Gốc đã đầy. Tạo gốc mới, chuẩn bị tách node con.", [self.root])
            self._split_child(new_root, 0)
            self._insert_non_full(new_root, book)
        else:
            self._insert_non_full(root, book)
            
        self.capture_state(f"Hoàn tất thêm sách {book.ma_sach}", [self.root])

    def _insert_non_full(self, node, book):
        self.capture_state(f"Đang xét duyệt node: {[k.ma_sach for k in node.keys]}", [node])
        
        i = len(node.keys) - 1
        if node.leaf:
            node.keys.append(None)
            while i >= 0 and book.ma_sach < node.keys[i].ma_sach:
                node.keys[i + 1] = node.keys[i]
                i -= 1
            node.keys[i + 1] = book
            self.affected_nodes.add(node)
            self.capture_state(f"Node lá còn chỗ. Chèn {book.ma_sach} vào vị trí thích hợp.", [node])
        else:
            while i >= 0 and book.ma_sach < node.keys[i].ma_sach:
                i -= 1
            i += 1
            
            if len(node.children[i].keys) >= (2 * self.t - 1):
                self.capture_state(f"Node con index {i} bị đầy (Full). Thực hiện tách node.", [node, node.children[i]])
                self._split_child(node, i)
                if book.ma_sach > node.keys[i].ma_sach:
                    i += 1
            
            self._insert_non_full(node.children[i], book)

    def _split_child(self, parent, index):
        t = self.t
        full_child = parent.children[index]
        new_child = BTreeNode(leaf=full_child.leaf)
        mid_index = t - 1
        
        new_child.keys = full_child.keys[mid_index + 1:]
        median_key = full_child.keys[mid_index]
        full_child.keys = full_child.keys[:mid_index]
        
        if not full_child.leaf:
            new_child.children = full_child.children[mid_index + 1:]
            full_child.children = full_child.children[:mid_index + 1]
            
        parent.keys.insert(index, median_key)
        parent.children.insert(index + 1, new_child)

        self.affected_nodes.add(parent)
        self.affected_nodes.add(full_child)
        self.affected_nodes.add(new_child)
        
        self.capture_state(f"Đã tách node. Đẩy khóa '{median_key.ma_sach}' lên cha.", [parent, full_child, new_child])

    # --- DELETE LOGIC (WITH ANIMATION) ---
    def delete(self, ma_sach):
        self.steps_log = [] # Reset animation log
        self.affected_nodes = set()
        
        self.capture_state(f"Bắt đầu yêu cầu xóa sách: {ma_sach}")
        
        if not self.search(ma_sach): 
            self.capture_state(f"Không tìm thấy sách {ma_sach} để xóa.")
            return False
            
        self._delete(self.root, ma_sach)
        
        if len(self.root.keys) == 0:
            if not self.root.leaf:
                self.root = self.root.children[0]
                self.affected_nodes.add(self.root)
                self.capture_state("Gốc bị rỗng. Hạ chiều cao cây xuống.", [self.root])
        
        self.capture_state("Hoàn tất xóa.", [self.root])
        return True

    def _delete(self, node, ma_sach):
        t = self.t
        i = 0
        while i < len(node.keys) and ma_sach > node.keys[i].ma_sach:
            i += 1
        
        self.affected_nodes.add(node)
        
        # Case 1: Tìm thấy khóa k tại node này
        if i < len(node.keys) and ma_sach == node.keys[i].ma_sach:
            self.capture_state(f"Đã tìm thấy {ma_sach} tại node hiện tại.", [node])
            
            if node.leaf:
                # Case 1a: Xóa tại lá
                node.keys.pop(i)
                self.affected_nodes.add(node)
                self.capture_state(f"Node là lá. Xóa trực tiếp {ma_sach}.", [node])
            else:
                # Case 1b: Xóa tại node trong
                if len(node.children[i].keys) >= t:
                    pred = self._get_predecessor(node, i)
                    self.capture_state(f"Thay thế {ma_sach} bằng tiền nhiệm {pred.ma_sach}.", [node, node.children[i]])
                    node.keys[i] = pred
                    self._delete(node.children[i], pred.ma_sach)
                elif len(node.children[i+1].keys) >= t:
                    succ = self._get_successor(node, i)
                    self.capture_state(f"Thay thế {ma_sach} bằng kế thừa {succ.ma_sach}.", [node, node.children[i+1]])
                    node.keys[i] = succ
                    self._delete(node.children[i+1], succ.ma_sach)
                else:
                    self.capture_state(f"Cả 2 con đều ít khóa. Gộp 2 node con.", [node])
                    self._merge(node, i)
                    self._delete(node.children[i], ma_sach)
        else:
            # Case 2: Không tìm thấy tại node này, đi xuống con
            if node.leaf: 
                return # Should not happen if search checked first

            flag = (i == len(node.keys))
            
            # Đảm bảo node con có đủ khóa (>= t) trước khi đi xuống
            if len(node.children[i].keys) < t:
                self.capture_state(f"Node con index {i} bị thiếu khóa (Underflow). Cần xử lý...", [node, node.children[i]])
                self._fill(node, i)
            
            # Sau khi fill, index có thể thay đổi nếu merge xảy ra
            if flag and i > len(node.keys):
                self._delete(node.children[i-1], ma_sach)
            else:
                child_idx = i if i < len(node.children) else len(node.children) - 1
                self.capture_state(f"Tiếp tục tìm {ma_sach} ở node con.", [node.children[child_idx]])
                self._delete(node.children[child_idx], ma_sach)

    def _get_predecessor(self, node, i):
        cur = node.children[i]
        while not cur.leaf: cur = cur.children[-1]
        return cur.keys[-1]

    def _get_successor(self, node, i):
        cur = node.children[i+1]
        while not cur.leaf: cur = cur.children[0]
        return cur.keys[0]

    def _fill(self, node, i):
        if i != 0 and len(node.children[i-1].keys) >= self.t:
            self._borrow_from_prev(node, i)
        elif i != len(node.children)-1 and len(node.children[i+1].keys) >= self.t:
            self._borrow_from_next(node, i)
        else:
            if i != len(node.children)-1: self._merge(node, i)
            else: self._merge(node, i-1)

    def _borrow_from_prev(self, node, i):
        child = node.children[i]
        sibling = node.children[i-1]
        
        self.capture_state(f"Mượn khóa từ anh em bên Trái ({sibling.keys[-1].ma_sach}).", [node, child, sibling])
        
        child.keys.insert(0, node.keys[i-1])
        if not child.leaf: child.children.insert(0, sibling.children.pop())
        node.keys[i-1] = sibling.keys.pop()
        
        self.affected_nodes.add(child)
        self.affected_nodes.add(sibling)
        self.affected_nodes.add(node)

    def _borrow_from_next(self, node, i):
        child = node.children[i]
        sibling = node.children[i+1]
        
        self.capture_state(f"Mượn khóa từ anh em bên Phải ({sibling.keys[0].ma_sach}).", [node, child, sibling])
        
        child.keys.append(node.keys[i])
        if not child.leaf: child.children.append(sibling.children.pop(0))
        node.keys[i] = sibling.keys.pop(0)
        
        self.affected_nodes.add(child)
        self.affected_nodes.add(sibling)
        self.affected_nodes.add(node)

    def _merge(self, node, i):
        child = node.children[i]
        sibling = node.children[i+1]
        
        self.capture_state(f"Gộp node con index {i} và {i+1} cùng khóa phân cách.", [node, child, sibling])
        
        child.keys.append(node.keys[i])
        child.keys.extend(sibling.keys)
        if not child.leaf: child.children.extend(sibling.children)
        
        node.keys.pop(i)
        node.children.pop(i+1)
        
        self.affected_nodes.add(child)
        self.affected_nodes.add(node)

    def get_all_books(self):
        return self._inorder(self.root)

    def _inorder(self, node):
        res = []
        if not node: return res
        i = 0
        for i in range(len(node.keys)):
            if not node.leaf: res.extend(self._inorder(node.children[i]))
            res.append(node.keys[i])
        if not node.leaf: res.extend(self._inorder(node.children[i+1]))
        return res
    
    def get_tree_structure(self):
        return self.root.to_dict()
    
    def get_affected_nodes_data(self):
        result = []
        for node in self.affected_nodes:
            keys_sig = [k.ma_sach for k in node.keys]
            result.append(keys_sig)
        return result

# --- 2. GLOBAL & UTILS ---
btree = BTree(t=3)

def save_data():
    books = btree.get_all_books()
    data = [b.to_dict() for b in books]
    with open(DATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def load_data():
    global btree
    if os.path.exists(DATA_FILE):
        try:
            with open(DATA_FILE, 'r', encoding='utf-8') as f:
                data = json.load(f)
                btree = BTree(t=btree.t)
                for item in data:
                    book = Book(item['ma_sach'], item['ten_sach'], item['tac_gia'])
                    btree.insert(book)
            return True
        except: return False
    return False

load_data()

# --- 3. ROUTES ---
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/books', methods=['GET'])
def get_books():
    books = btree.get_all_books()
    return jsonify([b.to_dict() for b in books])

@app.route('/api/tree', methods=['GET'])
def get_tree():
    return jsonify(btree.get_tree_structure())

@app.route('/api/books', methods=['POST'])
def add_book():
    data = request.json
    ma = data.get('ma_sach')
    if btree.search(ma):
        return jsonify({'success': False, 'message': 'Mã sách đã tồn tại'})
    
    book = Book(ma, data.get('ten_sach'), data.get('tac_gia'))
    btree.insert(book)
    save_data()
    
    # Return steps log for animation
    return jsonify({
        'success': True, 
        'message': 'Thêm thành công',
        'affected_nodes': btree.get_affected_nodes_data(),
        'steps': btree.steps_log
    })

@app.route('/api/books/random', methods=['POST'])
def add_random_book():
    if not os.path.exists(SAMPLE_FILE):
        return jsonify({'success': False, 'message': 'Chưa có file sample_books.json'})
    try:
        with open(SAMPLE_FILE, 'r', encoding='utf-8') as f:
            samples = json.load(f)
        current_codes = {b.ma_sach for b in btree.get_all_books()}
        available = [s for s in samples if s['ma_sach'] not in current_codes]
        
        if not available:
            return jsonify({'success': False, 'message': 'Hết sách mẫu!'})
        
        chosen = random.choice(available)
        book = Book(chosen['ma_sach'], chosen['ten_sach'], chosen['tac_gia'])
        btree.insert(book)
        save_data()
        
        return jsonify({
            'success': True,
            'message': f"Đã thêm: {book.ten_sach}",
            'book': book.to_dict(),
            'steps': btree.steps_log
        })
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})

@app.route('/api/books/search/<ma>', methods=['GET'])
def search_book(ma):
    found_book = btree.search_with_animation(ma)
    return jsonify({
        'success': bool(found_book),
        'book': found_book.to_dict() if found_book else None,
        'steps': btree.steps_log,
        'search_path': []
    })

@app.route('/api/books/<ma>', methods=['DELETE'])
def delete_book(ma):
    if not btree.search(ma):
        return jsonify({'success': False, 'message': 'Không tìm thấy sách'})
    
    # Thực hiện xóa (lúc này steps_log đã được ghi lại trong hàm delete)
    btree.delete(ma)
    save_data()
    
    return jsonify({
        'success': True, 
        'message': 'Đã xóa thành công',
        'affected_nodes': btree.get_affected_nodes_data(),
        'steps': btree.steps_log # Trả về log để làm animation xóa
    })

@app.route('/api/config/degree', methods=['POST'])
def update_degree():
    global btree
    try:
        new_t = int(request.json.get('t', 3))
        if new_t < 2: return jsonify({'success': False, 'message': 't >= 2'})
        current_books = btree.get_all_books()
        btree = BTree(t=new_t)
        for b in current_books: btree.insert(b)
        save_data()
        return jsonify({'success': True, 'message': f'Đã đổi sang t={new_t}'})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})

@app.route('/api/reset', methods=['POST'])
def reset_tree():
    global btree
    btree = BTree(t=btree.t)
    save_data()
    return jsonify({'success': True, 'message': 'Đã reset hệ thống'})

if __name__ == '__main__':
    app.run(debug=True, port=5000)