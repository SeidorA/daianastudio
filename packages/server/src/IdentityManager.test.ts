import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals'
import axios from 'axios'
import { Platform } from './Interface'
import { IdentityManager } from './IdentityManager'

jest.mock('axios')
jest.mock('./enterprise/rbac/Permissions', () => ({
    Permissions: jest.fn().mockImplementation(() => ({}))
}))
jest.mock('./enterprise/services/login-method.service', () => ({
    LoginMethodService: jest.fn()
}))
jest.mock('./enterprise/services/organization.service', () => ({
    OrganizationService: jest.fn()
}))
jest.mock('./enterprise/sso/Auth0SSO', () => jest.fn())
jest.mock('./enterprise/sso/AzureSSO', () => jest.fn())
jest.mock('./enterprise/sso/GithubSSO', () => jest.fn())
jest.mock('./enterprise/sso/GoogleSSO', () => jest.fn())
jest.mock('./StripeManager', () => ({
    StripeManager: { getInstance: jest.fn() }
}))
jest.mock('./UsageCacheManager', () => ({
    UsageCacheManager: { getInstance: jest.fn() }
}))
jest.mock('./utils/getRunningExpressApp', () => ({
    getRunningExpressApp: jest.fn()
}))

const mockedAxios = axios as jest.Mocked<typeof axios>
const ORIGINAL_ENV = process.env

describe('IdentityManager platform and license defaults', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        process.env = { ...ORIGINAL_ENV }
        delete process.env.FLOWISE_EE_LICENSE_KEY
        delete process.env.LICENSE_URL
        delete process.env.OFFLINE
        delete process.env.STRIPE_SECRET_KEY
    })

    afterEach(() => {
        process.env = ORIGINAL_ENV
    })

    it('uses enterprise platform with a valid license state when no license key is configured', async () => {
        const identityManager = new IdentityManager()

        await identityManager.initialize()

        expect(identityManager.getPlatformType()).toBe(Platform.ENTERPRISE)
        expect(identityManager.isEnterprise()).toBe(true)
        expect(identityManager.isLicenseValid()).toBe(true)
    })

    it('keeps enterprise platform when remote license verification fails', async () => {
        process.env.FLOWISE_EE_LICENSE_KEY = 'invalid-license-key'
        process.env.LICENSE_URL = 'https://license.example.com/api/v1'
        mockedAxios.post.mockRejectedValue(new Error('verification failed'))
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined)
        const identityManager = new IdentityManager()

        await identityManager.initialize()

        expect(mockedAxios.post).toHaveBeenCalledWith('https://license.example.com/api/v1/enterprise/verify', {
            license: 'invalid-license-key'
        })
        expect(identityManager.getPlatformType()).toBe(Platform.ENTERPRISE)
        expect(identityManager.isEnterprise()).toBe(true)
        expect(identityManager.isLicenseValid()).toBe(false)

        consoleErrorSpy.mockRestore()
    })
})
