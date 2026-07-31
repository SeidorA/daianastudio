const redisClient = {
    lrange: jest.fn().mockResolvedValue([]),
    lpush: jest.fn().mockResolvedValue(1),
    expire: jest.fn().mockResolvedValue(1),
    del: jest.fn().mockResolvedValue(1),
    quit: jest.fn().mockResolvedValue(undefined)
}

jest.mock('ioredis', () => ({
    Redis: jest.fn().mockImplementation(() => redisClient)
}))

jest.mock('../../../src/utils', () => ({
    convertBaseMessagetoIMessage: jest.fn().mockReturnValue([]),
    getBaseClasses: jest.fn().mockReturnValue([]),
    getCredentialData: jest.fn().mockResolvedValue({}),
    getCredentialParam: jest.fn().mockReturnValue(undefined),
    mapChatMessageToBaseMessage: jest.fn().mockResolvedValue([]),
    mapStoredMessageToChatMessage: jest.fn()
}))

const { nodeClass: RedisMemoryNode } = require('./RedisBackedChatMemory')

describe('RedisBackedChatMemory session selection', () => {
    beforeEach(() => jest.clearAllMocks())

    it('uses an override session ID and falls back to the configured session ID', async () => {
        const memory = await new RedisMemoryNode().init({ inputs: { sessionId: 'configured-session', memoryKey: 'chat_history' } }, '', {
            orgId: 'org-id'
        })

        await memory.getChatMessages('override-session')
        expect(redisClient.lrange).toHaveBeenLastCalledWith('override-session', 0, -1)

        await memory.getChatMessages()
        expect(redisClient.lrange).toHaveBeenLastCalledWith('configured-session', 0, -1)

        await memory.addChatMessages([{ text: 'hello', type: 'userMessage' }], 'override-session')
        expect(redisClient.lpush).toHaveBeenLastCalledWith('override-session', expect.any(String))
    })
})
