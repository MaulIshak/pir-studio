import type { BoardTemplateCategory, BoardTemplateRecord } from './types'

export interface BuiltInBoardTemplate {
  id: string
  slug: string
  title: string
  category: BoardTemplateCategory
  description: string
  elements: Record<string, unknown>[]
}

const BASE62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'

/**
 * Generate a strictly increasing, 100% valid `fractional-indexing` order key
 * for any 0-based position (supports up to 3,906 elements).
 */
export function indexForPosition(position: number): string {
  const n = Math.max(0, Math.floor(position))
  if (n < 62) {
    return `a${BASE62[n]}`
  }
  const m = n - 62
  const hi = Math.floor(m / 62)
  const lo = m % 62
  return `b${BASE62[Math.min(hi, 61)]}${BASE62[lo]}`
}

/**
 * Validate whether a string is a syntactically valid `fractional-indexing` key.
 * Prevents Excalidraw from throwing `Error: invalid order key` when appending new elements.
 */
export function isValidOrderKey(key: unknown): key is string {
  if (typeof key !== 'string' || key.length < 2) return false
  const head = key.charCodeAt(0)
  let intDigits: number
  if (head >= 97 && head <= 122) {
    intDigits = head - 97 + 1
  } else if (head >= 65 && head <= 90) {
    intDigits = 90 - head + 1
  } else {
    return false
  }
  const intLen = 1 + intDigits
  if (key.length < intLen) return false
  if (!/^[0-9A-Za-z]+$/.test(key.slice(1))) return false
  if (key.length > intLen && key[key.length - 1] === '0') return false
  return true
}

function makeBase(
  id: string,
  index: string,
  overrides: Record<string, unknown>
): Record<string, unknown> {
  return {
    id,
    angle: 0,
    strokeColor: '#1e1e1e',
    backgroundColor: 'transparent',
    fillStyle: 'solid',
    strokeWidth: 2,
    strokeStyle: 'solid',
    roughness: 1,
    opacity: 100,
    groupIds: [],
    frameId: null,
    index,
    roundness: { type: 3 },
    seed: Math.abs(
      Array.from(id).reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) | 0, 7)
    ) + 1,
    version: 1,
    versionNonce: 1001,
    isDeleted: false,
    boundElements: null,
    updated: 1700000000000,
    link: null,
    locked: false,
    ...overrides,
  }
}

function makeRectWithText(
  prefix: string,
  idx: number,
  opts: {
    x: number
    y: number
    w: number
    h: number
    text: string
    bg: string
    stroke?: string
    fontSize?: number
    textAlign?: 'left' | 'center'
    verticalAlign?: 'top' | 'middle'
  }
): Record<string, unknown>[] {
  const rectId = `${prefix}_rect`
  const textId = `${prefix}_text`
  const rectIndex = indexForPosition(idx * 2)
  const textIndex = indexForPosition(idx * 2 + 1)
  const fontSize = opts.fontSize ?? 18
  const lines = opts.text.split('\n').length
  const textHeight = Math.ceil(lines * fontSize * 1.25)

  return [
    makeBase(rectId, rectIndex, {
      type: 'rectangle',
      x: opts.x,
      y: opts.y,
      width: opts.w,
      height: opts.h,
      backgroundColor: opts.bg,
      strokeColor: opts.stroke ?? '#1e1e1e',
      boundElements: [{ id: textId, type: 'text' }],
    }),
    makeBase(textId, textIndex, {
      type: 'text',
      x: opts.x + 12,
      y:
        opts.verticalAlign === 'top'
          ? opts.y + 12
          : opts.y + Math.max(10, (opts.h - textHeight) / 2),
      width: opts.w - 24,
      height: textHeight,
      strokeColor: '#1e1e1e',
      backgroundColor: 'transparent',
      roundness: null,
      text: opts.text,
      originalText: opts.text,
      fontSize,
      fontFamily: 5,
      textAlign: opts.textAlign ?? 'center',
      verticalAlign: opts.verticalAlign ?? 'middle',
      containerId: rectId,
      autoResize: true,
      lineHeight: 1.25,
    }),
  ]
}

