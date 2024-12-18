import fs from 'fs';
import * as os from 'os';
import * as ni from 'network-interfaces';
import { execSync } from 'child_process';

class DevServerUtils {
  static readonly INFERENCE_MODE_SENTINEL =
    '/opt/dev/misc/dev-server-inference-mode';
  static readonly BACKEND_PORT = 8080;
  static readonly CONNECT_TIMEOUT = 100; // 100ms
  static readonly HOSTS_FILE = '/etc/hosts';

  static assertConnectable(name: string, addr: string, port: number): void {
    try {
      execSync(`nc -z -v -w 1 ${addr} ${port}`, {
        timeout: DevServerUtils.CONNECT_TIMEOUT,
        stdio: 'ignore',
      });
    } catch (err) {
      throw new Error(
        `NET FAILED DevServer for '${name}' is not running on ${port} / ${addr}: \`dev up ${name}\` to start it.`
      );
    }
  }

  static inferenceModeAndProjectIsEdition2016(name: string): boolean {
    try {
      fs.accessSync(DevServerUtils.INFERENCE_MODE_SENTINEL);
      try {
        fs.accessSync(`/opt/nginx/etc/manifest/${name}/current/edition-2024`);
        return false;
      } catch {
        return true;
      }
    } catch {
      return false;
    }
  }

  static getIpFromHosts(hostname: string): string {
    try {
      const hostsContent = fs.readFileSync(DevServerUtils.HOSTS_FILE, 'utf8');
      const lines = hostsContent.split(/\r?\n/);
      for (const line of lines) {
        const matches = /^\s*?([^#]+?)\s+([^#]+?)$/.exec(line);
        if (matches && matches.length === 3 && matches[2] === hostname) {
          return matches[1]!; // Return the IP address
        }
      }
    } catch (error) {
      console.error('Error reading hosts file:', error);
    }

    throw new Error(`No IP found for hostname: ${hostname}`);
  }

  static getAddrPort2024(name: string): [string, number] {
    try {
      const backendIp = DevServerUtils.resolveBackendHost(name);
      const interfaceName = ni.fromIp(backendIp, {
        internal: true,
        ipVersion: 4,
      });
      return [backendIp, DevServerUtils.BACKEND_PORT];
    } catch (error) {
      throw new Error(
        `DevServer for '${name}' is not running: \`dev up ${name}\` to start it.`
      );
    }
  }

  static getAddrPort2016(name: string): [string, number] {
    try {
      const portContent = fs.readFileSync(
        `${os.homedir()}/.local/run/services/${name}/server/port`,
        'utf-8'
      );
      return ['localhost', parseInt(portContent, 10)];
    } catch (error) {
      throw new Error(
        `DevServer for '${name}' is not running: \`dev up ${name}\` to start it.`
      );
    }
  }

  static resolveBackendHost(name: string): string {
    let host: string;
    try {
      host = fs.readlinkSync(`/opt/nginx/etc/manifest/${name}/current`);
    } catch (error) {
      host = `${name}.root.shopify.dev.internal`;
    }

    try {
      return DevServerUtils.getIpFromHosts(host);
    } catch {
      return host;
    }
  }
}

export class DevServer {
  protected name: string;

  constructor(name: string) {
    if (!process.env.SPIN && !process.env.USING_DEV) {
      throw new Error('DevServer is not supported in this environment');
    }

    if (name === 'shopify') {
      throw new Error('Use DevServer.core for the \'shopify\' project');
    }
    this.name = name;
  }

  url({
    nonstandardHostPrefix,
  }: { nonstandardHostPrefix?: string } = {}): string {
    return `https://${this.host({nonstandardHostPrefix})}`;
  }

  host({
    nonstandardHostPrefix,
  }: { nonstandardHostPrefix?: string } = {}): string {
    const prefix = nonstandardHostPrefix || this.name;

    if (process.env.SPIN === '1') {
      const services = fs.readdirSync('/run/ports2')
        .filter(file => file.endsWith(`--${this.name}`));

      if (services.length === 0) {
        throw new Error(
          `DevServer for '${this.name}' not present in this spin environment`
        );
      }

      const match = new RegExp(`^(.+)${this.name}$`).exec(services[0]!);
      const organization = match ? match[1] : '';
      const spinPrefix = organization !== 'shopify--' ? `${organization}` : '';

      return `${spinPrefix}${this.name}.${process.env.SPIN_FQDN}`;
    } else if (DevServerUtils.inferenceModeAndProjectIsEdition2016(this.name)) {
      this.assertRunningLocally2016();
      return `${prefix}.myshopify.io`;
    } else {
      this.assertRunningLocally2024();
      return `${prefix}.shop.dev`;
    }
  }

  protected assertRunningLocally2024(): void {
    const [addr, port] = DevServerUtils.getAddrPort2024(this.name);
    DevServerUtils.assertConnectable(this.name, addr, port);
  }

  protected assertRunningLocally2016(): void {
    const [addr, port] = DevServerUtils.getAddrPort2016(this.name);
    DevServerUtils.assertConnectable(this.name, addr, port);
  }
}

export class DevServerCore {
  private readonly name = 'shopify';

  url(prefix: string): string {
    return `https://${this.host(prefix)}`;
  }

  host(prefix: string): string {
    if (process.env.SPIN === '1') {
      const projectPortRoot = fs
        .readdirSync('/run/ports2')
        .find((file) => file.endsWith(`--${this.name}`));
      if (!projectPortRoot) {
        throw new Error(
          `DevServer for '${this.name}' not present in this spin environment`
        );
      }
      // Spin mostly doesn't do alternative hostname prefixing.
      return `${prefix}.${this.name}.${process.env.SPIN_FQDN}`;
    } else if (DevServerUtils.inferenceModeAndProjectIsEdition2016('shopify')) {
      this.assertRunningLocally2016();
      return `${prefix}.myshopify.io`;
    } else {
      this.assertRunningLocally2024();
      return `${prefix}.my.shop.dev`;
    }
  }

  private assertRunningLocally2024(): void {
    const [addr, port] = DevServerUtils.getAddrPort2024('shopify');
    DevServerUtils.assertConnectable('shopify', addr, port);
  }

  private assertRunningLocally2016(): void {
    const [addr, port] = DevServerUtils.getAddrPort2016('shopify');
    DevServerUtils.assertConnectable('shopify', addr, port);
  }
}