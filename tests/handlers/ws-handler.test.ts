import type { Duplex } from 'node:stream';
import { describe, expect, it, vi } from 'vitest';
import { handleWebSocketUpgrade } from '@@/handlers/ws-handler.js';
import type { ConfigType } from '@@/types/config.js';

function mockSocket() {
	return {
		write: vi.fn(),
		destroy: vi.fn(),
		pipe: vi.fn(),
		on: vi.fn(),
	} as unknown as Duplex & { write: ReturnType<typeof vi.fn>; destroy: ReturnType<typeof vi.fn> };
}

function mockReq(url: string) {
	return {
		url,
		method: 'GET',
		headers: { host: 'localhost' },
		socket: { remoteAddress: '127.0.0.1' },
	} as never;
}

const config: ConfigType = {
	port: 8080,
	routes: [{ match: '/ws', upstreams: [{ host: 'localhost', port: 9000 }] }],
};

describe('handleWebSocketUpgrade', () => {
	it('sends 502 and destroys socket when no route matches', async () => {
		const socket = mockSocket();
		await handleWebSocketUpgrade(mockReq('/unknown'), socket, Buffer.alloc(0), config);
		expect(socket.write).toHaveBeenCalledWith('HTTP/1.1 502 Bad Gateway\r\n\r\n');
		expect(socket.destroy).toHaveBeenCalled();
	});

	it('sends 502 and destroys socket when route has no upstreams', async () => {
		const cfg: ConfigType = {
			port: 8080,
			routes: [{ match: '/ws', upstreams: [] }],
		};
		const socket = mockSocket();
		await handleWebSocketUpgrade(mockReq('/ws'), socket, Buffer.alloc(0), cfg);
		expect(socket.write).toHaveBeenCalledWith('HTTP/1.1 502 Bad Gateway\r\n\r\n');
		expect(socket.destroy).toHaveBeenCalled();
	});
});
