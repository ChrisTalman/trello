'use strict';

// External Modules
import { Domain, Definition as RequestDefinition, Result as RequestResult, RequestJsonError } from '@chris-talman/request';
import { delay, PromiseController } from '@chris-talman/isomorphic-utilities';

// Internal Modules
import { RateLimitError, QueueTimeoutError } from './Errors';
import { ApiError } from './ApiError';
import { throwRejectionApiError } from 'src/Modules/ApiError';
import { Cards } from './Methods/Cards';

// Types
import { RequestOptions } from 'src/Modules';
interface RateLimit
{
	limit: number;
	remaining: number;
	reset: number;
};
type RateLimitVariant = RateLimit | undefined;
interface Queue extends Array<ScheduledRequest<any>> {};

// Constants
const DEFAULT_RATE_LIMIT = 100;
const MINUTE_MILLISECONDS = 1000 * 10;

export class Client
{
	public readonly key: string;
	public readonly token: string;
	public readonly domain: Domain;
	private readonly queue: Queue = [];
	private rateLimit: RateLimitVariant;
	/**
		Callback invoked before every request to validate that the rate limit has not been exceeded.
		If returns `true`, request will proceed.
		If returns `false`, request will not proceed, and `RateLimitError` will throw, unless `options.useQueue` is enabled.
	*/
	public validateRateLimit?: (rateLimit: RateLimitVariant) => Promise<boolean>;
	private rateLimitResetTimeout?: RateLimitResetTimeout;
	private queueItemTimeoutMilliseconds = 180000;
	constructor
	(
		{ key, token, queueItemTimeoutMilliseconds }:
		{ key: Client['key'], token: Client['token'], queueItemTimeoutMilliseconds?: number }
	)
	{
		this.key = key;
		this.token = token;
		const url = 'https://api.trello.com/1';
		this.domain = new Domain
		(
			{
				path: url
			}
		);
		if (typeof queueItemTimeoutMilliseconds === 'number') this.queueItemTimeoutMilliseconds = queueItemTimeoutMilliseconds;
	};
	public async scheduleApiRequest <GenericResultJson> ({request, options = {}}: {request: RequestDefinition, options?: RequestOptions})
	{
		const scheduledRequest = new ScheduledRequest <GenericResultJson> ({request, options, client: this});
		const result = await scheduledRequest.promiseController.promise;
		return result;
	};
	public async executeApiRequest <GenericResultJson, GenericResult extends RequestResult<GenericResultJson>> ({request}: {request: RequestDefinition})
	{
		let result: GenericResult;
		try
		{
			result = await throwRejectionApiError(this.domain.request(request));
		}
		catch (error)
		{
			if (error instanceof RequestJsonError)
			{
				this.recordRateLimit(error.response);
			}
			else if (error instanceof ApiError)
			{
				this.recordRateLimit(error.error.response);
			};
			throw error;
		};
		this.recordRateLimit(result.response);
		return result;
	};
	private recordRateLimit(response: RequestResult<any>['response'])
	{
		const { headers } = response;
		const rawLimit = headers.get('x-rate-limit-api-token-max');
		const rawRemaining = headers.get('x-rate-limit-api-token-remaining');
		const rawInterval = headers.get('x-rate-limit-api-token-interval-ms');
		const rawDate = headers.get('date');
		if (rawLimit === null || rawRemaining === null || rawInterval === null || rawDate === null)
		{
			throw new RateLimitHeadersNotFoundError({response});
		};
		const limit = parseInt(rawLimit);
		const remaining = parseInt(rawRemaining);
		const reset = (new Date(rawDate)).valueOf() + parseInt(rawInterval);
		const rateLimit: RateLimit =
		{
			limit,
			remaining,
			reset
		};
		this.rateLimit = rateLimit;
	};
	public async consumeRateLimit <GenericScheduledRequest extends ScheduledRequest<any>> (scheduledRequest: GenericScheduledRequest)
	{
		if (this.validateRateLimit)
		{
			const valid = await this.validateRateLimit(this.rateLimit);
			if (!valid)
			{
				if (!scheduledRequest.options.useQueue)
				{
					throw new RateLimitError();
				};
			};
		};
		if (this.rateLimit === undefined || this.rateLimit.remaining > 0 || Date.now() >= this.rateLimit.reset)
		{
			if (this.rateLimit !== undefined && Date.now() >= this.rateLimit.reset)
			{
				this.rateLimit.reset = Date.now() + MINUTE_MILLISECONDS;
				this.rateLimit.remaining = this.rateLimit.limit;
			};
			this.recordRateLimitConsumed();
			return true;
		};
		if (!scheduledRequest.options.useQueue)
		{
			throw new RateLimitError();
		};
		this.guaranteeQueueItem(scheduledRequest);
		this.timeoutQueueItem(scheduledRequest);
		this.guaranteeRateLimitResetTimeout();
		return false;
	};
	private async timeoutQueueItem <GenericScheduledRequest extends ScheduledRequest<any>> (item: GenericScheduledRequest)
	{
		await delay(this.queueItemTimeoutMilliseconds);
		const timeoutError = new QueueTimeoutError();
		item.promiseController.reject(timeoutError);
	};
	private guaranteeRateLimitResetTimeout()
	{
		if ((this.rateLimitResetTimeout && !this.rateLimitResetTimeout.complete) || this.queue.length === 0) return;
		const delay = this.generateRateLimitResetDelay();
		this.rateLimitResetTimeout = new RateLimitResetTimeout({callback: () => this.processQueue(), delay});
	};
	private generateRateLimitResetDelay()
	{
		if (this.rateLimit === undefined) throw new Error('Rate limit undefined');
		let delay = this.rateLimit.reset - Date.now();
		if (delay < 0)
		{
			delay = 0;
		};
		return delay;
	};
	private processQueue()
	{
		if (this.rateLimit === undefined) throw new Error('Rate limit undefined');
		const processable = this.queue.slice(0, this.rateLimit.limit);
		for (let item of processable)
		{
			item.execute();
		};
		this.guaranteeRateLimitResetTimeout();
	};
	private recordRateLimitConsumed()
	{
		if (this.rateLimit === undefined)
		{
			this.rateLimit =
			{
				limit: DEFAULT_RATE_LIMIT,
				remaining: DEFAULT_RATE_LIMIT,
				reset: Date.now() + MINUTE_MILLISECONDS
			};
		};
		this.rateLimit.remaining -= 1;
	};
	public guaranteeQueueItem <GenericScheduledRequest extends ScheduledRequest<any>> (item: GenericScheduledRequest)
	{
		const queueItem = this.queue.find(currentItem => currentItem === item);
		if (queueItem) return;
		this.queue.push(item);
	};
	public removeQueueItem <GenericScheduledRequest extends ScheduledRequest<any>> (item: GenericScheduledRequest)
	{
		const queueItemIndex = this.queue.findIndex(currentItem => currentItem === item);
		if (queueItemIndex === -1) return;
		this.queue.splice(queueItemIndex, 1);
	};
	public cards = new Cards({client: this});
};