function makeHeading(
  id: string,
  idx: number,
  x: number,
  y: number,
  text: string,
  fontSize = 24
): Record<string, unknown> {
  return makeBase(id, indexForPosition(30 + idx), {
    type: 'text',
    x,
    y,
    width: Math.max(180, text.length * fontSize * 0.6),
    height: Math.ceil(fontSize * 1.3),
    strokeColor: '#1e1e1e',
    backgroundColor: 'transparent',
    roundness: null,
    text,
    originalText: text,
    fontSize,
    fontFamily: 5,
    textAlign: 'left',
    verticalAlign: 'top',
    containerId: null,
    autoResize: true,
    lineHeight: 1.25,
  })
}

function makeArrow(
  id: string,
  idx: number,
  x: number,
  y: number,
  dx: number,
  dy: number,
  stroke = '#1e1e1e'
): Record<string, unknown> {
  return makeBase(id, indexForPosition(40 + idx), {
    type: 'arrow',
    x,
    y,
    width: Math.abs(dx),
    height: Math.abs(dy),
    strokeColor: stroke,
    roundness: { type: 2 },
    points: [
      [0, 0],
      [dx, dy],
    ],
    lastCommittedPoint: null,
    startBinding: null,
    endBinding: null,
    startArrowhead: null,
    endArrowhead: 'arrow',
  })
}

