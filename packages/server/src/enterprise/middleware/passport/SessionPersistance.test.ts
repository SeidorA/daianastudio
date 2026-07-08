import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals'

const mockPool = jest.fn()
const mockPgSessionStore = jest.fn()
const mockGetPostgresSearchPathOptionFromEnv = jest.fn()

jest.mock('pg', () => ({
    Pool: mockPool
}))

jest.mock('connect-pg-simple', () => () => mockPgSessionStore)
jest.mock('express-session', () => ({}))
jest.mock('ioredis', () => jest.fn())
jest.mock('connect-redis', () => ({ RedisStore: jest.fn() }))

jest.mock('../../../DataSource', () => ({
    getDatabaseSSLFromEnv: jest.fn(() => undefined),
    getPostgresSearchPathOptionFromEnv: () => mockGetPostgresSearchPathOptionFromEnv()
}))
jest.mock('../../../utils', () => ({
    getUserHome: jest.fn(() => '/tmp/flowise-test-home')
}))
jest.mock('../../database/entities/login-session.entity', () => ({
    LoginSession: class LoginSession {}
}))
jest.mock('../../../utils/getRunningExpressApp', () => ({
    getRunningExpressApp: jest.fn()
}))

const ORIGINAL_ENV = process.env

describe('SessionPersistance postgres schema configuration', () => {
    beforeEach(() => {
        jest.resetModules()
        jest.clearAllMocks()
        process.env = { ...ORIGINAL_ENV, DATABASE_TYPE: 'postgres', DATABASE_HOST: 'localhost', DATABASE_NAME: 'flowise' }
        delete process.env.DATABASE_SCHEMA
        mockPool.mockImplementation((options) => ({ options }))
        mockPgSessionStore.mockImplementation(function PgSessionStore(options: any) {
            return { options }
        })
    })

    afterEach(() => {
        process.env = ORIGINAL_ENV
    })

    it('passes the configured postgres search_path option to the session pool', () => {
        mockGetPostgresSearchPathOptionFromEnv.mockReturnValue('-c search_path=studio,public')

        const { initializeDBClientAndStore } = require('./SessionPersistance')
        const store = initializeDBClientAndStore()

        expect(mockPool).toHaveBeenCalledWith(expect.objectContaining({ options: '-c search_path=studio,public' }))
        expect(mockPgSessionStore).toHaveBeenCalledWith(
            expect.objectContaining({
                pool: expect.objectContaining({ options: expect.objectContaining({ options: '-c search_path=studio,public' }) })
            })
        )
        expect(store.options).toEqual(expect.objectContaining({ tableName: 'login_sessions', createTableIfMissing: true }))
    })

    it('keeps default postgres session pool options when DATABASE_SCHEMA is unset', () => {
        mockGetPostgresSearchPathOptionFromEnv.mockReturnValue(undefined)

        const { initializeDBClientAndStore } = require('./SessionPersistance')
        initializeDBClientAndStore()

        expect(mockPool).toHaveBeenCalledWith(expect.objectContaining({ options: undefined }))
    })
})
