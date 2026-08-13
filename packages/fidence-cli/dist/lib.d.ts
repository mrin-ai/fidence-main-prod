export declare function getBaseUrl(): string;
export declare function getConfigPath(): string;
export declare function apiFetch(path: string, init?: RequestInit): Promise<{
    response: Response;
    data: unknown;
}>;
export declare function generateKeyPair(): {
    publicKey: string;
    secretKey: string;
};
export declare function sleep(ms: number): Promise<unknown>;
