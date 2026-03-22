export interface Upstream {
  host: string;
  port: number;
  protocol?: 'http' | 'https';
  weight?: number;
}
