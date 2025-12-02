import browser from 'webextension-polyfill'
import { LoginForm } from './LoginForm'
import { Settings } from './Settings'

interface LoginViewProps {
    currentView: 'main' | 'settings' | 'login'
    onViewChange: (view: 'main' | 'settings' | 'login') => void
}

export function LoginView({ currentView, onViewChange }: LoginViewProps) {
    return (
        <div className="w-[450px] min-h-[500px] p-6">
            {currentView === 'settings' ? (
                <Settings onBack={() => onViewChange('main')} />
            ) : (
                <div className="space-y-6">
                    {/* Logo and Title */}
                    <div className="text-center mb-2">
                        <div className="flex items-center justify-center mb-4">
                            <div className="w-12 h-12">
                                <img
                                    src={browser.runtime.getURL('assets/readspace.svg')}
                                    alt="Readspace"
                                    className="w-full h-full rounded"
                                />
                            </div>
                        </div>
                        <h1 className="text-lg font-semibold">Sign in to Readspace</h1>
                    </div>

                    {/* Embedded Login Form */}
                    <LoginForm onShowSelfHosted={() => onViewChange('settings')} />

                    {/* New to Readspace link */}
                    <div className="text-center">
                        <p className="text-sm text-muted-foreground">
                            New to Readspace?{' '}
                            <button
                                onClick={() =>
                                    window.open('https://app.readspace.ai/signup', '_blank')
                                }
                                className="text-primary hover:underline font-medium"
                            >
                                Create account
                            </button>
                        </p>
                    </div>
                </div>
            )}
        </div>
    )
}
