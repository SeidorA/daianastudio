jest.mock('./logger', () => ({
    __esModule: true,
    default: { error: jest.fn() }
}))

import type { ChatType, IChatFlow } from '../Interface'
import { InternalFlowiseError } from '../errors/internalFlowiseError'
import { runWithSharedMessageQuota } from './sharedMessageQuota'

const chatflow = { id: 'flow-1', workspaceId: 'workspace-1', isPublic: true } as IChatFlow
const defaultParams = {
    chatflow,
    organizationId: 'organization-1',
    workspaceId: 'workspace-1',
    isInternal: false,
    isEvaluation: false,
    isTool: false,
    requestId: 'request-1'
}

const rpcResponse = (body: unknown, ok = true) => Promise.resolve({ ok, json: async () => body } as Response)

describe('runWithSharedMessageQuota', () => {
    const originalEnv = process.env

    beforeEach(() => {
        process.env = {
            ...originalEnv,
            DAIANA_SHARED_CHAT_QUOTA_ENABLED: 'true',
            SUPABASE_BASE_URL: 'https://example.supabase.co',
            SUPABASE_SERVICE_ROLE_KEY: 'service-role-key'
        }
        global.fetch = jest.fn()
    })

    afterEach(() => {
        process.env = originalEnv
        jest.restoreAllMocks()
    })

    it('reserves before execution and consumes after the assistant message is persisted', async () => {
        const execute = jest.fn().mockResolvedValue({ chatMessageId: 'message-1', text: 'Hello' })
        ;(global.fetch as jest.Mock)
            .mockImplementationOnce(() => rpcResponse(42))
            .mockImplementationOnce(() => rpcResponse({ allowed: true, status: 'reserved' }))
            .mockImplementationOnce(() => rpcResponse({ status: 'consumed' }))

        await expect(runWithSharedMessageQuota(defaultParams, execute)).resolves.toMatchObject({ chatMessageId: 'message-1' })

        expect(execute).toHaveBeenCalledTimes(1)
        expect(global.fetch).toHaveBeenNthCalledWith(
            2,
            'https://example.supabase.co/rest/v1/rpc/reserve_tenant_message_quota',
            expect.objectContaining({ body: expect.stringMatching(/request-1.*studio-shared-chat/) })
        )
        expect(global.fetch).toHaveBeenNthCalledWith(
            3,
            'https://example.supabase.co/rest/v1/rpc/consume_tenant_message_quota',
            expect.any(Object)
        )
    })

    it('returns a safe error without executing when quota is exhausted', async () => {
        const execute = jest.fn()
        ;(global.fetch as jest.Mock)
            .mockImplementationOnce(() => rpcResponse(42))
            .mockImplementationOnce(() => rpcResponse({ allowed: false, status: 'exhausted', remaining: 0 }))

        await expect(runWithSharedMessageQuota(defaultParams, execute)).rejects.toMatchObject({
            statusCode: 429,
            message: 'This chatbot is temporarily unavailable. Please try again later.'
        })
        expect(execute).not.toHaveBeenCalled()
    })

    it('fails closed when an enabled Daiana deployment has no explicit mapping', async () => {
        ;(global.fetch as jest.Mock).mockImplementationOnce(() => rpcResponse(null))

        await expect(runWithSharedMessageQuota(defaultParams, jest.fn())).rejects.toMatchObject({ statusCode: 503 })
    })

    it.each([
        ['internal', { isInternal: true }],
        ['non-public', { chatflow: { ...chatflow, isPublic: false } }],
        ['evaluation', { isEvaluation: true }],
        ['tool', { isTool: true }],
        ['MCP', { chatType: 'MCP' as ChatType }],
        ['scheduled', { chatType: 'SCHEDULED' as ChatType }],
        ['webhook', { chatType: 'WEBHOOK' as ChatType }]
    ])('bypasses quota for %s traffic', async (_name, overrides) => {
        const execute = jest.fn().mockResolvedValue({ chatMessageId: 'message-1' })

        await runWithSharedMessageQuota({ ...defaultParams, ...overrides }, execute)

        expect(execute).toHaveBeenCalledTimes(1)
        expect(global.fetch).not.toHaveBeenCalled()
    })

    it('releases the reservation when execution fails', async () => {
        const failure = new Error('model failed')
        ;(global.fetch as jest.Mock)
            .mockImplementationOnce(() => rpcResponse(42))
            .mockImplementationOnce(() => rpcResponse({ allowed: true, status: 'reserved' }))
            .mockImplementationOnce(() => rpcResponse({ status: 'released' }))

        await expect(runWithSharedMessageQuota(defaultParams, async () => Promise.reject(failure))).rejects.toBe(failure)
        expect(global.fetch).toHaveBeenNthCalledWith(
            3,
            'https://example.supabase.co/rest/v1/rpc/release_tenant_message_quota',
            expect.any(Object)
        )
    })

    it('releases the reservation when no persisted assistant message is returned', async () => {
        ;(global.fetch as jest.Mock)
            .mockImplementationOnce(() => rpcResponse(42))
            .mockImplementationOnce(() => rpcResponse({ allowed: true, status: 'reserved' }))
            .mockImplementationOnce(() => rpcResponse({ status: 'released' }))

        await expect(
            runWithSharedMessageQuota(defaultParams, async () => ({ chatMessageId: undefined, text: 'not persisted' }))
        ).rejects.toThrow('Prediction completed without a persisted assistant message')
    })

    it('rejects a duplicate active request ID without executing the prediction again', async () => {
        const execute = jest.fn()
        ;(global.fetch as jest.Mock)
            .mockImplementationOnce(() => rpcResponse(42))
            .mockImplementationOnce(() => rpcResponse({ allowed: false, status: 'already_reserved' }))

        await expect(runWithSharedMessageQuota(defaultParams, execute)).rejects.toMatchObject({
            statusCode: 409,
            message: 'This request is already in progress.'
        })
        expect(execute).not.toHaveBeenCalled()
    })

    it('retains the reservation when consume fails after assistant persistence', async () => {
        ;(global.fetch as jest.Mock)
            .mockImplementationOnce(() => rpcResponse(42))
            .mockImplementationOnce(() => rpcResponse({ allowed: true, status: 'reserved' }))
            .mockRejectedValueOnce(new Error('consume unavailable'))
            .mockRejectedValueOnce(new Error('consume unavailable'))
            .mockRejectedValueOnce(new Error('consume unavailable'))

        await expect(runWithSharedMessageQuota(defaultParams, async () => ({ chatMessageId: 'message-1' }))).rejects.toMatchObject({
            statusCode: 503
        })
        const rpcUrls = (global.fetch as jest.Mock).mock.calls.map(([url]) => url)
        expect(rpcUrls.filter((url) => url.endsWith('/consume_tenant_message_quota'))).toHaveLength(3)
        expect(rpcUrls.some((url) => url.endsWith('/release_tenant_message_quota'))).toBe(false)
    })

    it('fails closed without releasing when consume reports an expired lease', async () => {
        ;(global.fetch as jest.Mock)
            .mockImplementationOnce(() => rpcResponse(42))
            .mockImplementationOnce(() => rpcResponse({ allowed: true, status: 'reserved' }))
            .mockImplementationOnce(() => rpcResponse({ status: 'already_released' }))

        await expect(runWithSharedMessageQuota(defaultParams, async () => ({ chatMessageId: 'message-1' }))).rejects.toMatchObject({
            statusCode: 503
        })
        const rpcUrls = (global.fetch as jest.Mock).mock.calls.map(([url]) => url)
        expect(rpcUrls.filter((url) => url.endsWith('/consume_tenant_message_quota'))).toHaveLength(1)
        expect(rpcUrls.some((url) => url.endsWith('/release_tenant_message_quota'))).toBe(false)
    })

    it('consumes once after a streaming execution completes, not for individual chunks', async () => {
        const chunks = ['one', 'two', 'three']
        ;(global.fetch as jest.Mock)
            .mockImplementationOnce(() => rpcResponse(42))
            .mockImplementationOnce(() => rpcResponse({ allowed: true, status: 'reserved' }))
            .mockImplementationOnce(() => rpcResponse({ status: 'consumed' }))

        await runWithSharedMessageQuota(defaultParams, async () => {
            chunks.forEach(() => undefined)
            return { chatMessageId: 'message-1' }
        })

        const rpcUrls = (global.fetch as jest.Mock).mock.calls.map(([url]) => url)
        expect(rpcUrls.filter((url) => url.endsWith('/consume_tenant_message_quota'))).toHaveLength(1)
    })

    it('fails closed when the mapped tenant has no enforceable plan', async () => {
        ;(global.fetch as jest.Mock)
            .mockImplementationOnce(() => rpcResponse(42))
            .mockImplementationOnce(() => rpcResponse({ allowed: true, status: 'not_enforced' }))

        await expect(runWithSharedMessageQuota(defaultParams, jest.fn())).rejects.toBeInstanceOf(InternalFlowiseError)
    })

    it('preserves standalone Studio behavior when enforcement is disabled', async () => {
        process.env.DAIANA_SHARED_CHAT_QUOTA_ENABLED = 'false'
        const execute = jest.fn().mockResolvedValue({ chatMessageId: 'message-1' })

        await runWithSharedMessageQuota(defaultParams, execute)

        expect(execute).toHaveBeenCalledTimes(1)
        expect(global.fetch).not.toHaveBeenCalled()
    })
})
