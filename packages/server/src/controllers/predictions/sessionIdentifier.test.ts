import { resolvePredictionSessionId } from './sessionIdentifier'

describe('resolvePredictionSessionId', () => {
    it('prefers an explicit chatId', () => {
        expect(
            resolvePredictionSessionId({ chatId: 'chat-id', overrideConfig: { sessionId: 'override-session-id' } }, () => 'generated-id')
        ).toBe('chat-id')
    })

    it('uses overrideConfig.sessionId when chatId is absent', () => {
        expect(resolvePredictionSessionId({ overrideConfig: { sessionId: 'override-session-id' } }, () => 'generated-id')).toBe(
            'override-session-id'
        )
    })

    it('generates a UUID when neither identifier is supplied', () => {
        const generatedId = resolvePredictionSessionId({})
        expect(generatedId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
    })

    it('does not use credentials or tokens as identifiers', () => {
        expect(
            resolvePredictionSessionId(
                { authorization: 'Bearer secret-token', credential: 'secret-credential' } as any,
                () => 'generated-id'
            )
        ).toBe('generated-id')
    })
})
