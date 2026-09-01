import { StatusCodes } from 'http-status-codes'
import { InternalFlowiseError } from '../../errors/internalFlowiseError'
import { validateStudioProvisioningRequest } from './account.controller'

const validRequest = {
    externalUserId: '123e4567-e89b-12d3-a456-426614174000',
    tenantId: 42,
    email: 'owner@example.com',
    name: 'Owner'
}

describe('validateStudioProvisioningRequest', () => {
    it.each([
        ['missing body', undefined],
        ['invalid UUID', { ...validRequest, externalUserId: 'not-a-uuid' }],
        ['non-positive tenant', { ...validRequest, tenantId: 0 }],
        ['unsafe tenant', { ...validRequest, tenantId: Number.MAX_SAFE_INTEGER + 1 }],
        ['invalid email', { ...validRequest, email: 'not-an-email' }],
        ['blank name', { ...validRequest, name: '   ' }],
        ['overlong name', { ...validRequest, name: 'a'.repeat(101) }]
    ])('rejects %s without invoking the service', (_description, request) => {
        expect(() => validateStudioProvisioningRequest(request)).toThrow(InternalFlowiseError)
        try {
            validateStudioProvisioningRequest(request)
        } catch (error) {
            expect(error).toMatchObject({ statusCode: StatusCodes.BAD_REQUEST, message: 'Invalid Studio provisioning request' })
        }
    })

    it('accepts the exact provisioning DTO', () => {
        expect(validateStudioProvisioningRequest(validRequest)).toEqual(validRequest)
    })
})
