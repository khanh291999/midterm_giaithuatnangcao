from flask import Flask, render_template, request, jsonify
import json
import os
import random
import math

app = Flask(__name__)

# --- CONFIGURATION ---
DATA_FILE = 'books_data.json'

# --- 0. DATA GENERATOR ---
LIBRARY_DATA = {
    "prefixes": ["Giáo trình", "Nhập môn", "Kỹ thuật", "Lập trình", "Tư duy", "Nghệ thuật", "Lịch sử", "Phân tích"],
    "subjects": ["Python", "C++", "Trí tuệ nhân tạo", "Blockchain", "Triết học", "Kinh tế vĩ mô", "Marketing", "IoT", "Dữ liệu lớn"],
    "suffixes": ["Căn bản", "Nâng cao", "Cho người mới", "Toàn tập", "Ứng dụng", "Trong 24 giờ", "Thực chiến"],
    "authors_last": ["Nguyễn", "Trần", "Lê", "Phạm", "Hoàng", "Huỳnh", "Phan", "Vũ", "Đặng", "Bùi"],
    "authors_first": ["Văn An", "Thị Bình", "Quốc Cường", "Minh Đức", "Thanh Hà", "Bảo Khánh", "Trọng Nghĩa", "Hoàng Nam", "Tú Linh"]
}

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
                self.capture_state(f"✅ <b>TÌM THẤY:</b> Khóa <b>{ma_sach}</b>.", highlight_nodes=node)
                return node.keys[i]
            if node.leaf:
                self.capture_state(f"❌ <b>Kết thúc:</b> Không tìm thấy.", highlight_nodes=node)
                return None
            
            direction = ""
            if i == 0: direction = f"nhỏ hơn {node.keys[0].ma_sach}"
            elif i == len(node.keys): direction = f"lớn hơn {node.keys[-1].ma_sach}"
            else: direction = f"giữa {node.keys[i-1].ma_sach} và {node.keys[i].ma_sach}"

            self.capture_state(f"⬇️ <b>Đi xuống:</b> Vì {ma_sach} {direction}, xuống nhánh {i}.", highlight_nodes=[node, node.children[i]])
            node = node.children[i]
            step_count += 1

    # --- RANGE SEARCH ---
    def search_range_with_animation(self, min_val, max_val):
        self.steps_log = []
        results = []
        min_val = str(min_val).strip()
        max_val = str(max_val).strip()
        
        self.capture_state(f"🔍 <b>Range Search:</b> Tìm từ <b>{min_val}</b> đến <b>{max_val}</b>.")
        self._search_range_recursive(self.root, min_val, max_val, results)
        
        if results:
            ids = [b.ma_sach for b in results]
            display_ids = ', '.join(ids) if len(ids) < 5 else f"{', '.join(ids[:5])}..."
            self.capture_state(f"✅ <b>Hoàn tất:</b> Thấy {len(results)} cuốn.<br>IDs: {display_ids}", highlight_nodes=self.root)
        else:
            self.capture_state(f"❌ <b>Hoàn tất:</b> Không có dữ liệu.")
        return results

    def _search_range_recursive(self, node, min_val, max_val, results):
        i = 0
        while i < len(node.keys) and node.keys[i].ma_sach < min_val: i += 1
        
        highlight_candidates = [k.ma_sach for k in node.keys if min_val <= k.ma_sach <= max_val]
        if highlight_candidates:
             self.capture_state(f"👀 <b>Quét Node:</b> Ứng viên {highlight_candidates}", highlight_nodes=[node])
        
        while i < len(node.keys):
            if node.keys[i].ma_sach > max_val:
                if not node.leaf: self._search_range_recursive(node.children[i], min_val, max_val, results)
                return
            if not node.leaf: self._search_range_recursive(node.children[i], min_val, max_val, results)
            curr_key = node.keys[i].ma_sach
            if min_val <= curr_key <= max_val: results.append(node.keys[i])
            i += 1
        if not node.leaf: self._search_range_recursive(node.children[i], min_val, max_val, results)

    # --- INSERT ---
    def insert(self, book):
        self.steps_log = []
        self.affected_nodes = set()
        if self.search(book.ma_sach): return 

        self.capture_state(f"🚀 <b>Thêm mới:</b> Chèn {book.ten_sach} ({book.ma_sach}).")
        
        result = self._insert_recursive(self.root, book)
        
        if result:
            median_key, new_child = result
            new_root = BTreeNode(leaf=False)
            new_root.keys = [median_key]
            new_root.children = [self.root, new_child]
            self.root = new_root
            self.capture_state(f"🌳 <b>Tách Gốc:</b> Gốc cũ tách đôi. Gốc mới chứa <b>{median_key.ma_sach}</b>.", [self.root, self.root.children[0], new_child])
        else:
            self.capture_state(f"🏁 <b>Hoàn tất:</b> Cây ổn định.", [self.root])

    def _insert_recursive(self, node, book):
        i = 0
        while i < len(node.keys) and book.ma_sach > node.keys[i].ma_sach: i += 1
            
        if node.leaf:
            node.keys.insert(i, book) 
            self.affected_nodes.add(node)
            self.capture_state(f"📥 <b>Chèn vào Lá:</b> Đặt <b>{book.ma_sach}</b> vào vị trí {i}.", [node])
            
            if len(node.keys) > self.max_keys:
                self.capture_state(f"⚠️ <b>Tràn (Overflow):</b> {len(node.keys)} khóa (Max={self.max_keys}). Tách node...", [node])
                return self._split_node(node)
            return None
        else:
            # --- LOGIC MỚI: MÔ PHỎNG TÌM ĐƯỜNG ---
            direction = ""
            if i == 0: direction = f"nhỏ hơn {node.keys[0].ma_sach}"
            elif i == len(node.keys): direction = f"lớn hơn {node.keys[-1].ma_sach}"
            else: direction = f"giữa {node.keys[i-1].ma_sach} và {node.keys[i].ma_sach}"

            self.capture_state(f"⬇️ <b>Tìm vị trí:</b> {book.ma_sach} {direction} -> Xuống nhánh {i}.", highlight_nodes=[node, node.children[i]])
            # -------------------------------------

            result = self._insert_recursive(node.children[i], book)
            if result:
                median, new_child = result
                node.keys.insert(i, median)
                node.children.insert(i + 1, new_child)
                self.affected_nodes.add(node)
                self.capture_state(f"✂️ <b>Tách thành công:</b> Cha nhận khóa <b>{median.ma_sach}</b>.", [node, node.children[i], new_child])
                
                if len(node.keys) > self.max_keys:
                    self.capture_state(f"⚠️ <b>Tràn cha:</b> Cha cũng đầy. Tách tiếp.", [node])
                    return self._split_node(node)
            return None

    def _split_node(self, node):
        mid = len(node.keys) // 2
        median = node.keys[mid]
        self.capture_state(f"✨ <b>Trung vị:</b> Đẩy khóa <b>{median.ma_sach}</b> lên.", [node])

        new_node = BTreeNode(leaf=node.leaf)
        new_node.keys = node.keys[mid + 1:]
        node.keys = node.keys[:mid]
        
        if not node.leaf:
            new_node.children = node.children[mid + 1:]
            node.children = node.children[:mid + 1]
        
        self.affected_nodes.update([node, new_node])
        return median, new_node

    # --- DELETE ---
    def delete(self, ma_sach):
        self.steps_log = [] 
        self.affected_nodes = set()
        ma_sach = str(ma_sach)
        
        self.capture_state(f"🗑️ <b>Yêu cầu Xóa:</b> {ma_sach}")
        if not self.search(ma_sach): 
            self.capture_state(f"❌ Không tìm thấy.")
            return False
            
        self._delete_recursive(self.root, ma_sach)
        
        if len(self.root.keys) == 0 and not self.root.leaf:
            new_root = self.root.children[0]
            first_key = new_root.keys[0].ma_sach if new_root.keys else "..."
            self.root = new_root
            self.affected_nodes.add(self.root)
            self.capture_state(f"📉 <b>Hạ gốc:</b> Gốc rỗng. Con lên làm <b>Gốc Mới</b>.", [self.root])
        
        self.capture_state("✅ <b>Xóa hoàn tất.</b>", [self.root])
        return True

    def _delete_recursive(self, node, ma_sach):
        i = 0
        while i < len(node.keys) and ma_sach > node.keys[i].ma_sach: i += 1
        self.affected_nodes.add(node)
        
        if i < len(node.keys) and ma_sach == node.keys[i].ma_sach:
            if node.leaf:
                self.capture_state(f"🎯 <b>Xóa tại Lá:</b> Xóa trực tiếp <b>{ma_sach}</b>.", [node])
                node.keys.pop(i)
            else:
                self.capture_state(f"👑 <b>Node Trong:</b> Cần tìm người thay thế.", [node])
                if len(node.children[i].keys) > self.min_keys:
                    pred_key = self._get_predecessor(node, i)
                    node.keys[i] = pred_key
                    self.capture_state(f"🔄 <b>Thay thế (Tiền nhiệm):</b> Lấy <b>{pred_key.ma_sach}</b> lên. Xóa bản gốc.", [node])
                    self._delete_recursive(node.children[i], pred_key.ma_sach)
                    if len(node.children[i].keys) < self.min_keys: self._fix_child(node, i)
                elif len(node.children[i+1].keys) > self.min_keys:
                    succ_key = self._get_successor(node, i)
                    node.keys[i] = succ_key
                    self.capture_state(f"🔄 <b>Thay thế (Kế nhiệm):</b> Lấy <b>{succ_key.ma_sach}</b> lên. Xóa bản gốc.", [node])
                    self._delete_recursive(node.children[i+1], succ_key.ma_sach)
                    if len(node.children[i+1].keys) < self.min_keys: self._fix_child(node, i+1)
                else:
                    # --- LOGIC MỚI: XÓA TRƯỚC RỒI GỘP ---
                    child = node.children[i]
                    sibling = node.children[i+1]
                    self.capture_state(f"🔗 <b>Xóa & Gộp:</b> Xóa <b>{ma_sach}</b> khỏi cha, gộp 2 con.", [node, child, sibling])
                    
                    child.keys.extend(sibling.keys)
                    if not child.leaf: child.children.extend(sibling.children)
                    
                    node.keys.pop(i)
                    node.children.pop(i+1)
                    self.affected_nodes.update([node, child])
                    
                    self.capture_state(f"✅ <b>Gộp xong:</b> Node con mới chứa {len(child.keys)} khóa.", [child])
                    # -------------------------------------
        else:
            if node.leaf: return 
            self.capture_state(f"⬇️ <b>Đi xuống:</b> Nhánh {i}.", [node.children[i]])
            self._delete_recursive(node.children[i], ma_sach)
            if len(node.children[i].keys) < self.min_keys:
                self.capture_state(f"⚠️ <b>Thiếu hụt:</b> Con {i} thiếu khóa.", [node.children[i]])
                self._fix_child(node, i)

    def _fix_child(self, parent, i):
        if i > 0 and len(parent.children[i-1].keys) > self.min_keys:
            self._borrow_from_prev(parent, i)
        elif i < len(parent.children)-1 and len(parent.children[i+1].keys) > self.min_keys:
            self._borrow_from_next(parent, i)
        else:
            if i < len(parent.children) - 1: self._merge(parent, i)
            else: self._merge(parent, i-1)

    def _borrow_from_prev(self, parent, i):
        child = parent.children[i]
        sibling = parent.children[i-1]
        self.capture_state(f"👈 <b>Mượn Trái:</b> Cha <b>{parent.keys[i-1].ma_sach}</b> xuống, Anh <b>{sibling.keys[-1].ma_sach}</b> lên.", [parent, child, sibling])
        child.keys.insert(0, parent.keys[i-1])
        if not child.leaf: child.children.insert(0, sibling.children.pop())
        parent.keys[i-1] = sibling.keys.pop()
        self.affected_nodes.update([child, sibling, parent])

    def _borrow_from_next(self, parent, i):
        child = parent.children[i]
        sibling = parent.children[i+1]
        self.capture_state(f"👉 <b>Mượn Phải:</b> Cha <b>{parent.keys[i].ma_sach}</b> xuống, Em <b>{sibling.keys[0].ma_sach}</b> lên.", [parent, child, sibling])
        child.keys.append(parent.keys[i])
        if not child.leaf: child.children.append(sibling.children.pop(0))
        parent.keys[i] = sibling.keys.pop(0)
        self.affected_nodes.update([child, sibling, parent])

    def _merge(self, parent, i):
        child = parent.children[i]
        sibling = parent.children[i+1]
        self.capture_state(f"🔗 <b>Gộp Node:</b> Không mượn được. Gộp 2 con và khóa cha <b>{parent.keys[i].ma_sach}</b>.", [parent, child, sibling])
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

    def _get_successor(self, node, i):
        cur = node.children[i+1]
        while not cur.leaf: cur = cur.children[0]
        return cur.keys[0]

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

