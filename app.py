from flask import Flask, render_template, request, jsonify
import json
import os
import random
import math

app = Flask(__name__)

# Config files
DATA_FILE = 'books_data.json'
SAMPLE_FILE = 'sample_books.json'

# --- 1. CLASS DEFINITIONS ---

class Book:
    def __init__(self, ma_sach, ten_sach, tac_gia):
        self.ma_sach = str(ma_sach).strip() 
        self.ten_sach = ten_sach
        self.tac_gia = tac_gia
    
    def to_dict(self):
        return {'ma_sach': self.ma_sach, 'ten_sach': self.ten_sach, 'tac_gia': self.tac_gia}
    
    def __lt__(self, other): return self.ma_sach < (other.ma_sach if isinstance(other, Book) else str(other))
    def __gt__(self, other): return self.ma_sach > (other.ma_sach if isinstance(other, Book) else str(other))
    def __eq__(self, other): return self.ma_sach == (other.ma_sach if isinstance(other, Book) else str(other))
    def __le__(self, other): return self.ma_sach <= (other.ma_sach if isinstance(other, Book) else str(other))
    def __ge__(self, other): return self.ma_sach >= (other.ma_sach if isinstance(other, Book) else str(other))


class BTreeNode:
    def __init__(self, leaf=True):
        self.keys = []
        self.children = []
        self.leaf = leaf
    
    def to_dict(self):
        return {
            'keys': [k.to_dict() for k in self.keys],
            'leaf': self.leaf,
            'children': [child.to_dict() for child in self.children]
        }