export const BUILT_IN_BOARD_TEMPLATES: BuiltInBoardTemplate[] = [
  {
    id: 'system:theme-brainstorm',
    slug: 'theme-brainstorm',
    title: 'Theme Brainstorm',
    category: 'brainstorm',
    description: 'Rapid jam ideation across mechanics, vibe, twist, and wild hooks.',
    elements: [
      makeHeading('tb_title', 0, 60, 20, 'THEME BRAINSTORM', 28),
      // 4 quadrant containers
      ...makeRectWithText('tb_q1', 1, {
        x: 60,
        y: 80,
        w: 360,
        h: 260,
        text: 'CORE MECHANICS',
        bg: '#e7f5ff',
        stroke: '#1971c2',
        fontSize: 16,
        verticalAlign: 'top',
      }),
      ...makeRectWithText('tb_q2', 2, {
        x: 460,
        y: 80,
        w: 360,
        h: 260,
        text: 'VIBE & ART DIRECTION',
        bg: '#f3f0ff',
        stroke: '#6741d9',
        fontSize: 16,
        verticalAlign: 'top',
      }),
      ...makeRectWithText('tb_q3', 3, {
        x: 60,
        y: 380,
        w: 360,
        h: 260,
        text: 'THEME TWIST',
        bg: '#fff9db',
        stroke: '#e67700',
        fontSize: 16,
        verticalAlign: 'top',
      }),
      ...makeRectWithText('tb_q4', 4, {
        x: 460,
        y: 380,
        w: 360,
        h: 260,
        text: 'WILD HOOKS',
        bg: '#ebfbee',
        stroke: '#2f9e44',
        fontSize: 16,
        verticalAlign: 'top',
      }),
      // Center theme hub
      ...makeRectWithText('tb_center', 5, {
        x: 350,
        y: 315,
        w: 180,
        h: 90,
        text: 'JAM THEME\n(Edit me)',
        bg: '#ffc9c9',
        stroke: '#c92a2a',
        fontSize: 18,
      }),
      // Starter sticky notes
      ...makeRectWithText('tb_s1', 6, {
        x: 90,
        y: 140,
        w: 140,
        h: 90,
        text: 'One-button\nmechanic?',
        bg: '#ffec99',
        stroke: '#f08c00',
        fontSize: 14,
      }),
      ...makeRectWithText('tb_s2', 7, {
        x: 500,
        y: 140,
        w: 140,
        h: 90,
        text: 'Low-poly /\nPixel palette',
        bg: '#d0bfff',
        stroke: '#7048e8',
        fontSize: 14,
      }),
      ...makeRectWithText('tb_s3', 8, {
        x: 90,
        y: 440,
        w: 150,
        h: 90,
        text: 'Flip the rule\nhalfway through',
        bg: '#ffd8a8',
        stroke: '#d9480f',
        fontSize: 14,
      }),
    ],
  },
  {
    id: 'system:core-loop',
    slug: 'core-loop',
    title: 'Core Loop',
    category: 'gameplay',
    description: 'Map the 30-second gameplay loop, feedback, rewards, and meta progression.',
    elements: [
      makeHeading('cl_title', 0, 80, 20, 'CORE GAMEPLAY LOOP', 28),
      ...makeRectWithText('cl_action', 1, {
        x: 310,
        y: 90,
        w: 220,
        h: 100,
        text: '1. PLAYER ACTION\nExplore / Fight / Craft',
        bg: '#d0ebff',
        stroke: '#1971c2',
        fontSize: 16,
      }),
      ...makeRectWithText('cl_feedback', 2, {
        x: 590,
        y: 250,
        w: 220,
        h: 100,
        text: '2. JUICE & FEEDBACK\nSFX, Hitstop, Particles',
        bg: '#fff3bf',
        stroke: '#e67700',
        fontSize: 16,
      }),
      ...makeRectWithText('cl_reward', 3, {
        x: 310,
        y: 410,
        w: 220,
        h: 100,
        text: '3. REWARD\nLoot, Score, Unlock',
        bg: '#d3f9d8',
        stroke: '#2f9e44',
        fontSize: 16,
      }),
      ...makeRectWithText('cl_upgrade', 4, {
        x: 40,
        y: 250,
        w: 220,
        h: 100,
        text: '4. PROGRESSION\nNew Ability / Harder Stage',
        bg: '#e5dbff',
        stroke: '#6741d9',
        fontSize: 16,
      }),
      makeArrow('cl_a1', 1, 535, 145, 130, 95, '#1971c2'),
      makeArrow('cl_a2', 2, 665, 355, -130, 95, '#e67700'),
      makeArrow('cl_a3', 3, 305, 455, -130, -95, '#2f9e44'),
      makeArrow('cl_a4', 4, 175, 245, 130, -95, '#6741d9'),
      ...makeRectWithText('cl_goal', 5, {
        x: 300,
        y: 255,
        w: 240,
        h: 90,
        text: 'WIN / FAIL CONDITION\nDefine clear tension',
        bg: '#ffe3e3',
        stroke: '#c92a2a',
        fontSize: 15,
      }),
    ],
  },
  {
    id: 'system:scope-cut',
    slug: 'scope-cut',
    title: 'Scope Cut',
    category: 'scope',
    description: 'Prioritize jam features to lock MVP early and cut risk before deadline.',
    elements: [
      makeHeading('sc_title', 0, 40, 20, 'SCOPE & FEATURE CUT', 28),
      ...makeRectWithText('sc_col1', 1, {
        x: 40,
        y: 80,
        w: 230,
        h: 460,
        text: 'MUST HAVE (MVP)',
        bg: '#ebfbee',
        stroke: '#2f9e44',
        fontSize: 16,
        verticalAlign: 'top',
      }),
      ...makeRectWithText('sc_col2', 2, {
        x: 290,
        y: 80,
        w: 230,
        h: 460,
        text: 'SHOULD HAVE',
        bg: '#e7f5ff',
        stroke: '#1971c2',
        fontSize: 16,
        verticalAlign: 'top',
      }),
      ...makeRectWithText('sc_col3', 3, {
        x: 540,
        y: 80,
        w: 230,
        h: 460,
        text: 'POLISH / STRETCH',
        bg: '#fff9db',
        stroke: '#e67700',
        fontSize: 16,
        verticalAlign: 'top',
      }),
      ...makeRectWithText('sc_col4', 4, {
        x: 790,
        y: 80,
        w: 230,
        h: 460,
        text: 'CUT FOR JAM',
        bg: '#fff5f5',
        stroke: '#c92a2a',
        fontSize: 16,
        verticalAlign: 'top',
      }),
      ...makeRectWithText('sc_c1', 5, {
        x: 60,
        y: 135,
        w: 190,
        h: 75,
        text: 'Playable movement\n& core interaction',
        bg: '#b2f2bb',
        stroke: '#2b8a3e',
        fontSize: 14,
      }),
      ...makeRectWithText('sc_c2', 6, {
        x: 60,
        y: 225,
        w: 190,
        h: 75,
        text: 'Title, Win, Retry\nfull game loop',
        bg: '#b2f2bb',
        stroke: '#2b8a3e',
        fontSize: 14,
      }),
      ...makeRectWithText('sc_c3', 7, {
        x: 310,
        y: 135,
        w: 190,
        h: 75,
        text: 'BGM + core SFX\nfeedback pass',
        bg: '#a5d8ff',
        stroke: '#1864ab',
        fontSize: 14,
      }),
      ...makeRectWithText('sc_c4', 8, {
        x: 560,
        y: 135,
        w: 190,
        h: 75,
        text: 'Screen shake &\nparticle juice',
        bg: '#ffec99',
        stroke: '#e67700',
        fontSize: 14,
      }),
      ...makeRectWithText('sc_c5', 9, {
        x: 810,
        y: 135,
        w: 190,
        h: 75,
        text: 'Online leaderboard\n& extra classes',
        bg: '#ffc9c9',
        stroke: '#c92a2a',
        fontSize: 14,
      }),
    ],
  },
  {
    id: 'system:level-blockout',
    slug: 'level-blockout',
    title: 'Level Blockout',
    category: 'level',
    description: 'Top-down room pacing sketch with spawn, encounters, secrets, and legend.',
    elements: [
      makeHeading('lb_title', 0, 50, 20, 'LEVEL 01 BLOCKOUT', 28),
      ...makeRectWithText('lb_spawn', 1, {
        x: 60,
        y: 190,
        w: 160,
        h: 130,
        text: 'SAFE SPAWN\nTeach Controls',
        bg: '#d3f9d8',
        stroke: '#2f9e44',
        fontSize: 15,
      }),
      ...makeRectWithText('lb_hall', 2, {
        x: 270,
        y: 215,
        w: 130,
        h: 80,
        text: 'CORRIDOR\nFirst Hazard',
        bg: '#fff3bf',
        stroke: '#e67700',
        fontSize: 14,
      }),
      ...makeRectWithText('lb_arena', 3, {
        x: 450,
        y: 140,
        w: 220,
        h: 230,
        text: 'MAIN ARENA\nCore Combat / Puzzle',
        bg: '#d0ebff',
        stroke: '#1971c2',
        fontSize: 16,
      }),
      ...makeRectWithText('lb_secret', 4, {
        x: 480,
        y: 420,
        w: 160,
        h: 100,
        text: 'SIDE SECRET\nBonus Pickup',
        bg: '#e5dbff',
        stroke: '#6741d9',
        fontSize: 14,
      }),
      ...makeRectWithText('lb_exit', 5, {
        x: 730,
        y: 190,
        w: 160,
        h: 130,
        text: 'GOAL / EXIT\nNext Stage Gate',
        bg: '#ffe3e3',
        stroke: '#c92a2a',
        fontSize: 15,
      }),
      makeArrow('lb_a1', 1, 222, 255, 44, 0, '#1e1e1e'),
      makeArrow('lb_a2', 2, 402, 255, 44, 0, '#1e1e1e'),
      makeArrow('lb_a3', 3, 560, 372, 0, 44, '#6741d9'),
      makeArrow('lb_a4', 4, 672, 255, 54, 0, '#c92a2a'),
      // Legend box
      ...makeRectWithText('lb_legend', 6, {
        x: 60,
        y: 400,
        w: 320,
        h: 120,
        text: 'LEGEND\nGreen: Safe / Checkpoint   Yellow: Hazard\nBlue: Combat / Puzzle   Purple: Reward',
        bg: '#f8f9fa',
        stroke: '#495057',
        fontSize: 13,
        textAlign: 'left',
        verticalAlign: 'top',
      }),
    ],
  },
  {
    id: 'system:screen-flow',
    slug: 'screen-flow',
    title: 'Screen Flow',
    category: 'ui',
    description: 'Wireframe menu navigation from title screen through HUD, pause, and credits.',
    elements: [
      makeHeading('sf_title', 0, 50, 20, 'UI & SCREEN FLOW', 28),
      ...makeRectWithText('sf_menu', 1, {
        x: 60,
        y: 160,
        w: 180,
        h: 130,
        text: 'TITLE SCREEN\nPlay / Options / Credits',
        bg: '#e7f5ff',
        stroke: '#1971c2',
        fontSize: 15,
      }),
      ...makeRectWithText('sf_play', 2, {
        x: 320,
        y: 160,
        w: 200,
        h: 130,
        text: 'GAMEPLAY HUD\nHP, Timer, Objective',
        bg: '#d3f9d8',
        stroke: '#2f9e44',
        fontSize: 15,
      }),
      ...makeRectWithText('sf_pause', 3, {
        x: 330,
        y: 370,
        w: 180,
        h: 110,
        text: 'PAUSE OVERLAY\nResume / Audio / Quit',
        bg: '#fff3bf',
        stroke: '#e67700',
        fontSize: 14,
      }),
      ...makeRectWithText('sf_over', 4, {
        x: 600,
        y: 90,
        w: 180,
        h: 110,
        text: 'GAME OVER\nInstant Retry / Title',
        bg: '#ffe3e3',
        stroke: '#c92a2a',
        fontSize: 14,
      }),
      ...makeRectWithText('sf_win', 5, {
        x: 600,
        y: 250,
        w: 180,
        h: 110,
        text: 'VICTORY\nScore / Credits',
        bg: '#e5dbff',
        stroke: '#6741d9',
        fontSize: 14,
      }),
      ...makeRectWithText('sf_credits', 6, {
        x: 60,
        y: 370,
        w: 180,
        h: 110,
        text: 'CREDITS\nTeam & Asset Licenses',
        bg: '#f8f9fa',
        stroke: '#495057',
        fontSize: 14,
      }),
      makeArrow('sf_a1', 1, 244, 225, 72, 0, '#1971c2'),
      makeArrow('sf_a2', 2, 150, 294, 0, 72, '#495057'),
      makeArrow('sf_a3', 3, 420, 294, 0, 72, '#e67700'),
      makeArrow('sf_a4', 4, 524, 195, 72, -45, '#c92a2a'),
      makeArrow('sf_a5', 5, 524, 255, 72, 45, '#6741d9'),
    ],
  },
]

export function getBuiltInTemplateById(id: string): BuiltInBoardTemplate | null {
  return BUILT_IN_BOARD_TEMPLATES.find((t) => t.id === id || t.slug === id) ?? null
}

export function builtInToTemplateRecord(tpl: BuiltInBoardTemplate): BoardTemplateRecord {
  return {
    id: tpl.id,
    organization_id: null,
    slug: tpl.slug,
    title: tpl.title,
    category: tpl.category,
    description: tpl.description,
    content: { elements: tpl.elements },
    is_system: true,
    created_by: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  }
}

