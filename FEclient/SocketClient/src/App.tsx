import { useEffect, useMemo, useRef, useState } from 'react'
import { io } from 'socket.io-client'
import type { Socket } from 'socket.io-client'

type ConversationId = string

interface ChatMessage {
  _id?: string
  conversationId?: string
  content?: string
  createdAt?: string | Date
  senderRole?: string
  sender?: {
    id?: string
    type?: string
  }
}

interface Conversation {
  _id: ConversationId
  customerId?: string
  customerName?: string
  lastMessageAt?: string | Date
  lastMessage?: string
  status?: string
  assignedHostId?: string
  unreadCount?: number
}

interface Ack {
  success?: boolean
  message?: string
  data?: {
    conversationId?: string
  }
}

interface JwtPayload {
  user_id?: string
  id?: string
  role?: string
}

type FilterType = 'all' | 'open' | 'unread'

type IconName =
  | 'inbox'
  | 'bag'
  | 'search'
  | 'users'
  | 'settings'
  | 'bell'
  | 'more'
  | 'phone'
  | 'video'
  | 'info'
  | 'send'
  | 'paperclip'
  | 'smile'
  | 'image'
  | 'arrow'
  | 'close'
  | 'code'
  | 'chevron'
  | 'check'
  | 'plus'

/* =========================================================
   TOKENS & HELPERS
========================================================= */

const COLOR = {
  fireSoft: '#FBE3DE',
  fireDark: '#B5301F',
  herbDot: '#3D7A4E',
  herbSoft: '#E3F0E6',
  herbText: '#2F6B41',
  amberDot: '#C99A3D',
  amberSoft: '#FBF0DC',
  amberText: '#96692A',
  grayDot: '#9AA093',
  graySoft: '#EEEFEA',
  grayText: '#6E7568',
  staffBg: '#191A16',
  staffFg: '#FFFFFF',
} as const

const AVATAR_PALETTE = [
  { bg: '#FBE3DE', fg: '#B5301F' },
  { bg: '#E3F0E6', fg: '#2F6B41' },
  { bg: '#FBF0DC', fg: '#96692A' },
  { bg: '#E7EEF7', fg: '#3C5C8C' },
  { bg: '#F3E6F0', fg: '#8C4472' },
  { bg: '#E1EFEC', fg: '#2B7D6C' },
]

const avatarTone = (seed: string) => {
  let hash = 0

  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i)
    hash |= 0
  }

  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length]
}

const statusTone = (status?: string) => {
  const s = (status || 'open').toLowerCase()

  if (s === 'closed' || s === 'resolved') {
    return { dot: COLOR.grayDot, bg: COLOR.graySoft, fg: COLOR.grayText }
  }

  if (s === 'pending') {
    return { dot: COLOR.amberDot, bg: COLOR.amberSoft, fg: COLOR.amberText }
  }

  return { dot: COLOR.herbDot, bg: COLOR.herbSoft, fg: COLOR.herbText }
}

const time = (v?: string | Date) =>
  v
    ? new Date(v).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      })
    : ''