class BTree:
    def __init__(self, m=5):
        self.root = BTreeNode(leaf=True)
        self.m = m
        self.max_keys = m - 1
        self.min_keys = math.ceil(m / 2) - 1
        self.affected_nodes = set()
        self.steps_log = [] 

    def capture_state(self, message, highlight_nodes=None):
        snapshot = {
            'tree': self.root.to_dict(),
            'message': message,
            'highlights': []
        }
        if highlight_nodes:
            if isinstance(highlight_nodes, list):
                snapshot['highlights'] = [[k.ma_sach for k in n.keys] for n in highlight_nodes]
            elif isinstance(highlight_nodes, BTreeNode):
                snapshot['highlights'] = [[k.ma_sach for k in highlight_nodes.keys]]
        self.steps_log.append(snapshot)

    # --- SEARCH ---
    def search(self, ma_sach, node=None):
        if node is None: node = self.root
        i = 0
        ma_sach = str(ma_sach)
        while i < len(node.keys) and ma_sach > node.keys[i].ma_sach: i += 1
        if i < len(node.keys) and ma_sach == node.keys[i].ma_sach: return node.keys[i]
        if node.leaf: return None
        return self.search(ma_sach, node.children[i])

    def search_with_animation(self, ma_sach):
        self.steps_log = [] 
        node = self.root
        ma_sach = str(ma_sach)
        step_count = 1
        while True:
            keys_str = ", ".join([k.ma_sach for k in node.keys])
            self.capture_state(f"🔍 <b>Bước {step_count}:</b> Xét Node <code>[{keys_str}]</code>.", highlight_nodes=node)
            i = 0
            while i < len(node.keys) and ma_sach > node.keys[i].ma_sach: i += 1
            if i < len(node.keys) and ma_sach == node.keys[i].ma_sach:
                self.capture_state(f"✅ <b>TÌM THẤY:</b> <b>{ma_sach}</b>.", highlight_nodes=node)
                return node.keys[i]
            if node.leaf:
                self.capture_state(f"❌ <b>Kết thúc:</b> Không tìm thấy.", highlight_nodes=node)
                return None
            
            direction = ""
            if i == 0: direction = f"nhỏ hơn {node.keys[0].ma_sach}"
            elif i == len(node.keys): direction = f"lớn hơn {node.keys[-1].ma_sach}"
            else: direction = f"giữa {node.keys[i-1].ma_sach} và {node.keys[i].ma_sach}"

            self.capture_state(f"⬇️ <b>Đi xuống:</b> Vì {ma_sach} {direction}, xuống nhánh {i+1}.", highlight_nodes=[node, node.children[i]])
            node = node.children[i]
            step_count += 1

    # --- INSERT ---
    def insert(self, book):
        self.steps_log = []
        self.affected_nodes = set()
        if self.search(book.ma_sach):
            self.capture_state(f"⚠️ Mã {book.ma_sach} đã tồn tại.")
            return

        self.capture_state(f"🚀 <b>Bắt đầu:</b> Chuẩn bị thêm sách {book.ten_sach} ({book.ma_sach}).")
        
        result = self._insert_recursive(self.root, book)
        
        if result:
            median_key, new_child = result
            new_root = BTreeNode(leaf=False)
            new_root.keys = [median_key]
            new_root.children = [self.root, new_child]
            self.root = new_root
            
            msg = f"🌳 <b>Tách Gốc:</b><br>1. Gốc cũ tách đôi.<br>2. Gốc mới chứa <b>{median_key.ma_sach}</b>."
            self.capture_state(msg, [self.root, self.root.children[0], new_child])
        else:
            self.capture_state(f"🏁 <b>Hoàn tất:</b> Cây đã ổn định.", [self.root])

    def _insert_recursive(self, node, book):
        i = 0
        while i < len(node.keys) and book.ma_sach > node.keys[i].ma_sach: i += 1
            
        if node.leaf:
            # Action First
            node.keys.insert(i, book) 
            self.affected_nodes.add(node)
            
            self.capture_state(f"📥 <b>Chèn vào lá:</b> Đã đặt <b>{book.ma_sach}</b> vào vị trí index {i}.", [node])
            
            if len(node.keys) > self.max_keys:
                self.capture_state(f"⚠️ <b>Tràn node:</b> Số khóa là {len(node.keys)} (Max={self.max_keys}). Chuẩn bị tách...", [node])
                return self._split_node(node)
            return None
        else:
            result = self._insert_recursive(node.children[i], book)
            
            if result:
                median, new_child = result
                
                # Connect First
                node.keys.insert(i, median)
                node.children.insert(i + 1, new_child)
                self.affected_nodes.add(node)
                
                # Capture Later
                msg = f"✂️ <b>Tách thành công:</b><br>- Node con đã tách làm đôi.<br>- Cha nhận khóa <b>{median.ma_sach}</b>."
                self.capture_state(msg, [node, node.children[i], new_child])
                
                if len(node.keys) > self.max_keys:
                    self.capture_state(f"⚠️ <b>Tràn cha:</b> Node cha cũng bị đầy. Tiếp tục tách lên trên.", [node])
                    return self._split_node(node)
            return None

    def _split_node(self, node):
        mid = len(node.keys) // 2
        median = node.keys[mid]
        
        new_node = BTreeNode(leaf=node.leaf)
        new_node.keys = node.keys[mid + 1:]
        node.keys = node.keys[:mid]
        
        if not node.leaf:
            new_node.children = node.children[mid + 1:]
            node.children = node.children[:mid + 1]
        
        self.affected_nodes.update([node, new_node])
        
        return median, new_node

    # --- DELETE (BASIC STRATEGY WITH IMPROVED HIGHLIGHT) ---
    def delete(self, ma_sach):
        self.steps_log = [] 
        self.affected_nodes = set()
        ma_sach = str(ma_sach)
        
        self.capture_state(f"🗑️ <b>Yêu cầu xóa:</b> {ma_sach}")
        if not self.search(ma_sach): 
            self.capture_state(f"❌ Không tìm thấy sách.")
            return False
            
        self._delete_recursive(self.root, ma_sach)
        
        if len(self.root.keys) == 0 and not self.root.leaf:
            self.root = self.root.children[0]
            self.affected_nodes.add(self.root)
            self.capture_state("📉 <b>Hạ gốc:</b> Gốc cũ rỗng, hạ chiều cao cây.", [self.root])
        
        self.capture_state("✅ <b>Hoàn tất xóa.</b>", [self.root])
        return True

    def _delete_recursive(self, node, ma_sach):
        i = 0
        while i < len(node.keys) and ma_sach > node.keys[i].ma_sach: i += 1
        
        self.affected_nodes.add(node)
        
        if i < len(node.keys) and ma_sach == node.keys[i].ma_sach:
            if node.leaf:
                self.capture_state(f"🎯 <b>Xóa tại lá:</b> Node là lá, xóa trực tiếp <b>{ma_sach}</b>.", [node])
                node.keys.pop(i)
            else:
                self.capture_state(f"🎯 <b>Tìm thấy (Node trong):</b> Không xóa ngay. Tìm người thế mạng.", [node])
                pred = self._get_predecessor(node, i)
                self.capture_state(f"🔄 <b>Thay thế:</b> Lấy tiền nhiệm <b>{pred.ma_sach}</b> đè lên <b>{ma_sach}</b>.", [node])
                node.keys[i] = pred
                self._delete_recursive(node.children[i], pred.ma_sach)
                
                # Check Underflow
                if len(node.children[i].keys) < self.min_keys:
                    # --- FIX: HIGHLIGHT NODE CON BỊ THIẾU ---
                    self.capture_state(f"⚠️ <b>Thiếu hụt (Underflow):</b> Con index {i} chỉ còn {len(node.children[i].keys)} khóa (Min={self.min_keys}).", [node.children[i]])
                    self._fix_child(node, i)

        else:
            if node.leaf: return 

            self.capture_state(f"⬇️ <b>Đi xuống:</b> Nhánh {i}.", [node.children[i]])
            self._delete_recursive(node.children[i], ma_sach)
            
            # Check Underflow after return
            if len(node.children[i].keys) < self.min_keys:
                # --- FIX: HIGHLIGHT NODE CON BỊ THIẾU ---
                self.capture_state(f"⚠️ <b>Thiếu hụt (Underflow):</b> Sau khi xóa, con index {i} bị thiếu khóa.", [node.children[i]])
                self._fix_child(node, i)

    def _fix_child(self, parent, i):
        if i > 0 and len(parent.children[i-1].keys) > self.min_keys:
            self._borrow_from_prev(parent, i)
        elif i < len(parent.children)-1 and len(parent.children[i+1].keys) > self.min_keys:
            self._borrow_from_next(parent, i)
        else:
            if i < len(parent.children) - 1:
                self._merge(parent, i)
            else:
                self._merge(parent, i-1)

    def _borrow_from_prev(self, parent, i):
        child = parent.children[i]
        sibling = parent.children[i-1]
        msg = f"👈 <b>Mượn Trái (Xoay Phải):</b><br>1. Cha <b>{parent.keys[i-1].ma_sach}</b> xuống con.<br>2. Anh <b>{sibling.keys[-1].ma_sach}</b> lên thay cha."
        self.capture_state(msg, [parent, child, sibling])
        
        child.keys.insert(0, parent.keys[i-1])
        if not child.leaf: child.children.insert(0, sibling.children.pop())
        parent.keys[i-1] = sibling.keys.pop()
        self.affected_nodes.update([child, sibling, parent])

    def _borrow_from_next(self, parent, i):
        child = parent.children[i]
        sibling = parent.children[i+1]
        msg = f"👉 <b>Mượn Phải (Xoay Trái):</b><br>1. Cha <b>{parent.keys[i].ma_sach}</b> xuống con.<br>2. Em <b>{sibling.keys[0].ma_sach}</b> lên thay cha."
        self.capture_state(msg, [parent, child, sibling])
        
        child.keys.append(parent.keys[i])
        if not child.leaf: child.children.append(sibling.children.pop(0))
        parent.keys[i] = sibling.keys.pop(0)
        self.affected_nodes.update([child, sibling, parent])

    def _merge(self, parent, i):
        child = parent.children[i]
        sibling = parent.children[i+1]
        self.capture_state(f"🔗 <b>Gộp Node:</b> Không thể mượn. Gộp 2 con và khóa cha <b>{parent.keys[i].ma_sach}</b>.", [parent, child, sibling])
        
        child.keys.append(parent.keys[i])
        child.keys.extend(sibling.keys)
        if not child.leaf: child.children.extend(sibling.children)
        parent.keys.pop(i)
        parent.children.pop(i+1)
        self.affected_nodes.update([child, parent])

    def _get_predecessor(self, node, i):
        cur = node.children[i]
        while not cur.leaf: cur = cur.children[-1]
        return cur.keys[-1]

    # --- UTILS ---
    def get_all_books(self): return self._inorder(self.root)
    def _inorder(self, node):
        res = []
        if not node: return res
        for i in range(len(node.keys)):
            if not node.leaf: res.extend(self._inorder(node.children[i]))
            res.append(node.keys[i])
        if not node.leaf: res.extend(self._inorder(node.children[-1]))
        return res
    def get_tree_structure(self): return self.root.to_dict()
    def get_affected_nodes_data(self): return [[k.ma_sach for k in n.keys] for n in self.affected_nodes]

