import { timingSafeEqual } from 'crypto'
import { StatusCodes } from 'http-status-codes'
import type { NextFunction, Request, Response } from 'express'

export function authenticateDaianaProvisioning(req: Request, res: Response, next: NextFunction) {
    const configuredSecret = process.env.DAIANA_STUDIO_PROVISIONING_SECRET
    const suppliedSecret = req.get('authorization')?.replace(/^Bearer\s+/i, '')

    if (!configuredSecret) return res.sendStatus(StatusCodes.SERVICE_UNAVAILABLE)
    if (!suppliedSecret) return res.sendStatus(StatusCodes.UNAUTHORIZED)

    const expected = Buffer.from(configuredSecret)
    const supplied = Buffer.from(suppliedSecret)
    if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) {
        return res.sendStatus(StatusCodes.UNAUTHORIZED)
    }

    return next()
}
