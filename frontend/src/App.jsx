import { useState } from 'react';
import InputPanel from './components/InputPanel.jsx';
import ResultsPanel from './components/ResultsPanel.jsx';
import AboutModal from './components/AboutModal.jsx';
import { useMuddler } from './hooks/useMuddler.js';
import logo from '/muddle_instead_of_music.png';

export default function App() {
  const [showAbout, setShowAbout] = useState(false);
  const { results, status, loading, generate } = useMuddler();

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-left">
          <img src={logo} alt="Muddle Instead Of Music" className="logo" width={250} />
          <div className="header-text">
            <h1>The Muddler</h1>
            <p className="subtitle">
              Generate xenharmonic muddles.&ensp;
              <a
                className="subtitle-link"
                href="https://github.com/ascai1/muddler"
                target="_blank"
                rel="noopener"
              >
                Full Python script ↗
              </a>
            </p>
          </div>
        </div>
        <button className="about-btn" onClick={() => setShowAbout(true)}>About</button>
      </header>

      <main className="app-body">
        <InputPanel onGenerate={generate} status={status} loading={loading} />
        <ResultsPanel results={results} />
      </main>

      {showAbout && <AboutModal onClose={() => setShowAbout(false)} />}
    </div>
  );
}
