# API Structure

Структура организации API-слоя приложения.

## Общая структура

```
api/
├── facebook/                    # Facebook API модуль
│   ├── controllers/            # Facebook контроллеры
│   ├── dto/                   # Facebook DTO
│   ├── services/              # Facebook сервисы (если есть)
│   └── interfaces/            # Facebook интерфейсы (если есть)
│
├── tiktok/                     # TikTok API модуль (подготовлен для будущего)
│   ├── controllers/           # TikTok контроллеры
│   ├── dto/                  # TikTok DTO
│   ├── services/             # TikTok сервисы
│   └── interfaces/           # TikTok интерфейсы
│
├── common/                     # Общие компоненты API
│   ├── controllers/          # Общие контроллеры
│   ├── dto/                 # Общие DTO
│   ├── middleware/          # Общие middleware
│   ├── pipes/              # Общие pipes
│   ├── filters/            # Общие фильтры исключений
│   ├── decorators/         # Общие декораторы
│   └── interfaces/         # Общие интерфейсы
│
└── health/                    # Health check endpoints
    └── controller/          # Health check контроллер
```

## Модули

- `FacebookApiModule` - модуль для Facebook-связанных эндпоинтов
- `CommonApiModule` - модуль для общих эндпоинтов (запросы)
- `HealthModule` - модуль для проверки состояния приложения
- `ApiModule` - главный модуль, объединяющий все API-модули

## Ответственности

- Контроллеры (`controllers/`) - обработка HTTP-запросов, валидация DTO
- DTO (`dto/`) - структуры данных для запросов/ответов API
- Middleware (`middleware/`) - промежуточные обработчики запросов
- Services (`services/`) - бизнес-логика API (если не используются общие сервисы)