# --- PERSISTENCE & ROUTES ---
btree = BTree(m=5)

def save_data():
    books = btree.get_all_books()
    payload = {'config': {'m': btree.m}, 'data': [b.to_dict() for b in books]}
    with open(DATA_FILE, 'w', encoding='utf-8') as f: json.dump(payload, f, ensure_ascii=False, indent=2)

def load_data():
    global btree
    if os.path.exists(DATA_FILE):
        try:
            with open(DATA_FILE, 'r', encoding='utf-8') as f:
                content = json.load(f)
                data = content.get('data', []) if isinstance(content, dict) else content
                m_val = content.get('config', {}).get('m', 5) if isinstance(content, dict) else 5
                btree = BTree(m=m_val)
                for item in data: btree.insert(Book(item['ma_sach'], item['ten_sach'], item['tac_gia']))
            return True
        except: return False
    return False

load_data()

@app.route('/')
def index(): return render_template('index.html')

@app.route('/api/books', methods=['GET'])
def get_books(): return jsonify([b.to_dict() for b in btree.get_all_books()])

@app.route('/api/tree', methods=['GET'])
def get_tree(): return jsonify({**btree.get_tree_structure(), 'm': btree.m})

@app.route('/api/books', methods=['POST'])
def add_book():
    data = request.json
    ma = str(data.get('ma_sach')).strip()
    if btree.search(ma): return jsonify({'success': False, 'message': 'Mã trùng'})
    btree.insert(Book(ma, data.get('ten_sach'), data.get('tac_gia')))
    save_data()
    return jsonify({'success': True, 'message': 'Thêm thành công', 'steps': btree.steps_log, 'affected_nodes': btree.get_affected_nodes_data()})

