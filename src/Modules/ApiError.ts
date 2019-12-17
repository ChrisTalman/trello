'use strict';

// External Modules
import { RequestJsonError } from '@chris-talman/request';

// Types
interface ApiErrorPayload
{
	error: 'API_TOKEN_LIMIT_EXCEEDED' | 'API_KEY_LIMIT_EXCEEDED';
	message: string;
};

export class ApiError extends Error
{
	public readonly error: RequestJsonError <ApiErrorPayload>;
	public readonly type: ApiErrorPayload['error'];
	public readonly message: string;
	constructor({error}: {error: RequestJsonError <ApiErrorPayload>})
	{
		const formattedMessage = 'Trello Error: ' + error.json.message;
		super(formattedMessage);
		this.error = error;
		this.type = error.json.error;
	};
};

/** If promise rejects with an API error, the error is thrown in a more readable form. */
export async function throwRejectionApiError <GenericResolution> (promise: Promise<GenericResolution>)
{
	let result: GenericResolution;
	try
	{
		result = await promise;
	}
	catch (error)
	{
		throwApiError(error);
		throw new Error('throwApiError() failed');
	};
	return result;
};

export function throwApiError(error: any)
{
	const apiError: RequestJsonError <ApiErrorPayload> = error;
	if (apiError instanceof RequestJsonError && typeof apiError.json.message === 'string' && typeof apiError.json.error === 'string')
	{
		throw new ApiError({error: apiError});
	}
	else
	{
		throw error;
	};
};