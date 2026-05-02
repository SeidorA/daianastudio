import { createPortal } from 'react-dom'
import PropTypes from 'prop-types'
import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { enqueueSnackbar as enqueueSnackbarAction, closeSnackbar as closeSnackbarAction } from '@/store/actions'

// Material
import { Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, Box, Stack, OutlinedInput, Typography } from '@mui/material'

// Project imports
import { StyledButton } from '@/ui-component/button/StyledButton'
import ConfirmDialog from '@/ui-component/dialog/ConfirmDialog'
import { Grid } from '@/ui-component/grid/Grid'

// Icons
import { IconX, IconShare } from '@tabler/icons-react'

// API
import workspaceApi from '@/api/workspace'
import userApi from '@/api/user'

// Hooks
import useApi from '@/hooks/useApi'

// utils
import useNotifier from '@/utils/useNotifier'

// const
import { HIDE_CANVAS_DIALOG, SHOW_CANVAS_DIALOG } from '@/store/actions'

const ShareWithWorkspaceDialog = ({ show, dialogProps, onCancel, setError }) => {
    const portalElement = document.getElementById('portal')

    const dispatch = useDispatch()

    // ==============================|| Snackbar ||============================== //

    useNotifier()
    const getSharedWorkspacesForItemApi = useApi(workspaceApi.getSharedWorkspacesForItem)
    const getWorkspacesByOrganizationIdUserIdApi = useApi(userApi.getWorkspacesByOrganizationIdUserId)
    const enqueueSnackbar = (...args) => dispatch(enqueueSnackbarAction(...args))
    const closeSnackbar = (...args) => dispatch(closeSnackbarAction(...args))

    const user = useSelector((state) => state.auth.user)

    const [outputSchema, setOutputSchema] = useState([])
    const outputSchemaRef = useRef([])

    const [name, setName] = useState('')

    const toggleWorkspaceShare = useCallback((workspaceId, shared) => {
        const nextRows = outputSchemaRef.current.map((row) => (row.id === workspaceId ? { ...row, shared } : row))
        outputSchemaRef.current = nextRows
        setOutputSchema(nextRows)
    }, [])

    const columns = useMemo(
        () => [
            { field: 'workspaceName', headerName: 'Workspace', editable: false, flex: 1 },
            {
                field: 'shared',
                headerName: 'Share',
                editable: false,
                width: 180,
                sortable: false,
                filterable: false,
                renderCell: (params) => (
                    <Checkbox
                        checked={Boolean(params.row.shared)}
                        onChange={(event) => toggleWorkspaceShare(params.row.id, event.target.checked)}
                    />
                )
            }
        ],
        [toggleWorkspaceShare]
    )

    useEffect(() => {
        if (getWorkspacesByOrganizationIdUserIdApi.data && getSharedWorkspacesForItemApi.data) {
            const workspaces = []
            const sharedWorkspaces = getSharedWorkspacesForItemApi.data || []

            getWorkspacesByOrganizationIdUserIdApi.data
                .filter((ws) => ws.workspace.id !== user.activeWorkspaceId)
                .map((ws) => {
                    const isShared = sharedWorkspaces.some((sw) => sw.workspaceId === ws.workspace.id)
                    workspaces.push({
                        id: ws.workspace.id,
                        workspaceName: ws.workspace.name,
                        shared: isShared
                    })
                })
            outputSchemaRef.current = workspaces
            setOutputSchema(workspaces)
        }
    }, [getWorkspacesByOrganizationIdUserIdApi.data, getSharedWorkspacesForItemApi.data, user.activeWorkspaceId])

    useEffect(() => {
        if (getSharedWorkspacesForItemApi.error && setError) {
            setError(getSharedWorkspacesForItemApi.error)
        }
    }, [getSharedWorkspacesForItemApi.error, setError])

    useEffect(() => {
        if (getWorkspacesByOrganizationIdUserIdApi.error && setError) {
            setError(getWorkspacesByOrganizationIdUserIdApi.error)
        }
    }, [getWorkspacesByOrganizationIdUserIdApi.error, setError])

    useEffect(() => {
        outputSchemaRef.current = []
        setOutputSchema([])
        if (user) {
            getWorkspacesByOrganizationIdUserIdApi.request(user.activeOrganizationId, user.id)
        }
        setName(dialogProps.data.name)
        getSharedWorkspacesForItemApi.request(dialogProps.data.id)

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dialogProps, user])

    useEffect(() => {
        if (show) dispatch({ type: SHOW_CANVAS_DIALOG })
        else dispatch({ type: HIDE_CANVAS_DIALOG })
        return () => dispatch({ type: HIDE_CANVAS_DIALOG })
    }, [show, dispatch])

    const shareItemRequest = async () => {
        try {
            const obj = {
                itemType: dialogProps.data.itemType,
                workspaceIds: []
            }
            outputSchemaRef.current.forEach((row) => {
                if (row.shared) {
                    obj.workspaceIds.push(row.id)
                }
            })
            const sharedResp = await workspaceApi.setSharedWorkspacesForItem(dialogProps.data.id, obj)
            if (sharedResp.data) {
                enqueueSnackbar({
                    message: 'Items Shared Successfully',
                    options: {
                        key: new Date().getTime() + Math.random(),
                        variant: 'success',
                        action: (key) => (
                            <Button style={{ color: 'white' }} onClick={() => closeSnackbar(key)}>
                                <IconX />
                            </Button>
                        )
                    }
                })
                onCancel()
            }
        } catch (error) {
            if (setError) setError(error)
            enqueueSnackbar({
                message: `Failed to share Item: ${
                    typeof error.response.data === 'object' ? error.response.data.message : error.response.data
                }`,
                options: {
                    key: new Date().getTime() + Math.random(),
                    variant: 'error',
                    persist: true,
                    action: (key) => (
                        <Button style={{ color: 'white' }} onClick={() => closeSnackbar(key)}>
                            <IconX />
                        </Button>
                    )
                }
            })
            onCancel()
        }
    }

    const component = show ? (
        <Dialog
            fullWidth
            maxWidth='md'
            open={show}
            onClose={onCancel}
            aria-labelledby='alert-dialog-title'
            aria-describedby='alert-dialog-description'
        >
            <DialogTitle sx={{ fontSize: '1rem' }} id='alert-dialog-title'>
                <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
                    <IconShare style={{ marginRight: '10px' }} />
                    {dialogProps.data.title}
                </div>
            </DialogTitle>
            <DialogContent>
                <Box sx={{ p: 2 }}>
                    <Stack sx={{ position: 'relative' }} direction='row'>
                        <Typography variant='overline'>Name</Typography>
                    </Stack>
                    <OutlinedInput id='name' type='string' disabled={true} fullWidth placeholder={name} value={name} name='name' />
                </Box>
                <Box sx={{ p: 2 }}>
                    <Grid columns={columns} rows={outputSchema} />
                </Box>
            </DialogContent>
            <DialogActions>
                <Button onClick={() => onCancel()}>{dialogProps.cancelButtonName}</Button>
                <StyledButton onClick={shareItemRequest} variant='contained'>
                    {dialogProps.confirmButtonName}
                </StyledButton>
            </DialogActions>
            <ConfirmDialog />
        </Dialog>
    ) : null

    return createPortal(component, portalElement)
}

ShareWithWorkspaceDialog.propTypes = {
    show: PropTypes.bool,
    dialogProps: PropTypes.object,
    onCancel: PropTypes.func,
    onConfirm: PropTypes.func,
    setError: PropTypes.func
}

export default ShareWithWorkspaceDialog
