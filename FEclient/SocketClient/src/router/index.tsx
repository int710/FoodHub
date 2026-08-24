import { createBrowserRouter } from 'react-router-dom'

import App from '../App'
import CustomerChat from '../CustomerChat'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
  },
  {
    path: '/customer/chat',
    element: <CustomerChat />,
  },
])