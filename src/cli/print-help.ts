export function printHelp(): void {
  console.log(`
nrp — Node Reverse Proxy

USAGE
  nrp [options]

OPTIONS
  -c, --config <path>      Path to config file (default: ./proxy.config.json)
      --log-level <level>  Log level: debug | info | warn | error | silent (default: info)
  -h, --help               Show this help message

CONFIG FORMAT (proxy.config.json)
  {
    "port": 8080,
    "balancer": "round-robin",
    "headers": {
      "response": { "X-Powered-By": "nrp" }
    },
    "routes": [
      {
        "match": "/api",
        "rewrite": { "stripPrefix": "/api" },
        "upstreams": [
          { "host": "localhost", "port": 3001 },
          { "host": "localhost", "port": 3002 }
        ]
      },
      {
        "match": "/",
        "upstreams": [{ "host": "localhost", "port": 3000 }]
      }
    ]
  }

EXAMPLES
  nrp
  nrp --config ./config/dev.json --log-level debug
`);
}
