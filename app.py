from flask import Flask, render_template, request, jsonify
import json
import os
import random

app = Flask(__name__)

# File cấu hình
DATA_FILE = 'books_data.json'
SAMPLE_FILE = 'sample_books.json'

# --- 1. ĐỊNH NGHĨA CÁC CLASS ---

class Book:
    """Lớp đại diện cho một cuốn sách"""
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
    
    # Các phép so sánh để B-Tree hoạt động
    def __lt__(self, other): return self.ma_sach < (other.ma_sach if isinstance(other, Book) else other)
    def __gt__(self, other): return self.ma_sach > (other.ma_sach if isinstance(other, Book) else other)
    def __eq__(self, other): return self.ma_sach == (other.ma_sach if isinstance(other, Book) else other)
    def __le__(self, other): return self.ma_sach <= (other.ma_sach if isinstance(other, Book) else other)
    def __ge__(self, other): return self.ma_sach >= (other.ma_sach if isinstance(other, Book) else other)


class BTreeNode:
    """Lớp Node của B-Tree"""
    def __init__(self, leaf=True):
        self.keys = []
        self.children = []
        self.leaf = leaf
    
    def to_dict(self):
        return {
            'keys': [k.to_dict() for k in self.keys], # Serialize book objects
            'leaf': self.leaf,
            'children': [child.to_dict() for child in self.children]
        }


class BTree:
    """Lớp B-Tree quản lý sách"""
    def __init__(self, t=3):
        self.root = BTreeNode()
        self.t = t
        self.affected_nodes = set()

    def get_affected_nodes_data(self):
        result = []
        for node in self.affected_nodes:
            keys_sig = [k.ma_sach for k in node.keys]
            result.append(keys_sig)
        return result

    def search(self, ma_sach, node=None):
        if node is None: node = self.root
        i = 0
        while i < len(node.keys) and ma_sach > node.keys[i].ma_sach:
            i += 1
        if i < len(node.keys) and ma_sach == node.keys[i].ma_sach:
            return node.keys[i]
        if node.leaf: return None
        return self.search(ma_sach, node.children[i])

    def search_with_path(self, ma_sach):
        """Tìm kiếm và trả về (kết quả, đường_đi)"""
        path = [] # Danh sách lưu chữ ký các node đã đi qua
        node = self.root
        
        while True:
            # 1. Ghi lại dấu vết node hiện tại
            node_sig = [k.ma_sach for k in node.keys]
            path.append(node_sig)
            
            i = 0
            while i < len(node.keys) and ma_sach > node.keys[i].ma_sach:
                i += 1
            
            # Trường hợp 1: Tìm thấy
            if i < len(node.keys) and ma_sach == node.keys[i].ma_sach:
                return node.keys[i], path
            
            # Trường hợp 2: Không thấy và đã ở lá
            if node.leaf:
                return None, path
            
            # Trường hợp 3: Đi xuống con
            node = node.children[i]
    def insert(self, book):
        """Thêm sách mới"""
        self.affected_nodes = set() # Reset tracking
        root = self.root
        
        if len(root.keys) >= (2 * self.t - 1):
            new_root = BTreeNode(leaf=False)
            new_root.children.append(self.root)
            self._split_child(new_root, 0)
            self.root = new_root
            self._insert_non_full(new_root, book)
            self.affected_nodes.add(new_root)
        else:
            self._insert_non_full(root, book)

    def _insert_non_full(self, node, book):
        i = len(node.keys) - 1
        
        if node.leaf:
            node.keys.append(None)
            while i >= 0 and book.ma_sach < node.keys[i].ma_sach:
                node.keys[i + 1] = node.keys[i]
                i -= 1
            node.keys[i + 1] = book
            self.affected_nodes.add(node) # Ghi nhận thay đổi
        else:
            while i >= 0 and book.ma_sach < node.keys[i].ma_sach:
                i -= 1
            i += 1
            
            if len(node.children[i].keys) >= (2 * self.t - 1):
                self._split_child(node, i)
                if book.ma_sach > node.keys[i].ma_sach:
                    i += 1
            
            self._insert_non_full(node.children[i], book)

    def _split_child(self, parent, index):
        t = self.t
        full_child = parent.children[index]
        new_child = BTreeNode(leaf=full_child.leaf)
        
        mid_index = t - 1
        
        # 1. Tách khóa sang con mới
        new_child.keys = full_child.keys[mid_index + 1:]
        
        # 2. Lấy khóa trung vị
        median_key = full_child.keys[mid_index]
        
        # 3. Cắt con cũ
        full_child.keys = full_child.keys[:mid_index]
        
        # 4. Di chuyển con cái (nếu có)
        if not full_child.leaf:
            new_child.children = full_child.children[mid_index + 1:]
            full_child.children = full_child.children[:mid_index + 1]
        
        # 5. Đẩy trung vị lên cha
        parent.keys.insert(index, median_key)
        parent.children.insert(index + 1, new_child)

        # Ghi nhận các node bị ảnh hưởng
        self.affected_nodes.add(parent)
        self.affected_nodes.add(full_child)
        self.affected_nodes.add(new_child)

    def delete(self, ma_sach):
        self.affected_nodes = set() # Reset tracking
        
        if not self.search(ma_sach):
            return False 
        
        self._delete(self.root, ma_sach)
        
        # Nếu root rỗng, giảm chiều cao
        if len(self.root.keys) == 0:
            if not self.root.leaf:
                self.root = self.root.children[0]
                self.affected_nodes.add(self.root) # Ghi nhận root mới
        return True

    def _delete(self, node, ma_sach):
        t = self.t
        i = 0
        while i < len(node.keys) and ma_sach > node.keys[i].ma_sach:
            i += 1
        
        # Ghi nhận node này đang bị xét duyệt/thay đổi
        self.affected_nodes.add(node)

        if i < len(node.keys) and ma_sach == node.keys[i].ma_sach:
            # Case 1: Xóa ở lá
            if node.leaf:
                node.keys.pop(i)
                self.affected_nodes.add(node)
            # Case 2: Xóa ở node trong
            else:
                if len(node.children[i].keys) >= t:
                    pred = self._get_predecessor(node, i)
                    node.keys[i] = pred
                    self._delete(node.children[i], pred.ma_sach)
                elif len(node.children[i+1].keys) >= t:
                    succ = self._get_successor(node, i)
                    node.keys[i] = succ
                    self._delete(node.children[i+1], succ.ma_sach)
                else:
                    self._merge(node, i)
                    # Sau khi merge, node con ở vị trí i+1 đã bị xóa, con ở vị trí i chứa cả 2
                    self._delete(node.children[i], ma_sach)
        else:
            # Case 3: Đi xuống con
            if node.leaf: return

            flag = (i == len(node.keys))
            if len(node.children[i].keys) < t:
                self._fill(node, i)

            # Fix lỗi Index Error tiềm ẩn sau khi merge
            if flag and i > len(node.keys):
                self._delete(node.children[i-1], ma_sach)
            else:
                # Kiểm tra lại index an toàn
                child_idx = i if i < len(node.children) else len(node.children) - 1
                self._delete(node.children[child_idx], ma_sach)

    # Các hàm bổ trợ cho Delete
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
        child.keys.insert(0, node.keys[i-1])
        if not child.leaf: child.children.insert(0, sibling.children.pop())
        node.keys[i-1] = sibling.keys.pop()

    def _borrow_from_next(self, node, i):
        child = node.children[i]
        sibling = node.children[i+1]
        child.keys.append(node.keys[i])
        if not child.leaf: child.children.append(sibling.children.pop(0))
        node.keys[i] = sibling.keys.pop(0)

    def _merge(self, node, i):
        child = node.children[i]
        sibling = node.children[i+1]
        child.keys.append(node.keys[i])
        child.keys.extend(sibling.keys)
        if not child.leaf: child.children.extend(sibling.children)
        node.keys.pop(i)
        node.children.pop(i+1)

        self.affected_nodes.add(child)

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

