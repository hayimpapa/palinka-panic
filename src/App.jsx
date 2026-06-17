import { useState } from 'react'
import GameCanvas from './components/GameCanvas.jsx'
import AboutTab from './components/AboutTab.jsx'

export default function App() {
  const [tab, setTab] = useState('game')

  return (
    <div className="flex h-full flex-col bg-stone-900">
      <header className="flex shrink-0 items-center justify-center gap-2 border-b border-stone-700 bg-stone-950/80 px-3 py-2">
        <TabButton active={tab === 'game'} onClick={() => setTab('game')}>
          🍶 Play
        </TabButton>
        <TabButton active={tab === 'about'} onClick={() => setTab('about')}>
          📖 About This Build
        </TabButton>
      </header>

      <main className="min-h-0 flex-1 overflow-auto">
        {tab === 'game' ? (
          <div className="h-full w-full p-2">
            <GameCanvas />
          </div>
        ) : (
          <AboutTab />
        )}
      </main>
    </div>
  )
}

function TabButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={
        'rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ' +
        (active
          ? 'bg-red-700 text-amber-50 shadow'
          : 'bg-stone-800 text-stone-300 hover:bg-stone-700')
      }
    >
      {children}
    </button>
  )
}
