import { beforeEach, describe, expect, it, jest } from '@jest/globals'
import { DataSource } from 'typeorm'

const mockExistsSync = jest.fn((_path?: any) => true)
const mockMkdirSync = jest.fn((_path?: any) => undefined)

jest.mock('fs', () => ({
    existsSync: (path: any) => mockExistsSync(path),
    mkdirSync: (path: any) => mockMkdirSync(path)
}))

jest.mock('./utils', () => ({
    getUserHome: jest.fn(() => '/tmp/flowise-test-home')
}))

jest.mock('./utils/logger', () => ({
    __esModule: true,
    default: {
        error: jest.fn()
    }
}))

jest.mock('./database/entities', () => ({ entities: {} }))
jest.mock('./database/migrations/sqlite', () => ({ sqliteMigrations: [] }))
jest.mock('./database/migrations/mysql', () => ({ mysqlMigrations: [] }))
jest.mock('./database/migrations/mariadb', () => ({ mariadbMigrations: [] }))
jest.mock('./database/migrations/postgres', () => ({ postgresMigrations: [] }))

const ORIGINAL_ENV = process.env

describe('DataSource postgres schema configuration', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        process.env = { ...ORIGINAL_ENV, DATABASE_TYPE: 'postgres', DATABASE_HOST: 'localhost', DATABASE_NAME: 'flowise' }
        delete process.env.DATABASE_SCHEMA
    })

    afterEach(() => {
        process.env = ORIGINAL_ENV
    })

    it('sets the postgres search_path option when DATABASE_SCHEMA is configured', async () => {
        process.env.DATABASE_SCHEMA = 'studio'

        const { init, getPostgresSearchPathOptionFromEnv } = require('./DataSource')
        await init()

        expect(getPostgresSearchPathOptionFromEnv()).toBe('-c search_path=studio,public')
        expect(DataSource).toHaveBeenCalledWith(
            expect.objectContaining({ extra: expect.objectContaining({ options: '-c search_path=studio,public' }) })
        )
    })

    it('keeps the default postgres connection options when DATABASE_SCHEMA is unset', async () => {
        const { init, getPostgresSearchPathOptionFromEnv } = require('./DataSource')
        await init()

        expect(getPostgresSearchPathOptionFromEnv()).toBeUndefined()
        expect(DataSource).toHaveBeenCalledWith(expect.objectContaining({ extra: expect.objectContaining({ options: undefined }) }))
    })
})
