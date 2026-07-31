import { v4 as uuidv4 } from 'uuid'

export interface PredictionSessionBody {
    chatId?: string
    overrideConfig?: {
        sessionId?: string
    }
}

export const resolvePredictionSessionId = (body: PredictionSessionBody, generateId: () => string = uuidv4): string => {
    return body.chatId || body.overrideConfig?.sessionId || generateId()
}
