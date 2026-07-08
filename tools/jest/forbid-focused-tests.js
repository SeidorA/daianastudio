const focusedTestError = (apiName) => () => {
    throw new Error(`${apiName}.only is disabled. Run the full test suite without focused Jest tests.`)
}

const disableOnly = (api, apiName) => {
    if (!api || typeof api.only !== 'function') return
    api.only = focusedTestError(apiName)
}

disableOnly(global.describe, 'describe')
disableOnly(global.it, 'it')
disableOnly(global.it?.concurrent, 'it.concurrent')
disableOnly(global.test, 'test')
disableOnly(global.test?.concurrent, 'test.concurrent')
