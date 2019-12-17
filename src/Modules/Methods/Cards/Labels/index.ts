'use strict';

// Internal Modules
import { Resource } from 'src/Modules/Resource';
import { add } from './Add';

// Types
export interface Label
{
	id: string;
};

export class Labels extends Resource
{
	public add = add;
};