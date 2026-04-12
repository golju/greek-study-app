# Greek Study (локальный MVP)

Desktop-приложение для изучения современного греческого: импорт скриншотов учебника, OCR (Tesseract), ручная разметка блоков, карточки и простое spaced repetition.

## Требования

- macOS (протестировано на darwin), Python **3.10+**
- [Tesseract](https://github.com/tesseract-ocr/tesseract) с языками **ell** и **eng**

Установка Tesseract (Homebrew):

```bash
brew install tesseract tesseract-lang
```

Проверка языков:

```bash
tesseract --list-langs | grep -E 'ell|eng'
```

## Установка приложения

```bash
cd /path/to/greek-study-app
python3 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
```

## Запуск

```bash
greek-study
```

Данные по умолчанию: `~/.greek_study/` (SQLite `app.db`, папка `images/`, логи `logs/app.log`). Переменная окружения `GREEK_STUDY_DATA_DIR` переопределяет каталог.

## Горячие клавиши (тренировка)

| Клавиша | Действие |
|---------|----------|
| `Space` | Показать ответ |
| `W` | «Снова» (again — в конец очереди с интервалом 0 дней) |
| `H` | «Сложно» (hard — короткий интервал) |
| `R` | «Знаю» (good) |
| `E` | «Легко» (easy) |
| `N` | Следующая карточка |

## Тесты

```bash
pytest
```

## Экспорт / импорт

Вкладка «Словарь/правила»: кнопки экспорта и импорта JSON (версия формата `1`). Импорт не дублирует колоды с тем же именем — создаёт новую с суффиксом.

## План развития

См. [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md).
