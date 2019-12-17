'use strict';

// Internal Modules
import { Resource } from 'src/Modules/Resource';
import { applyApiAuthentication } from 'src/Modules/ApiAuthentication';

// Types
import { RequestOptionsWrapper } from 'src/Modules';
import { Card } from 'src/Modules/Methods/Cards';
interface Parameters extends RequestOptionsWrapper
{
	name?: string;
	desc?: string;
	idList: string;
};
interface ApiParameters
{
	name?: string;
	desc?: string;
	idList: string;
};
interface Result extends Card {};

export async function add(this: Resource, {name, desc, idList, options}: Parameters)
{
	const body: ApiParameters =
	{
		name,
		desc,
		idList
	};
	const result = await this._client.scheduleApiRequest <Result>
	(
		{
			request:
			{
				method: 'POST',
				path: applyApiAuthentication({path: '/cards', client: this._client}),
				body,
				jsonResponseSuccess: true,
				jsonResponseError: true
			},
			options
		}
	);
	if (result.json === undefined) throw new Error('JSON undefined');
	const { json: card } = result;
	return card;
};