'use strict';

// Internal Modules
import { Resource } from 'src/Modules/Resource';
import { applyApiAuthentication } from 'src/Modules/ApiAuthentication';

// Types
import { RequestOptionsWrapper } from 'src/Modules';
import { Label } from 'src/Modules/Methods/Cards/Labels';
interface Parameters extends RequestOptionsWrapper
{
	cardId: string;
	name: string;
	color: ApiParameters['color'];
};
interface ApiParameters
{
	name?: string;
	color: 'yellow' | 'purple' | 'blue' | 'red' | 'green' | 'orange' | 'black' | 'sky' | 'pink' | 'lime' | null;
};
interface Result extends Label {};

export async function add(this: Resource, {cardId, name, color, options}: Parameters)
{
	const body: ApiParameters =
	{
		name,
		color
	};
	const result = await this._client.scheduleApiRequest <Result>
	(
		{
			request:
			{
				method: 'POST',
				path: applyApiAuthentication({path: '/cards/' + cardId + '/labels', client: this._client}),
				body,
				jsonResponseSuccess: true,
				jsonResponseError: true
			},
			options
		}
	);
	if (result.json === undefined) throw new Error('JSON undefined');
	const { json: label } = result;
	return label;
};