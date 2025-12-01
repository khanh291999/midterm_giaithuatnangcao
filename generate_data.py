# File: generate_sample.py
import json
import random

SAMPLE_FILE = 'sample_books.json'
TOTAL_BOOKS = 100

titles_prefix = ["Lập trình", "Giáo trình", "Nhập môn", "Thành thạo", "Tối ưu hóa", "Tìm hiểu", "Bí kíp", "Nghệ thuật"]
topics = ["Python", "Java", "C#", "C++", "JavaScript", "ReactJS", "NodeJS", "Machine Learning", "Deep Learning", "Data Science", "An ninh mạng", "Docker"]
titles_suffix = ["Cơ bản", "Nâng cao", "Toàn tập", "Thực chiến", "Hiện đại", "Version 2.0", "Pro"]
last_names = ["Nguyễn", "Trần", "Lê", "Phạm", "Hoàng", "Huỳnh", "Phan", "Vũ", "Võ", "Đặng"]
middle_names = ["Văn", "Thị", "Hữu", "Đức", "Thành", "Ngọc", "Minh", "Quốc", "Gia", "Xuân"]
first_names = ["An", "Bình", "Cường", "Dũng", "Giang", "Hải", "Hùng", "Khánh", "Long", "Nam", "Phúc", "Quân", "Sơn"]

def generate_samples():
    books = []
    for i in range(1, TOTAL_BOOKS + 1):
        ma_sach = f"B{i:03d}" # B001, B002...
        ten_sach = f"{random.choice(titles_prefix)} {random.choice(topics)} {random.choice(titles_suffix)}"
        tac_gia = f"{random.choice(last_names)} {random.choice(middle_names)} {random.choice(first_names)}"
        books.append({"ma_sach": ma_sach, "ten_sach": ten_sach, "tac_gia": tac_gia})
    
    with open(SAMPLE_FILE, 'w', encoding='utf-8') as f:
        json.dump(books, f, ensure_ascii=False, indent=2)
    print(f"Đã tạo {TOTAL_BOOKS} sách mẫu vào '{SAMPLE_FILE}'")

if __name__ == "__main__":
    generate_samples()