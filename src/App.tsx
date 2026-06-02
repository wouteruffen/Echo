import Sidebar from './components/Sidebar'
import Clock, { ClockGreeting } from './components/Clock'
import WeatherCard from './components/WeatherCard'
import EchoTerminal from './components/EchoTerminal'
import HueControl from './components/HueControl'
import CalendarOverview from './components/CalendarOverview'
import { useTheme } from './hooks/useTheme'
import { useLanguage } from './hooks/useLanguage'
import './App.css'

export default function App() {
  const { theme, toggle: toggleTheme } = useTheme()
  const { lang, setLang } = useLanguage()

  return (
    <div className="shell">
      <Sidebar
        theme={theme}
        onToggleTheme={toggleTheme}
        lang={lang}
        onSetLang={setLang}
      />
      <main className="main scrollable">
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
      </main>
    </div>
  )
}