# --- 2. GLOBAL & UTILS ---
btree = BTree(m=5)

def save_data():
    books = btree.get_all_books()
    payload = {'config': {'m': btree.m}, 'data': [b.to_dict() for b in books]}
    with open(DATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)

def load_data():
    global btree
    if os.path.exists(DATA_FILE):
        try:
            with open(DATA_FILE, 'r', encoding='utf-8') as f:
                content = json.load(f)
                if isinstance(content, list):
                    data, m_val = content, 5
                else:
                    data = content.get('data', [])
                    m_val = content.get('config', {}).get('m', 5)
                btree = BTree(m=m_val)
                for item in data:
                    btree.insert(Book(item['ma_sach'], item['ten_sach'], item['tac_gia']))
            return True
        except: return False
    return False

load_data()

# --- 3. ROUTES ---
@app.route('/')
def index(): return render_template('index.html')

@app.route('/api/books', methods=['GET'])
def get_books(): return jsonify([b.to_dict() for b in btree.get_all_books()])

@app.route('/api/tree', methods=['GET'])
def get_tree():
    data = btree.get_tree_structure()
    data['m'] = btree.m
    return jsonify(data)

@app.route('/api/books', methods=['POST'])
def add_book():
    data = request.json
    ma = str(data.get('ma_sach')).strip()
    if btree.search(ma): return jsonify({'success': False, 'message': 'Mã đã tồn tại'})
    btree.insert(Book(ma, data.get('ten_sach'), data.get('tac_gia')))
    save_data()
    return jsonify({'success': True, 'message': 'Thêm thành công', 'steps': btree.steps_log, 'affected_nodes': btree.get_affected_nodes_data()})

