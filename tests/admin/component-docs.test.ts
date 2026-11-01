import {it,expect} from 'vitest';
import {componentCatalogue} from '../../src/features/admin/components/catalogue';
import {componentUsage} from '../../src/features/admin/components/usage';
it('every component documents the actual control rather than its showcase wrapper',()=>{for(const [category,names] of Object.entries(componentCatalogue))for(const name of names){const code=componentUsage(category,name);expect(code.length,name).toBeGreaterThan(35);expect(code,name).not.toMatch(/<(?:Form|Navigation|Overlay|Feedback|Data|Action)Example/);}});
