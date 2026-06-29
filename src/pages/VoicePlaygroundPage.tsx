import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import VoicePlayground from '../components/VoicePlayground'

export default function VoicePlaygroundPage() {
  const navigate = useNavigate()

  return (
    <motion.div
      className="vp-page"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
    >
      <div className="vp-page-header">
        <div>
          <h1 className="vp-title">Voice Playground</h1>
          <p className="vp-subtitle">Test ECHO's voice output.</p>
        </div>
        <button
          className="vp-back-btn"
          onClick={() => navigate('/')}
        >
          ← Back to Dashboard
        </button>
      </div>

      <VoicePlayground />
    </motion.div>
  )
}
