"""
Flask Web App cho Hệ thống quản lý sách B-Tree
"""

from flask import Flask, render_template, request, jsonify
import json
import os

app = Flask(__name__)

# File để lưu dữ liệu
DATA_FILE = 'books_data.json'


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
    
    def __lt__(self, other):
        return self.ma_sach < other.ma_sach
    
    def __le__(self, other):
        return self.ma_sach <= other.ma_sach
    
    def __gt__(self, other):
        return self.ma_sach > other.ma_sach
    
    def __ge__(self, other):
        return self.ma_sach >= other.ma_sach
    
    def __eq__(self, other):
        return self.ma_sach == other.ma_sach


class BTreeNode:
    """Lớp đại diện cho một node trong B-Tree"""
    def __init__(self, leaf=True):
        self.keys = []
        self.children = []
        self.leaf = leaf
    
    def to_dict(self):
        return {
            'keys': [book.ma_sach for book in self.keys],
            'leaf': self.leaf,
            'children': [child.to_dict() for child in self.children]
        }


class BTree:
    """Lớp B-Tree để quản lý sách"""
    def __init__(self, t=3):
        self.root = BTreeNode()
        self.t = t
    
    def search(self, ma_sach, node=None):
        """Tìm kiếm sách theo mã"""
        if node is None:
            node = self.root
        
        i = 0
        while i < len(node.keys) and ma_sach > node.keys[i].ma_sach:
            i += 1
        
        if i < len(node.keys) and ma_sach == node.keys[i].ma_sach:
            return node.keys[i]
        
        if node.leaf:
            return None
        
        return self.search(ma_sach, node.children[i])
    
    def insert(self, book):
        """Thêm sách vào B-Tree"""
        root = self.root
        
        if len(root.keys) >= (2 * self.t - 1):
            new_root = BTreeNode(leaf=False)
            new_root.children.append(self.root)
            self._split_child(new_root, 0)
            self.root = new_root
        
        self._insert_non_full(self.root, book)
    
    def _insert_non_full(self, node, book):
        """Chèn vào node chưa đầy"""
        i = len(node.keys) - 1
        
        if node.leaf:
            node.keys.append(None)
            while i >= 0 and book < node.keys[i]:
                node.keys[i + 1] = node.keys[i]
                i -= 1
            node.keys[i + 1] = book
        else:
            while i >= 0 and book < node.keys[i]:
                i -= 1
            i += 1
            
            if len(node.children[i].keys) >= (2 * self.t - 1):
                self._split_child(node, i)
                if book > node.keys[i]:
                    i += 1
            
            self._insert_non_full(node.children[i], book)
    
    def _split_child(self, parent, index):
        """Chia child tại vị trí index của parent"""
        t = self.t
        full_child = parent.children[index]
        new_child = BTreeNode(leaf=full_child.leaf)
        
        mid_index = t - 1
        
        new_child.keys = full_child.keys[mid_index + 1:]
        full_child.keys = full_child.keys[:mid_index]
        
        if not full_child.leaf:
            new_child.children = full_child.children[mid_index + 1:]
            full_child.children = full_child.children[:mid_index + 1]
        
        parent.keys.insert(index, full_child.keys[mid_index] if mid_index < len(full_child.keys) else new_child.keys[0])
        
        if mid_index < len(full_child.keys):
            full_child.keys.pop(mid_index)
        
        parent.children.insert(index + 1, new_child)
    
    def delete(self, ma_sach):
        """Xóa sách theo mã"""
        self._delete(self.root, ma_sach)
        
        if len(self.root.keys) == 0:
            if not self.root.leaf and len(self.root.children) > 0:
                self.root = self.root.children[0]
    
    def _delete(self, node, ma_sach):
        """Xóa sách khỏi node"""
        i = 0
        while i < len(node.keys) and ma_sach > node.keys[i].ma_sach:
            i += 1
        
        if i < len(node.keys) and ma_sach == node.keys[i].ma_sach:
            if node.leaf:
                node.keys.pop(i)
            else:
                self._delete_internal_node(node, ma_sach, i)
        elif not node.leaf:
            is_in_subtree = (i == len(node.keys))
            
            if len(node.children[i].keys) < self.t:
                self._fill(node, i)
            
            if is_in_subtree and i > len(node.keys):
                self._delete(node.children[i - 1], ma_sach)
            else:
                self._delete(node.children[i], ma_sach)
    
    def _delete_internal_node(self, node, ma_sach, i):
        """Xóa key từ node nội bộ"""
        if len(node.children[i].keys) >= self.t:
            predecessor = self._get_predecessor(node, i)
            node.keys[i] = predecessor
            self._delete(node.children[i], predecessor.ma_sach)
        elif len(node.children[i + 1].keys) >= self.t:
            successor = self._get_successor(node, i)
            node.keys[i] = successor
            self._delete(node.children[i + 1], successor.ma_sach)
        else:
            self._merge(node, i)
            self._delete(node.children[i], ma_sach)
    
    def _get_predecessor(self, node, i):
        """Lấy predecessor của key tại vị trí i"""
        current = node.children[i]
        while not current.leaf:
            current = current.children[-1]
        return current.keys[-1]
    
    def _get_successor(self, node, i):
        """Lấy successor của key tại vị trí i"""
        current = node.children[i + 1]
        while not current.leaf:
            current = current.children[0]
        return current.keys[0]
    
    def _fill(self, node, i):
        """Đảm bảo child tại vị trí i có đủ keys"""
        if i != 0 and len(node.children[i - 1].keys) >= self.t:
            self._borrow_from_prev(node, i)
        elif i != len(node.children) - 1 and len(node.children[i + 1].keys) >= self.t:
            self._borrow_from_next(node, i)
        else:
            if i != len(node.children) - 1:
                self._merge(node, i)
            else:
                self._merge(node, i - 1)
    
    def _borrow_from_prev(self, node, child_index):
        """Mượn key từ sibling trước"""
        child = node.children[child_index]
        sibling = node.children[child_index - 1]
        
        child.keys.insert(0, node.keys[child_index - 1])
        node.keys[child_index - 1] = sibling.keys.pop()
        
        if not child.leaf:
            child.children.insert(0, sibling.children.pop())
    
    def _borrow_from_next(self, node, child_index):
        """Mượn key từ sibling sau"""
        child = node.children[child_index]
        sibling = node.children[child_index + 1]
        
        child.keys.append(node.keys[child_index])
        node.keys[child_index] = sibling.keys.pop(0)
        
        if not child.leaf:
            child.children.append(sibling.children.pop(0))
    
    def _merge(self, node, i):
        """Merge child với sibling"""
        child = node.children[i]
        sibling = node.children[i + 1]
        
        child.keys.append(node.keys[i])
        child.keys.extend(sibling.keys)
        
        if not child.leaf:
            child.children.extend(sibling.children)
        
        node.keys.pop(i)
        node.children.pop(i + 1)
    
    def get_all_books(self):
        """Lấy tất cả sách theo thứ tự"""
        return self._inorder_traversal(self.root)
    
    def _inorder_traversal(self, node):
        """Duyệt cây theo thứ tự"""
        result = []
        if node is None:
            return result
        
        if node.leaf:
            return node.keys
        
        for i in range(len(node.keys)):
            result.extend(self._inorder_traversal(node.children[i]))
            result.append(node.keys[i])
        
        if len(node.children) > len(node.keys):
            result.extend(self._inorder_traversal(node.children[-1]))
        
        return result
    
    def get_tree_structure(self):
        """Lấy cấu trúc cây để hiển thị"""
        if self.root is None:
            return None
        return self.root.to_dict()


