export interface TiktokLibraryFilters {
  dateRange?: {
    start?: Date | string;
    end?: Date | string;
  };
  countries?: string[];
}
export enum TiktokLibraryPeriod {
  DAY = 7,
  WEEK = 30,
  MONTH = 180,
}

export enum TiktokLibraryOrderBy {
  LIKE = 'like',
  CTR = 'ctr',
  PLAY_6S_RATE = 'play_6s_rate',
  PLAY_2S_RATE = 'play_2s_rate',
}

export enum TiktokLibraryAdFormat {
  SPARK_ADS = 1,
  NON_SPARK_ADS = 2,
}

export enum TiktokLibraryLike {
  FROM_1_TO_20 = 1,
  FROM_21_TO_40 = 2,
  FROM_41_TO_60 = 3,
  FROM_61_TO_80 = 4,
  FROM_81_TO_100 = 5,
}

export enum TiktokLibraryAdLanguage {
  ENGLISH = 'en',
  SPANISH = 'es',
  ARABIC = 'ar',
  VIETNAMESE = 'vi',
  THAI = 'th',
  GERMAN = 'de',
  INDONESIAN = 'id',
  PORTUGUESE = 'pt',
  FRENCH = 'fr',
  MALAY = 'ms',
  DUTCH = 'nl',
  JAPANESE = 'ja',
  ITALIAN = 'it',
  ROMANIAN = 'ro',
  CHINESE_TRADITIONAL = 'zh-Hant',
  KOREAN = 'ko',
}

export enum TiktokLibraryCountryCode {
  ALGERIA = 'DZ',
  ARGENTINA = 'AR',
  AUSTRALIA = 'AU',
  AUSTRIA = 'AT',
  AZERBAIJAN = 'AZ',
  BAHRAIN = 'BH',
  BANGLADESH = 'BD',
  BELARUS = 'BY',
  BELGIUM = 'BE',
  BOLIVIA = 'BO',
  BRAZIL = 'BR',
  BULGARIA = 'BG',
  CAMBODIA = 'KH',
  CANADA = 'CA',
  CHILE = 'CL',
  COLOMBIA = 'CO',
  COSTA_RICA = 'CR',
  CROATIA = 'HR',
  CYPRUS = 'CY',
  CZECHIA = 'CZ',
  DENMARK = 'DK',
  DOMINICAN_REPUBLIC = 'DO',
  ECUADOR = 'EC',
  EGYPT = 'EG',
  ESTONIA = 'EE',
  FINLAND = 'FI',
  FRANCE = 'FR',
  GERMANY = 'DE',
  GREECE = 'GR',
  GUATEMALA = 'GT',
  HUNGARY = 'HU',
  INDONESIA = 'ID',
  IRAQ = 'IQ',
  IRELAND = 'IE',
  ISRAEL = 'IL',
  ITALY = 'IT',
  JAPAN = 'JP',
  JORDAN = 'JO',
  KAZAKHSTAN = 'KZ',
  KENYA = 'KE',
  KUWAIT = 'KW',
  LATVIA = 'LV',
  LEBANON = 'LB',
  LITHUANIA = 'LT',
  MALAYSIA = 'MY',
  MEXICO = 'MX',
  MOROCCO = 'MA',
  NETHERLANDS = 'NL',
  NEW_ZEALAND = 'NZ',
  NIGERIA = 'NG',
  NORWAY = 'NO',
  OMAN = 'OM',
  PAKISTAN = 'PK',
  PANAMA = 'PA',
  PARAGUAY = 'PY',
  PERU = 'PE',
  PHILIPPINES = 'PH',
  POLAND = 'PL',
  PORTUGAL = 'PT',
  PUERTO_RICO = 'PR',
  QATAR = 'QA',
  ROMANIA = 'RO',
  SAUDI_ARABIA = 'SA',
  SERBIA = 'RS',
  SINGAPORE = 'SG',
  SLOVAKIA = 'SK',
  SLOVENIA = 'SI',
  SOUTH_AFRICA = 'ZA',
  SOUTH_KOREA = 'KR',
  SPAIN = 'ES',
  SRI_LANKA = 'LK',
  SWEDEN = 'SE',
  SWITZERLAND = 'CH',
  TAIWAN = 'TW',
  THAILAND = 'TH',
  TURKEY = 'TR',
  UNITED_ARAB_EMIRATES = 'AE',
  UNITED_KINGDOM = 'GB',
  UNITED_STATES = 'US',
  URUGUAY = 'UY',
  VIETNAM = 'VN',
}

export interface TiktokLibraryQuery {
  queryString: string;
  period: TiktokLibraryPeriod;
  orderBy: TiktokLibraryOrderBy;
  countryCode?: TiktokLibraryCountryCode[];
  languages?: TiktokLibraryAdLanguage[];
  adFormat?: TiktokLibraryAdFormat;
  like?: TiktokLibraryLike;
  adLanguages?: TiktokLibraryAdLanguage[];
}