@app.route('/api/books/random', methods=['POST'])
def add_random_book():
    try:
        # FORMAT BK-0000
        ma = f"BK-{random.randint(1, 9999):04d}"
        while btree.search(ma): ma = f"BK-{random.randint(1, 9999):04d}"
        ten = f"{random.choice(LIBRARY_DATA['prefixes'])} {random.choice(LIBRARY_DATA['subjects'])} {random.choice(LIBRARY_DATA['suffixes'])}"
        tac = f"{random.choice(LIBRARY_DATA['authors_last'])} {random.choice(LIBRARY_DATA['authors_first'])}"
        btree.insert(Book(ma, ten, tac))
        save_data()
        return jsonify({'success': True, 'message': f"Random: {ma}", 'steps': btree.steps_log, 'affected_nodes': btree.get_affected_nodes_data(), 'book': {'ma_sach': ma}})
    except Exception as e: return jsonify({'success': False, 'message': str(e)})

@app.route('/api/books/generate_bulk', methods=['POST'])
def generate_bulk_books():
    try:
        count = int(request.json.get('count', 10))
        added = 0
        btree.steps_log = [] 
        curr_max = 0
        for b in btree.get_all_books():
            if b.ma_sach.startswith("BK-"):
                try: curr_max = max(curr_max, int(b.ma_sach.split('-')[1]))
                except: continue
        
        start = curr_max + 1
        for i in range(count):
            ma = f"BK-{start + i:04d}"
            if btree.search(ma): continue
            ten = f"{random.choice(LIBRARY_DATA['prefixes'])} {random.choice(LIBRARY_DATA['subjects'])}"
            tac = f"{random.choice(LIBRARY_DATA['authors_last'])} {random.choice(LIBRARY_DATA['authors_first'])}"
            btree.insert(Book(ma, ten, tac))
            added += 1
        save_data()
        return jsonify({'success': True, 'message': f"Đã thêm {added} cuốn."})
    except Exception as e: return jsonify({'success': False, 'message': str(e)})

