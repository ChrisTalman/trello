// External Modules
import { Uniform } from '@ChrisTalman/types-helpers';
import { Domain, RequestJsonError } from '@chris-talman/request';

declare module '@chris-talman/trello'
{
	// Client
	export class Client
	{
		public readonly key: string;
		public readonly token: string;
		public readonly domain: Domain;
		/**
			Callback invoked before every request to validate that the rate limit has not been exceeded.
			If returns `true`, request will proceed.
			If returns `false`, request will not proceed, and `RateLimitError` will throw, unless `options.useQueue` is enabled.
		*/
		public validateRateLimit?: (rateLimit: RateLimitVariant) => Promise<boolean>;
		constructor
		(
			{ key, token, queueItemTimeoutMilliseconds }:
			{ key: Client['key'], token: Client['token'], queueItemTimeoutMilliseconds?: number }
		);
		public readonly cards: Cards;
	}
	interface RateLimit
	{
		limit: number;
		remaining: number;
		reset: number;
	}
	type RateLimitVariant = RateLimit | undefined;
	// Resource
	class Resource
	{
		public readonly _client: Client;
		constructor({client}: {client: Client});
	}
	// Redirect Flows
	export class Cards extends Resource
	{
		public add(parameters: CardsAddParameters): Promise<Card>;
		public readonly labels: Labels;
	}
	export interface Card
	{
		id: string;
	}
	export interface CardsAddParameters extends RequestOptionsWrapper
	{
		name?: string;
		desc?: string;
		idList: string;
	}
	// Redirect Flows: Create
	export class Labels extends Resource
	{
		public add(parameters: CardsLabelsAddParameters): Promise<Label>;
	}
	export interface Label
	{
		id: string;
	}
	export interface CardsLabelsAddParameters extends RequestOptionsWrapper
	{
		cardId: string;
		name?: string;
		color: 'yellow' | 'purple' | 'blue' | 'red' | 'green' | 'orange' | 'black' | 'sky' | 'pink' | 'lime' | null;
	}
	// Request Options
	export interface RequestOptionsWrapper
	{
		options?: RequestOptions;
	}
	export interface RequestOptions
	{
		useQueue?: boolean;
	}
	// API Error
	export class ApiError extends Error
	{
		public readonly error: RequestJsonError <ApiErrorPayload>;
		public readonly type: ApiErrorPayload['error'];
		public readonly message: string;
		constructor({error}: {error: RequestJsonError <ApiErrorPayload>});
	}
	interface ApiErrorPayload
	{
		error: 'API_TOKEN_LIMIT_EXCEEDED' | 'API_KEY_LIMIT_EXCEEDED';
		message: string;
	}
}