'use client'

import nextDynamic from 'next/dynamic'

const ChatClient = nextDynamic(() => import('./ChatClient'), { ssr: false })

export default ChatClient