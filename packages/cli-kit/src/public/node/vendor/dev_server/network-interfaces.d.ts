declare module 'network-interfaces' {
    export function fromIp(ip: string, options?: { internal?: boolean, ipVersion?: number }): string;
    export function toIp(interfaceName: string, options?: { internal?: boolean, ipVersion?: number }): string;
    export function getInterface(options?: { internal?: boolean, ipVersion?: number }): string;
}