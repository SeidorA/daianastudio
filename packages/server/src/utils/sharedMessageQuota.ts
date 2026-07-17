import { StatusCodes } from 'http-status-codes'
import { v4 as uuidv4 } from 'uuid'
import type { ChatType, IChatFlow } from '../Interface'
import { InternalFlowiseError } from '../errors/internalFlowiseError'
import logger from './logger'

const QUOTA_SOURCE = 'studio-shared-chat'
const SAFE_UNAVAILABLE_MESSAGE = 'This chatbot is temporarily unavailable. Please try again later.'
const MAX_CONSUME_ATTEMPTS = 3

type QuotaRpcResult = {
    allowed?: boolean
    status?: string
}

type SharedMessageQuotaParams = {
    chatflow: IChatFlow
    organizationId: string
    workspaceId: string
    isInternal: boolean
    isEvaluation: boolean
    isTool: boolean
    chatType?: ChatType
    requestId?: unknown
}

type QuotaReservation = {
    tenantId: number
    requestId: string
}

export class SharedMessageQuotaError extends InternalFlowiseError {}

const isQuotaEnabled = () => process.env.DAIANA_SHARED_CHAT_QUOTA_ENABLED === 'true'

const isEligibleSharedChat = ({ chatflow, isInternal, isEvaluation, isTool, chatType }: SharedMessageQuotaParams) =>
    chatflow.isPublic === true && !isInternal && !isEvaluation && !isTool && (chatType === undefined || chatType === 'EXTERNAL')

const getRequestId = (requestId: unknown): string => {
    if (requestId === undefined || requestId === null || requestId === '') return uuidv4()
    if (typeof requestId !== 'string' || requestId.trim().length === 0 || requestId.length > 200) {
        throw new SharedMessageQuotaError(StatusCodes.BAD_REQUEST, 'Invalid request ID')
    }
    return requestId.trim()
}

const callQuotaRpc = async <T>(name: string, body: Record<string, unknown>): Promise<T> => {
    const supabaseUrl = process.env.SUPABASE_BASE_URL?.replace(/\/$/, '')
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !serviceRoleKey) {
        throw new SharedMessageQuotaError(StatusCodes.SERVICE_UNAVAILABLE, SAFE_UNAVAILABLE_MESSAGE)
    }

    let response: Awaited<ReturnType<typeof fetch>>
    try {
        response = await fetch(`${supabaseUrl}/rest/v1/rpc/${name}`, {
            method: 'POST',
            headers: {
                apikey: serviceRoleKey,
                Authorization: `Bearer ${serviceRoleKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        })
    } catch (error) {
        throw new SharedMessageQuotaError(StatusCodes.SERVICE_UNAVAILABLE, SAFE_UNAVAILABLE_MESSAGE)
    }

    if (!response.ok) throw new SharedMessageQuotaError(StatusCodes.SERVICE_UNAVAILABLE, SAFE_UNAVAILABLE_MESSAGE)
    return (await response.json()) as T
}

const reserveQuota = async (params: SharedMessageQuotaParams): Promise<QuotaReservation | undefined> => {
    if (!isQuotaEnabled() || !isEligibleSharedChat(params)) return undefined

    const tenantId = await callQuotaRpc<number | null>('resolve_daiana_tenant_from_studio', {
        p_studio_organization_id: params.organizationId,
        p_studio_workspace_id: params.workspaceId
    })
    if (!Number.isInteger(tenantId)) {
        throw new SharedMessageQuotaError(StatusCodes.SERVICE_UNAVAILABLE, SAFE_UNAVAILABLE_MESSAGE)
    }

    const requestId = getRequestId(params.requestId)
    const result = await callQuotaRpc<QuotaRpcResult>('reserve_tenant_message_quota', {
        p_tenant_id: tenantId,
        p_request_id: requestId,
        p_source: QUOTA_SOURCE
    })

    if (result.status === 'reserved') return { tenantId: tenantId as number, requestId }
    if (result.status === 'already_reserved') {
        throw new SharedMessageQuotaError(StatusCodes.CONFLICT, 'This request is already in progress.')
    }
    if (result.status === 'already_consumed' || result.status === 'already_released' || result.status === 'request_id_reused') {
        throw new SharedMessageQuotaError(StatusCodes.CONFLICT, 'This request has already been processed.')
    }

    const statusCode = result.status === 'exhausted' ? StatusCodes.TOO_MANY_REQUESTS : StatusCodes.SERVICE_UNAVAILABLE
    throw new SharedMessageQuotaError(statusCode, SAFE_UNAVAILABLE_MESSAGE)
}

const callFinalizeQuota = async (reservation: QuotaReservation, action: 'consume' | 'release'): Promise<QuotaRpcResult> =>
    callQuotaRpc<QuotaRpcResult>(`${action}_tenant_message_quota`, {
        p_tenant_id: reservation.tenantId,
        p_request_id: reservation.requestId,
        p_source: QUOTA_SOURCE
    })

const releaseQuota = async (reservation: QuotaReservation): Promise<void> => {
    const result = await callFinalizeQuota(reservation, 'release')
    if (!result.status || !['released', 'already_released', 'already_consumed'].includes(result.status)) {
        throw new SharedMessageQuotaError(StatusCodes.SERVICE_UNAVAILABLE, SAFE_UNAVAILABLE_MESSAGE)
    }
}

const consumeQuota = async (reservation: QuotaReservation): Promise<void> => {
    let lastError: unknown
    for (let attempt = 1; attempt <= MAX_CONSUME_ATTEMPTS; attempt++) {
        let result: QuotaRpcResult
        try {
            result = await callFinalizeQuota(reservation, 'consume')
        } catch (error) {
            lastError = error
            if (attempt < MAX_CONSUME_ATTEMPTS) continue
            throw error
        }

        if (result.status === 'consumed' || result.status === 'already_consumed') return
        if (result.status === 'already_released') {
            throw new SharedMessageQuotaError(StatusCodes.SERVICE_UNAVAILABLE, SAFE_UNAVAILABLE_MESSAGE)
        }
        lastError = new SharedMessageQuotaError(StatusCodes.SERVICE_UNAVAILABLE, SAFE_UNAVAILABLE_MESSAGE)
    }
    throw lastError
}

const releaseQuotaSafely = async (reservation: QuotaReservation): Promise<void> => {
    try {
        await releaseQuota(reservation)
    } catch (releaseError) {
        logger.error('[server]: Failed to release shared message quota reservation', releaseError)
    }
}

export const runWithSharedMessageQuota = async <T extends { chatMessageId?: unknown }>(
    params: SharedMessageQuotaParams,
    execute: () => Promise<T>
): Promise<T> => {
    const reservation = await reserveQuota(params)
    if (!reservation) return execute()

    let result: T
    try {
        result = await execute()
    } catch (error) {
        await releaseQuotaSafely(reservation)
        throw error
    }

    if (!result?.chatMessageId) {
        await releaseQuotaSafely(reservation)
        throw new Error('Prediction completed without a persisted assistant message')
    }

    await consumeQuota(reservation)
    return result
}
