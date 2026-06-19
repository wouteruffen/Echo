import type { DayWeather } from '../services/buienradarService'
import type { CalendarEvent } from '../services/calendarService'
import type { Lang } from '../i18n/translations'

export interface InsightContext {
  hour: number
  weather: DayWeather | null
  events: CalendarEvent[]
  lightsOn: boolean | null
  lang: Lang
}

function nextUpcomingEvent(events: CalendarEvent[], afterHour: number): CalendarEvent | null {
  return (
    events
      .filter(e => !e.allDay && e.startISO)
      .find(e => new Date(e.startISO).getHours() > afterHour) ?? null
  )
}

function weatherLine(weather: DayWeather, lang: Lang): string {
  const temp = weather.current ?? weather.high
  return lang === 'nl'
    ? `Het is ${temp}°C met ${weather.description.toLowerCase()}.`
    : `It's ${temp}°C with ${weather.description.toLowerCase()}.`
}

// ── Rule-based insight engine ─────────────────────────────────
// Rules are checked in priority order. The first matching rule wins.
// Each rule tries to combine at least two data sources for richer context.

export function generateEchoInsight({
  hour,
  weather,
  events,
  lightsOn,
  lang,
}: InsightContext): string {
  const isNL       = lang === 'nl'
  const upcoming   = nextUpcomingEvent(events, hour)
  const timedEvts  = events.filter(e => !e.allDay)
  const rainHigh   = weather !== null && weather.rainChance >= 55
  const sunHigh    = weather !== null && weather.sunChance  >= 55

  // Rule 1: Rain expected + upcoming event → preparation tip (weather + calendar)
  if (rainHigh && upcoming) {
    return isNL
      ? `Er is ${weather!.rainChance}% kans op regen vandaag. Je hebt "${upcoming.title}" om ${upcoming.start} — handig om een regenjas mee te nemen en eventueel wat eerder te vertrekken.`
      : `There's a ${weather!.rainChance}% chance of rain today. You have "${upcoming.title}" at ${upcoming.start} coming up — worth bringing a coat and maybe leaving a little earlier than usual.`
  }

  // Rule 2: Late night + lights still on → evening mode hint (time + lights)
  if (hour >= 22 && lightsOn === true) {
    return isNL
      ? 'Het is laat en de verlichting is nog aan. Een warmere, gedempte sfeer via avondmodus kan helpen om rustig af te bouwen.'
      : "It's getting late and your lights are still on. Switching to evening mode — warmer and dimmed — might help you ease into rest."
  }

  // Rule 3: Morning + timed events → day briefing (time + calendar + weather)
  if (hour < 10 && timedEvts.length > 0) {
    const first = timedEvts[0]
    const wLine = weather ? ' ' + weatherLine(weather, lang) : ''
    return isNL
      ? `Goedemorgen. Je hebt vandaag ${timedEvts.length} afspraak${timedEvts.length > 1 ? 'en' : ''}, te beginnen met "${first.title}" om ${first.start}.${wLine}`
      : `Good morning. You have ${timedEvts.length} event${timedEvts.length > 1 ? 's' : ''} today, starting with "${first.title}" at ${first.start}.${wLine}`
  }

  // Rule 4: Morning + clear calendar → calm start (time + calendar + weather)
  if (hour < 10) {
    const wLine = weather ? ' ' + weatherLine(weather, lang) : ''
    return isNL
      ? `Goedemorgen. Je agenda is vandaag vrij.${wLine} Een rustige start — gebruik de dag zoals je wilt.`
      : `Good morning. Your schedule is clear today.${wLine} A calm start — the day is yours to shape.`
  }

  // Rule 5: Afternoon + sunny → outdoor break suggestion (time + weather)
  if (hour >= 12 && hour < 17 && sunHigh) {
    return isNL
      ? `De zon schijnt vanmiddag (${weather!.sunChance}% zonnekansen). Een korte buitenpauze kan je goed doen en energie geven voor de rest van de dag.`
      : `The sun is out this afternoon (${weather!.sunChance}% sun chance). A short break outside could refresh you and carry you through the rest of the day.`
  }

  // Rule 6: Evening + schedule done → wind down (time + calendar)
  if (hour >= 19 && hour < 22) {
    const remaining = timedEvts.filter(e => new Date(e.startISO).getHours() > hour)
    if (remaining.length === 0) {
      return isNL
        ? 'De dag loopt ten einde en je agenda is klaar voor vandaag. Een goed moment om even bij te komen en de dag af te sluiten.'
        : "The day is winding down and your schedule is done. A good moment to reflect and let the evening be yours."
    }
    return isNL
      ? `Je hebt de avond in. Nog ${remaining.length} item${remaining.length > 1 ? 's' : ''} op de planning — zorg dat je ook tijd inruimt voor rust.`
      : `Evening is setting in. You still have ${remaining.length} item${remaining.length > 1 ? 's' : ''} ahead — make sure to leave some time to unwind.`
  }

  // Rule 7: No events at all → focused work suggestion (calendar + weather)
  if (events.length === 0) {
    const wLine = weather ? ' ' + weatherLine(weather, lang) : ''
    return isNL
      ? `Je agenda is vandaag vrij.${wLine} Een goed moment voor geconcentreerd werk of een persoonlijk project.`
      : `Your calendar is clear today.${wLine} A good time for focused work or a personal project.`
  }

  // Rule 8: Fallback — weather + event count summary
  const wLine  = weather ? weatherLine(weather, lang) + ' ' : ''
  const eCount = timedEvts.length
  return isNL
    ? `${wLine}Je hebt ${eCount} afspraak${eCount !== 1 ? 'en' : ''} vandaag. Echo houdt je dag in de gaten.`
    : `${wLine}You have ${eCount} event${eCount !== 1 ? 's' : ''} today. Echo is keeping track of your day.`
}
