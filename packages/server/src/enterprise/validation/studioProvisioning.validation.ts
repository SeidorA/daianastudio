import { StatusCodes } from 'http-status-codes'
import { InternalFlowiseError } from '../../errors/internalFlowiseError'
import type { StudioProvisioningDTO } from '../services/account.service'
import { isInvalidEmail, isInvalidName, isInvalidUUID } from '../utils/validation.util'

export function validateStudioProvisioningRequest(data: unknown): StudioProvisioningDTO {
    const body = data && typeof data === 'object' && !Array.isArray(data) ? (data as Record<string, unknown>) : null
    const tenantId = body?.tenantId
    const name = body?.name
    if (
        !body ||
        isInvalidUUID(body.externalUserId) ||
        !Number.isSafeInteger(tenantId) ||
        (tenantId as number) < 1 ||
        isInvalidEmail(body.email) ||
        isInvalidName(name) ||
        typeof name !== 'string' ||
        !name.trim()
    ) {
        throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'Invalid Studio provisioning request')
    }

    return data as StudioProvisioningDTO
}
