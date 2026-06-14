declare module 'sql.js' {
  interface SqlJsStatic {
    Database: new (data?: ArrayLike<number> | Buffer | null) => Database;
  }
  interface Database {
    run(sql: string, params?: any[]): void;
    exec(sql: string): void;
    prepare(sql: string): Statement;
    export(): Uint8Array;
    close(): void;
  }
  interface Statement {
    bind(params?: any[]): void;
    step(): boolean;
    getAsObject(): Record<string, any>;
    free(): void;
  }
  export default function initSqlJs(): Promise<SqlJsStatic>;
}
