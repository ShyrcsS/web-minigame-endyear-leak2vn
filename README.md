# Leak2VN End-Year Event 2025 (MVP)

## Chạy nhanh
Cách dễ nhất trên Windows (có Python):

```powershell
cd "c:\Users\kusan\Desktop\Genshin Leak2VN Event End 2025"
python -m http.server 5173
```

Mở:
- http://localhost:5173

> Vì code dùng `fetch('./data/questions.json')`, nên **không** nên mở bằng `file://` (một số browser sẽ chặn fetch). Dùng http server là ổn.

## Data câu hỏi lore
- File: `data/questions.json`
- Format 1 câu:

```json
{
  "id": "nk-001",
  "question": "Câu hỏi...",
  "choices": ["A", "B", "C", "D"],
  "correctIndex": 0,
  "difficulty": 1,
  "points": 1,
  "tags": ["nod-krai"]
}
```

## Leaderboard
MVP lưu bảng điểm bằng `localStorage` trong browser (chỉ trên máy người chạy).
Nếu bạn muốn leaderboard chung cho cả group, mình sẽ thêm backend (Node/Express + SQLite) hoặc Google Sheets.
