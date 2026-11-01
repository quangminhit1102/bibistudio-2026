import {it,expect} from 'vitest';
import {render,screen} from '@testing-library/react';
import {RecordForm} from '../../src/features/admin/shared/forms/record-form';
it('Vietnamese midnight displays the selected calendar day rather than UTC previous day',()=>{render(<RecordForm fields={[{key:'publishAt',label:'Ngày',type:'date'}]} initial={{publishAt:'2026-10-31T17:00:00.000Z'}} onCancel={()=>{}} onSave={()=>{}}/>);expect(screen.getByLabelText('Ngày')).toHaveValue('2026-11-01');});
