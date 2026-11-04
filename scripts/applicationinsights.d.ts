declare module "applicationinsights-js" {
    interface AppInsightsConfig {
        instrumentationKey: string;
        disableAjaxTracking?: boolean;
        enableDebug?: boolean;
    }

    export const AppInsights: {
        downloadAndSetup(config: AppInsightsConfig): void;
        setAuthenticatedUserContext(authenticatedUserId: string, accountId?: string): void;
        trackEvent(name: string, properties?: { [key: string]: string }): void;
        flush(): void;
    };
}
