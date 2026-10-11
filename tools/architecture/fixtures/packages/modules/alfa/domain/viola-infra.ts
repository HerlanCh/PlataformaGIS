import { readFileSync } from 'node:fs';
import { guardar } from '../adapters/repo.ts';

export const mal = (): unknown => [readFileSync, guardar];
