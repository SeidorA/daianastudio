import express from 'express'
import { timingSafeEqual } from 'crypto'
import { StatusCodes } from 'http-status-codes'
import { IdentityManager } from '../../IdentityManager'
import { AccountController } from '../controllers/account.controller'
import { checkAnyPermission } from '../rbac/PermissionCheck'

const router = express.Router()
const accountController = new AccountController()

export const authenticateDaianaProvisioning = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const configuredSecret = process.env.DAIANA_STUDIO_PROVISIONING_SECRET
    const suppliedSecret = req.get('authorization')?.replace(/^Bearer\s+/i, '')
    if (!configuredSecret) return res.sendStatus(StatusCodes.SERVICE_UNAVAILABLE)
    if (!suppliedSecret) return res.sendStatus(StatusCodes.UNAUTHORIZED)
    const expected = Buffer.from(configuredSecret)
    const supplied = Buffer.from(suppliedSecret)
    if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return res.sendStatus(StatusCodes.UNAUTHORIZED)
    return next()
}

router.post('/provision', authenticateDaianaProvisioning, accountController.provision)

router.post('/register', accountController.register)

// feature flag to workspace since only user who has workspaces can invite
router.post(
    '/invite',
    IdentityManager.checkFeatureByPlan('feat:workspaces'),
    checkAnyPermission('workspace:add-user,users:manage'),
    accountController.invite
)

router.post('/logout', accountController.logout)

router.post('/verify', accountController.verify)

router.post('/confirm-email-change', accountController.confirmEmailChange)

router.post('/resend-verification', accountController.resendVerificationEmail)

router.post('/forgot-password', accountController.forgotPassword)

router.post('/reset-password', accountController.resetPassword)

router.post('/billing', accountController.createStripeCustomerPortalSession)

router.delete('/delete', accountController.delete)

export default router
