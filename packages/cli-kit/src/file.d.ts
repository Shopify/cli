export declare function read(path: string): Promise<string>;
export declare function write(path: string, data: string): Promise<void>;
export declare function mkdir(path: string): Promise<void>;
export declare function rmdir(path: string): Promise<void>;
export declare function mkTmpDir(): Promise<string>;
export declare function isDirectory(path: string): Promise<boolean>;
export declare function exists(path: string): Promise<boolean>;
