/**
 * SafeJsonHelper - класс для типобезопасной работы с JSON в NestJS
 *
 * Этот хелпер обеспечивает типобезопасную сериализацию и десериализацию JSON,
 * предотвращая ошибки, связанные с потерей типов при работе с JSON.
 */

// Базовые типы для работы с JSON
export type JSONPrimitive = string | number | boolean | null | undefined;
export type JSONValue =
  | JSONPrimitive
  | JSONValue[]
  | { [key: string]: JSONValue };

// Типы, которые не могут быть сериализованы в JSON
export type NotAssignableToJson =
  | bigint
  | symbol
  | ((...args: any[]) => unknown)
  | (new (...args: any[]) => unknown);

/**
 * Тип для проверки совместимости типа T с JSON
 * Использует mapped types для рекурсивной проверки всех свойств объекта
 */
export type JSONCompatible<T> = unknown extends T
  ? never
  : {
      [P in keyof T]: T[P] extends JSONValue
        ? T[P]
        : T[P] extends NotAssignableToJson
          ? never
          : JSONCompatible<T[P]>;
    };

/**
 * Хелпер для безопасной работы с JSON в NestJS приложениях
 */
export class SafeJsonHelper {
  /**
   * Безопасно сериализует данные в JSON-строку
   * Проверяет совместимость данных с JSON на этапе компиляции
   *
   * @param data Данные для сериализации
   * @returns JSON-строка
   */
  public static stringify<T>(data: JSONCompatible<T>): string {
    return JSON.stringify(data);
  }

  /**
   * Безопасно десериализует JSON-строку
   * Возвращает тип unknown для принудительной проверки типа после десериализации
   *
   * @param text JSON-строка
   * @returns Десериализованные данные с типом unknown
   */
  public static parse(text: string): unknown {
    return JSON.parse(text);
  }

  /**
   * Безопасно десериализует JSON-строку и приводит к указанному типу
   * ВНИМАНИЕ: Этот метод не выполняет валидацию структуры данных во время выполнения,
   * он только помогает с типизацией. Для полной валидации используйте parseAndValidate
   *
   * @param text JSON-строка
   * @returns Десериализованные данные приведенные к типу T
   */
  public static parseAs<T>(text: string): T {
    return JSON.parse(text) as T;
  }

  /**
   * Преобразует типизированный объект в JSONValue
   * Полезно когда нужно присвоить типизированный объект переменной типа JSONValue
   *
   * @param value Типизированное значение
   * @returns То же значение, но с типом JSONValue
   */
  public static toJsonValue<T>(value: JSONCompatible<T>): JSONValue {
    return value as JSONValue;
  }

  /**
   * Проверяет, является ли значение сериализуемым в JSON
   * Полезно для предварительной проверки перед сериализацией
   *
   * @param value Проверяемое значение
   * @returns true, если значение можно безопасно сериализовать
   */
  public static isJsonSerializable(value: unknown): boolean {
    if (value === null || value === undefined) {
      return true;
    }

    const type = typeof value;

    if (type === 'string' || type === 'number' || type === 'boolean') {
      return true;
    }

    if (type === 'object') {
      if (value instanceof Date) {
        return false; // Даты требуют особой обработки
      }

      if (Array.isArray(value)) {
        return value.every((item) => this.isJsonSerializable(item));
      }

      return Object.values(value as Record<string, unknown>).every((item) =>
        this.isJsonSerializable(item),
      );
    }

    return false;
  }

  /**
   * Преобразует объект с датами в формат, безопасный для JSON
   * Преобразует все поля типа Date в числа (timestamp)
   *
   * @param obj Объект, который может содержать даты
   * @returns Новый объект, где все даты преобразованы в числа
   */
  public static convertDatesToTimestamps<T>(obj: T): JSONCompatible<T> {
    if (obj === null || obj === undefined) {
      return obj as JSONCompatible<T>;
    }

    if (obj instanceof Date) {
      return obj.getTime() as unknown as JSONCompatible<T>;
    }

    if (Array.isArray(obj)) {
      return obj.map((item) =>
        this.convertDatesToTimestamps(item),
      ) as unknown as JSONCompatible<T>;
    }

    if (typeof obj === 'object') {
      const result: Record<string, unknown> = {};

      for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
          result[key] = this.convertDatesToTimestamps(obj[key]);
        }
      }

      return result as JSONCompatible<T>;
    }

    return obj as JSONCompatible<T>;
  }

  /**
   * Преобразует timestamp обратно в объекты Date
   * Полезно после десериализации JSON, содержащего даты
   *
   * @param obj Объект с полями timestamp, которые нужно преобразовать в Date
   * @param dateFields Массив путей к полям, которые должны быть преобразованы в Date
   * @returns Новый объект с Date вместо timestamp
   */
  public static convertTimestampsToDate<T>(
    obj: unknown,
    dateFields: string[],
  ): T {
    if (!obj || typeof obj !== 'object') {
      return obj as T;
    }

    const result = Array.isArray(obj)
      ? [...(obj as unknown[])]
      : { ...(obj as Record<string, unknown>) };

    for (const field of dateFields) {
      const parts = field.split('.');
      let current: Record<string, unknown> = result as Record<string, unknown>;

      for (let i = 0; i < parts.length - 1; i++) {
        if (current[parts[i]] === undefined || current[parts[i]] === null) {
          break;
        }
        current = current[parts[i]] as Record<string, unknown>;
      }

      const lastPart = parts[parts.length - 1];

      if (
        current &&
        current[lastPart] !== undefined &&
        current[lastPart] !== null &&
        typeof current[lastPart] === 'number'
      ) {
        current[lastPart] = new Date(current[lastPart]);
      }
    }

    return result as T;
  }
}
