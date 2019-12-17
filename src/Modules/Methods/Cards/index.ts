'use strict';

// Internal Modules
import { Client } from 'src/Modules/Client';
import { Resource } from 'src/Modules/Resource';
import { add } from './Add';
import { Labels } from './Labels';

// Types
export interface Card
{
	id: string;
};

export class Cards extends Resource
{
	public add = add;
	public readonly labels: Labels;
	constructor({client}: {client: Client})
	{
		super({client});
		this.labels = new Labels({client});
	};
};