# Khởi tạo B-Tree toàn cục
btree = BTree(t=3)

# Hàm lưu dữ liệu vào file
def save_data():
    """Lưu tất cả sách vào file JSON"""
    books = btree.get_all_books()
    data = [book.to_dict() for book in books]
    with open(DATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

# Hàm load dữ liệu từ file
def load_data():
    """Load sách từ file JSON"""
    if os.path.exists(DATA_FILE):
        try:
            with open(DATA_FILE, 'r', encoding='utf-8') as f:
                data = json.load(f)
                for item in data:
                    book = Book(item['ma_sach'], item['ten_sach'], item['tac_gia'])
                    btree.insert(book)
                return True
        except:
            return False
    return False

# Load dữ liệu mẫu
def load_sample_data():
    books_data = [
        ("B005", "Lập trình Python", "Nguyễn Văn A"),
        ("B002", "Cấu trúc dữ liệu", "Trần Thị B"),
        ("B008", "Thuật toán nâng cao", "Lê Văn C"),
        ("B001", "Trí tuệ nhân tạo", "Phạm Thị D"),
        ("B010", "Machine Learning", "Hoàng Văn E"),
        ("B003", "Deep Learning", "Vũ Thị F"),
        ("B007", "Data Science", "Đỗ Văn G"),
        ("B004", "Web Development", "Ngô Thị H"),
        ("B009", "Mobile Apps", "Bùi Văn I"),
        ("B006", "Database Systems", "Đinh Thị K"),
    ]
    
    for ma, ten, tac_gia in books_data:
        book = Book(ma, ten, tac_gia)
        btree.insert(book)
    save_data()

# Thử load dữ liệu từ file, nếu không có thì load dữ liệu mẫu
if not load_data():
    load_sample_data()


# Routes
@app.route('/')
def index():
    return render_template('index.html')


@app.route('/api/books', methods=['GET'])
def get_books():
    """Lấy danh sách tất cả sách"""
    books = btree.get_all_books()
    return jsonify([book.to_dict() for book in books])


@app.route('/api/books/search/<ma_sach>', methods=['GET'])
def search_book(ma_sach):
    """Tìm sách theo mã"""
    book = btree.search(ma_sach)
    if book:
        return jsonify({'success': True, 'book': book.to_dict()})
    return jsonify({'success': False, 'message': 'Không tìm thấy sách'})


@app.route('/api/books', methods=['POST'])
def add_book():
    """Thêm sách mới"""
    data = request.json
    ma_sach = data.get('ma_sach')
    ten_sach = data.get('ten_sach')
    tac_gia = data.get('tac_gia')
    
    if not all([ma_sach, ten_sach, tac_gia]):
        return jsonify({'success': False, 'message': 'Thiếu thông tin sách'})
    
    if btree.search(ma_sach):
        return jsonify({'success': False, 'message': 'Mã sách đã tồn tại'})
    
    book = Book(ma_sach, ten_sach, tac_gia)
    btree.insert(book)
    save_data()  # Lưu vào file
    
    return jsonify({'success': True, 'message': 'Thêm sách thành công'})


@app.route('/api/books/<ma_sach>', methods=['DELETE'])
def delete_book(ma_sach):
    """Xóa sách"""
    book = btree.search(ma_sach)
    if not book:
        return jsonify({'success': False, 'message': 'Không tìm thấy sách'})
    
    btree.delete(ma_sach)
    save_data()  # Lưu vào file
    return jsonify({'success': True, 'message': 'Xóa sách thành công'})


@app.route('/api/tree', methods=['GET'])
def get_tree():
    """Lấy cấu trúc cây"""
    return jsonify(btree.get_tree_structure())


if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