const dayTime = (v?: string | Date) =>
  v
    ? new Date(v).toLocaleString([], {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    : ''

const displayName = (c?: Conversation | null) =>
  c?.customerName || c?.customerId || 'Khách hàng'

const initial = (name: string) => name.trim().charAt(0).toUpperCase() || 'K'

const role = (m: ChatMessage) =>
  String(m.senderRole || m.sender?.type || 'customer').toLowerCase()

/* =========================================================
   ICON
========================================================= */

function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.7,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }

  switch (name) {
    case 'inbox':
      return (
        <svg {...common}>
          <path d="M4 5h16v14H4z" />
          <path d="M4 14h4l2 2h4l2-2h4" />
        </svg>
      )

    case 'bag':
      return (
        <svg {...common}>
          <path d="M6 8h12l-1 12H7L6 8Z" />
          <path d="M9 8a3 3 0 0 1 6 0" />
        </svg>
      )

    case 'search':
      return (
        <svg {...common}>
          <circle cx="11" cy="11" r="6.5" />
          <path d="m16 16 4 4" />
        </svg>
      )

    case 'users':
      return (
        <svg {...common}>
          <circle cx="9" cy="8" r="3" />
          <path d="M3.5 19c.7-3.2 2.5-4.8 5.5-4.8s4.8 1.6 5.5 4.8" />
          <path d="M15.5 5.5a3 3 0 0 1 0 5.8" />
          <path d="M17 14.5c2 .6 3.3 2 3.8 4.5" />
        </svg>
      )

    case 'settings':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-1.7 1.7-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.1h-2.4v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L8 17l.1-.1A1.7 1.7 0 0 0 8.4 15a1.7 1.7 0 0 0-1.6-1H6.7v-2.4h.1a1.7 1.7 0 0 0 1.6-1A1.7 1.7 0 0 0 8.1 8l-.1-.1 1.7-1.7.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.6v-.1h2.4V5a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1 1.7 1.7-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.1V14h-.1a1.7 1.7 0 0 0-1.6 1Z" />
        </svg>
      )

    case 'bell':
      return (
        <svg {...common}>
          <path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
          <path d="M10 21h4" />
        </svg>
      )

    case 'more':
      return (
        <svg {...common}>
          <circle cx="5" cy="12" r="1" fill="currentColor" />
          <circle cx="12" cy="12" r="1" fill="currentColor" />
          <circle cx="19" cy="12" r="1" fill="currentColor" />
        </svg>
      )

    case 'phone':
      return (
        <svg {...common}>
          <path d="M7 4h3l1.5 4-2 1.5a15 15 0 0 0 5 5l1.5-2 4 1.5v3c0 1-1 2-2 2C10 18.5 5.5 14 4 6c0-1 1-2 3-2Z" />
        </svg>
      )

    case 'video':
      return (
        <svg {...common}>
          <rect x="3" y="6" width="13" height="12" rx="2" />
          <path d="m16 10 5-3v10l-5-3z" />
        </svg>
      )

    case 'info':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 10v6" />
          <circle cx="12" cy="7" r=".7" fill="currentColor" />
        </svg>
      )

    case 'send':
      return (
        <svg {...common}>
          <path d="m4 4 17 8-17 8 3-8-3-8Z" />
          <path d="M7 12h14" />
        </svg>
      )

    case 'paperclip':
      return (
        <svg {...common}>
          <path d="m20 11-8.5 8.5a5 5 0 0 1-7-7L13 4a3.5 3.5 0 0 1 5 5l-8 8a2 2 0 0 1-3-3l7-7" />
        </svg>
      )

    case 'smile':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M8 14s1.5 2 4 2 4-2 4-2" />
          <path d="M9 9h.01M15 9h.01" />
        </svg>
      )

    case 'image':
      return (
        <svg {...common}>
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <circle cx="8.5" cy="9" r="1.5" />
          <path d="m21 15-5-5L5 20" />
        </svg>
      )

    case 'arrow':
      return (
        <svg {...common}>
          <path d="M5 12h14" />
          <path d="m13 6 6 6-6 6" />
        </svg>
      )

    case 'close':
      return (
        <svg {...common}>
          <path d="m6 6 12 12M18 6 6 18" />
        </svg>
      )

    case 'code':
      return (
        <svg {...common}>
          <path d="m8 8-4 4 4 4M16 8l4 4-4 4M14 5l-4 14" />
        </svg>
      )

    case 'chevron':
      return (
        <svg {...common}>
          <path d="m7 10 5 5 5-5" />
        </svg>
      )

    case 'check':
      return (
        <svg {...common}>
          <path d="m5 12 4 4L19 6" />
        </svg>
      )

    case 'plus':
      return (
        <svg {...common}>
          <path d="M12 5v14M5 12h14" />
        </svg>
      )

    default:
      return null
  }
}

/* =========================================================
   AVATAR
========================================================= */

function Avatar({
  name,
  size = 'md',
  online = false,
  staff = false,
}: {
  name: string
  size?: 'sm' | 'md' | 'lg'
  online?: boolean
  staff?: boolean
}) {
  const sizeClass = {
    sm: 'h-8 w-8 text-[10px]',
    md: 'h-10 w-10 text-[12px]',
    lg: 'h-14 w-14 text-[16px]',
  }[size]

  const tone = staff ? { bg: COLOR.staffBg, fg: COLOR.staffFg } : avatarTone(name)

  return (
    <div className="relative shrink-0">
      <div
        className={`flex ${sizeClass} items-center justify-center rounded-full font-semibold`}
        style={{ backgroundColor: tone.bg, color: tone.fg }}
      >
        {initial(name)}
      </div>

      {online && (
        <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-[var(--surface)] bg-[var(--herb)]" />
      )}
    </div>
  )
}

/* =========================================================
   APP
========================================================= */