export class ScheduledRequest <GenericResultJson, GenericResult extends RequestResult<GenericResultJson> = RequestResult<GenericResultJson>>
{
	public readonly client: Client;
	public readonly request: RequestDefinition;
	public readonly options: RequestOptions;
	public readonly promiseController: PromiseController <RequestResult<GenericResultJson>>;
	private executing = false;
	private executed = false;
	constructor({request, options, client}: {request: RequestDefinition, options: RequestOptions, client: Client})
	{
		this.request = request;
		this.options = options;
		this.client = client;
		this.promiseController = new PromiseController();
		this.execute();
	};
	public async execute()
	{
		if (this.executing || this.executed) return;
		this.executing = true;
		let rateLimitConsumed = false;
		try
		{
			rateLimitConsumed = await this.client.consumeRateLimit(this);
		}
		catch (error)
		{
			this.reject(error);
		};
		if (!rateLimitConsumed)
		{
			this.executing = false;
			return;
		};
		const { request } = this;
		let result: GenericResult;
		try
		{
			result = await this.client.executeApiRequest({request});
		}
		catch (error)
		{
			if (error instanceof ApiError && (error.type === 'API_TOKEN_LIMIT_EXCEEDED' || error.type === 'API_KEY_LIMIT_EXCEEDED'))
			{
				this.executing = false;
				this.client.guaranteeQueueItem(this);
			}
			else
			{
				this.reject(error);
			};
			return;
		};
		this.client.removeQueueItem(this);
		this.promiseController.resolve(result);
		this.markExecuted();
	};
	private reject(error: any)
	{
		this.client.removeQueueItem(this);
		this.promiseController.reject(error);
		this.markExecuted();
	};
	private markExecuted()
	{
		this.executed = true;
		this.executing = false;
	};
};

export class RateLimitResetTimeout
{
	public readonly timeout: NodeJS.Timeout;
	public readonly callback: () => void;
	private _complete: boolean;
	constructor({callback, delay}: {callback: () => void, delay: number})
	{
		this._complete = false;
		this.callback = callback;
		this.timeout = setTimeout(() => this.handleComplete(), delay);
	};
	get complete()
	{
		return this._complete;
	};
	private handleComplete()
	{
		this._complete = true;
		this.callback();
	};
};

export class RateLimitHeadersNotFoundError extends Error
{
	public readonly response: RequestResult<any>['response'];
	constructor({response}: {response: RequestResult<any>['response']})
	{
		const message = 'Rate limit headers not found';
		super(message);
		this.response = response;
	};
};