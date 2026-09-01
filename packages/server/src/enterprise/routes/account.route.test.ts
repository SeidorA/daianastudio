import { StatusCodes } from 'http-status-codes'
import { WHITELIST_URLS } from '../../utils/constants'
import { authenticateDaianaProvisioning } from '../auth/studioProvisioning.middleware'

const PROVISIONING_PATH = '/api/v1/account/provision'
const PROVISIONING_SECRET = 'test-provisioning-secret'

function makeResponse() {
    return { sendStatus: jest.fn() } as any
}

describe('Daiana Studio provisioning route protection', () => {
    beforeEach(() => {
        process.env.DAIANA_STUDIO_PROVISIONING_SECRET = PROVISIONING_SECRET
    })

    afterEach(() => {
        delete process.env.DAIANA_STUDIO_PROVISIONING_SECRET
    })

    it('whitelists the exact path from the global API-key middleware', () => {
        expect(WHITELIST_URLS).toContain(PROVISIONING_PATH)
    })

    it.each([undefined, 'Bearer wrong-secret'])('rejects missing or wrong bearer secrets with 401', (authorization) => {
        const req = { get: jest.fn().mockReturnValue(authorization) } as any
        const res = makeResponse()
        const next = jest.fn()

        authenticateDaianaProvisioning(req, res, next)

        expect(res.sendStatus).toHaveBeenCalledWith(StatusCodes.UNAUTHORIZED)
        expect(next).not.toHaveBeenCalled()
    })

    it('returns 503 when the provisioning secret is not configured', () => {
        delete process.env.DAIANA_STUDIO_PROVISIONING_SECRET
        const req = { get: jest.fn().mockReturnValue(`Bearer ${PROVISIONING_SECRET}`) } as any
        const res = makeResponse()
        const next = jest.fn()

        authenticateDaianaProvisioning(req, res, next)

        expect(res.sendStatus).toHaveBeenCalledWith(StatusCodes.SERVICE_UNAVAILABLE)
        expect(next).not.toHaveBeenCalled()
    })

    it('allows the configured bearer secret to reach the controller', () => {
        const req = { get: jest.fn().mockReturnValue(`Bearer ${PROVISIONING_SECRET}`) } as any
        const res = makeResponse()
        const next = jest.fn()

        authenticateDaianaProvisioning(req, res, next)

        expect(next).toHaveBeenCalledTimes(1)
        expect(res.sendStatus).not.toHaveBeenCalled()
    })
})
