import { io } from 'socket.io-client'

const token = localStorage.getItem('token')

export const socket = io('http://localhost:4000', {
  autoConnect: false, auth: {
    token
  }
})