export default function App() {
  const socketRef = useRef<Socket | null>(null)
  const bottomRef = useRef<HTMLDivElement | null>(null)
  const activeIdRef = useRef<ConversationId | null>(null)
  const searchInputRef = useRef<HTMLInputElement | null>(null)

  const [socketUrl, setSocketUrl] = useState('http://localhost:3000')
  const [token, setToken] = useState('')
  const [connected, setConnected] = useState(false)

  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeId, setActiveId] = useState<ConversationId | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [search, setSearch] = useState('')
  const [input, setInput] = useState('')

  const [mobileInbox, setMobileInbox] = useState(false)
  const [showDetails, setShowDetails] = useState(true)
  const [showDevTools, setShowDevTools] = useState(false)

  const [filter, setFilter] = useState<FilterType>('all')
  const [logs, setLogs] = useState<string[]>([])

  const active = conversations.find((c) => c._id === activeId) || null

  const addLog = (event: string, payload?: unknown) => {
    let value = ''

    try {
      value = payload === undefined ? '' : JSON.stringify(payload)
    } catch {
      value = '[unserializable]'
    }

    setLogs((prev) => [
      ...prev.slice(-199),
      `${new Date().toLocaleTimeString()}  ${event} ${value}`,
    ])
  }

  useEffect(() => {
    activeIdRef.current = activeId
  }, [activeId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    return () => {
      socketRef.current?.disconnect()
      socketRef.current = null
    }
  }, [])

  const connect = () => {
    if (socketRef.current?.connected) {
      socketRef.current.disconnect()
      return
    }

    if (!token.trim()) {
      alert('Vui lòng nhập JWT Token.')
      return
    }

    const socket = io(socketUrl, {
      auth: { token: token.trim() },
      transports: ['websocket', 'polling'],
    })

    socketRef.current = socket
    addLog('CONNECTING', socketUrl)

    socket.on('connect', () => {
      setConnected(true)
      addLog('CONNECT', socket.id)

      try {
        const payload = JSON.parse(atob(token.split('.')[1])) as JwtPayload
        addLog('AUTH', { userId: payload.user_id || payload.id, role: payload.role })
      } catch {
        addLog('AUTH', 'JWT payload unavailable')
      }
    })

    socket.on('disconnect', (reason) => {
      setConnected(false)
      addLog('DISCONNECT', reason)
    })

    socket.on('connect_error', (err) => {
      setConnected(false)
      addLog('CONNECT_ERROR', err.message)
    })

    socket.on('conversation:new', (conv: Conversation) => {
      addLog('conversation:new', conv)

      setConversations((prev) => {
        if (prev.some((x) => x._id === conv._id)) return prev
        return [conv, ...prev]
      })
    })

    socket.on('conversation:updated', (conv: Conversation) => {
      addLog('conversation:updated', conv)

      setConversations((prev) => {
        const exists = prev.some((x) => x._id === conv._id)

        // Backend can send an update for a conversation this client never
        // received a conversation:new for (e.g. it already existed before
        // this session connected). Insert it instead of silently dropping it.
        if (!exists) {
          return [
            { ...conv, unreadCount: conv._id === activeIdRef.current ? 0 : 1 },
            ...prev,
          ]
        }

        return prev.map((x) => (x._id === conv._id ? { ...x, ...conv } : x))
      })
    })

    socket.on('message:new', (msg: ChatMessage) => {
      addLog('message:new', msg)

      const currentActiveId = activeIdRef.current

      if (msg.conversationId === currentActiveId) {
        setMessages((prev) => [...prev, msg])
      }

      if (msg.conversationId) {
        setConversations((prev) =>
          prev.map((c) =>
            c._id === msg.conversationId
              ? {
                  ...c,
                  lastMessage: msg.content,
                  lastMessageAt: msg.createdAt,
                  unreadCount:
                    msg.conversationId === currentActiveId
                      ? 0
                      : (c.unreadCount || 0) + 1,
                }
              : c,
          ),
        )
      }
    })
  }

  const joinConversation = (id: ConversationId) => {
    const socket = socketRef.current

    if (!socket?.connected) return

    setActiveId(id)
    activeIdRef.current = id
    setMessages([])

    socket.emit('conversation:join', { conversationId: id }, (res: Ack) => {
      addLog('ACK conversation:join', res)

      if (!res?.success) {
        alert(res?.message || 'Không thể join conversation.')
      }
    })

    setConversations((prev) =>
      prev.map((c) => (c._id === id ? { ...c, unreadCount: 0 } : c)),
    )

    setMobileInbox(false)
  }

  const sendMessage = () => {
    const socket = socketRef.current

    if (!socket?.connected || !activeId || !input.trim()) return

    const payload = {
      conversationId: activeId,
      content: input.trim(),
      type: 'TEXT',
    }

    socket.emit('message:send', payload, (res: Ack) => {
      addLog('ACK message:send', res)

      if (res?.success) {
        setInput('')
      } else {
        alert(res?.message || 'Gửi message thất bại.')
      }
    })
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()

    let result = conversations

    if (filter === 'open') {
      result = result.filter(
        (c) => String(c.status || 'open').toLowerCase() === 'open',
      )
    }

    if (filter === 'unread') {
      result = result.filter((c) => (c.unreadCount || 0) > 0)
    }

    if (q) {
      result = result.filter((c) =>
        [c.customerName, c.customerId, c.lastMessage, c._id]
          .filter(Boolean)
          .some((x) => String(x).toLowerCase().includes(q)),
      )
    }

    return [...result].sort(
      (a, b) =>
        new Date(b.lastMessageAt || 0).getTime() -
        new Date(a.lastMessageAt || 0).getTime(),
    )
  }, [conversations, search, filter])

  const totalUnread = conversations.reduce((sum, c) => sum + (c.unreadCount || 0), 0)

  return (
    <div className="fh-app min-h-screen bg-[var(--paper)] text-[var(--ink)]">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap');

        .fh-app {
          --ink: #191A16;
          --paper: #F1F2ED;
          --surface: #FFFFFF;
          --surface-2: #FAFAF7;
          --rule: #DCE0D6;
          --rule-soft: #E9EBE4;
          --muted: #6E7568;
          --faint: #9CA396;
          --fire: #D33F2C;
          --fire-dark: #B5301F;
          --fire-soft: #FBE3DE;
          --fire-softer: #FDF0ED;
          --herb: #3D7A4E;
          --herb-soft: #E3F0E6;
          font-family: 'IBM Plex Sans', ui-sans-serif, system-ui, -apple-system, sans-serif;
        }

        .fh-display {
          font-family: 'Space Grotesk', ui-sans-serif, system-ui, sans-serif;
        }

        .fh-mono {
          font-family: 'IBM Plex Mono', ui-monospace, SFMono-Regular, monospace;
        }

        .fh-app * {
          scrollbar-width: thin;
          scrollbar-color: #D7DCCF transparent;
        }

        .fh-app ::-webkit-scrollbar {
          width: 5px;
          height: 5px;
        }

        .fh-app ::-webkit-scrollbar-thumb {
          background: #D7DCCF;
          border-radius: 999px;
        }

        .fh-app textarea::placeholder,
        .fh-app input::placeholder {
          color: #9CA396;
        }

        .fh-app button:focus-visible,
        .fh-app input:focus-visible,
        .fh-app textarea:focus-visible {
          outline: 2px solid var(--fire);
          outline-offset: 2px;
        }

        @media (prefers-reduced-motion: reduce) {
          .fh-app * {
            transition: none !important;
            animation: none !important;
            scroll-behavior: auto !important;
          }
        }
      `}</style>

      <div className="h-[3px] w-full bg-gradient-to-r from-[var(--fire-dark)] via-[var(--fire)] to-[#E8724F]" />

      {/* TOP BAR */}

      <header className="sticky top-0 z-30 h-[62px] border-b border-[var(--rule)] bg-[var(--surface)]/95 backdrop-blur-sm">
        <div className="flex h-full items-center justify-between px-4 lg:px-5">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileInbox(true)}
              className="rounded-xl p-2 text-[var(--muted)] transition-colors duration-150 hover:bg-[var(--surface-2)] lg:hidden"
            >
              <Icon name="inbox" size={17} />
            </button>

            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--fire)] to-[var(--fire-dark)] text-[13px] font-bold text-white shadow-[0_2px_8px_rgba(211,63,44,0.3)]">
                F
              </div>

              <div className="hidden leading-tight sm:block">
                <div className="fh-display text-[14px] font-semibold tracking-tight">
                  FoodHub
                </div>

                <div className="text-[9px] font-medium text-[var(--faint)]">
                  Support console
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => searchInputRef.current?.focus()}
              className="hidden rounded-xl p-2 text-[var(--muted)] transition-colors duration-150 hover:bg-[var(--surface-2)] sm:block"
              title="Search tickets"
            >
              <Icon name="search" size={16} />
            </button>

            <button
              className="rounded-xl p-2 text-[var(--muted)] transition-colors duration-150 hover:bg-[var(--surface-2)]"
              title="Notifications"
            >
              <Icon name="bell" size={16} />
            </button>

            <button
              onClick={() => setShowDetails((x) => !x)}
              className="hidden rounded-xl px-2.5 py-1.5 text-[10px] font-medium text-[var(--muted)] transition-colors duration-150 hover:bg-[var(--surface-2)] xl:block"
            >
              {showDetails ? 'Hide details' : 'Details'}
            </button>

            <button
              onClick={() => setShowDevTools((x) => !x)}
              className="hidden items-center gap-1.5 rounded-xl border border-[var(--rule)] px-2.5 py-1.5 text-[10px] font-medium text-[var(--muted)] transition-colors duration-150 hover:bg-[var(--surface-2)] md:flex"
            >
              <Icon name="code" size={13} />
              Developer
            </button>

            <div
              className={`ml-1 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[9px] font-semibold ${
                connected
                  ? 'bg-[var(--herb-soft)] text-[var(--herb)]'
                  : 'bg-[var(--surface-2)] text-[var(--faint)]'
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  connected ? 'bg-[var(--herb)]' : 'bg-[var(--faint)]'
                }`}
              />
              {connected ? 'Connected' : 'Offline'}
            </div>
          </div>
        </div>
      </header>

      {/* APPLICATION */}

      <main className="h-[calc(100vh-65px)] overflow-hidden">
        <div className="flex h-full">
          {/* LEFT RAIL */}

          <nav className="hidden w-[64px] shrink-0 flex-col items-center border-r border-[var(--rule)] bg-[var(--surface-2)] py-3 md:flex">
            <RailIcon icon="inbox" active badge={totalUnread > 0 ? totalUnread : undefined} />
            <RailIcon icon="bag" />
            <RailIcon icon="users" />

            <div className="my-3 h-px w-7 bg-[var(--rule)]" />

            <RailIcon icon="bell" />

            <div className="mt-auto">
              <RailIcon icon="settings" />
            </div>
          </nav>

          {/* TICKET LIST */}

          <aside
            className={`${
              mobileInbox
                ? 'fixed inset-y-0 left-0 z-50 flex w-[330px] shadow-2xl'
                : 'hidden'
            } w-[320px] shrink-0 flex-col border-r border-[var(--rule)] bg-[var(--surface)] lg:flex`}
          >
            <div className="border-b border-[var(--rule-soft)] px-4 pb-3 pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="fh-display text-[14px] font-semibold tracking-tight">
                      Tickets
                    </h1>

                    {totalUnread > 0 && (
                      <span className="fh-mono rounded-full bg-[var(--fire)] px-1.5 py-0.5 text-[8px] font-bold text-white">
                        {totalUnread}
                      </span>
                    )}
                  </div>

                  <p className="mt-0.5 text-[9px] text-[var(--faint)]">
                    {conversations.length} conversations
                  </p>
                </div>

                <button
                  onClick={() => setMobileInbox(false)}
                  className="rounded-xl p-1.5 text-[var(--muted)] hover:bg-[var(--surface-2)] lg:hidden"
                >
                  <Icon name="close" size={16} />
                </button>
              </div>

              <div className="relative mt-4">
                <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--faint)]">
                  <Icon name="search" size={14} />
                </div>

                <input
                  ref={searchInputRef}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-9 w-full rounded-xl border border-[var(--rule)] bg-[var(--surface-2)] pl-9 pr-3 text-[11px] outline-none transition-colors duration-150 focus:border-[var(--fire)] focus:bg-[var(--surface)] focus:ring-2 focus:ring-[var(--fire-softer)]"
                  placeholder="Search tickets..."
                />
              </div>

              <div className="mt-3 flex gap-1">
                {(
                  [
                    ['all', 'All'],
                    ['open', 'Open'],
                    ['unread', 'Unread'],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    onClick={() => setFilter(value)}
                    className={`rounded-lg px-2.5 py-1.5 text-[9px] font-semibold transition-colors duration-150 ${
                      filter === value
                        ? 'bg-[var(--fire-soft)] text-[var(--fire-dark)]'
                        : 'text-[var(--muted)] hover:bg-[var(--surface-2)]'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2">
              {filtered.length === 0 ? (
                <EmptyTickets />
              ) : (
                filtered.map((conversation) => {
                  const selected = activeId === conversation._id
                  const name = displayName(conversation)
                  const tone = statusTone(conversation.status)

                  return (
                    <button
                      key={conversation._id}
                      onClick={() => joinConversation(conversation._id)}
                      className={`group relative mb-1.5 flex w-full items-stretch rounded-xl py-3 pl-3 pr-3 text-left transition-colors duration-150 ${
                        selected ? 'bg-[var(--fire-softer)]' : 'hover:bg-[var(--surface-2)]'
                      }`}
                    >
                      {selected && (
                        <span className="absolute inset-y-2 left-0 w-[3px] rounded-full bg-[var(--fire)]" />
                      )}

                      <div className="flex items-center">
                        <Avatar name={name} size="md" online />
                      </div>

                      <div className="relative mx-3 w-0 shrink-0 self-stretch" aria-hidden="true">
                        <span className="absolute inset-y-0 left-0 border-l border-dashed border-[var(--rule)]" />
                        <span className="absolute -top-[5px] left-1/2 h-2.5 w-2.5 -translate-x-1/2 rounded-full bg-[var(--paper)] ring-1 ring-[var(--rule)]" />
                        <span className="absolute -bottom-[5px] left-1/2 h-2.5 w-2.5 -translate-x-1/2 rounded-full bg-[var(--paper)] ring-1 ring-[var(--rule)]" />
                      </div>

                      <div className="flex min-w-0 flex-1 flex-col justify-center">
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={`truncate text-[11.5px] font-semibold ${
                              selected ? 'text-[var(--fire-dark)]' : 'text-[var(--ink)]'
                            }`}
                          >
                            {name}
                          </span>

                          <span className="fh-mono shrink-0 text-[8px] text-[var(--faint)]">
                            {time(conversation.lastMessageAt)}
                          </span>
                        </div>

                        <p className="mt-1 truncate text-[9.5px] leading-4 text-[var(--muted)]">
                          {conversation.lastMessage || 'No messages yet'}
                        </p>

                        <div className="mt-1.5 flex items-center gap-1.5">
                          <span
                            className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[8px] font-semibold capitalize"
                            style={{ backgroundColor: tone.bg, color: tone.fg }}
                          >
                            <span
                              className="h-1.5 w-1.5 rounded-full"
                              style={{ backgroundColor: tone.dot }}
                            />
                            {conversation.status || 'open'}
                          </span>

                          {conversation.assignedHostId && (
                            <span className="truncate text-[8px] text-[var(--faint)]">
                              Assigned
                            </span>
                          )}

                          {!!conversation.unreadCount && (
                            <span className="fh-mono ml-auto flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--fire)] px-1 text-[8px] font-bold text-white">
                              {conversation.unreadCount}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  )
                })
              )}
            </div>

            <div className="border-t border-[var(--rule-soft)] p-2.5">
              <button className="flex w-full items-center gap-2 rounded-xl p-2 text-left hover:bg-[var(--surface-2)]">
                <Avatar name="Bùi Thanh Quân" size="sm" staff />

                <div className="min-w-0 flex-1">
                  <div className="truncate text-[10px] font-semibold">Bùi Thanh Quân</div>
                  <div className="mt-0.5 text-[8px] text-[var(--faint)]">Staff</div>
                </div>

                <Icon name="chevron" size={13} />
              </button>
            </div>
          </aside>

          {mobileInbox && (
            <button
              onClick={() => setMobileInbox(false)}
              className="fixed inset-0 z-40 bg-[var(--ink)]/20 backdrop-blur-[1px] lg:hidden"
            />
          )}

          {/* CHAT */}

          <section className="flex min-w-0 flex-1 flex-col bg-[var(--surface)]">
            {active ? (
              <>
                <div className="flex h-[64px] shrink-0 items-center justify-between border-b border-[var(--rule)] px-4 lg:px-6">
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar name={displayName(active)} size="md" online />

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h2 className="fh-display truncate text-[13px] font-semibold">
                          {displayName(active)}
                        </h2>

                        <span className="hidden items-center gap-1 text-[8px] font-semibold text-[var(--herb)] sm:flex">
                          <span className="h-1.5 w-1.5 rounded-full bg-[var(--herb)]" />
                          Online
                        </span>
                      </div>

                      <div className="mt-0.5 flex items-center gap-1.5 text-[8px] text-[var(--faint)]">
                        <span>Customer</span>
                        <span>·</span>
                        <span className="fh-mono truncate">#{active._id}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-0.5">
                    <HeaderIconBtn icon="phone" title="Call" />
                    <HeaderIconBtn icon="video" title="Video call" />
                    <HeaderIconBtn icon="search" title="Search" />
                    <HeaderIconBtn
                      icon="info"
                      title="Details"
                      onClick={() => setShowDetails((x) => !x)}
                    />
                    <HeaderIconBtn icon="more" title="More" />
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto bg-[var(--surface-2)] px-4 py-6 lg:px-10">
                  <div className="mx-auto max-w-[820px]">
                    <div className="mb-8 flex items-center gap-3">
                      <span className="h-px flex-1 bg-[var(--rule)]" />
                      <span className="fh-mono rounded-full border border-[var(--rule)] bg-[var(--surface)] px-2.5 py-1 text-[8px] font-semibold text-[var(--faint)]">
                        Today
                      </span>
                      <span className="h-px flex-1 bg-[var(--rule)]" />
                    </div>

                    {messages.length === 0 ? (
                      <EmptyChat name={displayName(active)} />
                    ) : (
                      <div className="space-y-6">
                        {messages.map((message, index) => (
                          <Bubble key={message._id || index} message={message} />
                        ))}
                      </div>
                    )}

                    <div ref={bottomRef} />
                  </div>
                </div>

                <div className="border-t border-[var(--rule)] bg-[var(--surface)] px-4 py-3 lg:px-8">
                  <div className="mx-auto max-w-[820px]">
                    <div className="overflow-hidden rounded-2xl border border-[var(--rule)] bg-[var(--surface)] shadow-[0_1px_2px_rgba(25,26,22,0.03)] transition-colors duration-150 focus-within:border-[var(--fire)] focus-within:ring-2 focus-within:ring-[var(--fire-softer)]">
                      <textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault()
                            sendMessage()
                          }
                        }}
                        rows={2}
                        disabled={!connected}
                        className="w-full resize-none bg-transparent px-3.5 py-3 text-[11px] leading-5 outline-none disabled:cursor-not-allowed"
                        placeholder={
                          connected
                            ? `Reply to ${displayName(active)}...`
                            : 'Connect socket to reply...'
                        }
                      />

                      <div className="flex items-center justify-between border-t border-[var(--rule-soft)] px-2 py-1.5">
                        <div className="flex items-center gap-0.5">
                          <ComposerIconBtn icon="plus" />
                          <ComposerIconBtn icon="paperclip" />
                          <ComposerIconBtn icon="image" />
                          <ComposerIconBtn icon="smile" />

                          <span className="ml-2 hidden text-[8px] text-[var(--faint)] sm:block">
                            Enter to send
                          </span>
                        </div>

                        <button
                          onClick={sendMessage}
                          disabled={!connected || !input.trim()}
                          className="flex h-7 items-center gap-1.5 rounded-full bg-[var(--fire)] px-3.5 text-[9px] font-bold text-white transition-colors duration-150 hover:bg-[var(--fire-dark)] disabled:cursor-not-allowed disabled:bg-[var(--rule)] disabled:text-[var(--faint)]"
                        >
                          Send
                          <Icon name="send" size={12} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <EmptyConsole />
            )}
          </section>

          {/* DETAILS */}

          {showDetails && (
            <aside className="hidden w-[260px] shrink-0 flex-col border-l border-[var(--rule)] bg-[var(--surface)] xl:flex">
              {active ? (
                <>
                  <div className="border-b border-[var(--rule-soft)] px-5 py-7 text-center">
                    <Avatar name={displayName(active)} size="lg" online />

                    <h3 className="fh-display mt-3 truncate text-[13px] font-semibold">
                      {displayName(active)}
                    </h3>

                    <p className="mt-1 text-[9px] text-[var(--faint)]">Customer</p>
                  </div>

                  <div className="space-y-6 p-5">
                    <DetailRow label="Status">
                      <span
                        className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[8px] font-semibold capitalize"
                        style={{
                          backgroundColor: statusTone(active.status).bg,
                          color: statusTone(active.status).fg,
                        }}
                      >
                        <span
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ backgroundColor: statusTone(active.status).dot }}
                        />
                        {active.status || 'open'}
                      </span>
                    </DetailRow>

                    <DetailRow label="Ticket">
                      <div className="fh-mono rounded-lg bg-[var(--surface-2)] px-2.5 py-2 text-[8px] text-[var(--muted)]">
                        #{active._id}
                      </div>
                    </DetailRow>

                    <DetailRow label="Customer ID">
                      <span className="fh-mono break-all text-[9px] text-[var(--muted)]">
                        {active.customerId || '—'}
                      </span>
                    </DetailRow>

                    <DetailRow label="Assigned to">
                      <div className="flex items-center gap-2">
                        <Avatar
                          name={active.assignedHostId || 'Unassigned'}
                          size="sm"
                          staff={!!active.assignedHostId}
                        />
                        <span className="text-[9px] font-medium text-[var(--muted)]">
                          {active.assignedHostId || 'Unassigned'}
                        </span>
                      </div>
                    </DetailRow>

                    <DetailRow label="Last activity">
                      <span className="fh-mono text-[9px] text-[var(--muted)]">
                        {dayTime(active.lastMessageAt) || '—'}
                      </span>
                    </DetailRow>
                  </div>

                  <div className="mt-auto space-y-2 border-t border-[var(--rule-soft)] p-4">
                    <button className="w-full rounded-xl border border-[var(--rule)] px-3 py-2 text-[9px] font-semibold text-[var(--muted)] transition-colors duration-150 hover:bg-[var(--surface-2)]">
                      Assign conversation
                    </button>

                    <button className="w-full rounded-xl bg-[var(--fire-softer)] px-3 py-2 text-[9px] font-semibold text-[var(--fire-dark)] transition-colors duration-150 hover:bg-[var(--fire-soft)]">
                      Close conversation
                    </button>
                  </div>
                </>
              ) : (
                <div className="flex h-full items-center justify-center px-7 text-center text-[9px] leading-5 text-[var(--faint)]">
                  Select a conversation to view customer details.
                </div>
              )}
            </aside>
          )}
        </div>
      </main>

      {/* DEV TOOLS */}

      {showDevTools && (
        <div className="fixed bottom-4 right-4 z-[70] w-[min(540px,calc(100vw-32px))] overflow-hidden rounded-2xl border border-[#2b2e28] bg-[#15160f] shadow-2xl">
          <div className="flex items-center justify-between border-b border-[#282b23] px-4 py-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#22241d] text-[#B7BDA9]">
                <Icon name="code" size={13} />
              </div>

              <div>
                <div className="text-[10px] font-bold text-white">Socket dev console</div>
                <div className="mt-0.5 text-[8px] text-[#8B917E]">
                  Testing only · hidden from production UI
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowDevTools(false)}
              className="rounded-md p-1.5 text-[#9BA18D] hover:bg-[#22241d]"
            >
              <Icon name="close" size={14} />
            </button>
          </div>

          <div className="space-y-2.5 p-3">
            <div className="flex gap-2">
              <input
                value={socketUrl}
                onChange={(e) => setSocketUrl(e.target.value)}
                className="fh-mono min-w-0 flex-1 rounded-lg border border-[#2f3227] bg-[#1c1e17] px-2.5 py-2 text-[9px] text-white outline-none focus:border-[var(--fire)]"
                placeholder="Socket URL"
              />

              <button
                onClick={connect}
                className={`rounded-lg px-3 py-2 text-[9px] font-bold text-white transition-colors duration-150 ${
                  connected ? 'bg-[#2b2e24]' : 'bg-[var(--fire)] hover:bg-[var(--fire-dark)]'
                }`}
              >
                {connected ? 'Disconnect' : 'Connect'}
              </button>
            </div>

            <input
              value={token}
              onChange={(e) => setToken(e.target.value)}
              className="fh-mono w-full rounded-lg border border-[#2f3227] bg-[#1c1e17] px-2.5 py-2 text-[9px] text-white outline-none focus:border-[var(--fire)]"
              placeholder="JWT Token"
              type="password"
            />

            <div className="fh-mono h-44 overflow-y-auto rounded-lg bg-[#0e0f0a] p-3 text-[8px] leading-5 text-[#B7BDA9]">
              {logs.length
                ? logs.map((x, i) => <div key={i}>{x}</div>)
                : 'No socket events yet.'}
            </div>

            <button
              onClick={() => setLogs([])}
              className="rounded-lg border border-[#2f3227] px-2.5 py-1.5 text-[8px] font-semibold text-[#9BA18D] hover:bg-[#1c1e17]"
            >
              Clear logs
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/* =========================================================
   SUPPORTING COMPONENTS
========================================================= */

function RailIcon({
  icon,
  active = false,
  badge,
}: {
  icon: 'inbox' | 'bag' | 'users' | 'bell' | 'settings'
  active?: boolean
  badge?: number
}) {
  return (
    <button
      className={`relative mb-1.5 flex h-10 w-10 items-center justify-center rounded-xl transition-colors duration-150 ${
        active
          ? 'bg-[var(--fire-soft)] text-[var(--fire-dark)]'
          : 'text-[var(--faint)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)]'
      }`}
    >
      <Icon name={icon} size={17} />

      {badge !== undefined && (
        <span className="fh-mono absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--fire)] px-1 text-[8px] font-bold text-white">
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </button>
  )
}

function HeaderIconBtn({
  icon,
  title,
  onClick,
}: {
  icon: 'phone' | 'video' | 'search' | 'info' | 'more'
  title: string
  onClick?: () => void
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="rounded-xl p-2 text-[var(--muted)] transition-colors duration-150 hover:bg-[var(--surface-2)] hover:text-[var(--ink)]"
    >
      <Icon name={icon} size={16} />
    </button>
  )
}

function ComposerIconBtn({
  icon,
}: {
  icon: 'plus' | 'paperclip' | 'image' | 'smile'
}) {
  return (
    <button className="rounded-lg p-1.5 text-[var(--faint)] transition-colors duration-150 hover:bg-[var(--fire-softer)] hover:text-[var(--fire-dark)]">
      <Icon name={icon} size={15} />
    </button>
  )
}

function IconGlow({ icon, size = 22 }: { icon: IconName; size?: number }) {
  return (
    <div className="relative flex h-16 w-16 items-center justify-center">
      <div className="absolute inset-0 rounded-full bg-[var(--fire-soft)] opacity-60 blur-xl" />
      <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl border border-[var(--rule)] bg-[var(--surface)] text-[var(--muted)] shadow-[0_2px_10px_rgba(25,26,22,0.05)]">
        <Icon name={icon} size={size} />
      </div>
    </div>
  )
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="fh-mono mb-2 text-[9px] font-semibold uppercase tracking-[0.1em] text-[var(--faint)]">
        {label}
      </div>

      {children}
    </div>
  )
}

function Bubble({ message }: { message: ChatMessage }) {
  const isCustomer = role(message) === 'customer'

  return (
    <div className={`flex ${isCustomer ? 'justify-start' : 'justify-end'}`}>
      <div className={`flex max-w-[78%] gap-2.5 ${isCustomer ? 'flex-row' : 'flex-row-reverse'}`}>
        <div className="mt-5 shrink-0">
          <Avatar name={isCustomer ? 'Customer' : 'Quân'} size="sm" staff={!isCustomer} />
        </div>

        <div>
          <div className={`mb-1.5 flex items-center gap-1.5 ${isCustomer ? '' : 'justify-end'}`}>
            <span className="text-[10px] font-semibold text-[var(--muted)]">
              {isCustomer ? 'Customer' : 'You'}
            </span>

            <span className="text-[9px] text-[var(--faint)]">·</span>

            <span className="fh-mono text-[9px] text-[var(--faint)]">
              {time(message.createdAt)}
            </span>
          </div>

          <div
            className={`text-[12px] leading-[1.65] ${
              isCustomer
                ? 'rounded-2xl rounded-tl-md border border-[var(--rule)] bg-[var(--surface)] px-4 py-2.5 text-[var(--ink)] shadow-[0_1px_2px_rgba(25,26,22,0.03)]'
                : 'rounded-2xl rounded-tr-md bg-[var(--fire)] px-4 py-2.5 text-white shadow-[0_4px_14px_rgba(211,63,44,0.22)]'
            }`}
          >
            {message.content}
          </div>

          {!isCustomer && (
            <div className="mt-1 flex items-center justify-end gap-1 text-[9px] text-[var(--faint)]">
              <Icon name="check" size={11} />
              Sent
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function EmptyTickets() {
  return (
    <div className="flex flex-col items-center px-6 py-20 text-center">
      <IconGlow icon="inbox" size={20} />

      <div className="mt-4 text-[11px] font-semibold text-[var(--ink)]">No tickets yet</div>

      <p className="mt-1 max-w-[190px] text-[9px] leading-4 text-[var(--faint)]">
        New customer conversations will land here as they come in.
      </p>
    </div>
  )
}

function EmptyChat({ name }: { name: string }) {
  return (
    <div className="flex min-h-[430px] flex-col items-center justify-center text-center">
      <Avatar name={name} size="lg" online />

      <div className="fh-display mt-4 text-[14px] font-semibold text-[var(--ink)]">
        Start the conversation
      </div>

      <p className="mt-1.5 max-w-[270px] text-[10px] leading-5 text-[var(--faint)]">
        Messages from the customer and your team will show up here in realtime.
      </p>
    </div>
  )
}

function EmptyConsole() {
  return (
    <div className="flex h-full flex-col items-center justify-center bg-[var(--surface-2)] px-6 text-center">
      <IconGlow icon="inbox" size={26} />

      <h2 className="fh-display mt-5 text-[16px] font-semibold tracking-tight text-[var(--ink)]">
        Pick up a ticket
      </h2>

      <p className="mt-1.5 max-w-[280px] text-[10px] leading-5 text-[var(--faint)]">
        Select a conversation on the left to read messages and reply in realtime.
      </p>
    </div>
  )
}