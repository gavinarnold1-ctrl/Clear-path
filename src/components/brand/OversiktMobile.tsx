'use client'

import { useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'

const p = {
  fjord: '#1B3A4B',
  pine: '#2D5F3E',
  frost: '#E8F0ED',
  stone: '#8B9A8E',
  snow: '#F7F9F8',
  birch: '#D4C5A9',
  ember: '#C4704B',
  midnight: '#0F1F28',
  lichen: '#A3B8A0',
  mist: '#C8D5CE',
}

const tabs = ['Brand', 'Colors', 'Type', 'App', 'Parts']

export default function OversiktMobile() {
  const [tab, setTab] = useState(0)

  return (
    <div
      style={{
        fontFamily: "'DM Sans',sans-serif",
        background: p.snow,
        minHeight: '100vh',
        color: p.midnight,
        maxWidth: 480,
        margin: '0 auto',
      }}
    >
      <link
        href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Fraunces:opsz,wght@9..144,300;9..144,400;9..144,500;9..144,600&family=JetBrains+Mono:wght@400;500&display=swap"
        rel="stylesheet"
      />

      {/* Top bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '16px 20px',
          borderBottom: `1px solid ${p.mist}`,
          background: 'rgba(247,249,248,0.95)',
          backdropFilter: 'blur(10px)',
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}
      >
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 7,
            background: p.fjord,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: "'Fraunces',serif",
            fontSize: 14,
            color: p.snow,
          }}
        >
          O
        </div>
        <span style={{ fontFamily: "'Fraunces',serif", fontSize: 16, color: p.fjord }}>
          oversikt
        </span>
        <span
          style={{ fontSize: 11, color: p.stone, marginLeft: 'auto', letterSpacing: '0.06em' }}
        >
          BRAND GUIDE
        </span>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          gap: 4,
          padding: '12px 16px',
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {tabs.map((t, i) => (
          <button
            key={t}
            onClick={() => setTab(i)}
            style={{
              padding: '7px 14px',
              borderRadius: 6,
              border: 'none',
              whiteSpace: 'nowrap',
              background: tab === i ? p.fjord : 'transparent',
              color: tab === i ? p.snow : p.stone,
              fontFamily: "'DM Sans',sans-serif",
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            {t}
          </button>
        ))}
      </div>

      <div style={{ padding: '8px 16px 40px' }}>
        {/* BRAND */}
        {tab === 0 && (
          <>
            {/* Hero */}
            <div
              style={{
                textAlign: 'center',
                padding: '56px 24px',
                background: `linear-gradient(165deg, ${p.fjord} 0%, ${p.midnight} 100%)`,
                borderRadius: 14,
                marginBottom: 20,
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  opacity: 0.05,
                  background:
                    'repeating-linear-gradient(90deg,transparent,transparent 40px,rgba(255,255,255,.5) 40px,rgba(255,255,255,.5) 41px)',
                }}
              />
              <div
                style={{
                  fontFamily: "'Fraunces',serif",
                  fontSize: 52,
                  fontWeight: 300,
                  color: p.snow,
                  letterSpacing: '-0.02em',
                  marginBottom: 8,
                  position: 'relative',
                }}
              >
                oversikt
              </div>
              <div
                style={{
                  fontSize: 12,
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                  color: p.lichen,
                  position: 'relative',
                }}
              >
                See your whole financial picture
              </div>
            </div>

            {/* Icon variants */}
            <div
              style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}
            >
              <Card>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 12,
                  }}
                >
                  <div
                    style={{
                      width: 64,
                      height: 64,
                      borderRadius: 14,
                      background: p.fjord,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontFamily: "'Fraunces',serif",
                      fontSize: 30,
                      color: p.snow,
                    }}
                  >
                    O
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <Label>App Icon</Label>
                    <div style={{ fontSize: 12, color: p.stone }}>Fjord background</div>
                  </div>
                </div>
              </Card>
              <Card>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 12,
                  }}
                >
                  <div
                    style={{
                      width: 64,
                      height: 64,
                      borderRadius: 14,
                      background: p.pine,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontFamily: "'Fraunces',serif",
                      fontSize: 30,
                      color: p.snow,
                    }}
                  >
                    O
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <Label>Alt Icon</Label>
                    <div style={{ fontSize: 12, color: p.stone }}>Pine variant</div>
                  </div>
                </div>
              </Card>
            </div>

            {/* Lockup */}
            <Card>
              <Label>Lockup</Label>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  marginTop: 12,
                  marginBottom: 12,
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 9,
                    background: p.fjord,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: "'Fraunces',serif",
                    fontSize: 18,
                    color: p.snow,
                  }}
                >
                  O
                </div>
                <span style={{ fontFamily: "'Fraunces',serif", fontSize: 22, color: p.fjord }}>
                  oversikt
                </span>
              </div>
              <div style={{ fontSize: 12, color: p.stone }}>
                Icon + wordmark for headers and marketing
              </div>
            </Card>

            {/* Context variants */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr',
                gap: 8,
                marginTop: 12,
              }}
            >
              {[
                { bg: p.midnight, label: 'On Dark' },
                { bg: p.snow, label: 'On Light', border: true },
                { bg: p.pine, label: 'On Pine' },
              ].map((v) => (
                <div
                  key={v.label}
                  style={{
                    background: v.bg,
                    borderRadius: 10,
                    padding: '20px 12px',
                    textAlign: 'center',
                    border: v.border ? `1px solid ${p.mist}` : 'none',
                  }}
                >
                  <span
                    style={{
                      fontFamily: "'Fraunces',serif",
                      fontSize: 16,
                      color: v.bg === p.snow ? p.fjord : p.snow,
                    }}
                  >
                    oversikt
                  </span>
                  <div
                    style={{
                      fontSize: 10,
                      color: v.bg === p.snow ? p.stone : 'rgba(255,255,255,0.45)',
                      marginTop: 6,
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                    }}
                  >
                    {v.label}
                  </div>
                </div>
              ))}
            </div>

            {/* Brand story */}
            <Card style={{ marginTop: 16 }}>
              <div
                style={{
                  fontFamily: "'Fraunces',serif",
                  fontSize: 17,
                  fontWeight: 500,
                  color: p.fjord,
                  marginBottom: 10,
                }}
              >
                Brand Story
              </div>
              <p style={{ fontSize: 14, lineHeight: 1.65, color: p.fjord, margin: 0 }}>
                <em>Oversikt</em> is Norwegian for &quot;overview&quot; — the elevated perspective
                from a mountain summit where the full landscape becomes clear. In personal finance,
                that clarity is everything: seeing the whole picture so every decision is informed.
              </p>
              <div
                style={{
                  marginTop: 14,
                  padding: '10px 14px',
                  background: 'rgba(27,58,75,0.05)',
                  borderRadius: 8,
                }}
              >
                <div style={{ fontSize: 12, color: p.stone, marginBottom: 4, fontWeight: 500 }}>
                  Pronunciation
                </div>
                <div
                  style={{
                    fontFamily: "'JetBrains Mono',monospace",
                    fontSize: 14,
                    color: p.fjord,
                  }}
                >
                  OH-ver-sikt
                </div>
              </div>
            </Card>
          </>
        )}

        {/* COLORS */}
        {tab === 1 && (
          <>
            <SectionTitle>Color System</SectionTitle>
            <p style={{ fontSize: 13, color: p.stone, marginBottom: 20 }}>
              Drawn from Norwegian landscapes — fjord depths, pine forests, morning frost, birch
              bark, mountain stone.
            </p>

            <Label>Primary</Label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
              {[
                { name: 'Fjord', hex: '#1B3A4B', desc: 'Brand primary, nav, CTAs' },
                { name: 'Pine', hex: '#2D5F3E', desc: 'Positive: income, on-track' },
                { name: 'Midnight', hex: '#0F1F28', desc: 'Darkest text, deep bg' },
              ].map((c) => (
                <ColorRow key={c.name} {...c} light />
              ))}
            </div>

            <Label>Neutrals</Label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
              {[
                { name: 'Snow', hex: '#F7F9F8', desc: 'Primary background' },
                { name: 'Frost', hex: '#E8F0ED', desc: 'Card backgrounds' },
                { name: 'Mist', hex: '#C8D5CE', desc: 'Borders, dividers' },
                { name: 'Stone', hex: '#8B9A8E', desc: 'Secondary text' },
              ].map((c) => (
                <ColorRow key={c.name} {...c} light={c.name === 'Stone'} />
              ))}
            </div>

            <Label>Accents</Label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
              {[
                { name: 'Lichen', hex: '#A3B8A0', desc: 'Subtle highlights' },
                { name: 'Birch', hex: '#D4C5A9', desc: 'Annual/pending states' },
                { name: 'Ember', hex: '#C4704B', desc: 'Warnings, over-budget' },
              ].map((c) => (
                <ColorRow key={c.name} {...c} light={c.name === 'Ember'} />
              ))}
            </div>

            <Card>
              <div style={{ fontSize: 13, fontWeight: 600, color: p.fjord, marginBottom: 8 }}>
                Semantic Usage
              </div>
              {(
                [
                  ['Income / paid / on-track', 'Pine', p.pine],
                  ['Expense / overspent / missed', 'Ember', p.ember],
                  ['Annual / pending / upcoming', 'Birch', p.birch],
                  ['Neutral / informational', 'Fjord', p.fjord],
                ] as const
              ).map(([use, name, color]) => (
                <div
                  key={use}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0' }}
                >
                  <div
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: 3,
                      background: color,
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ fontSize: 13, color: p.fjord, flex: 1 }}>{use}</span>
                  <span style={{ fontSize: 12, color: p.stone }}>{name}</span>
                </div>
              ))}
            </Card>
          </>
        )}

        {/* TYPE */}
        {tab === 2 && (
          <>
            <SectionTitle>Typography</SectionTitle>

            <Card style={{ marginBottom: 12 }}>
              <Label>Display — Fraunces</Label>
              <div
                style={{
                  fontFamily: "'Fraunces',serif",
                  fontSize: 32,
                  fontWeight: 300,
                  color: p.fjord,
                  lineHeight: 1.15,
                  margin: '12px 0 8px',
                }}
              >
                Your money, at a glance.
              </div>
              <div
                style={{
                  fontFamily: "'Fraunces',serif",
                  fontSize: 18,
                  fontWeight: 400,
                  color: p.fjord,
                  marginBottom: 10,
                }}
              >
                See the full picture. Make better decisions.
              </div>
              <div style={{ fontSize: 12, color: p.stone, lineHeight: 1.5 }}>
                Old-style soft serif with optical sizing. Warm and Scandinavian in character. Used
                for brand name, page titles, hero text.
              </div>
            </Card>

            <Card style={{ marginBottom: 12 }}>
              <Label>Interface — DM Sans</Label>
              <div
                style={{ fontSize: 16, fontWeight: 500, color: p.fjord, margin: '12px 0 6px' }}
              >
                Monthly Budget Overview
              </div>
              <div style={{ fontSize: 14, color: p.fjord, lineHeight: 1.6, marginBottom: 10 }}>
                Track spending across categories, monitor fixed expenses, and see exactly how much
                flexibility you have left after all commitments.
              </div>
              <div style={{ fontSize: 12, color: p.stone, lineHeight: 1.5 }}>
                Geometric sans with humanist touches. Clean, legible at all sizes. Used for all
                interface text, labels, buttons.
              </div>
            </Card>

            <Card>
              <Label>Figures — JetBrains Mono</Label>
              <div
                style={{ display: 'flex', gap: 24, margin: '12px 0 10px', flexWrap: 'wrap' }}
              >
                <div>
                  <div
                    style={{
                      fontFamily: "'JetBrains Mono',monospace",
                      fontSize: 28,
                      fontWeight: 500,
                      color: p.pine,
                    }}
                  >
                    $6,496.16
                  </div>
                  <div style={{ fontSize: 11, color: p.stone }}>Income</div>
                </div>
                <div>
                  <div
                    style={{
                      fontFamily: "'JetBrains Mono',monospace",
                      fontSize: 28,
                      fontWeight: 500,
                      color: p.ember,
                    }}
                  >
                    $2,279.72
                  </div>
                  <div style={{ fontSize: 11, color: p.stone }}>Committed</div>
                </div>
              </div>
              <div style={{ fontSize: 12, color: p.stone, lineHeight: 1.5 }}>
                Monospaced for tabular financial data. Numbers align vertically, making budget
                scanning instant. Used for all dollar amounts and percentages.
              </div>
            </Card>
          </>
        )}

        {/* APP */}
        {tab === 3 && (
          <>
            <SectionTitle>Dashboard Preview</SectionTitle>
            <p style={{ fontSize: 13, color: p.stone, marginBottom: 16 }}>
              How the brand system comes together in the product.
            </p>

            {/* Mini dashboard */}
            <div
              style={{
                background: p.snow,
                border: `1px solid ${p.mist}`,
                borderRadius: 14,
                overflow: 'hidden',
              }}
            >
              {/* Nav */}
              <div
                style={{
                  background: p.fjord,
                  padding: '12px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <div
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 6,
                    background: 'rgba(255,255,255,0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: "'Fraunces',serif",
                    fontSize: 12,
                    color: p.snow,
                  }}
                >
                  O
                </div>
                <span style={{ fontFamily: "'Fraunces',serif", fontSize: 14, color: p.snow }}>
                  oversikt
                </span>
                <span
                  style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginLeft: 'auto' }}
                >
                  Feb 2026
                </span>
              </div>

              <div style={{ padding: 14 }}>
                {/* Stats */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 8,
                    marginBottom: 14,
                  }}
                >
                  {[
                    { l: 'Net Worth', v: '$42,318', c: p.fjord },
                    { l: 'Income', v: '$6,496', c: p.pine },
                    { l: 'Expenses', v: '$3,423', c: p.ember },
                    { l: 'True Remaining', v: '$3,073', c: p.pine },
                  ].map((s) => (
                    <div
                      key={s.l}
                      style={{ background: p.frost, borderRadius: 8, padding: '10px 12px' }}
                    >
                      <div
                        style={{ fontSize: 10, color: p.stone, fontWeight: 500, marginBottom: 4 }}
                      >
                        {s.l}
                      </div>
                      <div
                        style={{
                          fontFamily: "'JetBrains Mono',monospace",
                          fontSize: 17,
                          fontWeight: 500,
                          color: s.c,
                        }}
                      >
                        {s.v}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Fixed expenses */}
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: p.fjord,
                    marginBottom: 8,
                    display: 'flex',
                    justifyContent: 'space-between',
                  }}
                >
                  <span>Fixed Expenses</span>
                  <span
                    style={{
                      fontFamily: "'JetBrains Mono',monospace",
                      fontWeight: 400,
                      color: p.stone,
                      fontSize: 11,
                    }}
                  >
                    $2,279.72/mo
                  </span>
                </div>

                {[
                  { n: 'Mortgage', a: '$1,450.00', s: 'paid', d: '15th' },
                  { n: 'Auto Insurance', a: '$189.00', s: 'paid', d: '1st' },
                  { n: 'AT&T Phone', a: '$89.99', s: 'paid', d: '10th' },
                  { n: 'Frontier Internet', a: '$74.99', s: 'paid', d: '10th' },
                  { n: 'Planet Fitness', a: '$24.99', s: 'upcoming', d: '28th' },
                ].map((x, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 10px',
                      borderRadius: 6,
                      marginBottom: 2,
                      background:
                        x.s === 'upcoming' ? 'rgba(196,112,75,0.04)' : 'transparent',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        minWidth: 0,
                      }}
                    >
                      <div
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: '50%',
                          background: x.s === 'paid' ? p.pine : p.birch,
                          flexShrink: 0,
                        }}
                      />
                      <span
                        style={{
                          fontSize: 13,
                          color: p.fjord,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {x.n}
                      </span>
                      <span style={{ fontSize: 10, color: p.stone, flexShrink: 0 }}>{x.d}</span>
                    </div>
                    <div
                      style={{
                        fontFamily: "'JetBrains Mono',monospace",
                        fontSize: 12,
                        color: x.s === 'paid' ? p.pine : p.fjord,
                        flexShrink: 0,
                      }}
                    >
                      {x.a}
                    </div>
                  </div>
                ))}

                {/* Budget preview */}
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: p.fjord,
                    marginTop: 14,
                    marginBottom: 8,
                  }}
                >
                  Top Budgets
                </div>
                {[
                  { n: 'Groceries', spent: 310, total: 500, pct: 62 },
                  { n: 'Dining Out', spent: 145, total: 200, pct: 73 },
                ].map((b) => (
                  <div key={b.n} style={{ marginBottom: 10 }}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: 12,
                        marginBottom: 4,
                      }}
                    >
                      <span style={{ color: p.fjord }}>{b.n}</span>
                      <span style={{ color: p.stone }}>
                        <span
                          style={{
                            fontFamily: "'JetBrains Mono',monospace",
                            color: p.fjord,
                          }}
                        >
                          ${b.spent}
                        </span>{' '}
                        / ${b.total}
                      </span>
                    </div>
                    <div
                      style={{
                        height: 5,
                        borderRadius: 3,
                        background: p.mist,
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          width: `${b.pct}%`,
                          height: '100%',
                          borderRadius: 3,
                          background: b.pct > 80 ? p.ember : p.pine,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* PARTS */}
        {tab === 4 && (
          <>
            <SectionTitle>UI Components</SectionTitle>

            <Label>Buttons</Label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
              {[
                { l: '+ New Budget', bg: p.fjord },
                { l: 'Export CSV', bg: 'transparent', border: true },
                { l: 'Confirm', bg: p.pine },
                { l: 'Delete', bg: p.ember },
              ].map((b) => (
                <button
                  key={b.l}
                  style={{
                    padding: '9px 16px',
                    borderRadius: 8,
                    border: b.border ? `1px solid ${p.mist}` : 'none',
                    background: b.bg,
                    color: b.border ? p.fjord : p.snow,
                    fontSize: 13,
                    fontWeight: 500,
                    fontFamily: "'DM Sans',sans-serif",
                    cursor: 'pointer',
                  }}
                >
                  {b.l}
                </button>
              ))}
            </div>

            <Label>Status Badges</Label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 20 }}>
              {[
                { l: 'ON TRACK', bg: 'rgba(45,95,62,0.1)', c: p.pine },
                { l: 'OVER BUDGET', bg: 'rgba(196,112,75,0.1)', c: p.ember },
                { l: 'PAID', bg: 'rgba(45,95,62,0.1)', c: p.pine },
                { l: 'MISSED', bg: 'rgba(196,112,75,0.1)', c: p.ember },
                { l: 'UPCOMING', bg: 'rgba(212,197,169,0.3)', c: '#8B7B5E' },
                { l: 'FIXED', bg: 'rgba(27,58,75,0.08)', c: p.fjord },
                { l: 'FLEXIBLE', bg: 'rgba(163,184,160,0.3)', c: '#4A6848' },
                { l: 'ANNUAL', bg: 'rgba(212,197,169,0.3)', c: '#8B7B5E' },
              ].map((b) => (
                <span
                  key={b.l}
                  style={{
                    padding: '4px 9px',
                    borderRadius: 5,
                    background: b.bg,
                    color: b.c,
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: '0.03em',
                  }}
                >
                  {b.l}
                </span>
              ))}
            </div>

            <Label>Budget Card</Label>
            <Card style={{ marginBottom: 16 }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  marginBottom: 12,
                }}
              >
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: p.fjord, marginBottom: 2 }}>
                    Groceries
                  </div>
                  <div style={{ fontSize: 11, color: p.stone }}>Flexible &middot; Monthly</div>
                </div>
                <span
                  style={{
                    padding: '3px 8px',
                    borderRadius: 4,
                    background: 'rgba(45,95,62,0.1)',
                    color: p.pine,
                    fontSize: 10,
                    fontWeight: 600,
                  }}
                >
                  ON TRACK
                </span>
              </div>
              <div
                style={{
                  height: 5,
                  borderRadius: 3,
                  background: p.mist,
                  marginBottom: 8,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{ width: '62%', height: '100%', borderRadius: 3, background: p.pine }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span>
                  <span
                    style={{
                      fontFamily: "'JetBrains Mono',monospace",
                      color: p.fjord,
                      fontWeight: 500,
                    }}
                  >
                    $310.42
                  </span>
                  <span style={{ color: p.stone }}> / $500.00</span>
                </span>
                <span
                  style={{
                    fontFamily: "'JetBrains Mono',monospace",
                    color: p.stone,
                    fontSize: 12,
                  }}
                >
                  62%
                </span>
              </div>
            </Card>

            <Label>Annual Expense Card</Label>
            <Card>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: 2,
                }}
              >
                <div style={{ fontSize: 15, fontWeight: 600, color: p.fjord }}>
                  Vacation / Travel
                </div>
                <span
                  style={{
                    padding: '3px 8px',
                    borderRadius: 4,
                    background: 'rgba(212,197,169,0.3)',
                    color: '#8B7B5E',
                    fontSize: 10,
                    fontWeight: 600,
                  }}
                >
                  ANNUAL
                </span>
              </div>
              <div style={{ fontSize: 11, color: p.stone, marginBottom: 12 }}>
                Due July 2026 &middot; 5 months remaining
              </div>
              <div
                style={{
                  height: 5,
                  borderRadius: 3,
                  background: p.mist,
                  marginBottom: 8,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{ width: '8%', height: '100%', borderRadius: 3, background: p.birch }}
                />
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 13,
                  marginBottom: 10,
                }}
              >
                <span>
                  <span
                    style={{
                      fontFamily: "'JetBrains Mono',monospace",
                      color: p.fjord,
                      fontWeight: 500,
                    }}
                  >
                    $200
                  </span>
                  <span style={{ color: p.stone }}> / $2,400</span>
                </span>
                <span
                  style={{
                    fontFamily: "'JetBrains Mono',monospace",
                    color: p.stone,
                    fontSize: 12,
                  }}
                >
                  8%
                </span>
              </div>
              <div
                style={{
                  padding: '7px 10px',
                  background: 'rgba(212,197,169,0.15)',
                  borderRadius: 6,
                  fontSize: 12,
                  color: '#8B7B5E',
                }}
              >
                Set aside{' '}
                <span style={{ fontFamily: "'JetBrains Mono',monospace", fontWeight: 500 }}>
                  $440/mo
                </span>{' '}
                to reach goal
              </div>
            </Card>
          </>
        )}
      </div>
    </div>
  )
}