@app.route('/api/books/search/<ma>', methods=['GET'])
def search_book(ma):
    f = btree.search_with_animation(ma)
    return jsonify({'success': bool(f), 'book': f.to_dict() if f else None, 'steps': btree.steps_log})

@app.route('/api/books/range', methods=['POST'])
def search_range():
    d = request.json
    f = btree.search_range_with_animation(d.get('min_key'), d.get('max_key'))
    return jsonify({'success': True, 'message': f"Tìm thấy {len(f)}.", 'books': [b.to_dict() for b in f], 'steps': btree.steps_log})

@app.route('/api/books/<ma>', methods=['DELETE'])
def delete_book(ma):
    if not btree.search(ma): return jsonify({'success': False, 'message': 'Không thấy'})
    btree.delete(ma)
    save_data()
    return jsonify({'success': True, 'message': 'Đã xóa', 'steps': btree.steps_log, 'affected_nodes': btree.get_affected_nodes_data()})

@app.route('/api/config/degree', methods=['POST'])
def update_degree():
    global btree
    m = int(request.json.get('m', 5))
    if m < 3: return jsonify({'success': False, 'message': 'm >= 3'})
    books = btree.get_all_books()
    btree = BTree(m=m)
    for b in books: btree.insert(b)
    save_data()
    return jsonify({'success': True, 'message': f'Đã đổi m={m}'})

@app.route('/api/reset', methods=['POST'])
def reset():
    global btree
    m = btree.m
    btree = BTree(m=m)
    save_data()
    return jsonify({'success': True, 'message': 'Đã reset'})

if __name__ == '__main__':
    app.run(debug=True, port=5000)