@app.route('/api/books/random', methods=['POST'])
def add_random_book():
    if not os.path.exists(SAMPLE_FILE): return jsonify({'success': False, 'message': 'Thiếu file sample'})
    try:
        with open(SAMPLE_FILE, 'r', encoding='utf-8') as f: samples = json.load(f)
        cur = {b.ma_sach for b in btree.get_all_books()}
        avail = [s for s in samples if str(s['ma_sach']) not in cur]
        if not avail: return jsonify({'success': False, 'message': 'Hết sách mẫu'})
        c = random.choice(avail)
        book = Book(c['ma_sach'], c['ten_sach'], c['tac_gia'])
        btree.insert(book)
        save_data()
        return jsonify({'success': True, 'message': f"Đã thêm: {book.ten_sach}", 'steps': btree.steps_log, 'affected_nodes': btree.get_affected_nodes_data()})
    except Exception as e: return jsonify({'success': False, 'message': str(e)})

@app.route('/api/books/search/<ma>', methods=['GET'])
def search_book(ma):
    f = btree.search_with_animation(ma)
    return jsonify({'success': bool(f), 'book': f.to_dict() if f else None, 'steps': btree.steps_log})

@app.route('/api/books/<ma>', methods=['DELETE'])
def delete_book(ma):
    if not btree.search(ma): return jsonify({'success': False, 'message': 'Không tìm thấy'})
    btree.delete(ma)
    save_data()
    return jsonify({'success': True, 'message': 'Đã xóa', 'steps': btree.steps_log, 'affected_nodes': btree.get_affected_nodes_data()})

@app.route('/api/config/degree', methods=['POST'])
def update_degree():
    global btree
    try:
        m = int(request.json.get('m', 5))
        if m < 3: return jsonify({'success': False, 'message': 'm phải >= 3'})
        books = btree.get_all_books()
        btree = BTree(m=m)
        for b in books: btree.insert(b)
        save_data()
        return jsonify({'success': True, 'message': f'Đã đổi m={m}'})
    except: return jsonify({'success': False, 'message': 'Lỗi'})

@app.route('/api/reset', methods=['POST'])
def reset_tree():
    global btree
    current_m = btree.m
    btree = BTree(m=current_m)
    save_data()
    return jsonify({'success': True, 'message': 'Đã reset'})

if __name__ == '__main__':
    app.run(debug=True, port=5000)