import '@fontsource/inter'
import * as React from 'react'
import * as ReactDOM from 'react-dom/client'

import Root from './routes/root.tsx'
import Login from './routes/auth/login.js'
import Landing from './app/routes/landing.tsx'
import ErrorPage from './components/error.tsx'

import { AuthProvider } from './app/authProvider.tsx'
import { ChakraProvider, ThemeConfig } from '@chakra-ui/react'
import { ColorModeScript, extendTheme } from '@chakra-ui/react'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'

const theme: ThemeConfig = extendTheme({
    config: {
        initialColorMode: 'dark',
        useSystemColorMode: false,
    },
    colors: {
        brand: {
            900: '#1a365d',
            800: '#153e75',
            700: '#2a69ac',
        },
    },
    fonts: {
        heading: `'Inter', sans-serif`,
        body: `'Inter', sans-serif`,
    },
})

const router = createBrowserRouter([
    {
        path: '/',
        element: <Root />,
        errorElement: <ErrorPage />,
        children: [
            {
                path: '/',
                element: <Landing />,
            },
        ],
    },
    {
        path: '/auth/login',
        element: <Login />,
        errorElement: <ErrorPage />,
    },
])

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <ColorModeScript initialColorMode={theme.initialColorMode} />
        <ChakraProvider theme={theme}>
            <AuthProvider>
                <RouterProvider router={router} />
            </AuthProvider>
        </ChakraProvider>
    </React.StrictMode>
)
