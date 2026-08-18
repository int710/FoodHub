import { useEffect, useState } from 'react'
import { socket } from './socket/socket'

function App() {
  const [connected, setConnected] = useState(false)
  const [socketId, setSocketId] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    // Bắt đầu kết nối đến BE
    socket.connect()

    // =========================
    // SERVER -> CLIENT
    // =========================

    socket.on('connect', () => {
      console.log('Connected to server')
      console.log('Socket ID:', socket.id)

      setConnected(true)
      setSocketId(socket.id ?? '')
    })

    socket.on('pong', (data) => {
      console.log('Received pong:', data)

      setMessage(data.message)
    })

    socket.on('disconnect', (reason) => {
      console.log('Disconnected:', reason)

      setConnected(false)
      setSocketId('')
    })

    socket.on('connect_error', (error) => {
  console.log('Socket connection failed:', error.message)
})

    // Cleanup
    return () => {
      socket.off('connect')
      socket.off('pong')
      socket.off('disconnect')

      socket.disconnect()
    }
  }, [])

  // =========================
  // CLIENT -> SERVER
  // =========================

  const sendPing = () => {
    console.log('Send ping to server')

    socket.emit('ping', {
      message: 'Hello from client'
    })
  }

  return (
    <div>
      <h1>Socket.IO Test</h1>

      <p>
        Status:{' '}
        <strong>
          {connected ? 'Connected' : 'Disconnected'}
        </strong>
      </p>

      <p>
        Socket ID: {socketId || 'None'}
      </p>

      <button
        onClick={sendPing}
        disabled={!connected}
      >
        Send Ping
      </button>

      <p>
        Server response: {message || 'None'}
      </p>
    </div>
  )
}

export default App