function Card({ children, style = {} }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div style={{ background: '#E8F0ED', borderRadius: 12, padding: 20, marginBottom: 0, ...style }}>
      {children}
    </div>
  )
}

function Label({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        color: '#8B9A8E',
        marginBottom: 8,
        marginTop: 4,
      }}
    >
      {children}
    </div>
  )
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        fontFamily: "'Fraunces',serif",
        fontSize: 24,
        fontWeight: 400,
        color: '#1B3A4B',
        marginBottom: 6,
      }}
    >
      {children}
    </div>
  )
}

function ColorRow({
  name,
  hex,
  desc,
  light,
}: {
  name: string
  hex: string
  desc: string
  light: boolean
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 14px',
        background: hex,
        borderRadius: 10,
        border: hex === '#F7F9F8' ? '1px solid #C8D5CE' : 'none',
      }}
    >
      <div style={{ flex: 1 }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 500,
            color: light ? 'rgba(255,255,255,0.9)' : '#1B3A4B',
          }}
        >
          {name}
        </div>
        <div
          style={{ fontSize: 11, color: light ? 'rgba(255,255,255,0.55)' : '#8B9A8E' }}
        >
          {desc}
        </div>
      </div>
      <div
        style={{
          fontFamily: "'JetBrains Mono',monospace",
          fontSize: 11,
          color: light ? 'rgba(255,255,255,0.5)' : '#8B9A8E',
        }}
      >
        {hex}
      </div>
    </div>
  )
}
