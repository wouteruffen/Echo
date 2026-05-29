export type Lang = 'nl' | 'en'

export interface Translations {
  weather: string
  echoTerminal: string
  greetings: {
    night: string
    morning: string
    afternoon: string
    evening: string
  }
  attribution: string
  updated: string
  humidity: string
  feelsLike: string
  wind: string
  rain: string
  sun: string
  askEcho: string
  echoReady: string
  ready: string
  home: string
  dark: string
  light: string
  today: string
  tomorrow: string
  days: Record<string, string>       // short abbreviations (MON / MA)
  daysFull: Record<string, string>   // full names (Monday / Maandag)
}

export const translations: Record<Lang, Translations> = {
  en: {
    weather: 'Weather',
    echoTerminal: 'Echo Terminal',
    greetings: {
      night: 'Good night',
      morning: 'Good morning',
      afternoon: 'Good afternoon',
      evening: 'Good evening',
    },
    attribution: 'Buienradar.nl',
    updated: 'Updated',
    humidity: 'Humidity',
    feelsLike: 'Feels like',
    wind: 'Wind',
    rain: 'Rain',
    sun: 'Sun',
    askEcho: 'Ask Echo anything...',
    echoReady: 'Echo terminal ready. Ask me anything about your day.',
    ready: 'Ready',
    home: 'Home',
    dark: 'Dark',
    light: 'Light',
    today: 'Today',
    tomorrow: 'Tomorrow',
    days: {
      Mon: 'MON', Tue: 'TUE', Wed: 'WED', Thu: 'THU',
      Fri: 'FRI', Sat: 'SAT', Sun: 'SUN',
    },
    daysFull: {
      Mon: 'Monday', Tue: 'Tuesday',  Wed: 'Wednesday', Thu: 'Thursday',
      Fri: 'Friday', Sat: 'Saturday', Sun: 'Sunday',
    },
  },
  nl: {
    weather: 'Weer',
    echoTerminal: 'Echo Terminal',
    greetings: {
      night: 'Goedenacht',
      morning: 'Goedemorgen',
      afternoon: 'Goedemiddag',
      evening: 'Goedenavond',
    },
    attribution: 'Buienradar.nl',
    updated: 'Bijgewerkt',
    humidity: 'Vochtigheid',
    feelsLike: 'Voelt als',
    wind: 'Wind',
    rain: 'Regen',
    sun: 'Zon',
    askEcho: 'Vraag Echo iets...',
    echoReady: 'Echo terminal gereed. Stel me een vraag over je dag.',
    ready: 'Gereed',
    home: 'Home',
    dark: 'Donker',
    light: 'Licht',
    today: 'Vandaag',
    tomorrow: 'Morgen',
    days: {
      Mon: 'MA', Tue: 'DI', Wed: 'WO', Thu: 'DO',
      Fri: 'VR', Sat: 'ZAT', Sun: 'ZO',
    },
    daysFull: {
      Mon: 'Maandag', Tue: 'Dinsdag',  Wed: 'Woensdag', Thu: 'Donderdag',
      Fri: 'Vrijdag', Sat: 'Zaterdag', Sun: 'Zondag',
    },
  },
}
