jest.mock('../../../src/utils', () => ({
    getBaseClasses: jest.fn().mockReturnValue([]),
    mapChatMessageToBaseMessage: jest.fn().mockResolvedValue([])
}))

const { nodeClass: BufferMemoryNode } = require('./BufferMemory')

describe('BufferMemory session selection', () => {
    it('uses an override session ID and falls back to the configured session ID', async () => {
        const find = jest.fn().mockResolvedValue([])
        const memory = await new BufferMemoryNode().init({ inputs: { sessionId: 'configured-session' } }, '', {
            appDataSource: { getRepository: () => ({ find }) },
            databaseEntities: { ChatMessage: 'ChatMessage' },
            chatflowid: 'chatflow-id',
            orgId: 'org-id'
        })

        await memory.getChatMessages('override-session')
        expect(find).toHaveBeenLastCalledWith(
            expect.objectContaining({ where: expect.objectContaining({ sessionId: 'override-session' }) })
        )

        await memory.getChatMessages()
        expect(find).toHaveBeenLastCalledWith(
            expect.objectContaining({ where: expect.objectContaining({ sessionId: 'configured-session' }) })
        )
    })
})
