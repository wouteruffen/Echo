import { motion } from 'framer-motion'
import type { Theme } from '../hooks/useTheme'
import { translations, type Lang } from '../i18n/translations'

interface SidebarProps {
  theme: Theme
  onToggleTheme: () => void
  lang: Lang
  onSetLang: (l: Lang) => void
}

export default function Sidebar({ theme, onToggleTheme, lang, onSetLang }: SidebarProps) {
  const isDark = theme === 'dark'
  const tr = translations[lang]

  return (
    <motion.nav
      className="sidebar"
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
    >
      <div className="sidebar-logo">
        <span className="logo-mark">◈</span>
        <span className="logo-text">ECHO</span>
      </div>

      <div className="lang-switcher">
        <button
          className={`lang-seg ${lang === 'nl' ? 'lang-seg--active' : ''}`}
          onClick={() => onSetLang('nl')}
          title="Nederlands"
        >
          NL
        </button>
        <button
          className={`lang-seg ${lang === 'en' ? 'lang-seg--active' : ''}`}
          onClick={() => onSetLang('en')}
          title="English"
        >
          EN
        </button>
      </div>

      <button
        className="theme-toggle"
        onClick={onToggleTheme}
        title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        <span className="theme-toggle-icon">{isDark ? '○' : '◑'}</span>
        <span className="theme-toggle-label">{isDark ? tr.light : tr.dark}</span>
      </button>

      <div className="sidebar-nav">
        <button className="nav-item active" title={tr.home}>
          <span className="nav-icon">⬡</span>
          <span className="nav-label">{tr.home}</span>
          <motion.span
            className="nav-indicator"
            layoutId="nav-indicator"
            transition={{ type: 'spring', stiffness: 400, damping: 35 }}
          />
        </button>
      </div>

      <div className="sidebar-echo-status">
        <span className="echo-status-dot" />
        <span className="echo-status-label">ECHO</span>
        <span className="echo-status-sub">Online</span>
      </div>
    </motion.nav>
  )
}
