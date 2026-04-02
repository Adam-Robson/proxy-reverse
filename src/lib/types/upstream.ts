/**
 * Upstream server configuration for the reverse proxy server.
 *
 * @property {string} host - The hostname or IP address of the upstream server.
 * @property {number} port - The port number of the upstream server.
 * @property {('http' | 'https')} [protocol] - The protocol to use when connecting to the upstream server (http or https). Defaults to http.
 * @property {number} [weight] - The weight of the upstream server for weighted load balancing. Defaults to 1.
 *
 */
export interface Upstream {
	host: string;
	port: number;
	protocol?: "http" | "https";
	weight?: number;
}
