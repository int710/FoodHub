import { useEffect, useRef, useState } from 'react'
import { io, Socket } from 'socket.io-client'

interface ChatMessage {
  _id?: string
  conversationId?: string
  content?: string
  type?: string
  createdAt?: string | Date
  senderRole?: string
  sender?: {
    id?: string
    type?: string
  }
}

interface Ack {
  success?: boolean
  message?: string
  data?: {
    conversationId?: string
  }
}

interface Props {
  token?: string
  socketUrl?: string
}

export default function CustomerChat({
  token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoiMWJjOTk0NGItM2ZkNy00YzgyLTliNTItYjFiNmFjNGEzOTgzIiwiaXNWZXJpZmllZCI6ZmFsc2UsInJvbGUiOiJDVVNUT01FUiIsImVtYWlsIjoicXVhbml0d2Vic2l0ZTk5QGdtYWlsLmNvbSIsInRva2VuX3R5cGUiOjAsImlhdCI6MTc4NzQ2ODM4NSwiZXhwIjoxNzg3NDcwMTg1fQ.cu5EXsx8iU2lIm-OG623tkz6dKBPlTYt2ONYxA434UM',
  socketUrl = 'http://localhost:4000',
}: Props) {
  const socketRef = useRef<Socket | null>(null)
  const bottomRef = useRef<HTMLDivElement | null>(null)

  const [connected, setConnected] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    if (!token) return

    const socket = io(socketUrl, {
      auth: {
        token,
      },
      transports: ['websocket', 'polling'],
    })

    socketRef.current = socket

    socket.on('connect', () => {
      console.log('CUSTOMER CONNECTED', socket.id)
      setConnected(true)
    })

    socket.on('disconnect', () => {
      setConnected(false)
    })

    socket.on('connect_error', (err) => {
      console.error('CUSTOMER SOCKET ERROR:', err.message)
      setConnected(false)
    })

    /**
     * Server trả message mới
     */
    socket.on('message:new', (message: ChatMessage) => {
      console.log('CUSTOMER message:new', message)

      if (message.conversationId) {
        setConversationId(message.conversationId)
      }

      setMessages((prev) => {
        // chống duplicate
        if (
          message._id &&
          prev.some((item) => item._id === message._id)
        ) {
          return prev
        }

        return [...prev, message]
      })
    })

    /**
     * Conversation mới được server tạo
     */
    socket.on(
      'conversation:new',
      (conversation: {
        _id: string
        customerId?: string
      }) => {
        console.log('CUSTOMER conversation:new', conversation)

        setConversationId(conversation._id)
      },
    )

    return () => {
      socket.disconnect()
      socketRef.current = null
    }
  }, [token, socketUrl])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      behavior: 'smooth',
    })
  }, [messages])

  const sendMessage = () => {
    const socket = socketRef.current

    if (!socket?.connected) return
    if (!input.trim()) return
    if (sending) return

    const content = input.trim()

    setSending(true)

    /**
     * Customer:
     *
     * Không cần conversationId ở message đầu tiên.
     *
     * Backend tự:
     * - lấy customerId từ JWT
     * - tìm conversation
     * - tạo nếu chưa có
     */
    socket.emit(
      'message:send',
      {
        ...(conversationId ? { conversationId } : {}),
        content,
        type: 'TEXT',
      },
      (res: Ack) => {
        console.log('ACK message:send', res)

        setSending(false)

        if (!res?.success) {
          alert(res?.message || 'Không thể gửi tin nhắn.')
          return
        }

        if (res.data?.conversationId) {
          setConversationId(res.data.conversationId)
        }

        setInput('')
      },
    )
  }

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLTextAreaElement>,
  ) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="flex h-screen flex-col bg-[#F7F7F5] text-[#191A16]">
      {/* HEADER */}
      <header className="flex h-[64px] shrink-0 items-center justify-between border-b border-[#E2E4DE] bg-white px-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#D33F2C] text-sm font-bold text-white">
            F
          </div>

          <div>
            <div className="text-sm font-semibold">
              FoodHub Support
            </div>

            <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-[#858A80]">
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  connected
                    ? 'bg-[#3D7A4E]'
                    : 'bg-[#A0A49D]'
                }`}
              />

              {connected
                ? 'Usually replies in a few minutes'
                : 'Connecting...'}
            </div>
          </div>
        </div>
      </header>

      {/* MESSAGES */}
      <main className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto max-w-[720px]">
          {messages.length === 0 ? (
            <div className="flex min-h-[500px] flex-col items-center justify-center text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#FBE3DE] text-xl font-bold text-[#B5301F]">
                F
              </div>

              <h2 className="mt-5 text-base font-semibold">
                How can we help?
              </h2>

              <p className="mt-2 max-w-[300px] text-xs leading-5 text-[#858A80]">
                Send us a message and our support team
                will get back to you.
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              {messages.map((message, index) => {
                const isCustomer =
                  String(
                    message.senderRole ||
                      message.sender?.type ||
                      '',
                  ).toLowerCase() === 'customer'

                return (
                  <div
                    key={message._id || index}
                    className={`flex ${
                      isCustomer
                        ? 'justify-end'
                        : 'justify-start'
                    }`}
                  >
                    <div className="max-w-[75%]">
                      <div
                        className={`rounded-2xl px-4 py-2.5 text-sm leading-6 ${
                          isCustomer
                            ? 'rounded-tr-md bg-[#D33F2C] text-white'
                            : 'rounded-tl-md border border-[#E0E2DC] bg-white text-[#191A16]'
                        }`}
                      >
                        {message.content}
                      </div>

                      {message.createdAt && (
                        <div
                          className={`mt-1 text-[9px] text-[#9CA396] ${
                            isCustomer
                              ? 'text-right'
                              : 'text-left'
                          }`}
                        >
                          {new Date(
                            message.createdAt,
                          ).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </main>

      {/* COMPOSER */}
      <footer className="border-t border-[#E2E4DE] bg-white px-4 py-3">
        <div className="mx-auto max-w-[720px]">
          <div className="overflow-hidden rounded-2xl border border-[#DCE0D6] bg-white focus-within:border-[#D33F2C]">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={!connected || sending}
              rows={2}
              placeholder={
                connected
                  ? 'Write a message...'
                  : 'Connecting...'
              }
              className="w-full resize-none bg-transparent px-4 py-3 text-sm outline-none"
            />

            <div className="flex items-center justify-end border-t border-[#EEF0EB] px-3 py-2">
              <button
                onClick={sendMessage}
                disabled={
                  !connected ||
                  !input.trim() ||
                  sending
                }
                className="rounded-full bg-[#D33F2C] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#B5301F] disabled:cursor-not-allowed disabled:bg-[#DCE0D6] disabled:text-[#9CA396]"
              >
                {sending ? 'Sending...' : 'Send'}
              </button>
            </div>
          </div>

          <div className="mt-1.5 text-center text-[9px] text-[#9CA396]">
            Press Enter to send · Shift + Enter for new line
          </div>
        </div>
      </footer>
    </div>
  )
}