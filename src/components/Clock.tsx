import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { translations, type Lang } from '../i18n/translations'

function greeting(h: number, lang: Lang): string {
  const g = translations[lang].greetings
  if (h < 5) return g.night
  if (h < 12) return g.morning
  if (h < 17) return g.afternoon
  if (h < 21) return g.evening
  return g.night
}

interface Props { lang: Lang }

export function ClockGreeting({ lang }: Props) {
  const [hour, setHour] = useState(new Date().getHours())

  useEffect(() => {
    const id = setInterval(() => setHour(new Date().getHours()), 60_000)
    return () => clearInterval(id)
  }, [])

  return (
    <motion.p
      className="clock-greeting"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5, duration: 0.8 }}
    >
      {greeting(hour, lang)}, Wouter
    </motion.p>
  )
}

export default function Clock({ lang }: Props) {
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const hours = now.getHours().toString().padStart(2, '0')
  const minutes = now.getMinutes().toString().padStart(2, '0')
  const seconds = now.getSeconds().toString().padStart(2, '0')

  const locale = lang === 'nl' ? 'nl-NL' : 'en-GB'
  const day = now.toLocaleDateString(locale, { weekday: 'long' })
  const date = now.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <div className="clock-block">
      <motion.div
        className="clock-time"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
      >
        <span className="clock-hm">{hours}:{minutes}</span>
        <span className="clock-sep">:</span>
        <span className="clock-sec">{seconds}</span>
      </motion.div>
      <motion.div
        className="clock-date"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.8 }}
      >
        {day}, {date}
      </motion.div>
    </div>
  )
}
