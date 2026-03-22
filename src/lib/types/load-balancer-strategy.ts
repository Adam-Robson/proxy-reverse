/**
 * Load balancing strategies for the reverse proxy server.
 * 
 * @property {"round-robin"} round-robin - Distributes requests evenly across all upstream servers.
 * @property {"random"} random - Selects an upstream server at random for each request.
 * @property {"weighted"} weighted - Selects an upstream server based on assigned weights.
 *
 */
export type LoadBalancerStrategy = "round-robin" | "random" | "weighted";
