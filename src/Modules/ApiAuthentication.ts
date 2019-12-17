'use strict';

// External Modules
import { URLSearchParams } from 'url';

// Intenral Modules
import { Client } from 'src/Modules/Client';

export function applyApiAuthentication({path, client}: {path: string, client: Client})
{
	const params = new URLSearchParams(path);
	params.set('key', client.key);
	params.set('token', client.token);
	path = path + '?' + params.toString();
	return path;
};