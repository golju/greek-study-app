# Greek Study — план реализации (локальный desktop MVP)

## Выбор стека

**Python 3.10+ + PySide6 (Essentials) + SQLite + Pillow + pytesseract (Tesseract `ell` + `eng`)**

- **macOS-сборка**: один виртуальный env, `pip install -e .`, при необходимости `brew install tesseract tesseract-lang` (греческий пакет). Без Rust/Node для ядра приложения. Версии ключевых зависимостей закреплены в `pyproject.toml`, чтобы `pip` не уходил в долгий backtracking.
- **Офлайн OCR**: вызов локального бинарника Tesseract; при отсутствии — понятная ошибка и ручной ввод текста.
- **Данные**: SQLite в каталоге данных пользователя + файлы изображений рядом; проще типизировать модели (SQLAlchemy 2.0) и тестировать домен без GUI.

Альтернатива **Tauri + веб-UI** хороша для витрины, но для Tesseract на macOS всё равно понадобится либо sidecar, либо системный CLI — лишний слой по сравнению с Python.

## Архитектура (слои)

1. **Инфраструктура**: каталог данных (`~/.greek_study` по умолчанию), логи в `logs/app.log`, настройки в `settings.json` (флаги приватности, путь к `tesseract`).
2. **Хранение**: SQLAlchemy ORM, `Base.metadata.create_all` для MVP (без Alembic до первой миграции схемы).
3. **Сервисы**:
   - `ocr_service` — предобработка (RGB→L, масштаб, контраст) + `pytesseract.image_to_string` / `image_to_data` (при необходимости расширения).
   - `extraction` — разбиение OCR-текста на кандидаты-блоки (по абзацам/пустым строкам), тип блока — эвристика + ручная правка в UI.
   - `import_export` — валидация Pydantic, экспорт/импорт JSON.
4. **Домен**: чистая функция интервалов повторений (без Qt/SQL).
5. **UI (PySide6)**: вкладки «Импорт», «Тренировка», «Словарь/правила»; drag&drop на macOS через события виджета; горячие клавиши через `QShortcut`.

## Модель данных (сущности)

| Сущность | Назначение | Ключевые поля |
|----------|------------|---------------|
| **PageImage** | Страница учебника как файл | `id`, `original_name`, `rel_path` (файл в `images/`), `width`, `height`, `created_at` |
| **ExtractedBlock** | Кандидат на карточку после OCR | `id`, `page_image_id`, `kind` (heading/table/example/vocab/other), `text`, `include` (чекбокс), `sort_order` |
| **Deck** | Колодa/тема | `id`, `name`, `created_at` |
| **Card** | Материал для тренировки | `id`, `deck_id`, `front`, `back`, `card_type` (flashcard/mcq/type_in/… для расширения), `tags` (строка через запятую для MVP), `source_block_id` nullable |
| **ReviewSchedule** | Spaced repetition | `id`, `card_id`, `level` (0…4 → интервалы 0/1/3/7/14 дней), `next_review_at`, `last_reviewed_at`, `last_grade` (again/hard/good/easy) |

Связи: `PageImage` 1—N `ExtractedBlock`; `ExtractedBlock` 0—1 `Card` (опционально); `Card` 1—1 `ReviewSchedule` (создаётся при добавлении в колоду).

## Приватность

- По умолчанию **никаких сетевых вызовов**; OCR только локальный.
- В настройках заготовка «Разрешить внешние API» (выключено); при включении — предупреждение (реализация вызова API вне MVP).

## Инкременты «как коммиты»

1. **chore: scaffold** — `pyproject.toml`, пакет `src/greek_study`, README, этот план.
2. **feat: persistence** — SQLite-модели, инициализация БД, сохранение изображений на диск.
3. **feat: ocr** — предобработка + Tesseract `ell+eng`, fallback сообщения.
4. **feat: domain srs** — уровни 1/3/7/14 дней + again/hard/good/easy.
5. **feat: import/export** — JSON v1, тесты сериализации.
6. **feat: ui-import** — drag&drop, превью, список блоков, сохранение в БД.
7. **feat: ui-train + library** — выбор колоды, флешкарта + простой MCQ, прогресс, поиск/теги.
8. **test: srs + json** — pytest для расписания и round-trip экспорта.

## Что сознательно отложено после MVP

- Полноценный SM-2, синхронизация между устройствами, «найди ошибку» / «сопоставь колонки» как отдельные шаблоны карточек.
- Улучшенный layout-анализ таблиц (сейчас — текстовые блоки).
- Alembic, упаковка в `.app` (py2app/briefcase) — отдельный этап релиза.