# --- 2. KHỞI TẠO GLOBAL ---
btree = BTree(t=3)

# --- 3. HÀM UTILS ---
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
                btree = BTree(t=btree.t) # Reset tree
                for item in data:
                    book = Book(item['ma_sach'], item['ten_sach'], item['tac_gia'])
                    btree.insert(book)
            return True
        except:
            return False
    return False

# Load data on startup
load_data()

# --- 4. ROUTES ---
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
    
    return jsonify({
        'success': True, 
        'message': 'Thêm thành công',
        'affected_nodes': btree.get_affected_nodes_data()
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
            'affected_nodes': btree.get_affected_nodes_data()
        })
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})

@app.route('/api/books/search/<ma>', methods=['GET'])
def search_book(ma):
    # Gọi hàm mới search_with_path
    book, path = btree.search_with_path(ma)
    
    if book: 
        return jsonify({
            'success': True, 
            'book': book.to_dict(),
            'search_path': path # Trả về lộ trình
        })
    
    return jsonify({
        'success': False, 
        'search_path': path # Vẫn trả về lộ trình dù không tìm thấy (để biết đã tìm ở đâu)
    })
# Example for Backend (Python/Flask)
@app.route('/api/books/<ma>', methods=['DELETE'])
def delete_book(ma):
    try:
        if not btree.search(ma):
            return jsonify({'success': False, 'message': 'Không tìm thấy sách'})
        
        btree.delete(ma)
        save_data()
        
        # MỚI: Trả về danh sách node bị ảnh hưởng
        return jsonify({
            'success': True, 
            'message': 'Đã xóa thành công',
            'affected_nodes': btree.get_affected_nodes_data()
        })
    except Exception as e:
        print("LỖI XÓA SÁCH:", e)
        traceback.print_exc()
        return jsonify({'success': False, 'message': f'Lỗi hệ thống: {str(e)}'})

@app.route('/api/config/degree', methods=['POST'])
def update_degree():
    global btree
    try:
        data = request.json
        new_t = int(data.get('t', 3))
        if new_t < 2: return jsonify({'success': False, 'message': 't >= 2'})
        
        # Re-index
        current_books = btree.get_all_books()
        btree = BTree(t=new_t)
        for b in current_books: btree.insert(b)
        save_data()
        
        return jsonify({'success': True, 'message': f'Đã đổi sang t={new_t}'})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})

@app.route('/api/reset', methods=['POST'])
def reset_tree():
    """Xóa toàn bộ dữ liệu và khởi tạo lại cây rỗng"""
    global btree
    try:
        # Giữ nguyên bậc t hiện tại, chỉ reset dữ liệu
        current_t = btree.t
        btree = BTree(t=current_t)
        
        # Lưu đè danh sách rỗng vào file
        save_data()
        
        return jsonify({
            'success': True, 
            'message': 'Đã xóa toàn bộ dữ liệu. Cây đã được reset.'
        })
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})

if __name__ == '__main__':
    app.run(debug=True, port=5000)