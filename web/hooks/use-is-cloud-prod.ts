import * as React from "react"

export function useIsCloudProd() {
    const [isCloudProd, setIsCloudProd] = React.useState<boolean>(false)

    React.useEffect(() => {
        setIsCloudProd(window.location.hostname === 'app.readspace.ai')
    }, [])

    return isCloudProd
}
