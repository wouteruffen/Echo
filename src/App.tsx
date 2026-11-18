import { useCallback, useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import Clock, { ClockGreeting } from './components/Clock'
import WeatherCard from './components/WeatherCard'
import EchoTerminal from './components/EchoTerminal'
import HueControl from './components/HueControl'
import CalendarOverview from './components/CalendarOverview'
import VoicePlaygroundPage from './pages/VoicePlaygroundPage'
import KanbanPage from './pages/KanbanPage'
import { useTheme } from './hooks/useTheme'
import { useLanguage } from './hooks/useLanguage'
import { useBackground } from './hooks/useBackground'
import SettingsModal from './components/SettingsModal'
import AccountMenu from './components/AccountMenu'
import { useSession } from './hooks/useSession'
import './App.css'

export default function App() {
  const { theme, toggle: toggleTheme } = useTheme()
  const { lang, setLang } = useLanguage()
  const { background, setBackground, reset: resetBackground } = useBackground()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const session = useSession()
  const closeSettings = useCallback(() => setSettingsOpen(false), [])

  return (
    <div className="shell">
      <Sidebar
        theme={theme}
        onToggleTheme={toggleTheme}
        lang={lang}
        onSetLang={setLang}
        onOpenSettings={() => setSettingsOpen(true)}
        session={session}
      />
      {session && <div className="account-mobile"><AccountMenu session={session} /></div>}
      <button className="settings-fab" type="button" aria-label="Instellingen openen" onClick={() => setSettingsOpen(true)}>⚙</button>
      {settingsOpen && <SettingsModal background={background} onSelectBackground={setBackground} onReset={resetBackground} onClose={closeSettings} />}
      <main className="main scrollable">
        <Routes>
          <Route path="/" element={
            <>
              <header className="dashboard-header">
                <ClockGreeting lang={lang} />
                <Clock lang={lang} />
              </header>
              <div className="dashboard-content">
                <WeatherCard lang={lang} />
                <CalendarOverview />
                <div className="dashboard-bottom">
                  <EchoTerminal lang={lang} />
                  <HueControl />
                </div>
              </div>
            </>
          } />
          <Route path="/voice-playground" element={<VoicePlaygroundPage />} />
          <Route path="/board" element={<KanbanPage />} />
        </Routes>
      </main>
    </div>
  )
}
