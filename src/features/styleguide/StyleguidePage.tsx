/**
 * Living reference for the design system (roadmap P1). Renders every token as a
 * labelled swatch + a gallery of every ds-* component, with a local Light/Dark
 * toggle (sets data-theme on this page's wrapper only — not the global app).
 */
import { useState } from 'react';
import './styleguide.css';

const SURFACE_TOKENS = ['--bg-0', '--bg-1', '--bg-2', '--bg-3', '--border'];
const TEXT_TOKENS = ['--fg', '--fg-muted', '--accent'];
const DOMAIN_TOKENS = ['--live', '--dead', '--gold', '--violet', '--sp', '--error', '--warn'];
const STAT_TOKENS = ['--stat-speed', '--stat-stamina', '--stat-power', '--stat-guts', '--stat-wit'];

function Swatches({ title, tokens }: { title: string; tokens: string[] }) {
  return (
    <section className="sg-section">
      <h2>{title}</h2>
      <div className="sg-swatches">
        {tokens.map((t) => (
          <div className="sg-swatch" key={t}>
            <span className="sg-chip" style={{ background: `var(${t})` }} />
            <code>{t}</code>
          </div>
        ))}
      </div>
    </section>
  );
}

export function StyleguidePage() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  return (
    <div className="styleguide" data-theme={theme}>
      <div className="styleguide-toolbar">
        <h1>Design-system styleguide</h1>
        <div className="ds-seg ds-miniseg" role="group" aria-label="Preview theme" style={{ marginLeft: 'auto' }}>
          <button type="button" className={theme === 'light' ? 'on' : undefined} onClick={() => setTheme('light')}>Light</button>
          <button type="button" className={theme === 'dark' ? 'on' : undefined} onClick={() => setTheme('dark')}>Dark</button>
        </div>
      </div>

      <Swatches title="Surfaces & lines" tokens={SURFACE_TOKENS} />
      <Swatches title="Text & accent" tokens={TEXT_TOKENS} />
      <Swatches title="Domain" tokens={DOMAIN_TOKENS} />
      <Swatches title="Stats" tokens={STAT_TOKENS} />

      <section className="sg-section">
        <h2>Components</h2>
        <div className="sg-gallery">
          <div className="ds-card" style={{ width: '16rem' }}>
            <div className="ds-card-head">Card head</div>
            <div className="ds-card-body">Card body with <span className="ds-l">+1.42</span> and <span className="ds-cost">SP 240</span>.</div>
          </div>

          <div className="ds-band" style={{ width: '16rem' }}>
            <div className="ds-band-head"><span className="ds-bnum">0</span> Band head</div>
            <div className="ds-band-body">Band body content.</div>
          </div>

          <div className="sg-section">
            <div>
              <span className="ds-efb ds-ef-spd">SPD</span>{' '}
              <span className="ds-efb ds-ef-acc">ACC</span>{' '}
              <span className="ds-efb ds-ef-rec">REC</span>{' '}
              <span className="ds-efb ds-ef-heal">HEAL</span>{' '}
              <span className="ds-efb ds-ef-dbf">DBF</span>
            </div>
            <div className="ds-seg" role="group" aria-label="Sample segmented">
              <button type="button" className="on">Front</button>
              <button type="button">Pace</button>
              <button type="button">Late</button>
              <button type="button">End</button>
            </div>
            <span className="ds-switch" data-on><span className="ds-knob" /> show every skill</span>
            <div>
              <span className="ds-l">+2.10</span> · <span className="ds-cost">SP 530</span> ·{' '}
              <span className="ds-na">n/a</span> · <span className="ds-zero">0 L</span>
            </div>
          </div>

          <table className="ds-table" style={{ width: '18rem' }}>
            <thead><tr><th>Skill</th><th>L</th><th>SP</th></tr></thead>
            <tbody>
              <tr><td>Escape Artist</td><td><span className="ds-l">+1.42</span></td><td><span className="ds-cost">240</span></td></tr>
              <tr><td>Rushing Gale!</td><td><span className="ds-zero">0 L</span></td><td><span className="ds-cost">160</span></td></tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
